"""Load company-scoped conversation history for AI responses."""

from sqlalchemy import select

from api.ai_opening import opening_reply
from api.ai_retrieval import retrieve_knowledge
from api.models import AIAgent, Conversation, Message, db


def load_conversation_history(company_id, conversation_id, limit=12):
    """Return recent conversation messages in chronological order."""
    if type(limit) is not int or not 1 <= limit <= 30:
        raise ValueError("History limit must be between 1 and 30.")

    conversation = db.session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.company_id == company_id,
        )
    )

    if conversation is None:
        raise ValueError("Conversation not found.")

    query = (
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.content_type == "text",
            Message.delivery_status.in_(
                ["received", "stored", "sent", "delivered", "read"]
            ),
        )
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )

    messages = db.session.scalars(query).all()

    return [
        {
            "message_id": message.id,
            "direction": message.direction.value,
            "content": message.content,
        }
        for message in reversed(messages)
    ]


def load_conversation_agent(company_id, conversation_id):
    """Load the active agent assigned to this company's conversation."""
    agent = db.session.scalar(
        select(AIAgent)
        .join(
            Conversation,
            Conversation.ai_agent_id == AIAgent.id,
        )
        .where(
            Conversation.id == conversation_id,
            Conversation.company_id == company_id,
            AIAgent.company_id == company_id,
            AIAgent.is_active.is_(True),
        )
    )

    if agent is None:
        raise ValueError("No active agent is assigned to this conversation.")

    return {
        "id": agent.id,
        "name": agent.name,
        "purpose": agent.purpose,
        "model_name": agent.model_name,
        "main_instruction": agent.main_instruction,
        "requires_human_approval": agent.requires_human_approval,
    }


def build_conversation_context(company_id, conversation_id, question):
    """Assemble authorized context before generating a response."""
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question is required.")

    question = question.strip()

    if len(question) > 4000:
        raise ValueError("Question exceeds the size limit.")

    agent = load_conversation_agent(company_id, conversation_id)
    history = load_conversation_history(company_id, conversation_id)

    previous_questions = [
        message["content"] for message in history if message["direction"] == "inbound"
    ]

    previous_text = "\n".join(previous_questions[-3:])
    remaining = 4000 - len(question) - 1
    search_question = question

    if previous_text and remaining > 0:
        search_question = previous_text[-min(remaining, 1500) :] + "\n" + question

    opening = opening_reply(question, history)
    sources = []
    if not opening:
        sources = retrieve_knowledge(company_id, agent["id"], question)
        if search_question != question:
            contextual_sources = retrieve_knowledge(company_id, agent["id"], search_question)
            by_id = {source["chunk_id"]: source for source in sources}
            for source in contextual_sources:
                existing = by_id.get(source["chunk_id"])
                if existing is None or source.get("score", -1) > existing.get("score", -1):
                    by_id[source["chunk_id"]] = source
            sources = sorted(
                by_id.values(), key=lambda source: (-source.get("score", -1), source["chunk_id"])
            )[:5]

    return {
        "company_id": company_id,
        "conversation_id": conversation_id,
        "agent": agent,
        "history": history,
        "question": question,
        "sources": sources,
        "needs_human": not sources and not opening,
        "opening_reply": opening,
    }
