"""Validate the initial revision against the current model on a disposable database."""
import tempfile
import unittest
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask import Flask
from flask_migrate import Migrate, upgrade, downgrade
from sqlalchemy import inspect, select

from api.commands import setup_commands
from api.models import db, Plan


class InitialMigrationTest(unittest.TestCase):
    def test_upgrade_seed_downgrade_and_reupgrade(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Flask(__name__)
            app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{directory}/test.db'
            db.init_app(app)
            Migrate(app, db, compare_type=True)
            setup_commands(app)
            migrations = str(Path(__file__).resolve().parents[1] / 'migrations')
            with app.app_context():
                for attempt in range(2):
                    upgrade(directory=migrations)
                    self.assertEqual(
                        set(inspect(db.engine).get_table_names()) - {'alembic_version'},
                        set(db.metadata.tables),
                    )
                    with db.engine.connect() as connection:
                        context = MigrationContext.configure(connection, opts={'compare_type': True})
                        self.assertEqual(compare_metadata(context, db.metadata), [])
                    for _ in range(2):
                        result = app.test_cli_runner().invoke(args=['seed-plans'])
                        self.assertEqual(result.exit_code, 0, result.output)
                    self.assertEqual(set(db.session.scalars(select(Plan.code))),
                                     {'starter', 'professional', 'business'})
                    db.session.remove()
                    downgrade(directory=migrations, revision='base')
                    self.assertEqual(set(inspect(db.engine).get_table_names()), {'alembic_version'})
                db.engine.dispose()
