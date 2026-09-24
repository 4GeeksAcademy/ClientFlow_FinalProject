# CHANNEL-01 — Communication channels

## Implemented scope

- Common incoming-message and delivery-result contracts.
- Authenticated web chat session creation by company operators.
- Visitor message submission and history retrieval.
- Sequential retry deduplication using the same external message identifier.
- Company-scoped email configuration validation.
- Proposed integration contracts for WhatsApp and Instagram.

## Web chat

POST /api/web-chat/sessions requires an application login token,
X-Company-ID, an active subscription and an operator role.

Allowed roles: owner, admin, manager and agent.

Request body:
{"display_name": "Visitor"}

The server creates a web conversation and an external participant.
It returns a visitor token, conversation_id and expires_in.

Visitor tokens expire after one hour and authorize one participant
in one conversation. They must not appear in logs or query strings.

GET /api/web-chat/messages uses the visitor token as a Bearer token.
The optional after_id cursor retrieves up to 50 messages per request.

POST /api/web-chat/messages accepts only:
{"external_id": "unique-message-id", "content": "Hello"}

Company, conversation and participant identifiers come from the
validated session, not from the message body.

The first submission returns 201. Repeating the same identifier and
content returns 200 with the existing message. Reusing that identifier
with different content returns 400.

The transaction must roll back when storage fails. The browser keeps
the identifier and content for retries while the component remains open.

## Current visitor interface

/web-chat is an authenticated operator testing page. It creates a
visitor session and displays the visitor interface in the same page.

It is not yet a public, anonymously accessible website widget.

The visitor token is kept in component memory. Reloading the page loses
that session in the interface; stored conversation messages remain.

The operator reads and replies through /conversations.
The visitor interface polls for replies every three seconds.

## Delivery status

received: an inbound message has been saved.
stored: an outbound message has been saved.
sent: reserved for a transport-confirmed submission.
delivered: reserved for confirmed delivery.
read: reserved for confirmed reading.
failed: a delivery attempt failed.

The current web chat does not change stored messages to delivered or
read merely because they were returned by the history endpoint.

WebChatAdapter.send requires an injected transport. Without one, it
returns failed with transport_not_configured and retryable=false.

The browser currently uses the web chat HTTP routes directly.

## Email configuration

Configuration is stored in Integration with provider=email and the
authorized company_id.

The settings object contains:

- smtp_host
- smtp_port: integer from 1 to 65535
- security: starttls or tls
- from_address

credentials_reference identifies a separately managed credential.
Passwords must not be stored inside settings or sent to the frontend.

load_email_configuration must receive a company identifier already
authorized by the calling backend.

Validation does not establish an SMTP connection, resolve credentials
or prove that delivery works. SMTP sending and incoming email handling
are not implemented by this configuration module.

## Proposed WhatsApp and Instagram integration contract

These are integration requirements, not deployed webhook endpoints.

Before accepting provider events, the future connector must:

1. Verify the provider request using its documented verification process.
2. Map the verified external account to a company-owned Integration.
3. Resolve the conversation and external participant within that company.
4. Normalize the event into IncomingMessage.
5. Deduplicate repeated provider events before storing a message.

IncomingMessage fields:

- external_id
- conversation_reference
- sender_reference
- content

Never trust a company_id supplied by an unverified external event.
Provider-specific payloads must remain outside Inbox business logic.

Outbound connectors implement:
send(destination, content, idempotency_key) -> DeliveryResult

DeliveryResult fields:

- status
- external_id
- retryable
- error_code

Before implementation, document the selected provider API version,
permissions, account identifiers, credential storage, webhook
verification, delivery callbacks and retry rules.

Retry transient failures only when duplication can be prevented.
Do not report delivery success without transport or provider evidence.

## Local development and Codespaces

The frontend calls /api/web-chat through VITE_BACKEND_URL when set.
Otherwise, it uses the frontend origin and the existing /api proxy.

In Codespaces, use the frontend origin with the proxy, or an explicitly
configured reachable backend. Do not use the browser machine's localhost
to address a remote Codespace backend.

Keep credentials and visitor tokens out of Git.

## Validation

The user confirmed bidirectional messaging:
visitor -> Inbox -> visitor.

The channel test suite currently contains 36 passing tests.

Repository validation: 126 backend tests passed, 4 calendar tests passed,
and the production frontend build passed. The backend suite passed twice.
The final frontend build also includes the retry error-handling adjustment.

## Provider onboarding requirements

### WhatsApp Cloud API

Prepare a Meta app, a WhatsApp Business Account and its business
phone number identifier.

Configure an HTTPS webhook URL reachable by Meta, with a valid
certificate. A localhost URL is not an external webhook endpoint.

ClientFlow must map the verified business phone number identifier
to a single company integration before processing an event.

Reference:
https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference

### Instagram API with Instagram Login

Prepare an Instagram professional account, an authorized access token
and the instagram_business_manage_messages permission.

The recipient must have initiated contact with the professional
account before the application sends a reply.

ClientFlow must map the verified professional account identifier
to a single company integration. Customer identifiers must remain
scoped to that integration.

Reference:
https://www.postman.com/meta/instagram/folder/uxudqu0/send-api

## Proposed webhook processing contract

The following behavior is a ClientFlow implementation requirement.
The external webhook routes are not implemented in this ticket.

- Complete the provider's callback verification before activation.
- Verify webhook authenticity against the original request bytes,
  using the selected provider API's documented mechanism.
- Reject invalid verification or unknown account mappings.
- Process every event in a batch independently.
- Persist accepted events durably before acknowledging them.
- Deduplicate by company, provider, external account and event ID.
- Treat delivery callbacks separately from inbound customer messages.
- Match delivery callbacks to previously stored outbound identifiers.
- Prevent old callbacks from reversing a newer delivery state.
- Define handling for unsupported attachments before enabling them.
- Keep access tokens and app secrets exclusively on the backend.

Before activation, record the pinned API version, granted permissions,
account ownership, callback verification settings and a tested sample
payload for both inbound messages and delivery callbacks.

## Retry behavior in the current web interface

Connection failures, HTTP 408, HTTP 429 and server failures preserve
the pending message identifier and content for a manual retry.

Other HTTP 4xx responses clear the pending identifier so the visitor
can correct the message. HTTP 401 disables sending until a new session
is established.

Pending retries exist only in component memory and do not survive
a page reload.
