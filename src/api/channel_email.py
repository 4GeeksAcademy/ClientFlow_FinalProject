"""Validate company-scoped email configuration without sending email."""

import re

from api.channel_validation import message_reference
from api.models import Integration, db


def validate_email_settings(settings):
    """Validate connection settings while keeping credentials separate."""
    expected = {"smtp_host", "smtp_port", "security", "from_address"}

    if not isinstance(settings, dict) or set(settings) != expected:
        raise ValueError("Unexpected or missing email configuration fields.")

    host = message_reference(settings["smtp_host"], "smtp_host")

    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise ValueError("Invalid SMTP hostname.")

    port = settings["smtp_port"]
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("SMTP port must be between 1 and 65535.")

    security = settings["security"]
    if security not in ("starttls", "tls"):
        raise ValueError("Email requires STARTTLS or TLS.")

    address = message_reference(settings["from_address"], "from_address")
    if not re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", address):
        raise ValueError("Invalid sender email address.")

    return {
        "smtp_host": host,
        "smtp_port": port,
        "security": security,
        "from_address": address,
    }


def load_email_configuration(company_id):
    """Load settings only for the company authorized by the caller."""
    if type(company_id) is not int or company_id <= 0:
        raise ValueError("Invalid company identifier.")

    integration = db.session.scalar(
        db.select(Integration).where(
            Integration.company_id == company_id,
            Integration.provider == "email",
        )
    )

    if integration is None:
        raise ValueError("Email is not configured for this company.")

    settings = validate_email_settings(integration.settings)

    reference = message_reference(
        integration.credentials_reference,
        "credentials_reference",
    )

    return {
        "settings": settings,
        "credentials_reference": reference,
    }
