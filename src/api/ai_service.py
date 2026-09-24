"""Call the private agent service without exposing credentials."""

import json
import os
from http.client import HTTPException
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from api.knowledge_embeddings import NoRedirectHandler


class AgentServiceError(RuntimeError):
    """Report a safe error from the private agent service."""


def request_agent_reply(message, company_id=None):
    """Request an answer without reusing remote conversation memory."""
    if not isinstance(message, str) or not 1 <= len(message) <= 4000:
        raise AgentServiceError("Invalid agent message.")

    url = os.getenv("AI_SERVICE_URL", "").strip()
    try:
        keys = json.loads(os.getenv("AI_SERVICE_COMPANY_KEYS", "{}"))
        if not isinstance(keys, dict):
            raise ValueError("Invalid key mapping")
        key = keys.get(str(company_id), "")
        if not key and str(company_id) == os.getenv("AI_SERVICE_COMPANY_ID", ""):
            key = os.getenv("AI_SERVICE_API_KEY", "")
        if not isinstance(key, str):
            raise ValueError("Invalid key")
        key = key.strip()
    except ValueError:
        raise AgentServiceError("Invalid company service configuration.") from None

    try:
        address = urlsplit(url)
        valid = (
            address.scheme == "https"
            and bool(address.hostname)
            and address.username is None
            and address.password is None
            and not address.fragment
        )
    except ValueError:
        valid = False

    if not valid or not key:
        raise AgentServiceError("Agent service is not configured.")

    request = Request(
        url,
        data=json.dumps(
            {
                "message": message,
                "conversation_id": None,
            }
        ).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-API-Key": key,
        },
        method="POST",
    )

    try:
        opener = build_opener(NoRedirectHandler())

        with opener.open(request, timeout=60) as response:
            raw = response.read(65537)

        if len(raw) > 65536:
            raise AgentServiceError("Agent response exceeds the size limit.")

        data = json.loads(raw)

        if not isinstance(data, dict) or not isinstance(data.get("reply"), str):
            raise AgentServiceError("Invalid agent service response.")

        if data.get("conversation_id") is not None:
            raise AgentServiceError("Remote conversation memory is not supported.")
        if data.get("model") != os.getenv("AI_SERVICE_MODEL", "qwen2.5:3b"):
            raise AgentServiceError("Unexpected agent model.")
        return data["reply"]

    except (URLError, OSError, HTTPException, ValueError, RecursionError):
        raise AgentServiceError("Unable to obtain an agent response.") from None
