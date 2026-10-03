# AUTH-API-01 — Autenticación y contexto de empresa

Implementación del ticket #22. Los PRs se integran en `develop` después de revisión.

## Contrato para Eudald y los endpoints de negocio

1. `POST /api/login` con `{"email":"owner@example.com","password":"..."}` devuelve `token`, `token_type`, `expires_in` (1800 segundos) y `user`.
2. Enviar `Authorization: Bearer <token>` a `GET /api/me`. Devuelve el usuario y sus empresas activas: `companies: [{id, name, membership_id, role}]`.
3. Elegir una de esas empresas y enviar `X-Company-ID: <id>` además del JWT. `GET /api/auth/context` permite comprobar el contexto sin implementar todavía endpoints de leads.
4. En las rutas de negocio reutilizar el decorador siguiente. No confiar en `company_id` del cuerpo ni limitarse a comprobar que existe un token.

```python
from flask import g, jsonify
from sqlalchemy import select
from api.auth import tenant_required
from api.models import db, Lead

@api.get('/leads/<int:lead_id>')
@tenant_required
def get_lead(lead_id):
    lead = db.session.scalar(select(Lead).where(
        Lead.id == lead_id,
        Lead.company_id == g.company_id,
    ))
    if lead is None:
        return jsonify(message='Lead no encontrado.'), 404
    # Serializar aquí los campos públicos del contrato de #23.
    return jsonify(id=lead.id, company_id=lead.company_id)
```

El ejemplo es documentación, no implementa #23. El decorador verifica en cada petición que la sesión y el usuario siguen activos y que el usuario pertenece a una empresa activa. Expone `g.user`, `g.company_id` y `g.membership`. No filtra automáticamente las consultas: cada endpoint debe filtrar sus registros y validar que los IDs relacionados pertenecen a esa empresa. La autorización por acciones/roles se completa en #21.

No se elige una empresa automáticamente: un usuario puede pertenecer a varias. Falta de JWT, token inválido/caducado/revocado: 401; cabecera de empresa ausente o mal formada: 400; empresa no autorizada: 403.

## Sesiones y contraseñas

- Contraseñas nuevas: 12–128 caracteres, hash scrypt de Werkzeug. Reutilizar `set_password(user, password)` al crear usuarios en #24/#21; no asignar contraseñas en texto plano.
- `POST /api/logout` con JWT devuelve 204 y revoca esa sesión en el banco. El cliente debe borrar también su token. No hay refresh tokens en este ticket: tras 30 minutos se inicia sesión de nuevo.
- `POST /api/forgot-password` recibe `email`; responde 202 con el mismo mensaje exista o no una cuenta activa. No devuelve tokens. Requiere entrega configurada; si no hay ningún mecanismo devuelve 503 para cualquier email.
- `POST /api/reset-password` recibe `token`, `password` y `password_confirmation`. El token caduca a los 30 minutos y solo se almacena su SHA-256. La confirmación debe coincidir. Cambiar la contraseña consume el token, invalida los demás enlaces del usuario y revoca todas sus sesiones.
- El consumo del token es condicional y atómico. En PostgreSQL, el bloqueo del usuario serializa login y reset concurrentes.
- Límites persistidos en el banco: login y reset, 10 peticiones por 15 minutos; solicitud de recuperación, 5. Se cuentan intentos válidos e inválidos por IP y, cuando hay email válido, también por email. Respuesta 429 con `Retry-After`. Son ventanas fijas, no una garantía contra todos los tipos de abuso.
- No se confía en `X-Forwarded-For`. Antes de un despliegue detrás de proxy debe configurarse el número de proxies confiables; de lo contrario, varios usuarios pueden compartir la cuota de la IP del proxy.
- El resultado público de recuperación es genérico; SMTP es síncrono y el tiempo de respuesta puede variar. La entrega en segundo plano y la supervisión del proveedor quedan como limitaciones de despliegue.

## Configuración y ejecución local

