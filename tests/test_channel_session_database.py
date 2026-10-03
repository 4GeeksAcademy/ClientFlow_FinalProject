"""Verify web chat session isolation using an in-memory database."""

import unittest

from flask import Flask

from api.channel_session import create_chat_token, resolve_chat_session
from api.models import (
    ChannelType,
    Company,
    Conversation,
    ConversationParticipant,
    db,
)


class ChatSessionDatabaseTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite://",
            JWT_SECRET_KEY="test-session-key",
        )
        db.init_app(self.app)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()

        self.company = Company(name="First", slug="first")
        self.other_company = Company(name="Second", slug="second")
        db.session.add_all([self.company, self.other_company])
        db.session.flush()

        self.conversation = Conversation(
            company_id=self.company.id,
            channel=ChannelType.WEB,
        )
        self.other_conversation = Conversation(
            company_id=self.other_company.id,
            channel=ChannelType.WEB,
        )
        db.session.add_all(
            [
                self.conversation,
                self.other_conversation,
            ]
        )
        db.session.flush()

        self.visitor = ConversationParticipant(
            conversation_id=self.conversation.id,
            participant_type="visitor",
        )
        self.other_visitor = ConversationParticipant(
            conversation_id=self.other_conversation.id,
            participant_type="visitor",
        )
        db.session.add_all([self.visitor, self.other_visitor])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def token(self):
        return create_chat_token(
            self.company.id,
            self.conversation.id,
            self.visitor.id,
        )

    def test_accepts_matching_visitor(self):
        conversation, participant = resolve_chat_session(self.token())

        self.assertEqual(conversation.id, self.conversation.id)
        self.assertEqual(participant.id, self.visitor.id)

    def test_rejects_another_company(self):
        token = create_chat_token(
            self.other_company.id,
            self.conversation.id,
            self.visitor.id,
        )

        with self.assertRaises(ValueError):
            resolve_chat_session(token)

    def test_rejects_visitor_from_another_conversation(self):
        token = create_chat_token(
            self.company.id,
            self.conversation.id,
            self.other_visitor.id,
        )

        with self.assertRaises(ValueError):
            resolve_chat_session(token)

    def test_rechecks_company_after_token_creation(self):
        token = self.token()
        self.company.is_active = False
        db.session.commit()

        with self.assertRaises(ValueError):
            resolve_chat_session(token)

    def test_rejects_non_web_conversation(self):
        token = self.token()
        self.conversation.channel = ChannelType.EMAIL
        db.session.commit()

        with self.assertRaises(ValueError):
            resolve_chat_session(token)

    def test_rejects_deleted_participant(self):
        token = self.token()
        db.session.delete(self.visitor)
        db.session.commit()

        with self.assertRaises(ValueError):
            resolve_chat_session(token)

    def chat_client(self):
        from api.channel_routes import channels

        self.app.register_blueprint(channels, url_prefix="/api")
        return self.app.test_client()

    def add_message(self, conversation_id, content):
        from api.models import Message, MessageDirection

        message = Message(
            conversation_id=conversation_id,
            direction=MessageDirection.OUTBOUND,
            content=content,
            content_type="text",
            delivery_status="stored",
        )
        db.session.add(message)
        db.session.flush()
        return message

    def test_route_requires_token(self):
        client = self.chat_client()

        response = client.get("/api/web-chat/messages")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_route_returns_only_authorized_conversation(self):
        client = self.chat_client()
        self.add_message(self.conversation.id, "Visible message")
        self.add_message(self.other_conversation.id, "Private message")
        db.session.commit()

        response = client.get(
            "/api/web-chat/messages",
            headers={"Authorization": f"Bearer {self.token()}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [message["content"] for message in response.json["messages"]],
            ["Visible message"],
        )

    def test_route_paginates_without_duplicates(self):
        client = self.chat_client()

        for index in range(51):
            self.add_message(self.conversation.id, f"Message {index}")

        db.session.commit()
        headers = {"Authorization": f"Bearer {self.token()}"}

        first = client.get("/api/web-chat/messages", headers=headers)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(len(first.json["messages"]), 50)
        self.assertTrue(first.json["has_more"])

        cursor = first.json["next_after_id"]
        second = client.get(
            f"/api/web-chat/messages?after_id={cursor}",
            headers=headers,
        )

        self.assertEqual(second.status_code, 200)
        self.assertEqual(len(second.json["messages"]), 1)
        self.assertFalse(second.json["has_more"])

        first_ids = {message["id"] for message in first.json["messages"]}
        second_ids = {message["id"] for message in second.json["messages"]}
        self.assertTrue(first_ids.isdisjoint(second_ids))

    def test_send_retry_stores_only_one_message(self):
        from api.models import Message

        client = self.chat_client()
        headers = {"Authorization": f"Bearer {self.token()}"}
        payload = {
            "external_id": "visitor-message-001",
            "content": "  Hello!  ",
        }

        first = client.post(
            "/api/web-chat/messages",
            headers=headers,
            json=payload,
        )
        second = client.post(
            "/api/web-chat/messages",
            headers=headers,
            json=payload,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(first.json["created"])
        self.assertFalse(second.json["created"])
        self.assertEqual(
            first.json["message"]["id"],
            second.json["message"]["id"],
        )

        messages = db.session.scalars(
            db.select(Message).where(Message.conversation_id == self.conversation.id)
        ).all()

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].content, "Hello!")
        self.assertEqual(messages[0].sender_participant_id, self.visitor.id)

    def test_send_rejects_reused_identifier_with_changed_content(self):
        client = self.chat_client()
        headers = {"Authorization": f"Bearer {self.token()}"}

        first = client.post(
            "/api/web-chat/messages",
            headers=headers,
            json={"external_id": "message-001", "content": "Original"},
        )
        second = client.post(
            "/api/web-chat/messages",
            headers=headers,
            json={"external_id": "message-001", "content": "Changed"},
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)

        history = client.get("/api/web-chat/messages", headers=headers)
        self.assertEqual(
            [message["content"] for message in history.json["messages"]],
            ["Original"],
        )

    def test_send_rejects_company_in_payload(self):
        client = self.chat_client()
        headers = {"Authorization": f"Bearer {self.token()}"}

        response = client.post(
            "/api/web-chat/messages",
            headers=headers,
            json={
                "external_id": "message-002",
                "content": "Hello",
                "company_id": self.other_company.id,
            },
        )

        self.assertEqual(response.status_code, 400)

        history = client.get("/api/web-chat/messages", headers=headers)
        self.assertEqual(history.json["messages"], [])

    def test_send_requires_valid_session(self):
        client = self.chat_client()

        for headers in ({}, {"Authorization": "Bearer invalid-token"}):
            with self.subTest(headers=headers):
                response = client.post(
                    "/api/web-chat/messages",
                    headers=headers,
                    json={
                        "external_id": "message-003",
                        "content": "Hello",
                    },
                )

                self.assertEqual(response.status_code, 401)
