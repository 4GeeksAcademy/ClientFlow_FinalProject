"""
API routes for ClientFlow.
"""
from datetime import datetime, timedelta
from uuid import uuid4

from flask import Blueprint, g, jsonify, request
from flask_cors import CORS
from sqlalchemy import func, or_, and_, select
from sqlalchemy.exc import IntegrityError

from api.auth import email_value, limited, password_valid, set_password, tenant_required
from api.models import (
    Activity,
    Client,
    Company,
    CompanyMembership,
    Lead,
    LeadStatus,
    MembershipRole,
    NextAction,
    NextActionStatus,
    Plan,
    ServiceType,
    Subscription,
    SubscriptionStatus,
    User,
    Appointment,
    AppointmentStatus,
    db,
    utc_now,
)

api = Blueprint("api", __name__)

# Allow CORS requests to this API
CORS(api)


def _lead_to_dict(lead):
    """Serialize a Lead model into the public API representation."""
    return {
        "id": lead.id,
        "company_id": lead.company_id,
        "assigned_membership_id": lead.assigned_membership_id,
        "service_type_id": lead.service_type_id,
        "converted_client_id": lead.converted_client_id,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "email": lead.email,
        "phone": lead.phone,
        "source": lead.source,
        "consent_given": lead.consent_given,
        "consent_at": (
            lead.consent_at.isoformat() if lead.consent_at else None
        ),
        "status": lead.status.value,
        "notes": lead.notes,
        "converted_at": (
            lead.converted_at.isoformat() if lead.converted_at else None
        ),
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


def _get_json_payload():
    """Return the request JSON payload or an empty dictionary."""
    payload = request.get_json(silent=True)

    if payload is None:
        return {}

    if not isinstance(payload, dict):
        return None

    return payload


def _validate_lead_data(data, partial=False):
    """Validate fields accepted when creating or updating a lead."""
    allowed_fields = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "source",
        "status",
        "notes",
        "assigned_membership_id",
        "service_type_id",
        "consent_given",
    }

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return (
            f"Campos no permitidos: {', '.join(sorted(unknown_fields))}.",
            400,
        )

    if not partial or "first_name" in data:
        first_name = data.get("first_name")

        if not isinstance(first_name, str) or not first_name.strip():
            return "El nombre es obligatorio.", 400

        if len(first_name.strip()) > 100:
            return "El nombre no puede superar los 100 caracteres.", 400

    string_limits = {
        "last_name": 100,
        "email": 255,
        "phone": 40,
        "source": 80,
    }

    for field, max_length in string_limits.items():
        if field not in data or data[field] is None:
            continue

        if not isinstance(data[field], str):
            return f"El campo '{field}' debe ser texto.", 400

        if len(data[field]) > max_length:
            return (
                f"El campo '{field}' no puede superar "
                f"{max_length} caracteres.",
                400,
            )

    if "email" in data and data["email"]:
        if "@" not in data["email"]:
            return "El email no es válido.", 400

    if "status" in data:
        try:
            LeadStatus(data["status"])
        except (ValueError, TypeError):
            valid_statuses = ", ".join(status.value for status in LeadStatus)
            return (
                f"Estado no válido. Valores permitidos: {valid_statuses}.",
                400,
            )

    for field in ("assigned_membership_id", "service_type_id"):
        if field in data and data[field] is not None:
            if not isinstance(data[field], int) or data[field] <= 0:
                return f"El campo '{field}' no es válido.", 400

    if "consent_given" in data and not isinstance(data["consent_given"], bool):
        return "El campo 'consent_given' debe ser booleano.", 400

    return None


@api.route("/hello", methods=["POST", "GET"])
def handle_hello():
    response_body = {
        "message": (
            "Hello! I'm a message that came from the backend, "
            "check the network tab on the google inspector and you "
            "will see the GET request"
        )
    }

    return jsonify(response_body), 200


