# ClientFlow

[English](README.md) | [Español](README.es.md)

ClientFlow is the final project developed for 4Geeks Academy by a team of four Full Stack developers.

It is an AI-powered multilingual CRM and customer operations platform designed to centralize client management, conversations, appointments, jobs and intelligent automation.

## Core Features

- Lead and client management
- Appointments and job tracking
- Conversation inbox and channel adapters
- AI agent orchestration
- RAG-based knowledge system
- Conversation memory
- User roles and permissions
- Authentication and password recovery
- Multilingual interface: English and Spanish

## Tech Stack

### Frontend

- React
- JavaScript
- REST API integration

### Backend

- Python
- Flask
- SQLAlchemy
- PostgreSQL

### Authentication

- JWT
- Password hashing
- Password reset flow

### AI & Integrations

- LLM API
- RAG
- Vector embeddings
- External channel integrations require provider configuration

## Project Status

🚧 In development

## Team

- Carlos Alberto — Full Stack Developer / Technical Lead
- Eudald — Full Stack Developer
- Jesus — Full Stack Developer
- Marian Mircea — Full Stack Developer

## Project Structure

The `src/front` directory contains the React interface, `src/api` the Flask API, and `tests` the automated tests. Technical documentation and architecture sources are linked below.

## Local development

### Requirements

- Python 3.13 and Pipenv.
- Node.js 20 or later and npm.
- Git.
- A configured database. Shared deployment uses PostgreSQL;
  some local development and automated tests use SQLite.

### Install dependencies

Run these commands from the repository root:

```bash
pipenv sync
npm ci
```

These commands install the versions recorded in `Pipfile.lock` and
`package-lock.json`. They do not create the database or start the application.

### Development servers

After configuring the environment and preparing the database, use two terminals.

Backend:

```bash
pipenv run start
```

Frontend:

```bash
npm run start
```

The frontend uses port 3000 and the backend uses port 3001.
Vite includes an `/api` proxy targeting `http://127.0.0.1:3001` by default.
`BACKEND_PROXY_TARGET` can override that internal target.

In Codespaces, open the forwarded frontend address for port 3000.
A browser request to `localhost` refers to the user's computer, not the
remote Codespace.

### Environment configuration

If `.env` does not exist, copy `.env.example` to `.env`.
Keep any existing configuration and never commit real credentials.

Configure these values:

| Variable            | Purpose                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Connection URL for your own database. The example PostgreSQL URL must match your environment. |
| `FLASK_APP`         | Set to `src/app.py`.                                                                          |
| `FLASK_DEBUG`       | Use `1` locally and `0` in production.                                                        |
| `JWT_SECRET_KEY`    | A private, randomly generated signing secret.                                                 |
| `VITE_USE_MOCK_API` | Set to `false` to use the backend.                                                            |
| `VITE_BACKEND_URL`  | API server base address, without `/api` or `/api/login`.                                      |
| `FRONTEND_ORIGIN`   | Exact frontend origin allowed by the backend.                                                 |
| `AUTH_RESET_URL`    | Frontend password-reset page address.                                                         |
| `ENABLE_DEV_ADMIN`  | Keep `0` unless explicitly enabling the local development admin.                              |

Generate a JWT signing secret locally:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Store the result only in your private environment configuration.

For local development, `VITE_BACKEND_URL` can be `http://localhost:3001`.
In Codespaces, you can set it to `/`: Vite then proxies `/api` requests
to the backend inside the Codespace. Do not leave it empty: the current
frontend displays a configuration screen when this value is missing.

When using the same-origin proxy, the backend port does not need to be
made public. Restart the development servers after changing `.env`.

### Database preparation

The shared migration chain is pending integration in #43.
The current branch contains migration configuration but no versioned revisions.
Do not assume `flask db upgrade` can create a complete database yet.

For a new, empty, disposable local database only:

