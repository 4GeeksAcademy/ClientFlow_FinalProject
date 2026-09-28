import unittest
from datetime import timedelta

import test_auth
from api.dashboard import dashboard
from api.models import (
    Activity,
    Appointment,
    AppointmentStatus,
    Client,
    CompanyMembership,
    Job,
    JobStatus,
    Lead,
    LeadStatus,
    db,
    utc_now,
)


class DashboardApiTest(unittest.TestCase):
    setUpBase = test_auth.AuthenticationTest.setUp
    tearDown = test_auth.AuthenticationTest.tearDown
    login = test_auth.AuthenticationTest.login
    headers = test_auth.AuthenticationTest.headers

    def setUp(self):
        self.setUpBase()
        self.app.register_blueprint(dashboard, url_prefix="/api")
        now = utc_now()
        membership = db.session.query(CompanyMembership).filter_by(
            company_id=self.company_id
        ).one()
        client = Client(
            company_id=self.company_id,
            first_name="Dashboard",
            last_name="Client",
            created_at=now - timedelta(days=2),
        )
        other_client = Client(
            company_id=self.other_id,
            first_name="Other",
            created_at=now - timedelta(days=2),
        )
        lead = Lead(
            company_id=self.company_id,
            first_name="New",
            source="Website",
            status=LeadStatus.NEW,
            created_at=now - timedelta(days=1),
        )
        db.session.add_all([client, other_client, lead])
        db.session.flush()
        completed = Job(
            company_id=self.company_id,
            client_id=client.id,
            assigned_membership_id=membership.id,
            title="Completed wardrobe",
            status=JobStatus.COMPLETED,
            quoted_amount=1200,
            completed_at=now - timedelta(days=1),
            created_at=now - timedelta(days=4),
        )
        progress = Job(
            company_id=self.company_id,
            client_id=client.id,
            title="Kitchen",
            status=JobStatus.IN_PROGRESS,
            quoted_amount=800,
            created_at=now - timedelta(days=1),
        )
        db.session.add_all([completed, progress])
        db.session.flush()
        db.session.add_all(
            [
                Appointment(
                    company_id=self.company_id,
                    client_id=client.id,
                    assigned_membership_id=membership.id,
                    title="Measurement",
                    status=AppointmentStatus.SCHEDULED,
                    starts_at=now - timedelta(hours=2),
                    ends_at=now - timedelta(hours=1),
                ),
                Activity(
                    company_id=self.company_id,
                    client_id=client.id,
                    event_type="client_created",
                    description="Client created",
                ),
            ]
        )
        db.session.commit()
        self.auth = self.headers() | {
            "X-Company-ID": str(self.company_id),
        }

    def test_metrics_use_real_tenant_data(self):
        response = self.client.get(
            "/api/dashboard/metrics?period=30d",
            headers=self.auth,
        )

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["sales_this_month"]["value"], 1200.0)
        self.assertEqual(response.json["sales_this_month"]["currency"], "EUR")
        self.assertEqual(response.json["new_leads"]["value"], 1)
        self.assertEqual(response.json["active_clients"]["value"], 1)
        self.assertEqual(response.json["jobs_in_progress"]["value"], 1)
        self.assertEqual(response.json["appointments"]["value"], 1)
        self.assertEqual(
            response.json["sales_summary"]["records"][0]["job"],
            "Completed wardrobe",
        )

    def test_charts_return_real_series_and_breakdowns(self):
        response = self.client.get(
            "/api/dashboard/charts?scale=days",
            headers=self.auth,
        )

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(len(response.json["series"]), 7)
        self.assertEqual(sum(row["leads"] for row in response.json["series"]), 1)
        self.assertEqual(sum(row["clients"] for row in response.json["series"]), 1)
        self.assertIn(
            {"status": "in_progress", "count": 1},
            response.json["job_status"],
        )
        self.assertEqual(response.json["lead_sources"][0]["source"], "Website")
        self.assertEqual(
            response.json["recent_activity"][0]["event_type"],
            "client_created",
        )

    def test_dashboard_is_tenant_scoped_and_validates_filters(self):
        self.assertEqual(
            self.client.get("/api/dashboard/metrics").status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/api/dashboard/metrics?period=invalid",
                headers=self.auth,
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/dashboard/charts?scale=invalid",
                headers=self.auth,
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
