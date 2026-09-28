# ClientFlow

[English](README.md) | [Español](README.es.md)

ClientFlow es el proyecto final desarrollado para 4Geeks Academy por un equipo de cuatro desarrolladores Full Stack.

Es una plataforma CRM multilingüe y de operaciones con clientes impulsada por inteligencia artificial, diseñada para centralizar la gestión de clientes, conversaciones, citas, trabajos y automatizaciones inteligentes.

## Características principales

- Gestión de clientes potenciales y clientes
- Gestión de citas y seguimiento de trabajos
- Bandeja de conversaciones y adaptadores de canales
- Orquestación de agentes de IA
- Sistema de conocimiento basado en RAG
- Memoria de conversaciones
- Roles y permisos de usuario
- Autenticación y recuperación de contraseña
- Interfaz multilingüe: inglés y español

## Tecnologías utilizadas

### Frontend

- React
- JavaScript
- Integración con API REST

### Backend

- Python
- Flask
- SQLAlchemy
- PostgreSQL

### Autenticación

- JWT
- Hashing de contraseñas
- Flujo de restablecimiento de contraseña

### IA e integraciones

- API de modelos de lenguaje (LLM)
- RAG
- Embeddings vectoriales
- Las integraciones externas de canales requieren configurar un proveedor

## Estado del proyecto

🚧 En desarrollo

## Equipo

- Carlos Alberto — Desarrollador Full Stack / Líder técnico
- Eudald — Desarrollador Full Stack
- Jesus — Desarrollador Full Stack
- Marian Mircea — Desarrollador Full Stack

## Estructura del proyecto

`src/front` contiene la interfaz React, `src/api` la API Flask y `tests` las pruebas automatizadas. La documentación técnica y las fuentes de arquitectura están enlazadas más abajo.

## Desarrollo local

### Requisitos

- Python 3.13 y Pipenv.
- Node.js 20 o posterior y npm.
- Git.
- Una base de datos configurada. El despliegue compartido utiliza PostgreSQL;
  algunos entornos locales y pruebas automatizadas utilizan SQLite.

### Instalar dependencias

Ejecuta estos comandos desde la raíz del repositorio:

```bash
pipenv sync
npm ci
```

Estos comandos instalan las versiones registradas en `Pipfile.lock` y
`package-lock.json`. No crean la base de datos ni inician la aplicación.

### Servidores de desarrollo

Después de configurar el entorno y preparar la base de datos, utiliza dos terminales.

Backend:

```bash
pipenv run start
```

Frontend:

```bash
npm run start
```

El frontend utiliza el puerto 3000 y el backend utiliza el puerto 3001.
Vite incluye un proxy `/api` cuyo destino predeterminado es
`http://127.0.0.1:3001`.
`BACKEND_PROXY_TARGET` permite cambiar ese destino interno.

En Codespaces, abre la dirección del frontend correspondiente al puerto 3000
en la pestaña Ports.
Una petición del navegador a `localhost` apunta al ordenador del usuario,
no al Codespace remoto.

### Configuración del entorno

Si `.env` no existe, copia `.env.example` a `.env`.
Conserva cualquier configuración existente y nunca subas credenciales reales.

Configura estos valores:

| Variable            | Función                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | URL de conexión de tu propia base de datos. La URL PostgreSQL de ejemplo debe adaptarse a tu entorno. |
| `FLASK_APP`         | Establece `src/app.py`.                                                                               |
| `FLASK_DEBUG`       | Utiliza `1` localmente y `0` en producción.                                                           |
| `JWT_SECRET_KEY`    | Un secreto privado y aleatorio para firmar tokens.                                                    |
| `VITE_USE_MOCK_API` | Establece `false` para utilizar el backend.                                                           |
| `VITE_BACKEND_URL`  | Dirección base de la API, sin `/api` ni `/api/login`.                                                 |
| `FRONTEND_ORIGIN`   | Origen exacto del frontend autorizado por el backend.                                                 |
| `AUTH_RESET_URL`    | Dirección de la página de recuperación de contraseña.                                                 |
| `ENABLE_DEV_ADMIN`  | Mantén `0` salvo que habilites expresamente el administrador local de desarrollo.                     |

Genera un secreto JWT localmente:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Guarda el resultado únicamente en tu configuración privada del entorno.

En desarrollo local, `VITE_BACKEND_URL` puede ser `http://localhost:3001`.
Cuando frontend y backend comparten el mismo origen, se puede omitir o dejar
vacío; las peticiones utilizan direcciones relativas `/api`. En Codespaces,
Vite redirige estas peticiones al backend dentro del Codespace.

