# ClientFlow

ClientFlow es el proyecto final desarrollado para 4Geeks Academy por un equipo de cuatro desarrolladores Full Stack.

Es una plataforma CRM multilingüe y de operaciones con clientes impulsada por inteligencia artificial, diseñada para centralizar la gestión de clientes, conversaciones, citas, trabajos y automatizaciones inteligentes.

## Características principales

- Gestión de clientes potenciales y clientes
- Gestión de citas y seguimiento de trabajos
- Conversaciones omnicanal
- Orquestación de agentes de IA
- Sistema de conocimiento basado en RAG
- Memoria de conversaciones
- Asignación automática de clientes potenciales
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
- API de WhatsApp

## Estado del proyecto

🚧 En desarrollo

## Equipo

- Carlos Alberto — Desarrollador Full Stack / Líder técnico
- Eudlad — Desarrollador Full Stack
- Jesus — Desarrollador Full Stack
- Marian Mircea — Desarrollador Full Stack

## Estructura del proyecto

La documentación técnica, los diagramas de arquitectura, los wireframes y la documentación de la API estarán disponibles en el directorio `/docs`.

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
