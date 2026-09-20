"""Conversation and message endpoints for ticket #27."""

from flask import Blueprint, g, jsonify, request

from api.auth import tenant_required
from api.models import (
    AIAgent,
    ChannelType,
    CompanyMembership,
    Conversation,
    ConversationParticipant,
    Message,
    MessageDirection,
    db,
    utc_now,
)

inbox = Blueprint("inbox", __name__)
def conversation_to_dict(conversation):
    participant = db.session.scalar(
        db.select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation.id,
            ConversationParticipant.membership_id == g.membership.id,
        )
    )

    return {
        "id": conversation.id,
        "subject": conversation.subject,
        "channel": conversation.channel.value,
        "status": conversation.status.value,
        "assigned_membership_id": conversation.assigned_membership_id,
        "ai_agent_id": conversation.ai_agent_id,
        "control_mode": (
            "ai" if conversation.ai_agent_id is not None else "human"
        ),
        "last_read_message_id": (
            participant.last_read_message_id
            if participant is not None
            else None
        ),
        "last_message_at": (
            conversation.last_message_at.isoformat()
            if conversation.last_message_at is not None
            else None
        ),
    }


@inbox.route("/conversations", methods=["GET"])
@tenant_required
def list_conversations():
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)

    if page < 1 or per_page < 1 or per_page > 100:
        return jsonify(
            message="Page must be positive and per_page must be between 1 and 100."
        ), 400

    statement = (
        db.select(Conversation)
        .where(Conversation.company_id == g.company_id)
        .order_by(Conversation.id.desc())
    )

    pagination = db.paginate(
        statement,
        page=page,
        per_page=per_page,
        error_out=False,
    )

    return jsonify(
        conversations=[
            conversation_to_dict(conversation)
            for conversation in pagination.items
        ],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
    ), 200


def message_to_dict(message):
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_participant_id": message.sender_participant_id,
        "direction": message.direction.value,
        "content": message.content,
        "content_type": message.content_type,
        "sent_by_ai": message.sent_by_ai,
        "delivery_status": message.delivery_status,
        "created_at": (
            message.created_at.isoformat()
            if message.created_at is not None
            else None
        ),
    }


@inbox.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
@tenant_required
def list_messages(conversation_id):
    conversation = db.session.execute(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == g.company_id,
        )
    ).scalar_one_or_none()

    if conversation is None:
        return jsonify(message="Conversation not found."), 404

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=50, type=int)

    if page < 1 or per_page < 1 or per_page > 100:
        return jsonify(
            message="Page must be positive and per_page must be between 1 and 100."
        ), 400

    statement = (
        db.select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )

    pagination = db.paginate(
        statement,
        page=page,
        per_page=per_page,
        error_out=False,
    )

    return jsonify(
        conversation_id=conversation.id,
        messages=[
            message_to_dict(message)
            for message in pagination.items
        ],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
    ), 200


@inbox.route("/conversations", methods=["POST"])
@tenant_required
def create_conversation():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    subject = data.get("subject")

    if not isinstance(subject, str) or not subject.strip():
        return jsonify(message="Subject is required."), 400

    subject = subject.strip()

    if len(subject) > 255:
        return jsonify(
            message="Subject must not exceed 255 characters."
        ), 400

    channel_value = data.get("channel", "web")

    if not isinstance(channel_value, str):
        return jsonify(message="Invalid channel."), 400

    try:
        channel = ChannelType(channel_value)
    except ValueError:
        return jsonify(
            message="Channel must be web, email, whatsapp or instagram."
        ), 400

    conversation = Conversation(
        company_id=g.company_id,
        subject=subject,
        channel=channel,
    )

    db.session.add(conversation)
    db.session.commit()

    return jsonify(conversation=conversation_to_dict(conversation)), 201


@inbox.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
@tenant_required
def send_message(conversation_id):
    conversation = db.session.scalar(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == g.company_id,
        )
    )

    if conversation is None:
        return jsonify(message="Conversation not found."), 404
    if conversation.ai_agent_id is not None:
        return jsonify(
            message="Take human control before sending a message."
        ), 409
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    content = data.get("content")

    if not isinstance(content, str) or not content.strip():
        return jsonify(message="Message content is required."), 400

    content = content.strip()

    if len(content) > 10000:
        return jsonify(
            message="Message content must not exceed 10000 characters."
        ), 400

    participant = db.session.scalar(
        db.select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation.id,
            ConversationParticipant.membership_id == g.membership.id,
        )
    )

    if participant is None:
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            membership_id=g.membership.id,
            participant_type="member",
        )
        db.session.add(participant)
        db.session.flush()

    timestamp = utc_now()

    message = Message(
        conversation_id=conversation.id,
        sender_participant_id=participant.id,
        direction=MessageDirection.OUTBOUND,
        content=content,
        content_type="text",
        sent_by_ai=False,
        delivery_status="stored",
        created_at=timestamp,
    )

    conversation.last_message_at = timestamp
    db.session.add(message)
    db.session.commit()

    return jsonify(message=message_to_dict(message)), 201


