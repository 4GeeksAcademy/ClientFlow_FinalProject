"""Workspace settings persistence, authorization and tenant isolation."""

import unittest
from unittest.mock import patch

import test_auth
from api.models import (
    AIAgent,
    Company,
    CompanyMembership,
    Integration,
    KnowledgeDocument,
    MembershipRole,
    db,
)
from api.settings import settings


class SettingsTest(unittest.TestCase):
    def setUp(self):
        self.fixture = test_auth.AuthenticationTest()
        self.fixture.setUp()
        self.app = self.fixture.app
        self.app.register_blueprint(settings, url_prefix="/api")
        self.client = self.fixture.client
        self.company_id = self.fixture.company_id
        self.headers = self.fixture.headers() | {
            "X-Company-ID": str(self.company_id),
        }
        self.membership = db.session.scalar(
            db.select(CompanyMembership).where(
                CompanyMembership.company_id == self.company_id
            )
        )

    def tearDown(self):
        self.fixture.tearDown()

    def test_complete_settings_summary_is_company_scoped(self):
        own_agent = AIAgent(
            company_id=self.company_id,
            name="Own agent",
            purpose="Support",
            model_name="test",
            main_instruction="Use company sources.",
        )
        foreign_agent = AIAgent(
            company_id=self.fixture.other_id,
            name="Foreign agent",
            purpose="Support",
            model_name="test",
            main_instruction="Private.",
        )
        own_document = KnowledgeDocument(
            company_id=self.company_id,
            title="Own document",
            source_type="text",
            ingestion_status="ready",
            uploaded_by_membership_id=self.membership.id,
        )
        own_email = Integration(
            company_id=self.company_id,
            provider="email",
            status="configured",
            settings={
                "smtp_host": "smtp.example.com",
                "smtp_port": 587,
                "security": "starttls",
                "from_address": "support@example.com",
                "password": "legacy-secret-must-not-leak",
            },
            credentials_reference="secret/company-one",
        )
        foreign_email = Integration(
            company_id=self.fixture.other_id,
            provider="email",
            status="configured",
            settings={"private": "foreign-company-value"},
            credentials_reference="secret/company-two",
        )
        db.session.add_all([
            own_agent,
            foreign_agent,
            own_document,
            own_email,
            foreign_email,
        ])
        db.session.commit()

        with patch.dict("os.environ", {
            "AI_SERVICE_URL": "https://ai.internal",
            "AI_SERVICE_API_KEY": "test-secret",
            "AI_SERVICE_MODEL": "test-model",
        }):
            response = self.client.get("/api/settings", headers=self.headers)

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["company"]["id"], self.company_id)
        self.assertEqual(response.json["overview"]["agents"], 1)
        self.assertEqual(response.json["overview"]["knowledge_documents"], 1)
        self.assertEqual(response.json["overview"]["ready_documents"], 1)
        self.assertTrue(response.json["ai_service"]["configured"])
        self.assertEqual(response.json["ai_service"]["model"], "test-model")
        serialized = response.get_data(as_text=True)
        self.assertNotIn("secret/company-one", serialized)
        self.assertNotIn("legacy-secret-must-not-leak", serialized)
        self.assertNotIn("foreign-company-value", serialized)
        self.assertNotIn("test-secret", serialized)

    def test_company_and_preferences_persist(self):
        company_response = self.client.patch(
            "/api/settings/company",
            headers=self.headers,
            json={
                "name": "Carpintería Sevilla",
                "email": "hola@example.com",
                "phone": "+34 600 000 000",
                "timezone": "Europe/Madrid",
                "primary_colour": "#2244AA",
            },
        )
        self.assertEqual(company_response.status_code, 200, company_response.json)
        preference_response = self.client.patch(
            "/api/settings/preferences",
            headers=self.headers,
            json={"theme": "dark", "language": "es"},
        )
        self.assertEqual(preference_response.status_code, 200, preference_response.json)

        db.session.expire_all()
        company = db.session.get(Company, self.company_id)
        self.assertEqual(company.name, "Carpintería Sevilla")
        self.assertEqual(company.timezone, "Europe/Madrid")
        self.assertEqual(company.theme, "dark")
        self.assertEqual(company.default_language, "es")
        self.assertEqual(self.fixture.user.preferred_language, "es")
        refreshed = self.client.get("/api/settings", headers=self.headers).json
        self.assertEqual(refreshed["company"]["primary_colour"], "#2244AA")

    def test_invalid_company_and_preference_values_are_rejected(self):
        invalid_company_payloads = [
            {"name": ""},
            {"email": "invalid"},
            {"phone": "letters"},
            {"timezone": "Not/AZone"},
            {"primary_colour": "purple"},
            {"slug": "cannot-change"},
        ]
        for values in invalid_company_payloads:
            with self.subTest(values=values):
                response = self.client.patch(
                    "/api/settings/company", headers=self.headers, json=values
                )
                self.assertEqual(response.status_code, 400, response.json)

        for values in ({"theme": "blue"}, {"language": "fr"}, {"density": "tiny"}):
            with self.subTest(values=values):
                response = self.client.patch(
                    "/api/settings/preferences", headers=self.headers, json=values
                )
                self.assertEqual(response.status_code, 400, response.json)

    def test_non_manager_can_read_but_cannot_change_workspace(self):
        self.membership.role = MembershipRole.AGENT
        db.session.commit()

        response = self.client.get("/api/settings", headers=self.headers)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertFalse(response.json["membership"]["can_manage"])
        self.assertEqual(
            self.client.patch(
                "/api/settings/company",
                headers=self.headers,
                json={"name": "Blocked"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.put(
                "/api/settings/integrations/web_chat",
                headers=self.headers,
                json={"enabled": False, "settings": {}},
            ).status_code,
            403,
        )

    def test_integrations_validate_and_persist_without_browser_secrets(self):
        email = {
            "enabled": True,
            "settings": {
                "smtp_host": "smtp.example.com",
                "smtp_port": 587,
                "security": "starttls",
                "from_address": "support@example.com",
            },
        }
        response = self.client.put(
            "/api/settings/integrations/email", headers=self.headers, json=email
        )
        self.assertEqual(response.status_code, 200, response.json)
        row = db.session.scalar(db.select(Integration).where(
            Integration.company_id == self.company_id,
            Integration.provider == "email",
        ))
        self.assertEqual(row.status, "configured")
        self.assertIsNone(row.credentials_reference)

        bad_email = {**email, "settings": {**email["settings"], "password": "secret"}}
        self.assertEqual(
            self.client.put(
                "/api/settings/integrations/email",
                headers=self.headers,
                json=bad_email,
            ).status_code,
            400,
        )
        disconnected = self.client.put(
            "/api/settings/integrations/email",
            headers=self.headers,
            json={"enabled": False, "settings": {}},
        )
        self.assertEqual(disconnected.status_code, 200, disconnected.json)
        self.assertEqual(disconnected.json["integration"]["status"], "disconnected")

    def test_revoke_other_sessions_keeps_current_session(self):
        first_headers = self.headers
        second_headers = self.fixture.headers() | {
            "X-Company-ID": str(self.company_id),
        }
        response = self.client.post(
            "/api/settings/security/revoke-other-sessions",
            headers=second_headers,
        )
        self.assertEqual(response.status_code, 200, response.json)
        self.assertGreaterEqual(response.json["revoked"], 1)
        self.assertEqual(
            self.client.get("/api/settings", headers=first_headers).status_code,
            401,
        )
        self.assertEqual(
            self.client.get("/api/settings", headers=second_headers).status_code,
            200,
        )


if __name__ == "__main__":
    unittest.main()
