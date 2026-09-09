# System Architecture

## Main components

```text
React web application
        |
        | HTTPS / JSON REST API
        v
Flask API + JWT authentication
        |
        +--> PostgreSQL (business data and RAG metadata)
        +--> Vector search (document chunk embeddings)
        +--> Background jobs (ingestion and channel processing)
        +--> LLM provider
        +--> Email / WhatsApp / Instagram / web-channel providers
```

The Flask API is the only trusted entry point to business data. Every protected
request identifies both the current user and company. Queries must always be
scoped by `company_id` to prevent data from one customer organisation being
visible to another.

## Main application flow

```text
Plans -> 3-day trial / paid plan -> Owner registration -> Company workspace
                                                     |
New enquiry -> Lead -> Qualified -> Customer -> Job -> Appointment -> Complete
                  |          |          |          |
                  +----------+----------+----------+--> Conversation history
```

### Company onboarding and access

There are two intentionally separate registration flows:

1. **New company:** the owner selects a plan or a three-day free trial, creates
   their user and company, and becomes the `owner` membership. The backend
   creates the subscription and calculates `trial_ends_at`; no activation code
   is requested on this public flow.
2. **Existing company member:** an owner or administrator sends an invitation
   to a specific email address. The recipient uses the single-use invitation
   token to create or connect a user account to that company. They do not select
   or purchase a plan.

Workspace access is allowed only when the company is active and its subscription
is in `trialing` or `active` state. The backend, not the frontend, enforces this.

### Lead conversion

1. A lead enters manually or through a connected channel.
2. A user or AI agent qualifies it and records its status.
3. On conversion, the API creates a customer linked through `converted_client_id`.
4. Existing conversations remain attached to the original lead and may also be
   associated with the new customer.
5. Jobs and appointments are created only after a customer exists.

### Job and appointment flow

1. A team member creates a job for a customer and selects a service type.
2. The job is assigned to a company user.
3. One job can contain multiple appointments.
4. Job status and appointment status are independent: rescheduling an
   appointment does not automatically complete or cancel the job.

## AI and RAG flow

```text
Incoming message
      |
Channel adapter -> Conversation + Message
      |
Agent selection -> retrieve company document chunks
      |
LLM prompt = agent instruction + conversation context + RAG context
      |
      +--> Draft/answer when permitted
      +--> Human approval or handoff for sensitive/uncertain actions
```

- Knowledge is isolated per company.
- Original files are stored outside the database; the database keeps metadata,
  status and storage location.
- Each extracted chunk stores its text and embedding/vector reference.
- Agent instructions are versionable text managed through the application; they
  may originate from Markdown files but are persisted as configuration.
- AI must not create irreversible or sensitive actions without permission when
  `requires_human_approval` is enabled.

## Omnichannel architecture

External provider payloads are normalised into `conversations`,
`conversation_participants` and `messages`. Provider-specific identifiers are
kept in `external_id` fields. This lets the UI use one inbox while adapters deal
with the differences between web chat, email, WhatsApp and Instagram.

## Security rules

- Hash passwords; never store or return plaintext passwords.
- Store only hashes of member-invitation and password-reset tokens.
- Apply expiry and single-use rules to tokens.
- Validate `company_id` access on every protected resource.
- Do not place provider credentials or API keys in source control.
- Record timestamps in UTC and convert them using the company's timezone.
