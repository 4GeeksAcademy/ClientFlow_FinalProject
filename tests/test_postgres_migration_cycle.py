"""Test PostgreSQL migrations using a newly created disposable database."""

import os
import unittest
from pathlib import Path
from uuid import uuid4

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask import Flask
from flask_migrate import Migrate, downgrade, upgrade
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.engine import make_url

from api.commands import setup_commands
from api.models import Plan, db

TEST_URL = os.environ.get("MIGRATION_TEST_DATABASE_URL")


@unittest.skipUnless(TEST_URL, "PostgreSQL test database is not configured.")
class PostgresMigrationCycleTest(unittest.TestCase):
    def test_upgrade_seed_downgrade_and_reupgrade(self):
        source_url = make_url(TEST_URL)
        self.assertEqual(source_url.get_backend_name(), "postgresql")
        self.assertEqual(source_url.database, "clientflow_db43")

        database_name = f"clientflow_cycle_{uuid4().hex}"
        admin_engine = create_engine(
            source_url,
            isolation_level="AUTOCOMMIT",
        )
        created = False

        try:
            with admin_engine.connect() as connection:
                connection.exec_driver_sql(f'CREATE DATABASE "{database_name}"')
                created = True

            app = Flask(__name__)
            app.config["SQLALCHEMY_DATABASE_URI"] = source_url.set(
                database=database_name
            )
            db.init_app(app)
            Migrate(app, db, compare_type=True)
            setup_commands(app)

            migrations = str(Path(__file__).resolve().parents[1] / "migrations")

            with app.app_context():
                try:
                    for cycle in range(2):
                        with self.subTest(cycle=cycle + 1):
                            upgrade(directory=migrations)

                            with db.engine.connect() as connection:
                                context = MigrationContext.configure(
                                    connection,
                                    opts={"compare_type": True},
                                )
                                self.assertEqual(
                                    compare_metadata(context, db.metadata),
                                    [],
                                )

                            runner = app.test_cli_runner()
                            for _ in range(2):
                                result = runner.invoke(args=["seed-plans"])
                                self.assertEqual(result.exit_code, 0, result.output)

                            plans = db.session.scalars(select(Plan)).all()
                            self.assertEqual(len(plans), 3)
                            self.assertEqual(
                                {plan.code for plan in plans},
                                {"starter", "professional", "business"},
                            )

                            db.session.remove()
                            downgrade(
                                directory=migrations,
                                revision="base",
                            )
                            self.assertEqual(
                                set(inspect(db.engine).get_table_names()),
                                {"alembic_version"},
                            )
                finally:
                    db.session.remove()
                    db.engine.dispose()
        finally:
            try:
                if created:
                    with admin_engine.connect() as connection:
                        connection.exec_driver_sql(f'DROP DATABASE "{database_name}"')
            finally:
                admin_engine.dispose()


if __name__ == "__main__":
    unittest.main()
