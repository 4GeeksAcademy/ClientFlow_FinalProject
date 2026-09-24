"""Common message contracts for communication channel adapters."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class IncomingMessage:
    external_id: str
    conversation_reference: str
    sender_reference: str
    content: str


@dataclass(frozen=True)
class DeliveryResult:
    status: str
    external_id: str | None = None
    retryable: bool = False
    error_code: str | None = None


class ChannelAdapter(Protocol):
    def normalize_inbound(self, payload: dict) -> IncomingMessage:
        """Convert a verified provider event into a common message."""
        ...

    def send(
        self,
        *,
        destination: str,
        content: str,
        idempotency_key: str,
    ) -> DeliveryResult:
        """Deliver a message, avoiding duplicates when retried."""
        ...