Al utilizar el proxy del mismo origen, no es necesario hacer público el puerto
del backend. Reinicia los servidores después de modificar `.env`.

### Preparación de la base de datos

Para una base nueva y vacía, configura `DATABASE_URL` y `JWT_SECRET_KEY` y ejecuta:

```bash
pipenv run flask db upgrade
pipenv run flask seed-plans
```

La revisión `6bb753c896ae` crea el esquema actual. Los roles son valores enum
de las membresías, no un catálogo independiente que necesite registros seed.
Los planes se crean por separado; el seed protegido del navegador sigue disponible.

En una base desechable, `pipenv run flask db downgrade base` elimina el esquema
y sus datos; `pipenv run flask db upgrade` lo vuelve a crear. No ejecutes esa
reversión sobre una base cuyos datos deban conservarse.

### Bases de datos existentes

Antes de actualizar una base que contiene datos:

1. Crea una copia de seguridad y verifica su restauración en otra base.
2. Revisa el esquema y la revisión Alembic registrada en la copia restaurada.
3. Compara el esquema con los modelos actuales y revisa los cambios necesarios.
4. Prueba la actualización en esa copia y comprueba que conserva los registros.
5. Aplica el procedimiento revisado a la base compartida solo tras validarlo.

No ejecutes la migración inicial sobre tablas existentes. No uses
`flask db stamp` para ocultar diferencias: solo registra una revisión, sin
actualizar el esquema. Las bases creadas mediante bootstrap o migraciones
antiguas necesitan reconciliación individual; este ticket no ofrece una
conversión automática de bases antiguas. El PR #42 cerrado no forma parte
de la cadena actual de migraciones.

### Validación de migraciones PostgreSQL

La validación local en PostgreSQL 16 superó creación, comparación del esquema,
seed sin duplicados, reversión y recreación. La prueba de ciclo repite creación,
seed y reversión dos veces en una nueva base desechable.

Prepara una base PostgreSQL dedicada llamada `clientflow_db43`. Su usuario de
pruebas debe tener permiso para crear bases. Configura en el terminal
`MIGRATION_TEST_DATABASE_URL` con su URL; no uses credenciales de producción.
Para la configuración local mediante socket utilizada durante el desarrollo,
en el mismo terminal:

```bash
export MIGRATION_TEST_DATABASE_URL="${PG43_URL:?Set PG43_URL to the dedicated test database URL}"
```

Desde la raíz del proyecto, con `FLASK_APP=src/app.py` y una
`JWT_SECRET_KEY` de pruebas válida configuradas, ejecuta:

```bash
PIPENV_DONT_LOAD_ENV=1 DATABASE_URL="${MIGRATION_TEST_DATABASE_URL:?Set the test database URL}" pipenv run flask db upgrade
PIPENV_DONT_LOAD_ENV=1 DATABASE_URL="${MIGRATION_TEST_DATABASE_URL:?Set the test database URL}" pipenv run flask db check
PIPENV_DONT_LOAD_ENV=1 MIGRATION_TEST_DATABASE_URL="${MIGRATION_TEST_DATABASE_URL:?Set the test database URL}" PYTHONPATH=src:tests pipenv run python -m unittest test_postgres_migrations test_postgres_migration_cycle -v
```

`PIPENV_DONT_LOAD_ENV=1` evita que Pipenv sustituya la URL de pruebas por la
URL del archivo `.env`. La prueba del esquema consulta la base preparada.
La prueba de ciclo crea y elimina únicamente su propia base con nombre único.
Sin `MIGRATION_TEST_DATABASE_URL`, las dos pruebas PostgreSQL se omiten.

GitHub Actions está configurado para ejecutar estas comprobaciones con un
servicio PostgreSQL 16 temporal dentro de **Backend tests**, que es obligatorio.
Confirma que esa comprobación pasa en el PR antes de fusionarlo; el resultado
local no demuestra que la ejecución en GitHub haya terminado correctamente.

### Bootstrap alternativo para demostración local

El siguiente bootstrap es una alternativa para cuentas de demostración locales,
no un paso posterior a `db upgrade`:

Solo para una base local nueva, vacía y desechable:

1. Configura `DATABASE_URL` para esa base.
2. Establece localmente `FLASK_DEBUG=1` y `AUTH_ALLOW_LOCAL_BOOTSTRAP=1`.
3. Configura `JWT_SECRET_KEY` y crea la carpeta de SQLite si es necesario.
4. Ejecuta:

