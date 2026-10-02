import unittest

from sqlalchemy import select, text

import test_auth
from api.models import (
    Client,
    Job,
    JobStage,
    JobStageStatus,
    JobStatus,
    db,
)
from api.routes import api


class JobApiTest(unittest.TestCase):
    setUpBase = test_auth.AuthenticationTest.setUp
    tearDown = test_auth.AuthenticationTest.tearDown
    login = test_auth.AuthenticationTest.login
    headers = test_auth.AuthenticationTest.headers

    def setUp(self):
        self.setUpBase()
        self.app.register_blueprint(api, url_prefix="/api")

        own_client = Client(
            company_id=self.company_id,
            first_name="Own",
            last_name="Client",
        )
        other_client = Client(
            company_id=self.other_id,
            first_name="Other",
            last_name="Client",
        )
        db.session.add_all([own_client, other_client])
        db.session.flush()

        own_job = Job(
            company_id=self.company_id,
            client_id=own_client.id,
            title="Kitchen",
            status=JobStatus.DRAFT,
            priority="normal",
            quoted_amount=1200,
        )
        other_job = Job(
            company_id=self.other_id,
            client_id=other_client.id,
            title="Other company job",
            status=JobStatus.DRAFT,
            priority="normal",
        )
        db.session.add_all([own_job, other_job])
        db.session.flush()
        stage = JobStage(
            job_id=own_job.id,
            title="Measure",
            position=1,
            status=JobStageStatus.PENDING,
        )
        db.session.add(stage)
        db.session.commit()

        self.client_id = own_client.id
        self.other_client_id = other_client.id
        self.job_id = own_job.id
        self.other_job_id = other_job.id
        self.stage_id = stage.id
        self.auth = self.headers() | {
            "X-Company-ID": str(self.company_id),
        }

    def test_list_and_detail_accept_legacy_lowercase_status(self):
        db.session.execute(
            text("UPDATE jobs SET status = 'draft' WHERE id = :job_id"),
            {"job_id": self.job_id},
        )
        db.session.commit()

        response = self.client.get("/api/jobs", headers=self.auth)
        detail = self.client.get(
            f"/api/jobs/{self.job_id}",
            headers=self.auth,
        )

        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual([item["id"] for item in response.json], [self.job_id])
        self.assertEqual(response.json[0]["status"], "draft")
        self.assertEqual(detail.status_code, 200, detail.json)
        self.assertEqual(detail.json["client"]["name"], "Own Client")
        self.assertEqual(detail.json["stages"][0]["name"], "Measure")

    def test_create_update_stage_and_delete(self):
        created = self.client.post(
            "/api/jobs",
            headers=self.auth,
            json={
                "client_id": self.client_id,
                "title": "Wardrobe",
                "quoted_amount": 900,
                "scheduled_start": "2026-09-28T00:00:00",
                "scheduled_end": "2026-10-28T23:59:59",
            },
        )
        self.assertEqual(created.status_code, 201, created.json)
        self.assertEqual(created.json["status"], "draft")
        self.assertEqual(created.json["scheduled_start"], "2026-09-28T00:00:00")
        self.assertEqual(created.json["scheduled_end"], "2026-10-28T23:59:59")

        updated = self.client.put(
            f"/api/jobs/{self.job_id}",
            headers=self.auth,
            json={
                "status": "in_progress",
                "stages": [{"id": self.stage_id, "status": "completed"}],
                "progress": 100,
            },
        )
        self.assertEqual(updated.status_code, 200, updated.json)
        self.assertEqual(updated.json["status"], "in_progress")
        self.assertEqual(updated.json["stages"][0]["status"], "completed")
        self.assertEqual(updated.json["progress"], 100)

        added_stage = self.client.post(
            f"/api/jobs/{self.job_id}/stages",
            headers=self.auth,
            json={
                "title": "Manufacture",
                "description": "Build the wardrobe",
                "due_at": "2026-10-10",
            },
        )
        self.assertEqual(added_stage.status_code, 201, added_stage.json)
        self.assertEqual(len(added_stage.json["stages"]), 2)
        self.assertEqual(added_stage.json["stages"][1]["name"], "Manufacture")
        self.assertEqual(added_stage.json["stages"][1]["position"], 2)

        deleted = self.client.delete(
            f"/api/jobs/{created.json['id']}",
            headers=self.auth,
        )
        self.assertEqual(deleted.status_code, 200, deleted.json)

    def test_jobs_are_company_isolated_and_validate_status(self):
        self.assertEqual(
            self.client.get(
                f"/api/jobs/{self.other_job_id}",
                headers=self.auth,
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                "/api/jobs",
                headers=self.auth,
                json={
                    "client_id": self.other_client_id,
                    "title": "Cross-company",
                },
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.put(
                f"/api/jobs/{self.job_id}",
                headers=self.auth,
                json={"status": "unknown"},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                f"/api/jobs/{self.other_job_id}/stages",
                headers=self.auth,
                json={"title": "Cross-company stage"},
            ).status_code,
            404,
        )
        self.assertEqual(
            db.session.scalar(
                select(Job.title).where(Job.id == self.job_id)
            ),
            "Kitchen",
        )

    def test_rejects_a_schedule_that_ends_before_it_starts(self):
        response = self.client.post(
            "/api/jobs",
            headers=self.auth,
            json={
                "client_id": self.client_id,
                "title": "Invalid schedule",
                "scheduled_start": "2026-09-28T00:00:00",
                "scheduled_end": "2026-09-27T23:59:59",
            },
        )

        self.assertEqual(response.status_code, 400, response.json)
        self.assertEqual(
            response.json["error"],
            "The scheduled end must not precede the start",
        )


if __name__ == "__main__":
    unittest.main()