@api.route("/health", methods=["GET"])
def health_check():
    response_body = {
        "status": "ok"
    }

    return jsonify(response_body), 200


@api.route("/leads", methods=["GET"])
@tenant_required
def list_leads():
    """
    List leads belonging only to the authenticated user's company.

    Supported query parameters:
    - page
    - per_page
    - search
    - status
    - source
    """
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)
    search = request.args.get("search", default="", type=str).strip()
    status = request.args.get("status", default="", type=str).strip()
    source = request.args.get("source", default="", type=str).strip()

    if page < 1:
        return jsonify({"error": "La página debe ser mayor que 0."}), 400

    if per_page < 1 or per_page > 100:
        return jsonify(
            {"error": "per_page debe estar entre 1 y 100."}
        ), 400

    query = select(Lead).where(
        Lead.company_id == g.company_id
    )

    count_query = select(
        func.count()
    ).select_from(Lead).where(
        Lead.company_id == g.company_id
    )

    if search:
        search_pattern = f"%{search}%"

        search_filter = or_(
            Lead.first_name.ilike(search_pattern),
            Lead.last_name.ilike(search_pattern),
            Lead.email.ilike(search_pattern),
            Lead.phone.ilike(search_pattern),
        )

        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if status:
        try:
            lead_status = LeadStatus(status)
        except ValueError:
            valid_statuses = ", ".join(
                lead_status.value for lead_status in LeadStatus
            )
            return jsonify({
                "error": (
                    f"Estado no válido. Valores permitidos: "
                    f"{valid_statuses}."
                )
            }), 400

        query = query.where(Lead.status == lead_status)
        count_query = count_query.where(Lead.status == lead_status)

    if source:
        query = query.where(Lead.source == source)
        count_query = count_query.where(Lead.source == source)

    total = db.session.scalar(count_query) or 0

    leads = db.session.scalars(
        query
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return jsonify({
        "items": [_lead_to_dict(lead) for lead in leads],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page,
        },
    }), 200


@api.route("/leads/<int:lead_id>", methods=["GET"])
@tenant_required
def get_lead(lead_id):
    """Return one lead belonging to the authenticated user's company."""
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    return jsonify(_lead_to_dict(lead)), 200