Usar Python 3.13 y las dependencias de `Pipfile`/`Pipfile.lock`. Definir `JWT_SECRET_KEY` aleatorio de al menos 32 caracteres; la API se niega a arrancar si falta. No usar el secreto del ejemplo de los tests.

```sh
pipenv sync
export FLASK_APP=src/app.py
export FLASK_DEBUG=1
export PYTHONPATH=src
export JWT_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export DATABASE_URL="sqlite:///$PWD/.local/auth-demo.db"
export AUTH_ALLOW_LOCAL_BOOTSTRAP=1
export AUTH_RESET_OUTBOX="$PWD/.local/reset-outbox"
mkdir -p .local
pipenv run flask auth-local-bootstrap
pipenv run flask run --port 3001
```

El comando solicita email y contraseña sin imprimir la contraseña, exige modo debug y permiso explícito, y se niega a trabajar si el banco contiene tablas. Crea los modelos y un propietario de prueba en una empresa local. `db.create_all()` es únicamente una ayuda para una base vacía desechable: no actualiza esquemas existentes, no sustituye las migraciones y no debe ejecutarse sobre bases compartidas.

Para PostgreSQL local vacío puede usarse otra `DATABASE_URL` con el mismo procedimiento. No hay que borrar el banco de otro compañero para probar este ticket.

En el frontend configurar `VITE_USE_MOCK_API=false` y `VITE_BACKEND_URL=http://localhost:3001`; iniciar con `npm run dev`. El cadastro público y los planes siguen perteneciendo a #24; para probar login utilizar el propietario creado por el comando anterior.

En modo local, la recuperación guarda un archivo privado en la carpeta ignorada `.local/reset-outbox`. Abrir el enlace de ese archivo para completar el flujo en la interfaz. No subir ni compartir archivos de recuperación. El modo outbox solo se utiliza con debug habilitado.

Para email real configurar `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_FROM` y, si corresponde, `SMTP_USER`/`SMTP_PASSWORD`. Se exige STARTTLS. `AUTH_RESET_URL` es la URL del frontend configurada por el servidor, nunca una URL suministrada por el cliente. Fuera de local debe ser HTTPS. `FRONTEND_ORIGIN` configura CORS para estas rutas. No se ha probado un envío real a un proveedor SMTP en esta entrega.

El administrador genérico del scaffold permitía editar los modelos sin autenticar: ahora solo se habilita explícitamente con `ENABLE_DEV_ADMIN=1` en modo desarrollo. No es la administración de usuarios de #21.

## Migraciones aplazadas — #43

Este ticket no modifica ninguna migración. Añade a los modelos y al DBML:

- `auth_sessions`: id aleatorio, usuario, caducidad y revocación; necesario para logout persistente.
- `auth_rate_limits`: contadores por clave hash, número de intentos y fin de ventana; necesario para límites compartidos entre procesos.

La integración de #43 debe generar/reconciliar estas tablas junto con las migraciones de los demás módulos. Sin estas tablas, los endpoints no funcionan sobre un banco existente. Se reutiliza `password_reset_tokens` del modelo aprobado. Los contadores vencidos se limpian al procesar peticiones; la limpieza periódica de sesiones y tokens históricos debe acordarse antes del despliegue.

## Verificación

```sh
pipenv run python -m unittest discover -s tests -v
npm ci
npm run build
```

Los tests usan por defecto SQLite en memoria y crean/eliminan las tablas. Para repetir sobre PostgreSQL, definir `AUTH_TEST_DATABASE_URL` apuntando EXCLUSIVAMENTE a una base desechable: la suite elimina sus tablas al terminar. No prueba la cadena de migraciones ni acredita su integración.

Resultado desta entrega: 23 testes passaram em Python 3.13.15 com as versões de dependências de `Pipfile.lock`; build Vite passou; a aplicação Flask carregou e registrou as seis rotas de autenticação. A entrega local de recuperação em arquivo foi testada. Não foram executados testes contra PostgreSQL, envio SMTP real nem uma inspeção visual do navegador.