```bash
pipenv run flask auth-local-bootstrap
```

Sigue las instrucciones para crear la cuenta propietaria local.
El comando rechaza bases que ya contienen tablas.
Crea las tablas de los modelos actuales y los registros iniciales de demostración;
no migra una base existente.

No borres una base existente para evitar esta comprobación.
Haz una copia de seguridad y coordina los cambios de esquema con el equipo.

Crea los planes que faltan con `pipenv run flask seed-plans` o utiliza el
formulario protegido `/api/seed-plans`, descrito abajo, si no hay terminal.
Ninguna de las dos opciones recupera datos de clientes eliminados.

Consulta la [configuración de autenticación](docs/auth/README.md)
para conocer los detalles de la preparación local.
El despliegue PostgreSQL compartido debe utilizar la cadena de migraciones versionada y validarla en el entorno de destino antes de publicar.

### Configuración opcional de IA

Las funciones de IA necesitan acceso a los servicios de embeddings y respuestas.
La dirección privada de ejemplo no es un endpoint público.
Si se utiliza el Mac Mini mediante Tailscale, la máquina que ejecuta el backend
debe tener acceso autorizado a esa red. Esto también se aplica a Codespaces.

Configura estas variables únicamente en el backend:

- `KNOWLEDGE_EMBEDDINGS_URL`, `KNOWLEDGE_EMBEDDINGS_API_KEY`,
  `KNOWLEDGE_EMBEDDINGS_MODEL` y `KNOWLEDGE_EMBEDDINGS_DIMENSIONS`.
- `AI_SERVICE_URL` y `AI_SERVICE_MODEL`.
- Para el modo de autenticación predeterminado `company`, utiliza
  `AI_SERVICE_COMPANY_KEYS` para asociar los IDs de empresa de ClientFlow
  con sus credenciales del servicio. Para una sola empresa, utiliza
  `AI_SERVICE_COMPANY_ID` junto con `AI_SERVICE_API_KEY`.

Establece explícitamente `AI_SERVICE_AUTH_MODE=platform_stateless` para seleccionar este modo.
El modo `platform_stateless` utiliza `AI_SERVICE_PLATFORM_KEY` y requiere
un servicio de inferencia verificado que no conserve estado.
ClientFlow debe seguir comprobando la autorización y seleccionando únicamente
el contexto autorizado de esa empresa. No habilites este modo con un servicio
que conserve un historial compartido de conversaciones.

La configuración de embeddings de ejemplo utiliza `embeddinggemma`
con 768 dimensiones. El modelo y las dimensiones deben coincidir con
el servicio y los vectores almacenados.

Para preparar una demostración de IA:

1. Sube y procesa correctamente un documento de la empresa seleccionada.
2. Crea un agente y vincula sus documentos autorizados.
3. Asigna el agente a una conversación.
4. Genera un borrador, revisa sus fuentes y apruébalo o recházalo.

La falta de configuración o los fallos del servicio pueden requerir atención humana.
Que el CRM funcione no confirma que el servicio de IA esté accesible.
Nunca coloques credenciales del servicio en variables del frontend.

Consulta [procesamiento de conocimiento](docs/knowledge.md) y
[orquestación de IA](docs/ai-32.md) para conocer la configuración y sus límites.

## API y arquitectura

| Método y ruta                                | Función                          |
| -------------------------------------------- | -------------------------------- |
| `GET /api/plans`                             | Consultar planes activos.        |
| `POST /api/register`                         | Registrar cuenta y empresa.      |
| `POST /api/login`                            | Obtener un token.                |
| `GET /api/me`                                | Consultar empresas del usuario.  |
| `GET /api/auth/context`                      | Validar acceso a la empresa.     |
| `GET /api/clients`                           | Listar clientes.                 |
| `POST /api/clients`                          | Crear un cliente.                |
| `GET /api/leads`                             | Listar leads.                    |
| `POST /api/leads`                            | Crear un lead.                   |
| `POST /api/leads/<id>/convert`               | Convertir lead en cliente.       |
| `GET /api/conversations`                     | Listar conversaciones.           |
| `GET /api/conversations/<id>/messages`       | Consultar mensajes.              |
| `POST /api/conversations/<id>/messages`      | Enviar mensaje desde la bandeja. |
| `GET /api/knowledge/documents`               | Listar documentos.               |
| `POST /api/knowledge/documents`              | Subir un documento.              |
| `POST /api/knowledge/documents/<id>/process` | Procesar un documento.           |

