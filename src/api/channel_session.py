"""Sign short-lived access tokens for a single web chat participant."""

from flask import current_app
from itsdangerous import BadData, URLSafeTimedSerializer
from sqlalchemy import select

from api.models import (
    ChannelType,
    Company,
    Conversation,
    ConversationParticipant,
    db,
)

SESSION_MAX_AGE = 3600


def session_serializer():
    secret = current_app.config.get("JWT_SECRET_KEY")

    if not isinstance(secret, str) or not secret:
        raise RuntimeError("Session signing key is not configured.")

    return URLSafeTimedSerializer(
        secret,
        salt="clientflow-web-chat-session-v1",
    )


def create_chat_token(company_id, conversation_id, participant_id):
    """Issue a token after the backend authorizes the participant."""
    identifiers = (company_id, conversation_id, participant_id)

    if any(type(value) is not int or value <= 0 for value in identifiers):
        raise ValueError("Invalid chat session identifiers.")

    return session_serializer().dumps(
        {
            "company_id": company_id,
            "conversation_id": conversation_id,
            "participant_id": participant_id,
        }
    )


def read_chat_token(token):
    """Validate the signature, expiration and identifier types."""
    if not isinstance(token, str) or not token or len(token) > 4096:
        raise ValueError("Invalid chat session.")

    try:
        data = session_serializer().loads(
            token,
            max_age=SESSION_MAX_AGE,
        )
    except BadData:
        raise ValueError("Invalid or expired chat session.") from None

    expected = {"company_id", "conversation_id", "participant_id"}

    if not isinstance(data, dict) or set(data) != expected:
        raise ValueError("Invalid chat session.")

    if any(type(value) is not int or value <= 0 for value in data.values()):
        raise ValueError("Invalid chat session.")

    return data


def resolve_chat_session(token):
    """Resolve a signed session against current database records."""
    data = read_chat_token(token)

    conversation = db.session.scalar(
        select(Conversation)
        .join(Company, Company.id == Conversation.company_id)
        .where(
            Conversation.id == data["conversation_id"],
            Conversation.company_id == data["company_id"],
            Conversation.channel == ChannelType.WEB,
            Company.is_active.is_(True),
        )
    )

    if conversation is None:
        raise ValueError("Invalid chat session.")

    participant = db.session.scalar(
        select(ConversationParticipant).where(
            ConversationParticipant.id == data["participant_id"],
            ConversationParticipant.conversation_id == conversation.id,
            ConversationParticipant.membership_id.is_(None),
        )
    )

    if participant is None:
        raise ValueError("Invalid chat session.")

    return conversation, participant
