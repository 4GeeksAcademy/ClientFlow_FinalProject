"""Test operator permissions when creating visitor sessions."""

import unittest

import test_auth

from api.channel_routes import channels
from api.channel_session import resolve_chat_session
from api.models import CompanyMembership, MembershipRole, db


class ChatSessionCreationTest(unittest.TestCase):
    def setUp(self):
        self.fixture = test_auth.AuthenticationTest()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.fixture.app.register_blueprint(channels, url_prefix="/api")
        self.client = self.fixture.client
        self.headers = self.fixture.headers()
        self.headers["X-Company-ID"] = str(self.fixture.company_id)

    def test_operator_creates_working_visitor_session(self):
        response = self.client.post(
            "/api/web-chat/sessions",
            headers=self.headers,
            json={"display_name": "Visitor"},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

        token = response.json["token"]
        conversation, participant = resolve_chat_session(token)

        self.assertEqual(conversation.company_id, self.fixture.company_id)
        self.assertEqual(participant.display_name, "Visitor")
        self.assertIsNone(participant.membership_id)

        history = self.client.get(
            "/api/web-chat/messages",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json["messages"], [])

    def test_rejects_missing_login(self):
        response = self.client.post(
            "/api/web-chat/sessions",
            json={"display_name": "Visitor"},
        )

        self.assertEqual(response.status_code, 401)

    def test_rejects_another_company(self):
        headers = {
            **self.headers,
            "X-Company-ID": str(self.fixture.other_id),
        }
        response = self.client.post(
            "/api/web-chat/sessions",
            headers=headers,
            json={"display_name": "Visitor"},
        )

        self.assertEqual(response.status_code, 403)

    def test_rejects_technician_role(self):
        membership = db.session.scalar(
            db.select(CompanyMembership).where(
                CompanyMembership.company_id == self.fixture.company_id,
                CompanyMembership.user_id == self.fixture.user.id,
            )
        )
        membership.role = MembershipRole.TECHNICIAN
        db.session.commit()

        response = self.client.post(
            "/api/web-chat/sessions",
            headers=self.headers,
            json={"display_name": "Visitor"},
        )

        self.assertEqual(response.status_code, 403)

    def test_rejects_company_in_payload(self):
        response = self.client.post(
            "/api/web-chat/sessions",
            headers=self.headers,
            json={
                "display_name": "Visitor",
                "company_id": self.fixture.other_id,
            },
        )

        self.assertEqual(response.status_code, 400)
