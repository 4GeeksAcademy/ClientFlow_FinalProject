# ClientFlow

ClientFlow is the final project developed for 4Geeks Academy by a team of four Full Stack developers.

It is an AI-powered multilingual CRM and customer operations platform designed to centralize client management, conversations, appointments, jobs and intelligent automation.

## Core Features

- Lead and client management
- Appointments and job tracking
- Omnichannel conversations
- AI agent orchestration
- RAG-based knowledge system
- Conversation memory
- Automatic lead assignment
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
- WhatsApp API

## Project Status

🚧 In development

## Team

- Carlos Alberto — Full Stack Developer / Technical Lead
- Eudlad — Full Stack Developer
- Jesus — Full Stack Developer
- Marian Mircea — Full Stack Developer

## Project Structure

Technical documentation, architecture diagrams, wireframes and API documentation will be available in the `/docs` directory.

## License

This project was developed for educational purposes as part of the 4Geeks Academy Full Stack Development program.

## Database setup and security

After recreating the database tables through migrations, restore the default plans:

```bash
pipenv run flask seed-plans
```

This command creates missing plans without changing existing plans or prices.
It does not restore deleted accounts, clients, or conversations; those require
a database backup. The public `/api/seed-plans` endpoint has been removed.
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
