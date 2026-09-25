"""Normalize web chat events after session authentication."""

from api.channel_types import DeliveryResult, IncomingMessage
from api.channel_validation import message_content, message_reference


class WebChatAdapter:
    def __init__(self, transport=None):
        self.transport = transport

    def normalize_inbound(self, payload: dict) -> IncomingMessage:
        if not isinstance(payload, dict):
            raise ValueError("A JSON object is required.")

        expected = {
            "external_id",
            "conversation_reference",
            "sender_reference",
            "content",
        }

        if set(payload) != expected:
            raise ValueError("Unexpected or missing web chat fields.")

        return IncomingMessage(
            external_id=message_reference(payload["external_id"], "external_id"),
            conversation_reference=message_reference(
                payload["conversation_reference"], "conversation_reference"
            ),
            sender_reference=message_reference(
                payload["sender_reference"], "sender_reference"
            ),
            content=message_content(payload["content"]),
        )

    def send(
        self,
        *,
        destination: str,
        content: str,
        idempotency_key: str,
    ) -> DeliveryResult:
        destination = message_reference(destination, "destination")
        content = message_content(content)
        idempotency_key = message_reference(idempotency_key, "idempotency_key")

        if self.transport is None:
            return DeliveryResult(
                status="failed",
                retryable=False,
                error_code="transport_not_configured",
            )

        result = self.transport(
            destination=destination,
            content=content,
            idempotency_key=idempotency_key,
        )

        if not isinstance(result, DeliveryResult):
            raise ValueError("Transport returned an invalid delivery result.")

        return result
