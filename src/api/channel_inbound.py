"""Store authenticated web messages without duplicating retries."""

from sqlalchemy import update

from api.channel_session import read_chat_token, resolve_chat_session
from api.channel_web import WebChatAdapter
from api.inbox import receive_message
from api.models import Conversation, Message, MessageDirection, db


def store_web_message(token, payload):
    """Store a message within the caller's database transaction."""
    data = read_chat_token(token)

    if not isinstance(payload, dict):
        raise ValueError("A JSON object is required.")

    if set(payload) != {"external_id", "content"}:
        raise ValueError("Unexpected or missing message fields.")

    incoming = WebChatAdapter().normalize_inbound(
        {
            "external_id": payload["external_id"],
            "conversation_reference": str(data["conversation_id"]),
            "sender_reference": str(data["participant_id"]),
            "content": payload["content"],
        }
    )

    # Serialize writes to this conversation before checking for retries.
    db.session.execute(
        update(Conversation)
        .where(
            Conversation.id == data["conversation_id"],
            Conversation.company_id == data["company_id"],
        )
        .values(last_message_at=Conversation.last_message_at)
        .execution_options(synchronize_session=False)
    )

    conversation, participant = resolve_chat_session(token)

    existing = db.session.scalar(
        db.select(Message).where(
            Message.conversation_id == conversation.id,
            Message.sender_participant_id == participant.id,
            Message.direction == MessageDirection.INBOUND,
            Message.external_id == incoming.external_id,
        )
    )

    if existing is not None:
        if existing.content != incoming.content:
            raise ValueError(
                "This message identifier was already used for different content."
            )
        return existing, False

    message = receive_message(
        company_id=conversation.company_id,
        conversation_id=conversation.id,
        participant_id=participant.id,
        content=incoming.content,
    )
    message.external_id = incoming.external_id
    db.session.flush()

    return message, True