1. Configure `DATABASE_URL` for that database.
2. Set `FLASK_DEBUG=1` and `AUTH_ALLOW_LOCAL_BOOTSTRAP=1` locally.
3. Configure `JWT_SECRET_KEY` and create the SQLite parent directory if needed.
4. Run:

```bash
pipenv run flask auth-local-bootstrap
```

Follow the prompts to create the local owner account.
The command refuses databases that already contain tables.
It creates the current model tables and initial demo records;
it does not migrate an existing database.

Do not delete an existing database to bypass this check.
Back up existing data and coordinate schema updates with the team.

Plan seeding is being moved to `pipenv run flask seed-plans` in PR #68.
That command is available only in branches containing that change.
It restores missing catalog plans, not deleted customer records.

See [authentication setup](docs/auth/README.md) for local bootstrap details.
Shared PostgreSQL deployment must use the migration chain validated in #43.

### Optional AI configuration

AI features require reachable embedding and response services.
The example private service address is not a public endpoint.
When using the Mac Mini through Tailscale, the machine running the backend
must have authorized network access to it. This also applies to Codespaces.

Configure these backend-only variables:

- `KNOWLEDGE_EMBEDDINGS_URL`, `KNOWLEDGE_EMBEDDINGS_API_KEY`,
  `KNOWLEDGE_EMBEDDINGS_MODEL` and `KNOWLEDGE_EMBEDDINGS_DIMENSIONS`.
- `AI_SERVICE_URL` and `AI_SERVICE_MODEL`.
- For the default `company` authentication mode, use
  `AI_SERVICE_COMPANY_KEYS` to map ClientFlow company IDs to provisioned
  service credentials. For a single company, use `AI_SERVICE_COMPANY_ID`
  with `AI_SERVICE_API_KEY`.

Set `AI_SERVICE_AUTH_MODE=platform_stateless` explicitly to select this mode.
The `platform_stateless` mode uses `AI_SERVICE_PLATFORM_KEY` and requires
a verified stateless inference service. ClientFlow must continue to enforce
company authorization and select only that company's authorized context.
Do not enable this mode for a service that retains shared conversation state.

The example embedding configuration uses `embeddinggemma` with 768 dimensions.
The configured model and dimensions must match the service and stored vectors.

To prepare an AI demonstration:

1. Upload and successfully process a document for the selected company.
2. Create an agent and link its authorized documents.
3. Assign the agent to a conversation.
4. Generate a draft, review its sources, and approve or reject it.

Missing configuration or service failures may require human attention.
A running CRM does not by itself confirm that the AI service is reachable.
Never place service credentials in frontend variables.

See [knowledge processing](docs/knowledge.md) and
[AI orchestration](docs/ai-32.md) for the detailed configuration and limitations.


## API and architecture

| Method and path | Purpose |
| --- | --- |
| `GET /api/plans` | List active plans. |
| `POST /api/register` | Register an account and company. |
| `POST /api/login` | Obtain an access token. |
| `GET /api/me` | Read user memberships. |
| `GET /api/auth/context` | Validate company access. |
| `GET /api/clients` | List clients. |
| `POST /api/clients` | Create a client. |
| `GET /api/leads` | List leads. |
| `POST /api/leads` | Create a lead. |
| `POST /api/leads/<id>/convert` | Convert a lead into a client. |
| `GET /api/conversations` | List conversations. |
| `GET /api/conversations/<id>/messages` | Read messages. |
| `POST /api/conversations/<id>/messages` | Send an inbox message. |
| `GET /api/knowledge/documents` | List documents. |
| `POST /api/knowledge/documents` | Upload a document. |
| `POST /api/knowledge/documents/<id>/process` | Process a document. |

Protected company routes require `Authorization: Bearer <token>` and `X-Company-ID: <id>`. The server validates membership; additional permissions depend on the action.

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

## Demo walkthrough

Use a fictional company and rehearse the complete flow in the environment being presented.
One person shares the screen; divide the following three blocks among the speakers.

