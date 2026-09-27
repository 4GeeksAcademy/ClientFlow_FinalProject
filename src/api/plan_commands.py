"""Create missing subscription plans from the terminal."""

import click
from sqlalchemy import select

from api.models import Plan, db


def seed_plans():
    """Insert missing plans without modifying existing ones."""
    plans = [
        {
            "code": "starter",
            "name": "Starter",
            "description": "Basic plan for small businesses.",
            "price_eur": 0,
            "billing_interval": "monthly",
            "trial_days": 3,
            "limits": {"users": 2, "clients": 50, "ai_agents": 1},
            "is_active": True,
        },
        {
            "code": "professional",
            "name": "Professional",
            "description": "Plan for growing teams.",
            "price_eur": "29.99",
            "billing_interval": "monthly",
            "trial_days": 3,
            "limits": {"users": 10, "clients": 500, "ai_agents": 3},
            "is_active": True,
        },
        {
            "code": "business",
            "name": "Business",
            "description": "Advanced plan for businesses.",
            "price_eur": "79.99",
            "billing_interval": "monthly",
            "trial_days": 3,
            "limits": {"users": 50, "clients": 5000, "ai_agents": 10},
            "is_active": True,
        },
    ]

    created = []
    for values in plans:
        existing = db.session.scalar(select(Plan).where(Plan.code == values["code"]))
        if existing is None:
            db.session.add(Plan(**values))
            created.append(values["code"])

    db.session.commit()
    click.echo(f"Created plans: {', '.join(created) or 'none'}.")
