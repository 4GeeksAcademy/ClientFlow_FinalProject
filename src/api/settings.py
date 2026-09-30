"""Company-scoped workspace settings for ticket #29."""

import os
import re
from functools import wraps
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError

from api.auth import tenant_required
from api.channel_email import validate_email_settings
from api.models import (
    AIAgent,
    AuthSession,
    Company,
    CompanyMembership,
    Integration,
    KnowledgeDocument,
    MembershipRole,
    db,
    utc_now,
)

settings = Blueprint("settings", __name__)

MANAGER_ROLES = {
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
}
SUPPORTED_LANGUAGES = {"en", "es", "pt"}
SUPPORTED_THEMES = {"system", "light", "dark"}
SUPPORTED_INTEGRATIONS = {"email", "web_chat", "whatsapp"}


def settings_admin_required(function):
    """Limit workspace-wide changes to trusted company roles."""
    @wraps(function)
    @tenant_required
    def wrapped(*args, **kwargs):
        if g.membership.role not in MANAGER_ROLES:
            return jsonify(message="You cannot change company settings."), 403
        return function(*args, **kwargs)

    return wrapped


def body_object():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


def clean_optional_text(value, field, maximum):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text.")
    value = value.strip()
    if len(value) > maximum:
        raise ValueError(f"{field} is too long.")
    return value or None


def validate_company_changes(body):
    allowed = {"name", "email", "phone", "timezone", "primary_colour"}
    if body is None or not body or not set(body).issubset(allowed):
        raise ValueError("Provide only supported company fields.")

    changes = {}
    if "name" in body:
        name = clean_optional_text(body["name"], "name", 160)
        if name is None:
            raise ValueError("Company name is required.")
        changes["name"] = name
    if "email" in body:
        email = clean_optional_text(body["email"], "email", 255)
        if email and not re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", email):
            raise ValueError("Enter a valid company email address.")
        changes["email"] = email
    if "phone" in body:
        phone = clean_optional_text(body["phone"], "phone", 40)
        if phone and not re.fullmatch(r"[+0-9().\s-]{5,40}", phone):
            raise ValueError("Enter a valid company phone number.")
        changes["phone"] = phone
    if "timezone" in body:
        timezone = clean_optional_text(body["timezone"], "timezone", 60)
        if timezone is None:
            raise ValueError("Timezone is required.")
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Enter a valid IANA timezone.") from error
        changes["timezone"] = timezone
    if "primary_colour" in body:
        colour = clean_optional_text(body["primary_colour"], "primary_colour", 20)
        if colour and not re.fullmatch(r"#[0-9A-Fa-f]{6}", colour):
            raise ValueError("Primary colour must use #RRGGBB format.")
        changes["primary_colour"] = colour
    return changes


def validate_preferences(body):
    if body is None or not body or not set(body).issubset({"theme", "language"}):
        raise ValueError("Provide only supported preference fields.")
    changes = {}
    if "theme" in body:
        if body["theme"] not in SUPPORTED_THEMES:
            raise ValueError("Choose system, light or dark theme.")
        changes["theme"] = body["theme"]
    if "language" in body:
        if body["language"] not in SUPPORTED_LANGUAGES:
            raise ValueError("Choose a supported language.")
        changes["default_language"] = body["language"]
    return changes


def validate_integration(provider, body):
    if provider not in SUPPORTED_INTEGRATIONS:
        raise ValueError("Unsupported integration provider.")
    if body is None or set(body) != {"enabled", "settings"}:
        raise ValueError("Provide enabled and settings fields.")
    if type(body["enabled"]) is not bool or not isinstance(body["settings"], dict):
        raise ValueError("Invalid integration configuration.")

    values = body["settings"]
    if not body["enabled"]:
        return False, {}
    if provider == "email":
        values = validate_email_settings(values)
    elif provider == "web_chat":
        expected = {"display_name", "welcome_message", "accent_colour"}
        if set(values) != expected:
            raise ValueError("Unexpected or missing web chat fields.")
        display_name = clean_optional_text(values["display_name"], "display_name", 80)
        welcome = clean_optional_text(values["welcome_message"], "welcome_message", 300)
        accent = clean_optional_text(values["accent_colour"], "accent_colour", 20)
        if not display_name or not welcome:
            raise ValueError("Web chat name and welcome message are required.")
        if accent and not re.fullmatch(r"#[0-9A-Fa-f]{6}", accent):
            raise ValueError("Accent colour must use #RRGGBB format.")
        values = {
            "display_name": display_name,
            "welcome_message": welcome,
            "accent_colour": accent or "#635BFF",
        }
    else:
        expected = {"display_name", "phone_number"}
        if set(values) != expected:
            raise ValueError("Unexpected or missing WhatsApp fields.")
        display_name = clean_optional_text(values["display_name"], "display_name", 80)
        phone = clean_optional_text(values["phone_number"], "phone_number", 40)
        if not display_name or not phone or not re.fullmatch(r"\+[1-9][0-9]{6,14}", phone):
            raise ValueError("Enter a name and an international WhatsApp number.")
        values = {"display_name": display_name, "phone_number": phone}
    return body["enabled"], values