@inbox.route("/conversations/<int:conversation_id>/assignment", methods=["PATCH"])
@tenant_required
def assign_conversation(conversation_id):
    conversation = db.session.scalar(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == g.company_id,
        )
    )

    if conversation is None:
        return jsonify(message="Conversation not found."), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or "membership_id" not in data:
        return jsonify(message="Membership ID is required."), 400

    membership_id = data["membership_id"]

    if membership_id is not None:
        if type(membership_id) is not int or membership_id < 1:
            return jsonify(message="Invalid membership ID."), 400

        membership = db.session.scalar(
            db.select(CompanyMembership).where(
                CompanyMembership.id == membership_id,
                CompanyMembership.company_id == g.company_id,
            )
        )

        if membership is None or not membership.user.is_active:
            return jsonify(message="Active company member not found."), 404

    conversation.assigned_membership_id = membership_id
    db.session.commit()

    return jsonify(conversation=conversation_to_dict(conversation)), 200


@inbox.route("/conversations/<int:conversation_id>/control", methods=["PATCH"])
@tenant_required
def update_conversation_control(conversation_id):
    conversation = db.session.scalar(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == g.company_id,
        )
    )

    if conversation is None:
        return jsonify(message="Conversation not found."), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    mode = data.get("mode")

    if mode not in ("human", "ai"):
        return jsonify(message="Mode must be human or ai."), 400

    if mode == "ai":
        agent_id = data.get("ai_agent_id")

        if type(agent_id) is not int or agent_id < 1:
            return jsonify(message="A valid AI agent ID is required."), 400

        agent = db.session.scalar(
            db.select(AIAgent).where(
                AIAgent.id == agent_id,
                AIAgent.company_id == g.company_id,
                AIAgent.is_active.is_(True),
            )
        )

        if agent is None:
            return jsonify(message="Active AI agent not found."), 404

        conversation.ai_agent_id = agent.id
    else:
        conversation.ai_agent_id = None
        conversation.assigned_membership_id = g.membership.id

    db.session.commit()

    return jsonify(conversation=conversation_to_dict(conversation)), 200


@inbox.route("/conversations/<int:conversation_id>/read", methods=["PATCH"])
@tenant_required
def mark_conversation_read(conversation_id):
    conversation = db.session.scalar(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == g.company_id,
        )
    )

    if conversation is None:
        return jsonify(message="Conversation not found."), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    message_id = data.get("message_id")

    if type(message_id) is not int or message_id < 1:
        return jsonify(message="A valid message ID is required."), 400

    message = db.session.scalar(
        db.select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation.id,
        )
    )

    if message is None:
        return jsonify(message="Message not found."), 404

    participant = db.session.scalar(
        db.select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation.id,
            ConversationParticipant.membership_id == g.membership.id,
        )
    )

    if participant is None:
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            membership_id=g.membership.id,
            participant_type="member",
        )
        db.session.add(participant)

    participant.last_read_message_id = max(
        participant.last_read_message_id or 0,
        message.id,
    )
    db.session.commit()

    return jsonify(
        conversation_id=conversation.id,
        last_read_message_id=participant.last_read_message_id,
    ), 200


def receive_message(company_id, conversation_id, participant_id, content):
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Message content is required.")

    content = content.strip()

    if len(content) > 10000:
        raise ValueError("Message content must not exceed 10000 characters.")

    conversation = db.session.scalar(
        db.select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == company_id,
        )
    )

    if conversation is None:
        raise ValueError("Conversation not found.")

    participant = db.session.scalar(
        db.select(ConversationParticipant).where(
            ConversationParticipant.id == participant_id,
            ConversationParticipant.conversation_id == conversation.id,
        )
    )

    if participant is None or participant.membership_id is not None:
        raise ValueError("External conversation participant required.")

    timestamp = utc_now()

    message = Message(
        conversation_id=conversation.id,
        sender_participant_id=participant.id,
        direction=MessageDirection.INBOUND,
        content=content,
        content_type="text",
        sent_by_ai=False,
        delivery_status="received",
        created_at=timestamp,
    )

    conversation.last_message_at = timestamp
    db.session.add(message)
    db.session.flush()

    return message
