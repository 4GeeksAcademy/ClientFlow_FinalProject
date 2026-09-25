"""Test signed web chat session tokens."""

import unittest
from unittest.mock import patch

from flask import Flask

from api.channel_session import (
    create_chat_token,
    read_chat_token,
    session_serializer,
)


class ChatSessionTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config["JWT_SECRET_KEY"] = "test-session-key"
        self.context = self.app.app_context()
        self.context.push()
        self.addCleanup(self.context.pop)

    def test_valid_token_preserves_identifiers(self):
        token = create_chat_token(1, 2, 3)

        self.assertEqual(
            read_chat_token(token),
            {
                "company_id": 1,
                "conversation_id": 2,
                "participant_id": 3,
            },
        )

    def test_rejects_modified_token(self):
        token = create_chat_token(1, 2, 3)
        payload, timestamp, signature = token.split(".")
        replacement = "A" if signature[0] != "A" else "B"
        modified = ".".join([payload, timestamp, replacement + signature[1:]])

        with self.assertRaises(ValueError):
            read_chat_token(modified)

    def test_rejects_expired_token(self):
        with patch("itsdangerous.timed.time.time", return_value=1000):
            token = create_chat_token(1, 2, 3)

        with patch("itsdangerous.timed.time.time", return_value=4601):
            with self.assertRaises(ValueError):
                read_chat_token(token)

    def test_rejects_invalid_identifiers(self):
        for value in (0, -1, True, "1", None):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    create_chat_token(value, 2, 3)

    def test_rejects_signed_payload_with_extra_fields(self):
        token = session_serializer().dumps(
            {
                "company_id": 1,
                "conversation_id": 2,
                "participant_id": 3,
                "role": "admin",
            }
        )

        with self.assertRaises(ValueError):
            read_chat_token(token)

    def test_rejects_token_signed_with_another_key(self):
        token = create_chat_token(1, 2, 3)
        self.app.config["JWT_SECRET_KEY"] = "another-test-key"

        with self.assertRaises(ValueError):
            read_chat_token(token)
