"""Test plan creation using an isolated in-memory database."""

import unittest
from decimal import Decimal

from flask import Flask
from sqlalchemy import select

from api.commands import setup_commands
from api.models import Plan, db


class PlanCommandsTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite://",
        )
        db.init_app(self.app)
        setup_commands(self.app)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.runner = self.app.test_cli_runner()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_creates_missing_plans(self):
        result = self.runner.invoke(args=["seed-plans"])

        self.assertEqual(result.exit_code, 0, result.output)
        codes = set(db.session.scalars(select(Plan.code)).all())
        self.assertEqual(codes, {"starter", "professional", "business"})

    def test_preserves_existing_plans_and_prices(self):
        first = self.runner.invoke(args=["seed-plans"])
        self.assertEqual(first.exit_code, 0, first.output)

        starter = db.session.scalar(select(Plan).where(Plan.code == "starter"))
        starter.price_eur = Decimal("99.00")
        db.session.commit()

        second = self.runner.invoke(args=["seed-plans"])
        self.assertEqual(second.exit_code, 0, second.output)

        db.session.refresh(starter)
        self.assertEqual(starter.price_eur, Decimal("99.00"))
        self.assertEqual(len(db.session.scalars(select(Plan)).all()), 3)

    def test_browser_page_does_not_create_plans(self):
        from api.routes import api

        self.app.register_blueprint(api, url_prefix="/api")
        response = self.app.test_client().get("/api/seed-plans")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(db.session.scalars(select(Plan)).all(), [])

    def test_customers_can_still_read_plans(self):
        from api.routes import api

        self.app.register_blueprint(api, url_prefix="/api")
        result = self.runner.invoke(args=["seed-plans"])
        self.assertEqual(result.exit_code, 0, result.output)

        response = self.app.test_client().get("/api/plans")

        self.assertEqual(response.status_code, 200)
        codes = {plan["code"] for plan in response.get_json()}
        self.assertEqual(codes, {"starter", "professional", "business"})


if __name__ == "__main__":
    unittest.main()
