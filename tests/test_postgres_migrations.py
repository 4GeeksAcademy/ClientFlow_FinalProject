"""Check a migrated PostgreSQL test database without changing its data."""

import os
import unittest
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url

from api.models import db

TEST_URL = os.environ.get("MIGRATION_TEST_DATABASE_URL")


@unittest.skipUnless(TEST_URL, "PostgreSQL test database is not configured.")
class PostgresMigrationTest(unittest.TestCase):
    def test_schema_matches_current_models(self):
        url = make_url(TEST_URL)

        self.assertEqual(url.get_backend_name(), "postgresql")
        self.assertEqual(url.database, "clientflow_db43")

        engine = create_engine(url)

        try:
            with engine.connect() as connection:
                tables = set(inspect(connection).get_table_names())
                self.assertEqual(
                    tables - {"alembic_version"},
                    set(db.metadata.tables),
                )

                context = MigrationContext.configure(
                    connection,
                    opts={"compare_type": True},
                )
                differences = compare_metadata(context, db.metadata)
                self.assertEqual(differences, [])

                config = Config()
                migrations = Path(__file__).resolve().parents[1] / "migrations"
                config.set_main_option("script_location", str(migrations))
                scripts = ScriptDirectory.from_config(config)

                self.assertEqual(
                    set(context.get_current_heads()),
                    set(scripts.get_heads()),
                )
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
