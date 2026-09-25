"""Generate reviewable AI drafts from authorized conversation context."""

import os

from api.ai_context import build_conversation_context
from api.ai_prompt import build_agent_message
from api.ai_response import validate_agent_reply
from api.ai_service import AgentServiceError, request_agent_reply
from api.knowledge_embeddings import EmbeddingServiceError


def generate_reply_draft(company_id, conversation_id, question):
    """Prepare a draft; never send a message to the customer."""
    try:
        context = build_conversation_context(company_id, conversation_id, question)
    except EmbeddingServiceError:
        return handoff_result("knowledge_service_unavailable")

    if context.get("opening_reply"):
        return {
            "status": "pending_review",
            "reply": context["opening_reply"],
            "sources": [],
            "requires_approval": True,
            "reason": None,
        }

    try:
        minimum = float(os.getenv("AI_MIN_SIMILARITY", "0.5"))
        if not 0 <= minimum <= 1:
            raise ValueError("Invalid similarity threshold")
    except ValueError:
        return handoff_result("invalid_retrieval_configuration")
    candidates = context["sources"]
    anchors = [s for s in candidates if s.get("score", -1) >= minimum]
    # Retain adjacent authorized excerpts so a split paragraph does not lose its subject.
    context["sources"] = [s for s in candidates if s in anchors or any(
        s.get("document_id") is not None
        and s.get("document_id") == anchor.get("document_id")
        and abs(s.get("chunk_index", -100) - anchor.get("chunk_index", 100)) == 1
        for anchor in anchors
    )]

    try:
        prepared = build_agent_message(context)
    except ValueError:
        return handoff_result("context_limit")

    try:
        raw_reply = request_agent_reply(prepared["message"], company_id=company_id)
    except AgentServiceError:
        return handoff_result("agent_service_unavailable")

    try:
        answer = validate_agent_reply(
            raw_reply,
            prepared["source_ids"],
            allow_clarification=True,
        )
    except ValueError:
        return handoff_result("invalid_agent_response")

    return {
        "status": "handoff" if answer["needs_human"] else "pending_review",
        "reply": answer["reply"],
        "sources": [
            source
            for source in context["sources"]
            if source["chunk_id"] in answer["source_ids"]
        ],
        "requires_approval": True,
        "reason": "agent_requested_human" if answer["needs_human"] else None,
    }


def handoff_result(reason):
    """Return a human handoff without inventing an answer."""
    return {
        "status": "handoff",
        "reply": None,
        "sources": [],
        "requires_approval": True,
        "reason": reason,
    }
