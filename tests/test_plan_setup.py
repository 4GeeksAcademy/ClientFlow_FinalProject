"""Verify browser setup authorization and database preservation."""
import os
import unittest
from decimal import Decimal
from unittest.mock import patch

from flask import Flask
from sqlalchemy import select

from api.models import db, Plan
from api.routes import api


class BrowserSetupTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"PLAN_SEED_KEY": "test-setup-key-" * 4})
        self.env.start()
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite://")
        db.init_app(self.app)
        self.app.register_blueprint(api, url_prefix="/api")
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()
        self.env.stop()

    def test_get_never_writes_or_exposes_key(self):
        response = self.client.get("/api/seed-plans")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(os.environ["PLAN_SEED_KEY"], response.text)
        self.assertEqual(db.session.scalars(select(Plan)).all(), [])
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_missing_wrong_and_query_keys_denied(self):
        for data in ({}, {"setup_key": "wrong"}, {"setup_key": "é" * 32}):
            response = self.client.post("/api/seed-plans", data=data)
            self.assertIn(response.status_code, (403, 413))
        response = self.client.post("/api/seed-plans?setup_key=" + os.environ["PLAN_SEED_KEY"], data={"x": "y"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(db.session.scalars(select(Plan)).all(), [])

    def test_disabled_without_strong_configuration(self):
        for key in ("", "short"):
            with patch.dict(os.environ, {"PLAN_SEED_KEY": key}):
                response = self.client.post("/api/seed-plans", data={"setup_key": key})
                self.assertEqual(response.status_code, 503)
        self.assertEqual(db.session.scalars(select(Plan)).all(), [])

    def test_authorized_repeat_preserves_prices(self):
        data = {"setup_key": os.environ["PLAN_SEED_KEY"]}
        self.assertEqual(self.client.post("/api/seed-plans", data=data).status_code, 200)
        plan = db.session.scalar(select(Plan).where(Plan.code == "starter"))
        plan.price_eur = Decimal("99.00")
        db.session.commit()
        response = self.client.post("/api/seed-plans", data=data)
        self.assertEqual(response.status_code, 200)
        self.assertIn("All plans already exist", response.text)
        db.session.refresh(plan)
        self.assertEqual(plan.price_eur, Decimal("99.00"))
        self.assertEqual(len(db.session.scalars(select(Plan)).all()), 3)

    def test_missing_tables_returns_safe_error(self):
        db.drop_all()
        response = self.client.post("/api/seed-plans", data={"setup_key": os.environ["PLAN_SEED_KEY"]})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("sqlite", response.text)
