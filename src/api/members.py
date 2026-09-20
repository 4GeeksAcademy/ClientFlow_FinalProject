"""Team invitations and membership management for ticket #21."""
import json
import os
from urllib.parse import urlencode
import secrets
from datetime import timedelta
from functools import wraps
from pathlib import Path

from flask import Blueprint, current_app, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import joinedload

from api.auth import (
    digest,
    email_value,
    limited,
    password_valid,
    set_password,
    tenant_required,
)
from api.models import (
    Company,
    CompanyMembership,
    MemberInvitation,
    MembershipRole,
    User,
    db,
    utc_now,
)

members = Blueprint("members", __name__)


def team_admin_required(function):
    @wraps(function)
    @tenant_required
    def wrapped(*args, **kwargs):
        allowed_roles = {MembershipRole.OWNER, MembershipRole.ADMIN}

        if g.membership.role not in allowed_roles:
            return jsonify(
                message="Only owners and administrators can manage the team."
            ), 403

        return function(*args, **kwargs)

    return wrapped


def membership_to_dict(membership):
    return {
        "id": membership.id,
        "user_id": membership.user_id,
        "first_name": membership.user.first_name,
        "last_name": membership.user.last_name,
        "email": membership.user.email,
        "role": membership.role.value,
        "is_active": membership.is_active,
    }


@members.route("/members", methods=["GET"])
@team_admin_required
def list_members():
    try:
        page = int(request.args.get("page", "1"))
        per_page = int(request.args.get("per_page", "20"))
    except ValueError:
        return jsonify(message="Pagination values must be integers."), 400

    if page < 1 or not 1 <= per_page <= 100:
        return jsonify(
            message="Page must be positive and per_page must be between 1 and 100."
        ), 400

    statement = (
        db.select(CompanyMembership)
        .options(joinedload(CompanyMembership.user))
        .where(CompanyMembership.company_id == g.company_id)
        .order_by(CompanyMembership.id.asc())
    )

    search = request.args.get("search", "").strip()[:100]
    status = request.args.get("status", "all")
    if status not in {"all", "active", "inactive"}:
        return jsonify(message="Invalid status filter."), 400
    if search:
        statement = statement.join(User).where(db.or_(
            User.first_name.icontains(search, autoescape=True),
            User.last_name.icontains(search, autoescape=True),
            User.email.icontains(search, autoescape=True),
        ))
    if status != "all":
        statement = statement.where(CompanyMembership.is_active.is_(status == "active"))

    pagination = db.paginate(
        statement,
        page=page,
        per_page=per_page,
        error_out=False,
    )

    return jsonify(
        members=[
            membership_to_dict(membership)
            for membership in pagination.items
        ],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
    ), 200
def build_invitation(data):
    email = email_value(data)

    if email is None:
        raise ValueError("A valid email is required.")

    role_value = data.get("role", "agent")

    if not isinstance(role_value, str):
        raise ValueError("Invalid role.")

    allowed_roles = {
        MembershipRole.MANAGER,
        MembershipRole.AGENT,
        MembershipRole.TECHNICIAN,
    }

    if g.membership.role == MembershipRole.OWNER:
        allowed_roles.add(MembershipRole.ADMIN)

    try:
        role = MembershipRole(role_value)
    except ValueError:
        raise ValueError("Invalid role.") from None

    if role not in allowed_roles:
        raise ValueError("You cannot invite a member with this role.")

    existing_member = db.session.scalar(
        db.select(CompanyMembership)
        .join(User)
        .where(
            CompanyMembership.company_id == g.company_id,
            User.email == email,
        )
    )

    if existing_member is not None:
        raise ValueError("This user already belongs to the company.")

    raw_token = secrets.token_urlsafe(32)

    invitation = MemberInvitation(
        company_id=g.company_id,
        email=email,
        token_hash=digest(raw_token),
        role=role,
        expires_at=utc_now() + timedelta(hours=48),
        created_by_membership_id=g.membership.id,
    )

    db.session.add(invitation)

    return invitation, raw_token

