"""Test email configuration without contacting an email server."""

import unittest

from flask import Flask

from api.channel_email import (
    load_email_configuration,
    validate_email_settings,
)
from api.models import Company, Integration, db


class EmailConfigurationTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
        db.init_app(self.app)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()

        self.company = Company(name="First", slug="first")
        self.other_company = Company(name="Second", slug="second")
        db.session.add_all([self.company, self.other_company])
        db.session.flush()

        self.settings = {
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "security": "starttls",
            "from_address": "support@example.com",
        }
        self.integration = Integration(
            company_id=self.company.id,
            provider="email",
            settings=self.settings,
            credentials_reference="email/company-first",
        )
        db.session.add(self.integration)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def test_loads_own_company_configuration(self):
        result = load_email_configuration(self.company.id)

        self.assertEqual(result["settings"], self.settings)
        self.assertEqual(
            result["credentials_reference"],
            "email/company-first",
        )

    def test_does_not_reuse_another_company_configuration(self):
        with self.assertRaises(ValueError):
            load_email_configuration(self.other_company.id)

    def test_rejects_invalid_ports(self):
        for port in (0, 65536, True, "587"):
            with self.subTest(port=port):
                with self.assertRaises(ValueError):
                    validate_email_settings(
                        {
                            **self.settings,
                            "smtp_port": port,
                        }
                    )

    def test_rejects_unencrypted_connection(self):
        with self.assertRaises(ValueError):
            validate_email_settings(
                {
                    **self.settings,
                    "security": "none",
                }
            )

    def test_rejects_password_in_settings(self):
        with self.assertRaises(ValueError):
            validate_email_settings(
                {
                    **self.settings,
                    "password": "test-only",
                }
            )

    def test_rejects_invalid_sender(self):
        with self.assertRaises(ValueError):
            validate_email_settings(
                {
                    **self.settings,
                    "from_address": "invalid-address",
                }
            )

    def test_requires_credentials_reference(self):
        self.integration.credentials_reference = None
        db.session.commit()

        with self.assertRaises(ValueError):
            load_email_configuration(self.company.id)
