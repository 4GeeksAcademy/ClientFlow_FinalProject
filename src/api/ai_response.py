"""Validate generated answers and their source references."""

import json


def validate_agent_reply(raw_reply, allowed_source_ids, *, allow_clarification=False):
    """Reject malformed answers and references outside the sent context."""
    if not isinstance(raw_reply, str) or len(raw_reply) > 16000:
        raise ValueError("Invalid agent response.")

    try:
        data = json.loads(raw_reply)
    except (ValueError, RecursionError) as error:
        raise ValueError("Agent response must be JSON.") from error

    if not isinstance(data, dict):
        raise ValueError("Agent response must be an object.")

    if set(data) not in ({"reply", "source_ids", "needs_human"},
                         {"reply", "source_ids", "needs_human", "response_type"}):
        raise ValueError("Unexpected response fields.")

    reply = data["reply"]
    source_ids = data["source_ids"]

    if not isinstance(reply, str) or not 1 <= len(reply.strip()) <= 6000:
        raise ValueError("Invalid reply text.")

    if type(data["needs_human"]) is not bool:
        raise ValueError("Invalid human handoff flag.")

    if (
        not isinstance(source_ids, list)
        or len(source_ids) > 10
        or any(type(value) is not int for value in source_ids)
    ):
        raise ValueError("Invalid source references.")

    allowed = set(allowed_source_ids)

    if any(value not in allowed for value in source_ids):
        raise ValueError("Agent referenced an unauthorized source.")

    response_type = data.get("response_type", "handoff" if data["needs_human"] else "answer")
    if response_type not in ("answer", "clarification", "handoff"):
        raise ValueError("Invalid response type.")
    if (response_type == "handoff") != data["needs_human"]:
        raise ValueError("Inconsistent handoff status.")
    clarification = allow_clarification and response_type == "clarification"
    if clarification and (reply.count("?") > 1 or len(reply) > 1000):
        raise ValueError("Clarification must be concise and contain at most one question.")
    if not source_ids and not data["needs_human"] and not clarification:
        raise ValueError("An answer without sources requires human review.")

    return {
        "reply": reply.strip(),
        "source_ids": list(dict.fromkeys(source_ids)),
        "needs_human": data["needs_human"],
    }