@members.route("/members/invitations", methods=["POST"])
@team_admin_required
def create_invitation():
    if not current_app.debug:
        return jsonify(
            message="Invitation delivery is not configured."
        ), 503

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    try:
        invitation, raw_token = build_invitation(data)
    except ValueError as error:
        db.session.rollback()
        return jsonify(message=str(error)), 400

    outbox = Path(current_app.config.get("MEMBER_INVITE_OUTBOX") or
                  Path(current_app.root_path).parent / ".local" / "invite-outbox")
    file_path = outbox / f"{invitation.token_hash}.json"

    try:
        outbox.mkdir(parents=True, exist_ok=True, mode=0o700)

        with os.fdopen(os.open(file_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as file:
            json.dump(
                {
                    "to": invitation.email,
                    "subject": "Invitación a ClientFlow",
                    "token": raw_token,
                    "url": (os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").rstrip("/")
                            + "/accept-invitation#" + urlencode({"token": raw_token})),
                    "expires_at": invitation.expires_at.isoformat(),
                },
                file,
                ensure_ascii=False,
                indent=2,
            )

        db.session.commit()
    except (OSError, SQLAlchemyError):
        db.session.rollback()

        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass

        return jsonify(message="Unable to create the invitation."), 503

    return jsonify(
        message="Invitation saved to the local outbox.",
        invitation_id=invitation.id,
        expires_at=invitation.expires_at.isoformat(),
    ), 201

def accept_invitation_for_user(raw_token, user):
    if not isinstance(raw_token, str) or not 20 <= len(raw_token) <= 200:
        raise ValueError("Invalid or expired invitation.")

    if not user.is_active:
        raise ValueError("This account is inactive.")

    now = utc_now()

    invitation = db.session.scalar(
        db.select(MemberInvitation).where(
            MemberInvitation.token_hash == digest(raw_token),
            MemberInvitation.used_at.is_(None),
            MemberInvitation.expires_at > now,
        )
    )

    if invitation is None or invitation.email != user.email:
        raise ValueError("Invalid or expired invitation.")

    company = db.session.get(Company, invitation.company_id)

    if company is None or not company.is_active:
        raise ValueError("The company is unavailable.")

    inviter = db.session.get(CompanyMembership, invitation.created_by_membership_id)
    if (inviter is None or not inviter.is_active or not inviter.user.is_active
            or inviter.company_id != invitation.company_id
            or inviter.role not in {MembershipRole.OWNER, MembershipRole.ADMIN}
            or invitation.role == MembershipRole.OWNER
            or (invitation.role == MembershipRole.ADMIN and inviter.role != MembershipRole.OWNER)):
        raise ValueError("This invitation is no longer authorized.")

    existing_member = db.session.scalar(
        db.select(CompanyMembership).where(
            CompanyMembership.company_id == invitation.company_id,
            CompanyMembership.user_id == user.id,
        )
    )

    if existing_member is not None:
        raise ValueError("You already belong to this company.")

    result = db.session.execute(
        db.update(MemberInvitation)
        .where(
            MemberInvitation.id == invitation.id,
            MemberInvitation.used_at.is_(None),
            MemberInvitation.expires_at > now,
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )

    if result.rowcount != 1:
        raise ValueError("Invalid or expired invitation.")

    membership = CompanyMembership(
        company_id=invitation.company_id,
        user_id=user.id,
        role=invitation.role,
    )

    db.session.add(membership)
    db.session.flush()

    return membership

@members.route("/members/invitations/accept", methods=["POST"])
@jwt_required()
@limited("invitation-accept")
def accept_invitation():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    user = db.session.get(User, int(get_jwt_identity()))

    if user is None or not user.is_active:
        return jsonify(message="An active account is required."), 403

    try:
        membership = accept_invitation_for_user(data.get("token"), user)
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify(message=str(error)), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify(
            message="The invitation could not be accepted. Check your membership."
        ), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Unable to accept the invitation."), 503

    return jsonify(
        message="Invitation accepted.",
        company_id=membership.company_id,
        membership=membership_to_dict(membership),
    ), 201

@members.route("/members/invitations/register", methods=["POST"])
@limited("invitation-register", maximum=5)
def register_from_invitation():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="A JSON object is required."), 400

    raw_token = data.get("token")

    if not isinstance(raw_token, str) or not 20 <= len(raw_token) <= 200:
        return jsonify(message="Invalid or expired invitation."), 400

    first_name = data.get("first_name")
    last_name = data.get("last_name")
    password = data.get("password")

    if any(
        not isinstance(name, str) or not 1 <= len(name.strip()) <= 100
        for name in (first_name, last_name)
    ):
        return jsonify(message="Valid first and last names are required."), 400

    if not password_valid(password):
        return jsonify(message="Password must contain 12–128 characters."), 400

    if password != data.get("password_confirmation"):
        return jsonify(message="Passwords do not match."), 400

    invitation = db.session.scalar(
        db.select(MemberInvitation).where(
            MemberInvitation.token_hash == digest(raw_token),
            MemberInvitation.used_at.is_(None),
            MemberInvitation.expires_at > utc_now(),
        )
    )

    if invitation is None:
        return jsonify(message="Invalid or expired invitation."), 400

    existing_user = db.session.scalar(
        db.select(User).where(User.email == invitation.email)
    )

    if existing_user is not None:
        return jsonify(
            message="Sign in to your existing account to accept this invitation."
        ), 409

    try:
        user = User(
            email=invitation.email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            preferred_language="es",
            is_active=True,
        )
        set_password(user, password)
        db.session.add(user)
        db.session.flush()

        membership = accept_invitation_for_user(raw_token, user)
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify(message=str(error)), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify(
            message="Registration could not be completed. Try signing in."
        ), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Unable to complete registration."), 503

    return jsonify(
        message="Account created and invitation accepted. Please sign in.",
        company_id=membership.company_id,
    ), 201

@members.route("/members/<int:membership_id>", methods=["PATCH"])
@team_admin_required
def update_member(membership_id):
    data = request.get_json(silent=True)
    allowed_fields = {"role", "is_active"}

    if (
        not isinstance(data, dict)
        or not data
        or set(data) - allowed_fields
    ):
        return jsonify(message="Provide role or is_active only."), 400

    membership = db.session.scalar(
        db.select(CompanyMembership).where(
            CompanyMembership.id == membership_id,
            CompanyMembership.company_id == g.company_id,
        )
    )

    if membership is None:
        return jsonify(message="Member not found."), 404

    if membership.id == g.membership.id:
        return jsonify(message="You cannot change your own membership."), 403

    if membership.role == MembershipRole.OWNER:
        return jsonify(message="The owner cannot be modified here."), 403

    if (
        g.membership.role == MembershipRole.ADMIN
        and membership.role == MembershipRole.ADMIN
    ):
        return jsonify(message="Only the owner can manage administrators."), 403

    new_role = membership.role

    if "role" in data:
        if not isinstance(data["role"], str):
            return jsonify(message="Invalid role."), 400

        try:
            new_role = MembershipRole(data["role"])
        except ValueError:
            return jsonify(message="Invalid role."), 400

        allowed_roles = {
            MembershipRole.MANAGER,
            MembershipRole.AGENT,
            MembershipRole.TECHNICIAN,
        }
        if g.membership.role == MembershipRole.OWNER:
            allowed_roles.add(MembershipRole.ADMIN)

        if new_role not in allowed_roles:
            return jsonify(message="You cannot assign this role."), 403

    if "is_active" in data and not isinstance(data["is_active"], bool):
        return jsonify(message="is_active must be a boolean."), 400

    membership.role = new_role
    if "is_active" in data:
        membership.is_active = data["is_active"]

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify(message="Unable to update member."), 503

    return jsonify(member=membership_to_dict(membership)), 200
