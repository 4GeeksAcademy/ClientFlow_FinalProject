# Inbox API — Ticket #27

All HTTP endpoints require a bearer token and the X-Company-ID header.

## Endpoints

- GET /api/conversations — Paginated conversation list.
- POST /api/conversations — Create a conversation.
- GET /api/conversations/<id>/messages — Paginated message history.
- POST /api/conversations/<id>/messages — Store a human outbound message.
- PATCH /api/conversations/<id>/assignment — Assign or unassign a company member.
- PATCH /api/conversations/<id>/control — Switch between human and AI control.
- PATCH /api/conversations/<id>/read — Update the current member's read marker.

## Incoming messages

The internal receive_message function validates the company, conversation,
participant and content, then stores an inbound message.

The caller must authenticate the external source and commit the transaction.
Channel adapters and external delivery are handled by the integration tickets.
Outbound status "stored" does not mean delivered to an external provider.

## Database integration — Ticket #43

Add a nullable INTEGER column named last_read_message_id to
conversation_participants.

Existing rows should retain NULL until the participant marks a message as read.
The local SQLite adjustment is not a shared migration.

## Current frontend

The conversation list and selected message history refresh five seconds
after each completed request.

Both lists support pagination. Selecting a different conversation resets
the message page and cancels the previous history request.

The interface displays the channel, status, control mode and assigned
membership ID in a responsive three-column layout. Human messages can be
sent from the composer, and AI conversations offer a human takeover action.
Assignment and AI selection remain available through the API and frontend service.
Outbound messages are stored locally; external provider delivery is not implemented.
