# ClientFlow MVP Scope

## Product definition

ClientFlow is a multilingual, multi-tenant customer operations platform for UK
trade businesses. It centralises leads, customers, jobs, appointments,
conversations and AI-assisted workflows in a single workspace.

## MVP modules

1. **Authentication and tenant access**
   - Login, logout and password recovery.
   - Registration through a valid company invitation or activation token.
   - Company-level isolation of all operational data.
   - Administrator and member roles.

2. **Lead management**
   - Create, view, update, assign and qualify leads.
   - Track source, status, service requested and contact details.
   - Convert a qualified lead into a customer without losing its history.

3. **Customer management**
   - Customer profile, addresses, notes and interaction history.
   - Related jobs, appointments and conversations.

4. **Jobs and appointments**
   - Create and assign jobs to team members.
   - Track job status and service type.
   - Schedule appointments with start/end time and assignee.
   - Use consistent colours for service/status identification in the UI.

5. **Omnichannel conversations**
   - One inbox for web, email and WhatsApp conversations.
   - Store participants and messages independent of the channel provider.
   - Support human assignment and AI-to-human handoff.

6. **AI agents and RAG knowledge**
   - Configure specialised agents per company.
   - Upload knowledge documents and store searchable chunks.
   - Retrieve relevant company knowledge before generating an answer.
   - Require human approval for sensitive actions.

7. **Dashboard**
   - KPIs for leads, active customers, jobs and appointments.
   - Six-month lead/customer evolution.
   - Job-status distribution and upcoming appointments.

8. **Settings**
   - Company profile, users, language, theme and integrations.
   - English, Spanish and Portuguese interface preferences.

## Outside the MVP

- Native mobile applications.
- Full accounting, payroll and stock management.
- Marketplace for third-party extensions.
- Fully autonomous payments or legally binding actions by AI.
- Advanced subscription billing and usage-based invoicing.

## Frontend responsibilities

- Render responsive React views and navigation.
- Manage form state, client-side validation and user feedback.
- Apply language, theme and company branding preferences.
- Call the REST API and handle loading, empty and error states.
- Never decide authorisation or tenant access only in the browser.

## Backend responsibilities

- Authenticate users and issue/validate JWTs.
- Enforce company isolation, roles and permissions on every request.
- Validate business rules and persist data through SQLAlchemy.
- Coordinate lead conversion, assignments, appointments and conversations.
- Integrate external channels and AI providers without exposing credentials.
- Create embeddings, retrieve RAG context and keep an audit trail.

## Definition of done

The MVP architecture is ready when the team can implement SQLAlchemy models,
migrations and API endpoints directly from the documented entities,
relationships and flows without inventing incompatible structures.