@api.route("/leads/<int:lead_id>/activities", methods=["GET"])
@tenant_required
def list_lead_activities(lead_id):
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    activities = db.session.scalars(
        select(Activity)
        .where(
            Activity.lead_id == lead_id,
            Activity.company_id == g.company_id,
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
    ).all()

    return jsonify([
        {
            "id": activity.id,
            "lead_id": activity.lead_id,
            "actor_membership_id": activity.actor_membership_id,
            "event_type": activity.event_type,
            "description": activity.description,
            "metadata_json": activity.metadata_json,
            "created_at": activity.created_at.isoformat(),
        }
        for activity in activities
    ]), 200


@api.route("/leads/<int:lead_id>/next-actions", methods=["GET"])
@tenant_required
def list_lead_next_actions(lead_id):
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    next_actions = db.session.scalars(
        select(NextAction)
        .where(
            NextAction.lead_id == lead_id,
            NextAction.company_id == g.company_id,
        )
        .order_by(NextAction.due_at.asc(), NextAction.id.asc())
    ).all()

    return jsonify([
        {
            "id": action.id,
            "lead_id": action.lead_id,
            "assigned_membership_id": action.assigned_membership_id,
            "created_by_membership_id": action.created_by_membership_id,
            "title": action.title,
            "description": action.description,
            "due_at": action.due_at.isoformat(),
            "status": action.status.value,
            "completed_at": (
                action.completed_at.isoformat()
                if action.completed_at is not None
                else None
            ),
            "created_at": action.created_at.isoformat(),
            "updated_at": action.updated_at.isoformat(),
        }
        for action in next_actions
    ]), 200


@api.route("/leads", methods=["POST"])
@tenant_required
def create_lead():
    """Create a lead inside the authenticated user's company."""
    data = _get_json_payload()

    if data is None:
        return jsonify({"error": "El cuerpo debe ser un objeto JSON."}), 400

    validation_error = _validate_lead_data(data)

    if validation_error:
        message, status_code = validation_error
        return jsonify({"error": message}), status_code

    if data.get("assigned_membership_id") is not None:
        membership = db.session.scalar(
            select(CompanyMembership).where(
                CompanyMembership.id == data["assigned_membership_id"],
                CompanyMembership.company_id == g.company_id,
            )
        )

        if membership is None:
            return jsonify({
                "error": "El miembro asignado no pertenece a esta empresa."
            }), 400

    lead = Lead(
        company_id=g.company_id,
        first_name=data["first_name"].strip(),
        last_name=(
            data["last_name"].strip()
            if data.get("last_name") is not None
            else None
        ),
        email=data.get("email"),
        phone=data.get("phone"),
        source=data.get("source"),
        consent_given=data.get("consent_given", False),
        consent_at=utc_now() if data.get("consent_given", False) else None,
        status=LeadStatus(data.get("status", LeadStatus.NEW.value)),
        notes=data.get("notes"),
        assigned_membership_id=data.get("assigned_membership_id"),
        service_type_id=data.get("service_type_id"),
    )

    db.session.add(lead)
    db.session.commit()

    return jsonify(_lead_to_dict(lead)), 201


@api.route("/leads/<int:lead_id>/next-actions", methods=["POST"])
@tenant_required
def create_lead_next_action(lead_id):
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({"error": "El cuerpo debe ser un objeto JSON."}), 400

    allowed_fields = {"title", "description",
                      "due_at", "assigned_membership_id"}

    unknown_fields = set(data) - allowed_fields
    if unknown_fields:
        return jsonify({
            "error": f"Campos no permitidos: {', '.join(sorted(unknown_fields))}."
        }), 400

    if not isinstance(data.get("title"), str) or not data["title"].strip():
        return jsonify({"error": "El título es obligatorio."}), 400

    if len(data["title"].strip()) > 180:
        return jsonify({"error": "El título no puede superar los 180 caracteres."}), 400

    if not isinstance(data.get("due_at"), str):
        return jsonify({"error": "due_at es obligatorio y debe ser una fecha ISO."}), 400

    try:
        due_at = datetime.fromisoformat(data["due_at"].replace("Z", "+00:00"))
    except ValueError:
        return jsonify({"error": "due_at debe tener un formato ISO válido."}), 400

    if not isinstance(data.get("assigned_membership_id"), int) or data["assigned_membership_id"] <= 0:
        return jsonify({"error": "assigned_membership_id debe ser un entero positivo."}), 400

    membership = db.session.scalar(
        select(CompanyMembership).where(
            CompanyMembership.id == data["assigned_membership_id"],
            CompanyMembership.company_id == g.company_id,
        )
    )

    if membership is None:
        return jsonify({
            "error": "El miembro asignado no pertenece a esta empresa."
        }), 400

    action = NextAction(
        company_id=g.company_id,
        assigned_membership_id=data["assigned_membership_id"],
        created_by_membership_id=g.membership.id,
        lead_id=lead.id,
        title=data["title"].strip(),
        description=data.get("description"),
        due_at=due_at,
    )

    db.session.add(action)
    db.session.commit()

    return jsonify({
        "id": action.id,
        "lead_id": action.lead_id,
        "assigned_membership_id": action.assigned_membership_id,
        "created_by_membership_id": action.created_by_membership_id,
        "title": action.title,
        "description": action.description,
        "due_at": action.due_at.isoformat(),
        "status": action.status.value,
        "completed_at": None,
        "created_at": action.created_at.isoformat(),
        "updated_at": action.updated_at.isoformat(),
    }), 201


@api.route("/leads/<int:lead_id>", methods=["PATCH"])
@tenant_required
def update_lead(lead_id):
    """Update a lead belonging to the authenticated user's company."""
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({"error": "El cuerpo debe ser un objeto JSON."}), 400

    validation_error = _validate_lead_data(data, partial=True)

    if validation_error:
        message, status_code = validation_error
        return jsonify({"error": message}), status_code

    if (
        "assigned_membership_id" in data
        and data["assigned_membership_id"] is not None
    ):
        membership = db.session.scalar(
            select(CompanyMembership).where(
                CompanyMembership.id == data["assigned_membership_id"],
                CompanyMembership.company_id == g.company_id,
            )
        )

        if membership is None:
            return jsonify({
                "error": "El miembro asignado no pertenece a esta empresa."
            }), 400

    if (
        "service_type_id" in data
        and data["service_type_id"] is not None
    ):
        service_type = db.session.scalar(
            select(ServiceType).where(
                ServiceType.id == data["service_type_id"],
                ServiceType.company_id == g.company_id,
            )
        )

        if service_type is None:
            return jsonify({
                "error": "El tipo de servicio no pertenece a esta empresa."
            }), 400

    if "first_name" in data:
        lead.first_name = data["first_name"].strip()

    if "last_name" in data:
        lead.last_name = (
            data["last_name"].strip()
            if data["last_name"] is not None
            else None
        )

    if "email" in data:
        lead.email = data["email"]

    if "phone" in data:
        lead.phone = data["phone"]

    if "source" in data:
        lead.source = data["source"]
    if "consent_given" in data:
        lead.consent_given = data["consent_given"]

    if data.get("consent_given") and lead.consent_at is None:
        lead.consent_at = utc_now()

    if "status" in data:
        lead.status = LeadStatus(data["status"])

    if "notes" in data:
        lead.notes = data["notes"]

    if "assigned_membership_id" in data:
        lead.assigned_membership_id = data["assigned_membership_id"]

    if "service_type_id" in data:
        lead.service_type_id = data["service_type_id"]

    db.session.commit()

    return jsonify(_lead_to_dict(lead)), 200


@api.route("/next-actions/<int:action_id>", methods=["PATCH"])
@tenant_required
def update_next_action(action_id):
    action = db.session.scalar(
        select(NextAction).where(
            NextAction.id == action_id,
            NextAction.company_id == g.company_id,
        )
    )

    if action is None:
        return jsonify({"error": "Next Action no encontrada."}), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({"error": "El cuerpo debe ser un objeto JSON."}), 400

    allowed_fields = {
        "title",
        "description",
        "due_at",
        "assigned_membership_id",
        "status",
    }

    unknown_fields = set(data) - allowed_fields
    if unknown_fields:
        return jsonify({
            "error": f"Campos no permitidos: {', '.join(sorted(unknown_fields))}."
        }), 400

    if "title" in data:
        if not isinstance(data["title"], str) or not data["title"].strip():
            return jsonify({"error": "El título no puede estar vacío."}), 400

        if len(data["title"].strip()) > 180:
            return jsonify({"error": "El título no puede superar los 180 caracteres."}), 400

        action.title = data["title"].strip()

    if "description" in data:
        action.description = data["description"]

    if "due_at" in data:
        if not isinstance(data["due_at"], str):
            return jsonify({"error": "due_at debe ser una fecha ISO."}), 400

        try:
            action.due_at = datetime.fromisoformat(
                data["due_at"].replace("Z", "+00:00")
            )
        except ValueError:
            return jsonify({"error": "due_at debe tener un formato ISO válido."}), 400

    if "assigned_membership_id" in data:
        if (
            not isinstance(data["assigned_membership_id"], int)
            or data["assigned_membership_id"] <= 0
        ):
            return jsonify({
                "error": "assigned_membership_id debe ser un entero positivo."
            }), 400

        membership = db.session.scalar(
            select(CompanyMembership).where(
                CompanyMembership.id == data["assigned_membership_id"],
                CompanyMembership.company_id == g.company_id,
            )
        )

        if membership is None:
            return jsonify({
                "error": "El miembro asignado no pertenece a esta empresa."
            }), 400

        action.assigned_membership_id = data["assigned_membership_id"]

    if "status" in data:
        try:
            action.status = NextActionStatus(data["status"])
        except (ValueError, TypeError):
            return jsonify({"error": "Estado de Next Action no válido."}), 400

        if action.status == NextActionStatus.COMPLETED:
            action.completed_at = utc_now()
        else:
            action.completed_at = None

    db.session.commit()

    return jsonify({
        "id": action.id,
        "lead_id": action.lead_id,
        "assigned_membership_id": action.assigned_membership_id,
        "created_by_membership_id": action.created_by_membership_id,
        "title": action.title,
        "description": action.description,
        "due_at": action.due_at.isoformat(),
        "status": action.status.value,
        "completed_at": (
            action.completed_at.isoformat()
            if action.completed_at is not None
            else None
        ),
        "created_at": action.created_at.isoformat(),
        "updated_at": action.updated_at.isoformat(),
    }), 200


@api.route("/leads/<int:lead_id>/convert", methods=["POST"])
@tenant_required
def convert_lead_to_client(lead_id):
    lead = db.session.scalar(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.company_id == g.company_id,
        )
    )

    if lead is None:
        return jsonify({"error": "Lead no encontrado."}), 404

    if lead.converted_client_id is not None:
        return jsonify({
            "error": "El Lead ya ha sido convertido.",
            "client_id": lead.converted_client_id,
        }), 409

    client = Client(
        company_id=g.company_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        email=lead.email,
        phone=lead.phone,
        notes=lead.notes,
    )

    db.session.add(client)
    db.session.flush()

    lead.converted_client_id = client.id
    lead.converted_at = utc_now()
    lead.status = LeadStatus.WON

    activity = Activity(
        company_id=g.company_id,
        actor_membership_id=g.membership.id,
        lead_id=lead.id,
        event_type="lead_converted",
        description="Lead convertido a cliente.",
        metadata_json={
            "client_id": client.id,
        },
    )

    db.session.add(activity)
    db.session.commit()

    return jsonify({
        "lead_id": lead.id,
        "client_id": client.id,
        "status": lead.status.value,
        "converted_at": lead.converted_at.isoformat(),
    }), 201