Las rutas protegidas de empresa requieren `Authorization: Bearer <token>` y `X-Company-ID: <id>`. El servidor valida la pertenencia; los permisos adicionales dependen de la acción.

- [System architecture / Arquitectura](docs/architecture/system-architecture.md)
- [Database model / Modelo de datos (DBML)](docs/architecture/database.dbml)
- [MVP scope / Alcance](docs/architecture/mvp-scope.md)
- [Authentication / Autenticación](docs/auth/README.md)
- [Registration / Registro](docs/onboarding/README.md)
- [Members / Miembros](docs/members.md)
- [Appointments / Agenda](docs/agenda/README.md)
- [Conversations / Conversaciones](docs/inbox.md)
- [Channels / Canales](docs/channels-30.md)
- [Knowledge / Conocimiento](docs/knowledge.md)
- [AI / IA](docs/ai-32.md)

## Guion de demostración

Utiliza una empresa ficticia y ensaya el flujo completo en el entorno que se presentará.
Una sola persona comparte pantalla; los tres bloques se reparten entre los ponentes.

1. **Acceso y producto:** presentar el problema, el equipo y las tecnologías; mostrar los planes, entrar con la cuenta de demostración y explicar la empresa seleccionada.
2. **Gestión del cliente:** crear un lead ficticio, convertirlo en cliente, abrir su ficha y mostrar una cita previamente verificada. Mostrar trabajos solo si el flujo funciona con datos reales del backend en esa versión.
3. **Atención asistida:** mostrar el documento procesado y el agente; abrir una conversación web, recibir «Hola, quiero cambiar mi vestidor», generar un borrador, revisar sus fuentes, aprobarlo y comprobar la recepción. Continuar con una segunda pregunta para mostrar el contexto.

Antes del ensayo, comprueba la suscripción activa, los permisos, los documentos procesados y la conexión del backend con la IA. Comprueba también el acceso web del participante; no uses la cuenta administrativa como sustituto de esa sesión.
Si la IA falla, demuestra la atención manual y explica la limitación; no presentes una respuesta preparada como una generación en directo.

### Cuenta de demostración

No hay una contraseña compartida publicada en el repositorio. Crea una cuenta ficticia mediante el registro o el bootstrap local documentado arriba. Este último solicita una contraseña de 12–128 caracteres y crea una prueba de tres días.
Comparte las credenciales con el equipo y el profesor por un canal privado. Verifica su acceso antes del ensayo; una prueba caducada bloquea los módulos protegidos. No publiques tokens ni contraseñas en diapositivas.

## Verificación y límites conocidos

Desde la raíz del repositorio:

```bash
AUTH_TEST_DATABASE_URL=sqlite:// PYTHONPATH=src:tests pipenv run python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/frontend/calendar.test.mjs
npm run build
```

- Las pruebas de migraciones en PostgreSQL 16 pasaron localmente. Las bases existentes requieren copia de seguridad, reconciliación del esquema y pruebas en una copia restaurada; esto no certifica un despliegue de producción.
- El registro admite una simulación de pago: no procesa cobros reales. Consulta el contrato de registro enlazado arriba.
- Los adaptadores de canales no demuestran una integración externa activa. No anuncies WhatsApp o correo como operativos sin probar sus proveedores y credenciales.
- La IA necesita servicios externos accesibles y revisión humana de los borradores. El acceso del Mac no garantiza el acceso desde Codespaces.
- Verifica los módulos de trabajos, dashboard y ajustes en la versión que se vaya a presentar; excluye del recorrido funciones pendientes o simuladas.
- Las comprobaciones automáticas y los cambios de seguridad están integrados en esta rama. Comprueba por separado la revisión desplegada; un merge no confirma el despliegue.
- Antes de producción deben revisarse secretos, HTTPS, recuperación por correo, copias de seguridad y conservación de datos. Esta guía no certifica esos servicios.

## Licencia

Este proyecto fue desarrollado con fines educativos como parte del programa de Desarrollo Full Stack de 4Geeks Academy.

## Preparación de la base de datos y seguridad

Después de recrear las tablas mediante las migraciones, recupera los planes predeterminados:

```bash
pipenv run flask seed-plans
```

Este comando crea los planes que faltan sin modificar los existentes ni sus precios.
No recupera cuentas, clientes ni conversaciones eliminadas; para eso se necesita
una copia de seguridad. La página `/api/seed-plans` permite la preparación protegida desde el navegador, descrita abajo.
Los clientes pueden seguir consultando los planes activos mediante `/api/plans`.

