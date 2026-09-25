from api.appointments import register_appointments
from datetime import datetime, timedelta
from uuid import uuid4

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from api.auth import email_value, limited, password_valid, set_password, tenant_required
from api.models import (
    Activity,
    Attachment,
    Appointment,
    Client,
    ClientAddress,
    Company,
    CompanyMembership,
    Job,
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
    db,
    utc_now,
)
api = Blueprint("api", __name__)
# Allow CORS requests to this API


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


def _client_to_dict(client):
    """Serialize a Client model into the public API representation."""
    return {
        "id": client.id,
        "company_id": client.company_id,
        "first_name": client.first_name,
        "last_name": client.last_name,
        "email": client.email,
        "phone": client.phone,
        "notes": client.notes,
        "is_active": client.is_active,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "updated_at": client.updated_at.isoformat() if client.updated_at else None,
    }


def _get_json_payload():
    """Return the request JSON payload or an empty dictionary."""
    payload = request.get_json(silent=True)

    if payload is None:
        return {}

    if not isinstance(payload, dict):
        return None

    return payload


@api.route("/clients", methods=["GET"])
@tenant_required
def list_clients():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", "").strip()

    if page < 1:
        return jsonify({
            "error": "La página debe ser mayor que 0."
        }), 400

    if per_page < 1 or per_page > 100:
        return jsonify({
            "error": "per_page debe estar entre 1 y 100."
        }), 400

    query = select(Client).where(
        Client.company_id == g.company_id
    )

    count_query = select(func.count(Client.id)).where(
        Client.company_id == g.company_id
    )

    if search:
        pattern = f"%{search}%"

        search_filter = or_(
            Client.first_name.ilike(pattern),
            Client.last_name.ilike(pattern),
            Client.email.ilike(pattern),
            Client.phone.ilike(pattern),
        )

        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = db.session.scalar(count_query) or 0

    clients = db.session.scalars(
        query
        .order_by(Client.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    return jsonify({
        "items": [_client_to_dict(client) for client in clients],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
    }), 200


@api.route("/clients/<int:client_id>", methods=["GET"])
@tenant_required
def get_client(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    return jsonify(_client_to_dict(client)), 200


@api.route("/clients", methods=["POST"])
@tenant_required
def create_client():
    data = _get_json_payload()

    if data is None:
        return jsonify({
            "error": "El cuerpo debe ser un objeto JSON."
        }), 400

    allowed_fields = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "notes",
        "is_active",
    }

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return jsonify({
            "error": (
                f"Campos no permitidos: "
                f"{', '.join(sorted(unknown_fields))}."
            )
        }), 400

    first_name = data.get("first_name")

    if not isinstance(first_name, str) or not first_name.strip():
        return jsonify({
            "error": "El nombre es obligatorio."
        }), 400

    if len(first_name.strip()) > 100:
        return jsonify({
            "error": "El nombre no puede superar los 100 caracteres."
        }), 400

    string_limits = {
        "last_name": 100,
        "email": 255,
        "phone": 40,
    }

    for field, max_length in string_limits.items():
        if field not in data or data[field] is None:
            continue

        if not isinstance(data[field], str):
            return jsonify({
                "error": f"El campo '{field}' debe ser texto."
            }), 400

        if len(data[field].strip()) > max_length:
            return jsonify({
                "error": (
                    f"El campo '{field}' no puede superar "
                    f"los {max_length} caracteres."
                )
            }), 400

    if "notes" in data and data["notes"] is not None:
        if not isinstance(data["notes"], str):
            return jsonify({
                "error": "El campo 'notes' debe ser texto."
            }), 400

    if "is_active" in data and not isinstance(data["is_active"], bool):
        return jsonify({
            "error": "El campo 'is_active' debe ser booleano."
        }), 400

    client = Client(
        company_id=g.company_id,
        first_name=first_name.strip(),
        last_name=(
            data["last_name"].strip()
            if data.get("last_name") is not None
            else None
        ),
        email=data.get("email"),
        phone=data.get("phone"),
        notes=data.get("notes"),
        is_active=data.get("is_active", True),
    )

    db.session.add(client)
    db.session.commit()

    return jsonify(_client_to_dict(client)), 201


@api.route("/clients/<int:client_id>", methods=["PATCH"])
@tenant_required
def update_client(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({
            "error": "El cuerpo debe ser un objeto JSON."
        }), 400

    allowed_fields = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "notes",
        "is_active",
    }

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return jsonify({
            "error": (
                f"Campos no permitidos: "
                f"{', '.join(sorted(unknown_fields))}."
            )
        }), 400

    if "first_name" in data:
        if not isinstance(data["first_name"], str) or not data["first_name"].strip():
            return jsonify({
                "error": "El nombre no puede estar vacío."
            }), 400

        if len(data["first_name"].strip()) > 100:
            return jsonify({
                "error": "El nombre no puede superar los 100 caracteres."
            }), 400

        client.first_name = data["first_name"].strip()

    string_limits = {
        "last_name": 100,
        "email": 255,
        "phone": 40,
    }

    for field, max_length in string_limits.items():
        if field not in data:
            continue

        value = data[field]

        if value is not None and not isinstance(value, str):
            return jsonify({
                "error": f"El campo '{field}' debe ser texto."
            }), 400

        if value is not None and len(value.strip()) > max_length:
            return jsonify({
                "error": (
                    f"El campo '{field}' no puede superar "
                    f"los {max_length} caracteres."
                )
            }), 400

        setattr(
            client,
            field,
            value.strip() if value is not None else None,
        )

    if "notes" in data:
        if data["notes"] is not None and not isinstance(data["notes"], str):
            return jsonify({
                "error": "El campo 'notes' debe ser texto."
            }), 400

        client.notes = data["notes"]

    if "is_active" in data:
        if not isinstance(data["is_active"], bool):
            return jsonify({
                "error": "El campo 'is_active' debe ser booleano."
            }), 400

        client.is_active = data["is_active"]

    db.session.commit()

    return jsonify(_client_to_dict(client)), 200


@api.route("/clients/<int:client_id>/addresses", methods=["GET"])
@tenant_required
def list_client_addresses(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    addresses = db.session.scalars(
        select(ClientAddress)
        .where(ClientAddress.client_id == client_id)
        .order_by(
            ClientAddress.is_primary.desc(),
            ClientAddress.id.asc(),
        )
    ).all()

    return jsonify([
        {
            "id": address.id,
            "client_id": address.client_id,
            "label": address.label,
            "line_1": address.line_1,
            "line_2": address.line_2,
            "city": address.city,
            "postcode": address.postcode,
            "is_primary": address.is_primary,
        }
        for address in addresses
    ]), 200


@api.route("/clients/<int:client_id>/addresses", methods=["POST"])
@tenant_required
def create_client_address(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({
            "error": "El cuerpo debe ser un objeto JSON."
        }), 400

    allowed_fields = {
        "label",
        "line_1",
        "line_2",
        "city",
        "postcode",
        "is_primary",
    }

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return jsonify({
            "error": (
                f"Campos no permitidos: "
                f"{', '.join(sorted(unknown_fields))}."
            )
        }), 400

    required_fields = {
        "line_1": 160,
        "city": 100,
        "postcode": 20,
    }

    for field, max_length in required_fields.items():
        value = data.get(field)

        if not isinstance(value, str) or not value.strip():
            return jsonify({
                "error": f"El campo '{field}' es obligatorio."
            }), 400

        if len(value.strip()) > max_length:
            return jsonify({
                "error": (
                    f"El campo '{field}' no puede superar "
                    f"los {max_length} caracteres."
                )
            }), 400

    optional_string_limits = {
        "label": 60,
        "line_2": 160,
    }

    for field, max_length in optional_string_limits.items():
        if field not in data or data[field] is None:
            continue

        if not isinstance(data[field], str):
            return jsonify({
                "error": f"El campo '{field}' debe ser texto."
            }), 400

        if len(data[field].strip()) > max_length:
            return jsonify({
                "error": (
                    f"El campo '{field}' no puede superar "
                    f"los {max_length} caracteres."
                )
            }), 400

    if "is_primary" in data and not isinstance(data["is_primary"], bool):
        return jsonify({
            "error": "El campo 'is_primary' debe ser booleano."
        }), 400

    address = ClientAddress(
        client_id=client.id,
        label=(
            data["label"].strip()
            if data.get("label") is not None
            else None
        ),
        line_1=data["line_1"].strip(),
        line_2=(
            data["line_2"].strip()
            if data.get("line_2") is not None
            else None
        ),
        city=data["city"].strip(),
        postcode=data["postcode"].strip(),
        is_primary=data.get("is_primary", False),
    )

    db.session.add(address)
    db.session.commit()

    return jsonify({
        "id": address.id,
        "client_id": address.client_id,
        "label": address.label,
        "line_1": address.line_1,
        "line_2": address.line_2,
        "city": address.city,
        "postcode": address.postcode,
        "is_primary": address.is_primary,
    }), 201


@api.route("/clients/<int:client_id>/addresses/<int:address_id>", methods=["PATCH"])
@tenant_required
def update_client_address(client_id, address_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    address = db.session.scalar(
        select(ClientAddress).where(
            ClientAddress.id == address_id,
            ClientAddress.client_id == client_id,
        )
    )

    if address is None:
        return jsonify({
            "error": "Dirección no encontrada."
        }), 404

    data = _get_json_payload()

    if data is None:
        return jsonify({
            "error": "El cuerpo debe ser un objeto JSON."
        }), 400

    allowed_fields = {
        "label",
        "line_1",
        "line_2",
        "city",
        "postcode",
        "is_primary",
    }

    unknown_fields = set(data) - allowed_fields

    if unknown_fields:
        return jsonify({
            "error": (
                f"Campos no permitidos: "
                f"{', '.join(sorted(unknown_fields))}."
            )
        }), 400

    string_limits = {
        "label": 60,
        "line_1": 160,
        "line_2": 160,
        "city": 100,
        "postcode": 20,
    }

    for field, max_length in string_limits.items():
        if field not in data:
            continue

        value = data[field]

        if value is not None and not isinstance(value, str):
            return jsonify({
                "error": f"El campo '{field}' debe ser texto."
            }), 400

        if value is not None and len(value.strip()) > max_length:
            return jsonify({
                "error": (
                    f"El campo '{field}' no puede superar "
                    f"los {max_length} caracteres."
                )
            }), 400

    required_fields = {
        "line_1",
        "city",
        "postcode",
    }

    for field in required_fields:
        if field in data:
            value = data[field]

            if not isinstance(value, str) or not value.strip():
                return jsonify({
                    "error": f"El campo '{field}' no puede estar vacío."
                }), 400

    if "is_primary" in data and not isinstance(data["is_primary"], bool):
        return jsonify({
            "error": "El campo 'is_primary' debe ser booleano."
        }), 400

    if "label" in data:
        address.label = (
            data["label"].strip()
            if data["label"] is not None
            else None
        )

    if "line_1" in data:
        address.line_1 = data["line_1"].strip()

    if "line_2" in data:
        address.line_2 = (
            data["line_2"].strip()
            if data["line_2"] is not None
            else None
        )

    if "city" in data:
        address.city = data["city"].strip()

    if "postcode" in data:
        address.postcode = data["postcode"].strip()

    if "is_primary" in data:
        address.is_primary = data["is_primary"]

    db.session.commit()

    return jsonify({
        "id": address.id,
        "client_id": address.client_id,
        "label": address.label,
        "line_1": address.line_1,
        "line_2": address.line_2,
        "city": address.city,
        "postcode": address.postcode,
        "is_primary": address.is_primary,
    }), 200


@api.route("/clients/<int:client_id>/addresses/<int:address_id>", methods=["DELETE"])
@tenant_required
def delete_client_address(client_id, address_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    address = db.session.scalar(
        select(ClientAddress).where(
            ClientAddress.id == address_id,
            ClientAddress.client_id == client_id,
        )
    )

    if address is None:
        return jsonify({
            "error": "Dirección no encontrada."
        }), 404

    db.session.delete(address)
    db.session.commit()

    return "", 204


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


@api.route("/clients/<int:client_id>/activities", methods=["GET"])
@tenant_required
def list_client_activities(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({
            "error": "Cliente no encontrado."
        }), 404

    activities = db.session.scalars(
        select(Activity)
        .where(
            Activity.client_id == client_id,
            Activity.company_id == g.company_id,
        )
        .order_by(
            Activity.created_at.desc(),
            Activity.id.desc(),
        )
    ).all()

    return jsonify([
        {
            "id": activity.id,
            "client_id": activity.client_id,
            "actor_membership_id": activity.actor_membership_id,
            "event_type": activity.event_type,
            "description": activity.description,
            "metadata_json": activity.metadata_json,
            "created_at": (
                activity.created_at.isoformat()
                if activity.created_at
                else None
            ),
        }
        for activity in activities
    ]), 200


@api.route("/clients/<int:client_id>/leads", methods=["GET"])
@tenant_required
def list_client_leads(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

    leads = db.session.scalars(
        select(Lead)
        .where(
            Lead.converted_client_id == client_id,
            Lead.company_id == g.company_id,
        )
        .order_by(
            Lead.created_at.desc(),
            Lead.id.desc(),
        )
    ).all()

    return jsonify([
        {
            "id": lead.id,
            "company_id": lead.company_id,
            "converted_client_id": lead.converted_client_id,
            "assigned_membership_id": lead.assigned_membership_id,
            "service_type_id": lead.service_type_id,
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "email": lead.email,
            "phone": lead.phone,
            "source": lead.source,
            "status": lead.status.value,
            "consent_given": lead.consent_given,
            "consent_at": (
                lead.consent_at.isoformat()
                if lead.consent_at is not None
                else None
            ),
            "converted_at": (
                lead.converted_at.isoformat()
                if lead.converted_at is not None
                else None
            ),
            "created_at": lead.created_at.isoformat(),
            "updated_at": lead.updated_at.isoformat(),
        }
        for lead in leads
    ]), 200


@api.route("/clients/<int:client_id>/jobs", methods=["GET"])
@tenant_required
def list_client_jobs(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

    jobs = db.session.scalars(
        select(Job)
        .where(
            Job.client_id == client_id,
            Job.company_id == g.company_id,
        )
        .order_by(Job.created_at.desc(), Job.id.desc())
    ).all()

    return jsonify([
        {
            "id": job.id,
            "client_id": job.client_id,
            "service_type_id": job.service_type_id,
            "service_zone_id": job.service_zone_id,
            "assigned_membership_id": job.assigned_membership_id,
            "title": job.title,
            "description": job.description,
            "status": job.status.value,
            "priority": job.priority,
            "quoted_amount": (
                float(job.quoted_amount)
                if job.quoted_amount is not None
                else None
            ),
            "scheduled_start": (
                job.scheduled_start.isoformat()
                if job.scheduled_start
                else None
            ),
            "scheduled_end": (
                job.scheduled_end.isoformat()
                if job.scheduled_end
                else None
            ),
            "completed_at": (
                job.completed_at.isoformat()
                if job.completed_at
                else None
            ),
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
        }
        for job in jobs
    ]), 200


@api.route("/clients/<int:client_id>/appointments", methods=["GET"])
@tenant_required
def list_client_appointments(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

    appointments = db.session.scalars(
        select(Appointment)
        .where(
            Appointment.client_id == client_id,
            Appointment.company_id == g.company_id,
        )
        .order_by(Appointment.starts_at.asc(), Appointment.id.asc())
    ).all()

    return jsonify([
        {
            "id": appointment.id,
            "company_id": appointment.company_id,
            "job_id": appointment.job_id,
            "client_id": appointment.client_id,
            "assigned_membership_id": appointment.assigned_membership_id,
            "service_type_id": appointment.service_type_id,
            "title": appointment.title,
            "status": appointment.status.value,
            "starts_at": appointment.starts_at.isoformat(),
            "ends_at": appointment.ends_at.isoformat(),
            "address_text": appointment.address_text,
            "notes": appointment.notes,
        }
        for appointment in appointments
    ]), 200


@api.route("/clients/<int:client_id>/attachments", methods=["GET"])
@tenant_required
def list_client_attachments(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

    attachments = db.session.scalars(
        select(Attachment)
        .where(
            Attachment.client_id == client_id,
            Attachment.company_id == g.company_id,
        )
        .order_by(Attachment.created_at.desc(), Attachment.id.desc())
    ).all()

    return jsonify([
        {
            "id": attachment.id,
            "client_id": attachment.client_id,
            "uploaded_by_membership_id": attachment.uploaded_by_membership_id,
            "filename": attachment.filename,
            "content_type": attachment.content_type,
            "size_bytes": attachment.size_bytes,
            "category": attachment.category,
            "created_at": attachment.created_at.isoformat(),
        }
        for attachment in attachments
    ]), 200


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


@api.route("/clients/<int:client_id>/next-actions", methods=["GET"])
@tenant_required
def list_client_next_actions(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

    next_actions = db.session.scalars(
        select(NextAction)
        .where(
            NextAction.client_id == client_id,
            NextAction.company_id == g.company_id,
        )
        .order_by(NextAction.due_at.asc(), NextAction.id.asc())
    ).all()

    return jsonify([
        {
            "id": action.id,
            "client_id": action.client_id,
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


@api.route("/clients/<int:client_id>/next-actions", methods=["POST"])
@tenant_required
def create_client_next_action(client_id):
    client = db.session.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == g.company_id,
        )
    )

    if client is None:
        return jsonify({"error": "Cliente no encontrado."}), 404

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
        client_id=client.id,
        title=data["title"].strip(),
        description=data.get("description"),
        due_at=due_at,
    )

    db.session.add(action)
    db.session.commit()

    return jsonify({
        "id": action.id,
        "client_id": action.client_id,
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


# Register appointment routes on the existing API blueprint.
register_appointments(api)