@api.route('/plans', methods=['GET'])
def get_plans():
    plans = db.session.scalars(
        select(Plan)
        .where(Plan.is_active.is_(True))
        .order_by(Plan.id)
    ).all()

    return jsonify([
        {
            "id": plan.id,
            "code": plan.code,
            "name": plan.name,
            "description": plan.description,
            "price_eur": str(plan.price_eur),
            "billing_interval": plan.billing_interval,
            "trial_days": plan.trial_days,
            "limits": plan.limits,
        }
        for plan in plans
    ]), 200


@api.route("/register", methods=["POST"])
@limited("register")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify(message="Request body must be a JSON object."), 400
    registration_mode = data.get("registration_mode", "trial")

    if registration_mode not in ("trial", "mock_payment"):
        return jsonify(
            message="Choose a free trial or simulated payment."
        ), 400
    email = email_value(data)
    password = data.get("password")

    if not email or not password_valid(password):
        return jsonify(
            message="Use a valid email and a password of 12–128 characters."
        ), 400

    fields = {}
    for key, max_length in (
        ("firstName", 100),
        ("lastName", 100),
        ("company", 160),
    ):
        value = data.get(key, "")

        if not isinstance(value, str):
            return jsonify(message=f"{key} must be text."), 400

        value = value.strip()

        if len(value) > max_length:
            return jsonify(message=f"{key} is too long."), 400

        fields[key] = value

    if not fields["firstName"] or not fields["company"]:
        return jsonify(
            message="First name and company name are required."
        ), 400

    plan_id = data.get("plan_id")

    if type(plan_id) is not int or plan_id <= 0:
        return jsonify(message="Select a valid plan."), 400

    plan = db.session.scalar(
        select(Plan).where(
            Plan.id == plan_id,
            Plan.is_active.is_(True),
        )
    )

    if plan is None:
        return jsonify(message="Selected plan is unavailable."), 400

    if db.session.scalar(select(User.id).where(User.email == email)):
        return jsonify(message="An account with this email already exists."), 409

    now = utc_now()

    user = User(
        email=email,
        first_name=fields["firstName"],
        last_name=fields["lastName"],
    )
    set_password(user, password)

    company = Company(
        name=fields["company"],
        slug=f"company-{uuid4().hex}",
        email=email,
    )

    membership = CompanyMembership(
        user=user,
        company=company,
        role=MembershipRole.OWNER,
    )

    subscription = Subscription(
        company=company,
        plan=plan,
    )

    if registration_mode == "trial":
        subscription.status = SubscriptionStatus.TRIALING
        subscription.trial_started_at = now
        subscription.trial_ends_at = now + timedelta(days=3)
    else:
        # Academic payment simulation: no real charge is made.
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.current_period_started_at = now
        subscription.current_period_ends_at = now + timedelta(days=30)
        subscription.external_subscription_id = f"mock_{uuid4().hex}"

    try:
        db.session.add_all([user, company, membership, subscription])
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(
            message="Registration could not be completed due to a data conflict."
        ), 409

    return jsonify(message="Account created successfully. Please sign in."), 201

