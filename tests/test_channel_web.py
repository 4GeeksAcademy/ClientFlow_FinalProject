"""Test web chat normalization without sending messages."""

import unittest

from api.channel_web import WebChatAdapter


class WebChatAdapterTest(unittest.TestCase):
    def setUp(self):
        self.adapter = WebChatAdapter()
        self.payload = {
            "external_id": "message-001",
            "conversation_reference": "conversation-001",
            "sender_reference": "visitor-001",
            "content": "  Hello!  ",
        }

    def test_normalizes_content(self):
        message = self.adapter.normalize_inbound(self.payload)

        self.assertEqual(message.content, "Hello!")
        self.assertEqual(message.external_id, "message-001")

    def test_rejects_invalid_content(self):
        for content in ("", "   ", "x" * 10001, "Hello\x00", None):
            with self.subTest(content_type=type(content).__name__):
                with self.assertRaises(ValueError):
                    self.adapter.normalize_inbound({**self.payload, "content": content})

    def test_rejects_unexpected_company_field(self):
        with self.assertRaises(ValueError):
            self.adapter.normalize_inbound({**self.payload, "company_id": 999})

    def test_missing_transport_does_not_report_success(self):
        result = self.adapter.send(
            destination="conversation-001",
            content="Hello!",
            idempotency_key="outbound-001",
        )

        self.assertEqual(result.status, "failed")
        self.assertEqual(result.error_code, "transport_not_configured")
        self.assertFalse(result.retryable)

    def test_send_passes_normalized_content_and_same_retry_key(self):
        from unittest.mock import Mock

        from api.channel_types import DeliveryResult

        transport = Mock(return_value=DeliveryResult(status="stored"))
        adapter = WebChatAdapter(transport=transport)

        result = adapter.send(
            destination="conversation-001",
            content="  Hello!  ",
            idempotency_key="outbound-001",
        )

        transport.assert_called_once_with(
            destination="conversation-001",
            content="Hello!",
            idempotency_key="outbound-001",
        )
        self.assertEqual(result.status, "stored")
