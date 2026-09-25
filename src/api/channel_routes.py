"""Authenticated endpoints for web chat visitors."""

from flask import Blueprint, g, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from api.auth import tenant_required
from api.channel_inbound import store_web_message
from api.channel_session import (
    SESSION_MAX_AGE,
    create_chat_token,
    resolve_chat_session,
)
from api.channel_validation import required_text
from api.models import (
    ChannelType,
    Conversation,
    ConversationParticipant,
    Message,
    db,
)

channels = Blueprint("channels", __name__)


@channels.after_request
def prevent_chat_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@channels.get("/web-chat/messages")
def list_web_chat_messages():
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return jsonify(message="A chat session is required."), 401

    token = authorization.removeprefix("Bearer ").strip()

    try:
        conversation, participant = resolve_chat_session(token)
    except ValueError:
        return jsonify(message="Invalid or expired chat session."), 401

    try:
        after_id = int(request.args.get("after_id", "0"))
    except ValueError:
        return jsonify(message="Invalid message cursor."), 400

    if after_id < 0:
        return jsonify(message="Invalid message cursor."), 400

    messages = db.session.scalars(
        db.select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.id > after_id,
            Message.content_type == "text",
            Message.delivery_status.in_(
                ["received", "stored", "sent", "delivered", "read"]
            ),
        )
        .order_by(Message.id)
        .limit(51)
    ).all()

    has_more = len(messages) > 50
    visible_messages = messages[:50]

    return jsonify(
        messages=[
            {
                "id": message.id,
                "content": message.content,
                "direction": message.direction.value,
                "created_at": message.created_at.isoformat(),
            }
            for message in visible_messages
        ],
        next_after_id=(visible_messages[-1].id if visible_messages else after_id),
        has_more=has_more,
    )


@channels.post("/web-chat/messages")
def send_web_chat_message():
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return jsonify(message="A chat session is required."), 401

    token = authorization.removeprefix("Bearer ").strip()

    try:
        resolve_chat_session(token)
    except ValueError:
        db.session.rollback()
        return jsonify(message="Invalid or expired chat session."), 401

    payload = request.get_json(silent=True)

    try:
        message, created = store_web_message(token, payload)
        result = {
            "id": message.id,
            "content": message.content,
            "direction": message.direction.value,
            "delivery_status": message.delivery_status,
        }
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify(message=str(error)), 400
    except SQLAlchemyError:
        db.session.rollback()
        return (
            jsonify(
                message="Unable to store the message. Please retry.",
            ),
            503,
        )

    return jsonify(message=result, created=created), 201 if created else 200


@channels.post("/web-chat/sessions")
@tenant_required
def create_web_chat_session():
    if g.membership.role.value not in ("owner", "admin", "manager", "agent"):
        return jsonify(message="An operator role is required."), 403

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict) or set(payload) != {"display_name"}:
        return jsonify(message="Only display_name is required."), 400

    try:
        display_name = required_text(payload["display_name"], "display_name", 160)
    except ValueError as error:
        return jsonify(message=str(error)), 400

    try:
        conversation = Conversation(
            company_id=g.company_id,
            channel=ChannelType.WEB,
            subject=display_name,
            assigned_membership_id=g.membership.id,
        )
        db.session.add(conversation)
        db.session.flush()

        participant = ConversationParticipant(
            conversation_id=conversation.id,
            display_name=display_name,
            participant_type="visitor",
        )
        db.session.add(participant)
        db.session.flush()

        token = create_chat_token(
            g.company_id,
            conversation.id,
            participant.id,
        )
        result = {
            "token": token,
            "expires_in": SESSION_MAX_AGE,
            "conversation_id": conversation.id,
        }
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Unable to create the chat session."), 503

    return jsonify(result), 201