# ==========================================
# APPOINTMENTS ENDPOINTS (Ticket #28)
# ==========================================


@api.route("/appointments", methods=["GET"])
@tenant_required
def get_appointments():
    """List appointments for the current company, with optional date filters."""
    company_id = g.company_id

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = select(Appointment).where(Appointment.company_id == company_id)

    if start_date:
        query = query.where(Appointment.starts_at >=
                            datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(Appointment.ends_at <=
                            datetime.fromisoformat(end_date))

    appointments = db.session.scalars(query).all()

    return jsonify([{
        "id": appt.id,
        "company_id": appt.company_id,
        "job_id": appt.job_id,
        "client_id": appt.client_id,
        "assigned_membership_id": appt.assigned_membership_id,
        "service_type_id": appt.service_type_id,
        "title": appt.title,
        "status": appt.status.value if hasattr(appt.status, "value") else appt.status,
        "starts_at": appt.starts_at.isoformat() if appt.starts_at else None,
        "ends_at": appt.ends_at.isoformat() if appt.ends_at else None,
        "address_text": appt.address_text,
        "notes": appt.notes
    } for appt in appointments]), 200


@api.route("/appointments", methods=["POST"])
@tenant_required
def create_appointment():
    """Create a new appointment with scheduling conflict detection."""
    body = request.get_json()
    company_id = g.company_id

    required_fields = ["title", "client_id",
                       "starts_at", "ends_at", "assigned_membership_id"]
    for field in required_fields:
        if not body.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        new_start = datetime.fromisoformat(body["starts_at"])
        new_end = datetime.fromisoformat(body["ends_at"])
        assigned_id = body["assigned_membership_id"]

        # Validación de conflictos de horarios para el usuario asignado
        conflict_query = select(Appointment).where(
            Appointment.assigned_membership_id == assigned_id,
            Appointment.status != AppointmentStatus.CANCELLED,
            or_(
                and_(Appointment.starts_at <= new_start,
                     Appointment.ends_at > new_start),
                and_(Appointment.starts_at < new_end,
                     Appointment.ends_at >= new_end),
                and_(Appointment.starts_at >= new_start,
                     Appointment.ends_at <= new_end)
            )
        )

        existing_conflict = db.session.scalar(conflict_query)
        if existing_conflict:
            return jsonify({
                "error": "Scheduling conflict: The assigned user already has an appointment during this time slot."
            }), 409  # Conflicto HTTP 409

        new_appointment = Appointment(
            company_id=company_id,
            job_id=body.get("job_id"),
            client_id=body["client_id"],
            assigned_membership_id=assigned_id,
            service_type_id=body.get("service_type_id"),
            title=body["title"],
            status=AppointmentStatus.SCHEDULED,
            starts_at=new_start,
            ends_at=new_end,
            address_text=body.get("address_text"),
            notes=body.get("notes")
        )

        db.session.add(new_appointment)
        db.session.commit()

        return jsonify({
            "message": "Appointment created successfully",
            "id": new_appointment.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api.route("/appointments/<int:appointment_id>", methods=["PUT"])
@tenant_required
def update_appointment(appointment_id):
    """Update or move an existing appointment, with conflict detection."""
    company_id = g.company_id
    appointment = db.session.get(Appointment, appointment_id)

    if not appointment or appointment.company_id != company_id:
        return jsonify({"error": "Appointment not found"}), 404

    body = request.get_json()

    try:
        new_start = datetime.fromisoformat(
            body["starts_at"]) if "starts_at" in body else appointment.starts_at
        new_end = datetime.fromisoformat(
            body["ends_at"]) if "ends_at" in body else appointment.ends_at
        assigned_id = body.get("assigned_membership_id",
                               appointment.assigned_membership_id)

        # Validar conflictos si se modifican las fechas o el usuario asignado
        if "starts_at" in body or "ends_at" in body or "assigned_membership_id" in body:
            conflict_query = select(Appointment).where(
                Appointment.assigned_membership_id == assigned_id,
                Appointment.id != appointment_id,
                Appointment.status != AppointmentStatus.CANCELLED,
                or_(
                    and_(Appointment.starts_at <= new_start,
                         Appointment.ends_at > new_start),
                    and_(Appointment.starts_at < new_end,
                         Appointment.ends_at >= new_end),
                    and_(Appointment.starts_at >= new_start,
                         Appointment.ends_at <= new_end)
                )
            )
            existing_conflict = db.session.scalar(conflict_query)
            if existing_conflict:
                return jsonify({
                    "error": "Scheduling conflict: The assigned user already has an appointment during this time slot."
                }), 409

        if "title" in body:
            appointment.title = body["title"]
        if "client_id" in body:
            appointment.client_id = body["client_id"]
        if "job_id" in body:
            appointment.job_id = body["job_id"]
        if "assigned_membership_id" in body:
            appointment.assigned_membership_id = assigned_id
        if "service_type_id" in body:
            appointment.service_type_id = body["service_type_id"]
        if "status" in body:
            appointment.status = AppointmentStatus(body["status"])
        if "starts_at" in body:
            appointment.starts_at = new_start
        if "ends_at" in body:
            appointment.ends_at = new_end
        if "address_text" in body:
            appointment.address_text = body["address_text"]
        if "notes" in body:
            appointment.notes = body["notes"]

        db.session.commit()
        return jsonify({"message": "Appointment updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api.route("/appointments/<int:appointment_id>", methods=["DELETE"])
@tenant_required
def delete_appointment(appointment_id):
    """Cancel an appointment (sets status to CANCELLED)."""
    company_id = g.company_id
    appointment = db.session.get(Appointment, appointment_id)

    if not appointment or appointment.company_id != company_id:
        return jsonify({"error": "Appointment not found"}), 404

    try:
        # Cambiamos el estado a cancelado en lugar de borrar el registro físicamente
        appointment.status = AppointmentStatus.CANCELLED
        db.session.commit()
        return jsonify({"message": "Appointment cancelled successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
