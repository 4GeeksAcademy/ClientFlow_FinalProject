import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from api.auth import init_auth, set_password
from api.models import (
    Appointment,
    AppointmentStatus,
    Attachment,
    Client,
    Company,
    CompanyMembership,
    Job,
    JobStatus,
    Lead,
    LeadStatus,
    MembershipRole,
    User,
    db,
)
from api.routes import api


class ClientRelatedResourcesTest(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI=os.getenv(
                "AUTH_TEST_DATABASE_URL", "sqlite://"
            ),
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
            email="client-test@example.com",
            first_name="Client",
            last_name="Tester",
        )
        set_password(self.user, "test-password-123")

        self.company = Company(
            name="Client Company",
            slug="client-company",
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

        self.client = Client(
            company_id=self.company.id,
            first_name="Ana",
            last_name="García",
            email="ana@example.com",
        )

        self.other_client = Client(
            company_id=self.other_company.id,
            first_name="Other",
            last_name="Client",
            email="other@example.com",
        )

        db.session.add_all([
            self.client,
            self.other_client,
        ])
        db.session.flush()

        self.lead = Lead(
            company_id=self.company.id,
            converted_client_id=self.client.id,
            first_name="Ana",
            last_name="García",
            email="ana@example.com",
            status=LeadStatus.WON,
        )

        self.other_lead = Lead(
            company_id=self.other_company.id,
            converted_client_id=self.other_client.id,
            first_name="Other",
            last_name="Lead",
            email="other-lead@example.com",
            status=LeadStatus.WON,
        )

        db.session.add_all([
            self.lead,
            self.other_lead,
        ])
        db.session.flush()

        self.job = Job(
            company_id=self.company.id,
            client_id=self.client.id,
            title="Instalación principal",
            status=JobStatus.SCHEDULED,
            priority="normal",
        )

        self.other_job = Job(
            company_id=self.other_company.id,
            client_id=self.other_client.id,
            title="Trabajo otra empresa",
            status=JobStatus.SCHEDULED,
            priority="normal",
        )

        now = datetime.now(timezone.utc)

        self.appointment = Appointment(
            company_id=self.company.id,
            client_id=self.client.id,
            assigned_membership_id=self.membership.id,
            title="Visita técnica",
            status=AppointmentStatus.SCHEDULED,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
        )

        self.other_appointment = Appointment(
            company_id=self.other_company.id,
            client_id=self.other_client.id,
            assigned_membership_id=self.membership.id,
            title="Cita otra empresa",
            status=AppointmentStatus.SCHEDULED,
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=1),
        )

        self.attachment = Attachment(
            company_id=self.company.id,
            uploaded_by_membership_id=self.membership.id,
            client_id=self.client.id,
            filename="contrato.pdf",
            storage_key="company/contrato.pdf",
            content_type="application/pdf",
            size_bytes=1024,
            category="document",
        )

        db.session.add_all([
            self.job,
            self.other_job,
            self.appointment,
            self.other_appointment,
            self.attachment,
        ])
        db.session.commit()

        from api.models import Plan, Subscription, utc_now

        plan = Plan(
            code="fixture-client",
            name="Fixture Client",
            price_eur=20,
        )

        db.session.add(
            Subscription(
                company=self.company,
                plan=plan,
                trial_started_at=utc_now(),
                trial_ends_at=utc_now() + timedelta(days=3),
            )
        )
        db.session.commit()

        self.client_http = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.ctx.pop()

    def headers(self):
        response = self.client_http.post(
            "/api/login",
            json={
                "email": "client-test@example.com",
                "password": "test-password-123",
            },
        )

        return {
            "Authorization": "Bearer " + response.json["token"],
            "X-Company-ID": str(self.company.id),
        }

    def test_list_client_jobs(self):
        response = self.client_http.get(
            f"/api/clients/{self.client.id}/jobs",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.job.id)
        self.assertEqual(data[0]["client_id"], self.client.id)
        self.assertEqual(data[0]["title"], "Instalación principal")
        self.assertEqual(data[0]["status"], "scheduled")


    def test_list_client_leads(self):
        response = self.client_http.get(
            f"/api/clients/{self.client.id}/leads",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.lead.id)
        self.assertEqual(data[0]["converted_client_id"], self.client.id)
        self.assertEqual(data[0]["first_name"], "Ana")
        self.assertEqual(data[0]["status"], "won")

    def test_cannot_access_leads_from_other_company(self):
        response = self.client_http.get(
            f"/api/clients/{self.other_client.id}/leads",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 404)

    def test_client_leads_do_not_cross_company_boundary(self):
        response = self.client_http.get(
            f"/api/clients/{self.client.id}/leads",
            headers=self.headers(),
        )

        self.assertEqual(
            [item["id"] for item in response.json],
            [self.lead.id],
        )
    
    def test_list_client_appointments(self):
        response = self.client_http.get(
            f"/api/clients/{self.client.id}/appointments",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.appointment.id)
        self.assertEqual(data[0]["client_id"], self.client.id)
        self.assertEqual(data[0]["title"], "Visita técnica")
        self.assertEqual(data[0]["status"], "scheduled")

    def test_list_client_attachments(self):
        response = self.client_http.get(
            f"/api/clients/{self.client.id}/attachments",
            headers=self.headers(),
        )

        self.assertEqual(response.status_code, 200)

        data = response.json

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.attachment.id)
        self.assertEqual(data[0]["client_id"], self.client.id)
        self.assertEqual(data[0]["filename"], "contrato.pdf")
        self.assertEqual(data[0]["content_type"], "application/pdf")

    def test_cannot_access_client_from_other_company(self):
        for resource in ("jobs", "appointments", "attachments"):
            response = self.client_http.get(
                f"/api/clients/{self.other_client.id}/{resource}",
                headers=self.headers(),
            )

            self.assertEqual(response.status_code, 404)

    def test_client_resources_do_not_cross_company_boundary(self):
        jobs_response = self.client_http.get(
            f"/api/clients/{self.client.id}/jobs",
            headers=self.headers(),
        )
        appointments_response = self.client_http.get(
            f"/api/clients/{self.client.id}/appointments",
            headers=self.headers(),
        )

        self.assertEqual(
            [item["id"] for item in jobs_response.json],
            [self.job.id],
        )
        self.assertEqual(
            [item["id"] for item in appointments_response.json],
            [self.appointment.id],
        )


if __name__ == "__main__":
    unittest.main()