def integration_json(integration):
    safe_fields = {
        "email": {"smtp_host", "smtp_port", "security", "from_address"},
        "web_chat": {"display_name", "welcome_message", "accent_colour"},
        "whatsapp": {"display_name", "phone_number"},
    }
    stored_settings = integration.settings if isinstance(integration.settings, dict) else {}
    return {
        "provider": integration.provider,
        "status": integration.status,
        "settings": {
            key: value
            for key, value in stored_settings.items()
            if key in safe_fields.get(integration.provider, set())
        },
        "external_account_id": integration.external_account_id,
    }


@settings.get("/settings")
@tenant_required
def get_settings():
    company = db.session.get(Company, g.company_id)
    integrations = db.session.scalars(
        select(Integration).where(
            Integration.company_id == g.company_id,
            Integration.provider.in_(SUPPORTED_INTEGRATIONS),
        )
    ).all()
    active_sessions = db.session.scalar(
        select(func.count()).select_from(AuthSession).where(
            AuthSession.user_id == g.user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utc_now(),
        )
    )
    counts = {
        "members": db.session.scalar(
            select(func.count()).select_from(CompanyMembership).where(
                CompanyMembership.company_id == g.company_id,
                CompanyMembership.is_active.is_(True),
            )
        ),
        "agents": db.session.scalar(
            select(func.count()).select_from(AIAgent).where(
                AIAgent.company_id == g.company_id,
                AIAgent.is_active.is_(True),
            )
        ),
        "knowledge_documents": db.session.scalar(
            select(func.count()).select_from(KnowledgeDocument).where(
                KnowledgeDocument.company_id == g.company_id,
            )
        ),
        "ready_documents": db.session.scalar(
            select(func.count()).select_from(KnowledgeDocument).where(
                KnowledgeDocument.company_id == g.company_id,
                KnowledgeDocument.ingestion_status == "ready",
            )
        ),
    }
    configured = {row.provider: integration_json(row) for row in integrations}
    for provider in SUPPORTED_INTEGRATIONS:
        configured.setdefault(provider, {
            "provider": provider,
            "status": "disconnected",
            "settings": {},
            "external_account_id": None,
        })
    return jsonify(
        company={
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "phone": company.phone,
            "timezone": company.timezone,
            "default_language": company.default_language,
            "theme": company.theme,
            "primary_colour": company.primary_colour,
        },
        user=g.user.serialize(),
        membership={
            "id": g.membership.id,
            "role": g.membership.role.value,
            "can_manage": g.membership.role in MANAGER_ROLES,
        },
        integrations=configured,
        overview=counts,
        ai_service={
            "configured": bool(os.getenv("AI_SERVICE_URL") and os.getenv("AI_SERVICE_API_KEY")),
            "model": os.getenv("AI_SERVICE_MODEL") or None,
        },
        security={
            "active_sessions": active_sessions or 0,
            "last_login_at": g.user.last_login_at.isoformat() if g.user.last_login_at else None,
        },
    )


@settings.patch("/settings/company")
@settings_admin_required
def update_company():
    try:
        changes = validate_company_changes(body_object())
        company = db.session.get(Company, g.company_id)
        for field, value in changes.items():
            setattr(company, field, value)
        db.session.commit()
        return jsonify(message="Company settings saved.", company={
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "phone": company.phone,
            "timezone": company.timezone,
            "primary_colour": company.primary_colour,
        })
    except ValueError as error:
        return jsonify(message=str(error)), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Company settings could not be saved."), 503


@settings.patch("/settings/preferences")
@settings_admin_required
def update_preferences():
    try:
        changes = validate_preferences(body_object())
        company = db.session.get(Company, g.company_id)
        if "theme" in changes:
            company.theme = changes["theme"]
        if "default_language" in changes:
            company.default_language = changes["default_language"]
            g.user.preferred_language = changes["default_language"]
        db.session.commit()
        return jsonify(
            message="Workspace preferences saved.",
            theme=company.theme,
            language=company.default_language,
        )
    except ValueError as error:
        return jsonify(message=str(error)), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Workspace preferences could not be saved."), 503


@settings.put("/settings/integrations/<provider>")
@settings_admin_required
def update_integration(provider):
    try:
        enabled, values = validate_integration(provider, body_object())
        integration = db.session.scalar(select(Integration).where(
            Integration.company_id == g.company_id,
            Integration.provider == provider,
        ))
        if integration is None:
            integration = Integration(company_id=g.company_id, provider=provider)
            db.session.add(integration)
        integration.status = "configured" if enabled else "disconnected"
        integration.settings = values
        db.session.commit()
        return jsonify(message="Integration settings saved.", integration=integration_json(integration))
    except ValueError as error:
        return jsonify(message=str(error)), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Integration settings could not be saved."), 503


@settings.post("/settings/security/revoke-other-sessions")
@tenant_required
def revoke_other_sessions():
    current_session = get_jwt().get("sid")
    if not current_session:
        return jsonify(message="Current session is invalid."), 401
    now = utc_now()
    result = db.session.execute(
        update(AuthSession).where(
            AuthSession.user_id == g.user.id,
            AuthSession.id != current_session,
            AuthSession.revoked_at.is_(None),
        ).values(revoked_at=now)
    )
    db.session.commit()
    return jsonify(message="Other sessions closed.", revoked=result.rowcount)
