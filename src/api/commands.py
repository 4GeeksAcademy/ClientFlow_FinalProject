"""Administrative commands for database setup."""

import click

from api.models import db
from api.plan_commands import seed_plans


def setup_commands(app):
    app.cli.command("seed-plans")(seed_plans)

    @app.cli.command("ai-schema-upgrade")
    def ai_schema_upgrade():
        """Create only the two additive AI tables; preserve existing data."""
        from api.models import AIReplyAudit, AIReplyDraft

        with db.engine.begin() as connection:
            AIReplyDraft.__table__.create(connection, checkfirst=True)
            AIReplyAudit.__table__.create(connection, checkfirst=True)

        click.echo("AI draft and audit tables are ready.")
