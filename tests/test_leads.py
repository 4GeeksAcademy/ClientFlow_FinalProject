from api.routes import api
from api.models import (
    db,
    User,
    Company,
    CompanyMembership,
    MembershipRole,
    Lead,
    Client,
    Activity,
)
from api.auth import init_auth, set_password
from sqlalchemy import select
from flask import Flask
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


class LeadActivitiesTest(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI=os.getenv(
                "AUTH_TEST_DATABASE_URL", "sqlite://"),
            JWT_SECRET_KEY="test-secret-" * 8,
            AUTH_RATE_LIMIT_ENABLED=False,
        )

        db.init_app(self.app)
        init_auth(self.app)
        self.app.register_blueprint(api, url_prefix="/api")

        self.ctx = self.app.app_context()
        self.ctx.push()

        db.create_all()

        self.user = User(
            email="lead-test@example.com",
            first_name="Lead",
            last_name="Tester",
        )
        set_password(self.user, "test-password-123")

        self.company = Company(
            name="Lead Company",
            slug="lead-company",
        )

        self.other_company = Company(
            name="Other Company",
            slug="other-company",
        )

        db.session.add_all([
            self.user,
            self.company,
            self.other_company,
        ])
        db.session.flush()

        self.membership = CompanyMembership(
            user_id=self.user.id,
            company_id=self.company.id,
            role=MembershipRole.OWNER,
        )

        db.session.add(self.membership)
        db.session.flush()

        self.lead = Lead(
            company_id=self.company.id,
            first_name="Ana",
            last_name="García",
            email="ana@example.com",
        )

        db.session.add(self.lead)
        db.session.flush()

        self.activity = Activity(
            company_id=self.company.id,
            actor_membership_id=self.membership.id,
            lead_id=self.lead.id,
            event_type="note_added",
            description="Primera interacción con el lead.",
        )

        db.session.add(self.activity)
        db.session.commit()

        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.ctx.pop()

    def login(self):
        response = self.client.post(
            "/api/login",
            json={
                "email": "lead-test@example.com",
                "password": "test-password-123",
            },
        )
        return response

    def headers(self):
        login_response = self.login()

        return {
            "Authorization": "Bearer " + login_response.json["token"],
            "X-Company-ID": str(self.company.id),
        }

    def test_list_leads(self):
        response = self.client.get(
            "/api/leads",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(data["pagination"]["total"], 1)
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["id"], self.lead.id)
        self.assertEqual(data["items"][0]["first_name"], "Ana")

    def test_get_lead(self):
        response = self.client.get(
            f"/api/leads/{self.lead.id}",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(data["id"], self.lead.id)
        self.assertEqual(data["first_name"], "Ana")
        self.assertEqual(data["last_name"], "García")
        self.assertEqual(data["email"], "ana@example.com")

    def test_create_lead(self):
        response = self.client.post(
            "/api/leads",
            json={
                "first_name": "Carlos",
                "last_name": "López",
                "email": "carlos@example.com",
                "phone": "600123123",
            },
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 201)

        data = response.json

        self.assertIsNotNone(data["id"])
        self.assertEqual(data["first_name"], "Carlos")
        self.assertEqual(data["last_name"], "López")
        self.assertEqual(data["email"], "carlos@example.com")
        self.assertEqual(data["company_id"], self.company.id)

    def test_update_lead(self):
        response = self.client.patch(
            f"/api/leads/{self.lead.id}",
            json={
                "first_name": "Ana María",
                "phone": "611222333",
            },
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(data["id"], self.lead.id)
        self.assertEqual(data["first_name"], "Ana María")
        self.assertEqual(data["phone"], "611222333")

    def test_list_lead_activities(self):
        response = self.client.get(
            f"/api/leads/{self.lead.id}/activities",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["lead_id"], self.lead.id)
        self.assertEqual(data[0]["event_type"], "note_added")
        self.assertEqual(
            data[0]["description"],
            "Primera interacción con el lead.",
        )

    def test_cannot_access_lead_from_other_company(self):
        other_lead = Lead(
            company_id=self.other_company.id,
            first_name="Other",
            last_name="Lead",
        )

        db.session.add(other_lead)
        db.session.commit()

        response = self.client.get(
            f"/api/leads/{other_lead.id}/activities",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 404)

    def test_cannot_update_lead_from_other_company(self):
        other_lead = Lead(
            company_id=self.other_company.id,
            first_name="Lead",
            last_name="OtraEmpresa",
            email="other@example.com",
        )
        db.session.add(other_lead)
        db.session.commit()

        response = self.client.patch(
            f"/api/leads/{other_lead.id}",
            json={"first_name": "Intento de cambio"},
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 404)

        db.session.refresh(other_lead)
        self.assertEqual(other_lead.first_name, "Lead")

    def test_convert_lead_to_client(self):
        lead = Lead(
            company_id=self.company.id,
            first_name="Ana",
            last_name="García",
            email="ana@example.com",
            phone="600123123",
            notes="Lead de prueba",
        )
        db.session.add(lead)
        db.session.commit()

        response = self.client.post(
            f"/api/leads/{lead.id}/convert",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 201)

        data = response.get_json()

        self.assertEqual(data["lead_id"], lead.id)
        self.assertIsNotNone(data["client_id"])
        self.assertEqual(data["status"], "won")
        self.assertIsNotNone(data["converted_at"])

        db.session.refresh(lead)

        self.assertEqual(lead.converted_client_id, data["client_id"])
        self.assertIsNotNone(lead.converted_at)

        client = db.session.get(Client, data["client_id"])

        self.assertIsNotNone(client)
        self.assertEqual(client.company_id, self.company.id)
        self.assertEqual(client.first_name, "Ana")
        self.assertEqual(client.last_name, "García")
        self.assertEqual(client.email, "ana@example.com")

        activity = db.session.scalar(
            select(Activity).where(
                Activity.lead_id == lead.id,
                Activity.event_type == "lead_converted",
            )
        )

        self.assertIsNotNone(activity)
        self.assertEqual(
            activity.metadata_json["client_id"],
            client.id,
        )

    def test_critical_user_journey_create_update_convert(self):

        # 1. Crear Lead
        response = self.client.post(
            "/api/leads",
            json={
                "first_name": "Laura",
                "last_name": "Martínez",
                "email": "laura@example.com",
                "phone": "600111222",
            },
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 201)
        lead_data = response.get_json()
        lead_id = lead_data["id"]

        # 2. Actualizar Lead
        response = self.client.patch(
            f"/api/leads/{lead_id}",
            json={
                "phone": "600999888",
                "notes": "Cliente potencial interesado.",
            },
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)
        updated_lead = response.get_json()

        self.assertEqual(updated_lead["phone"], "600999888")
        self.assertEqual(
            updated_lead["notes"],
            "Cliente potencial interesado.",
        )

        # 3. Convertir Lead en Cliente
        response = self.client.post(
            f"/api/leads/{lead_id}/convert",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 201)
        conversion_data = response.get_json()

        self.assertEqual(conversion_data["lead_id"], lead_id)
        self.assertEqual(conversion_data["status"], "won")
        self.assertIsNotNone(conversion_data["client_id"])

        # 4. Comprobar que el Cliente pertenece a la misma empresa
        client = db.session.get(Client, conversion_data["client_id"])

        self.assertIsNotNone(client)
        self.assertEqual(client.company_id, self.company.id)
        self.assertEqual(client.first_name, "Laura")
        self.assertEqual(client.last_name, "Martínez")
        self.assertEqual(client.email, "laura@example.com")

        # 5. Comprobar que el Lead quedó convertido
        lead = db.session.get(Lead, lead_id)

        self.assertIsNotNone(lead)
        self.assertEqual(lead.status.value, "won")
        self.assertEqual(
            lead.converted_client_id,
            client.id,
        )

        # 6. Comprobar que se conserva el historial de conversión
        activity = db.session.scalar(
            select(Activity).where(
                Activity.lead_id == lead_id,
                Activity.event_type == "lead_converted",
            )
        )

        self.assertIsNotNone(activity)
        self.assertEqual(
            activity.metadata_json["client_id"],
            client.id,
        )

    def test_cannot_convert_lead_twice(self):
        lead = Lead(
            company_id=self.company.id,
            first_name="Carlos",
            last_name="López",
            email="carlos@example.com",
        )
        db.session.add(lead)
        db.session.commit()

        first_response = self.client.post(
            f"/api/leads/{lead.id}/convert",
            headers=self.headers(),
        )

        self.assertEqual(first_response.status_code, 201)

        second_response = self.client.post(
            f"/api/leads/{lead.id}/convert",
            headers=self.headers(),
        )

        self.assertEqual(second_response.status_code, 409)

        data = second_response.get_json()

        self.assertEqual(
            data["client_id"],
            lead.converted_client_id,
        )

    def test_cannot_convert_lead_from_other_company(self):
        other_company = Company(
            name="Other Company",
            slug="other-company-test",
        )
        db.session.add(other_company)
        db.session.commit()

        lead = Lead(
            company_id=other_company.id,
            first_name="Pedro",
            last_name="Gómez",
            email="pedro@example.com",
        )
        db.session.add(lead)
        db.session.commit()

        response = self.client.post(
            f"/api/leads/{lead.id}/convert",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 404)

        self.assertIsNone(lead.converted_client_id)


if __name__ == "__main__":
    unittest.main()