1. **Access and product:** introduce the problem, team and stack; show plans, sign in with the demo account and explain the selected company.
2. **Client operations:** create a fictional lead, convert it into a client, open its details and show a previously verified appointment. Show jobs only if that version's flow works with real backend data.
3. **Assisted support:** show the processed document and agent; open a web conversation, receive “Hi, I want to replace my wardrobe”, generate a draft, review sources, approve it and verify delivery. Continue with a second question to demonstrate context.

Before rehearsal, check the active subscription, permissions, processed documents and backend access to AI. Also verify the participant's web-chat access; an administrator account is not a substitute for that session.
If AI fails, demonstrate manual support and explain the limitation; do not present a prepared response as live generation.

### Demo account

No shared password is published in the repository. Create a fictional account through registration or the local bootstrap documented above. The bootstrap prompts for a 12–128-character password and creates a three-day trial.
Share credentials privately with the team and professor. Verify access before rehearsal; an expired trial blocks protected modules. Do not publish tokens or passwords in slides.

## Verification and known limitations

From the repository root:

```bash
AUTH_TEST_DATABASE_URL=sqlite:// PYTHONPATH=src:tests pipenv run python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/frontend/calendar.test.mjs
npm run build
```

- Shared PostgreSQL migrations remain pending integration in #43; local SQLite does not prove full production compatibility.
- Registration supports simulated payment, not real charges. See the linked registration contract.
- Channel adapters do not demonstrate an active external integration. Do not advertise WhatsApp or email as operational without testing their providers and credentials.
- AI requires reachable services and human review of drafts. Access from the Mac does not guarantee access from Codespaces.
- Verify jobs, dashboard and settings in the version being presented; exclude pending or simulated features from the walkthrough.
- PRs #67 (CI) and #68 (security) are documented as separate changes: confirm integration before using their commands or claiming they are deployed.
- Review secrets, HTTPS, email recovery, backups and data retention before production. This guide does not certify those services.

## License

This project was developed for educational purposes as part of the 4Geeks Academy Full Stack Development program.

## Database setup and security

After recreating the database tables through migrations, restore the default plans:

```bash
pipenv run flask seed-plans
```

This command creates missing plans without changing existing plans or prices.
It does not restore deleted accounts, clients, or conversations; those require
a database backup. The `/api/seed-plans` page supports protected browser setup as described below.
Customers can still read active plans through `/api/plans`.

### Operational safeguards

- Keep credentials in backend environment variables. Never put secrets in
  `VITE_*` variables, source code, screenshots, or logs.
- Rotate any credentials that have been shared or exposed.
- Keep database backups and private keys outside the repository.
- Disable debug mode in production and configure the allowed frontend origin.
- Client avatars are generated locally without sending names to an avatar service.

### Personal data

Use fictional data for demonstrations. Before using real customer data,
define the privacy notice, applicable consent requirements, retention periods,
and procedures for access and deletion requests, including backups.

Automatic retention and deletion are not implemented by this security change.
Review the AI service's access controls, logging, and retention separately
before sending real customer information.

### Verification

The review includes automated tests for authentication, tenant isolation,
member permissions, uploads, and plan seeding. Passing tests cover the tested
scenarios and do not replace a production deployment review.

## Plan setup from a browser

For hosting without a terminal, open `/api/seed-plans` on the backend domain.
GET only displays the form. To enable creation, configure `PLAN_SEED_KEY` in the
hosting environment with a randomly generated secret of 32–512 characters.
Generate it on your own computer with `python3 -c "import secrets; print(secrets.token_hex(32))"`.
Enter it in the password field and click **Create plans**. The form submits POST;
do not put the key in the URL. Use HTTPS outside local development.
The database tables must already exist. Missing plans are created; existing
prices are preserved. This does not recover deleted accounts or client data.
Remove `PLAN_SEED_KEY` after setup to disable browser writes. The terminal
command `pipenv run flask seed-plans` remains available independently.