### Medidas operativas

- Guarda las credenciales en variables de entorno del backend. Nunca incluyas
  secretos en variables `VITE_*`, código, capturas de pantalla ni registros.
- Renueva las credenciales que se hayan compartido o expuesto.
- Mantén las copias de seguridad y las claves privadas fuera del repositorio.
- Desactiva el modo debug en producción y configura el origen permitido del frontend.
- Los avatares se generan localmente sin enviar nombres a un servicio externo.

### Datos personales

Utiliza datos ficticios en las demostraciones. Antes de utilizar datos reales,
define el aviso de privacidad, los requisitos de consentimiento aplicables,
los plazos de conservación y los procedimientos de acceso y eliminación,
incluidas las copias de seguridad.

Este cambio no implementa la conservación ni la eliminación automática de datos.
Revisa por separado los controles de acceso, los registros y la conservación
del servicio de IA antes de enviar información real de clientes.

### Verificación

La revisión incluye pruebas automatizadas de autenticación, aislamiento entre
empresas, permisos de miembros, archivos subidos y creación de planes.
Las pruebas cubren los escenarios comprobados y no sustituyen una revisión
del despliegue en producción.

## Preparar planes desde el navegador

En una plataforma sin terminal, abre `/api/seed-plans` en el dominio del backend.
GET solo muestra el formulario. Para permitir la creación, configura `PLAN_SEED_KEY`
en las variables de la plataforma con un secreto aleatorio de 32–512 caracteres.
Genéralo en tu ordenador con `python3 -c "import secrets; print(secrets.token_hex(32))"`.
Introdúcelo en el campo de contraseña y pulsa **Create plans**. El formulario envía
POST; no incluyas la clave en la URL. Utiliza HTTPS fuera del desarrollo local.
Las tablas deben existir previamente. Se crean los planes que faltan y se conservan
los precios existentes. No recupera cuentas ni datos de clientes eliminados.
Elimina `PLAN_SEED_KEY` después para deshabilitar la escritura desde el navegador.
El comando `pipenv run flask seed-plans` sigue disponible de forma independiente.

## Despliegue de staging

El entorno compartido de staging está disponible en:

- https://clientflow-staging.onrender.com

Render crea el servicio web de Flask y React junto con una base PostgreSQL 16
mediante `render.yaml`. La compilación utiliza Python 3.13, Pipenv y Node.js 22.
Las migraciones se ejecutan automáticamente antes de iniciar Gunicorn, y el
frontend se comunica con la API mediante el mismo origen público.

La configuración pública del despliegue está en `render.yaml`. Los valores
privados, como `JWT_SECRET_KEY` y `PLAN_SEED_KEY`, deben permanecer en las
variables de entorno de Render y nunca deben guardarse en el repositorio.

Para una base de staging nueva y vacía, abre `/api/seed-plans` e introduce la
clave privada `PLAN_SEED_KEY`. Comprueba el catálogo resultante en `/api/plans`.

La prueba rápida de staging debe verificar:

1. `/api/health` devuelve una respuesta correcta.
2. Los tres planes del catálogo están disponibles.
3. Se puede registrar una cuenta nueva e iniciar sesión.
4. Se puede crear y editar un lead y convertirlo en cliente.
5. La dirección del cliente, el trabajo y la cita permanecen después de actualizar.
6. La bandeja, el conocimiento, la revisión del borrador de IA y el dashboard se abren sin errores JSON ni de red.
7. Cerrar sesión revoca la sesión del servidor y elimina el token del navegador.

El servicio compartido de Render sigue la rama `develop`. Si un servicio existente
todavía muestra `feature/deploy-39-staging`, cambia **Settings → Branch** a
`develop` antes del despliegue final y publica el último commit limpiando la caché
de compilación.

Los controles globales de idioma y tema están disponibles en la aplicación. La
pantalla de ajustes queda fuera del recorrido académico hasta completar el issue
#29. Como la demostración usa el plan gratuito de Render, la primera petición tras
un periodo de inactividad puede tardar alrededor de un minuto mientras el servicio
se reactiva.

### Reversión de staging

Si falla el despliegue final, abre el historial de despliegues del servicio de
Render, selecciona el último despliegue correcto verificado y elige **Rollback**.
No ejecutes comandos destructivos sobre la base de datos. Si el fallo procede de
una migración, restaura una copia de seguridad comprobada o publica una migración
correctiva probada antes de permitir nuevas escrituras.
