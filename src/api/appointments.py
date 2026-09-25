"""Company-scoped scheduling and validated appointment relationships."""
from datetime import datetime, timezone

from flask import g, jsonify, request
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError

from api.auth import tenant_required
from api.models import (Appointment, AppointmentStatus, Client, Company, CompanyMembership,
                        Job, ServiceType, User, db)


def instant(value):
    if not isinstance(value, str) or len(value) > 50:
        raise ValueError('Invalid date/time.')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        # Existing naive records are UTC; new browser requests carry explicit offsets.
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise ValueError('Invalid date/time.') from None


def iso(value):
    return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()


def serialize(item):
    return {**{key: getattr(item, key) for key in ('id', 'company_id', 'client_id', 'job_id',
            'assigned_membership_id', 'service_type_id', 'title', 'notes', 'address_text')},
            'status': item.status.value, 'starts_at': iso(item.starts_at), 'ends_at': iso(item.ends_at)}


def payload(body, existing=None):
    if not isinstance(body, dict):
        raise ValueError('Expected a JSON object.')
    fields = ('title', 'client_id', 'job_id', 'assigned_membership_id', 'service_type_id',
              'starts_at', 'ends_at', 'status', 'notes', 'address_text')
    if set(body) - set(fields):
        raise ValueError('Unknown appointment fields.')
    values = {key: body.get(key, getattr(existing, key, None)) for key in fields}
    for key, limit in [('title', 180), ('address_text', 300), ('notes', 10000)]:
        value = values[key]
        if value is None and key != 'title':
            continue
        if not isinstance(value, str) or len(value) > limit or (key == 'title' and not value.strip()):
            raise ValueError(f'Invalid {key}.')
        values[key] = value.strip()
    for key, model in [('client_id', Client), ('job_id', Job),
                       ('assigned_membership_id', CompanyMembership), ('service_type_id', ServiceType)]:
        value = values[key]
        if value is None and key in ('job_id', 'service_type_id'):
            continue
        if type(value) is not int or value <= 0:
            raise ValueError(f'Invalid {key}.')
        related = db.session.scalar(select(model).where(model.id == value, model.company_id == g.company_id))
        if related is None or (hasattr(related, 'is_active') and not related.is_active):
            raise ValueError(f'{key} is not available in this company.')
        if key == 'assigned_membership_id' and not db.session.get(User, related.user_id).is_active:
            raise ValueError('Assigned user is inactive.')
        if key == 'job_id' and related.client_id != values['client_id']:
            raise ValueError('Job does not belong to the selected client.')
    for key in ('starts_at', 'ends_at'):
        value = values[key]
        values[key] = instant(value) if not isinstance(value, datetime) else instant(iso(value))
    if values['ends_at'] <= values['starts_at']:
        raise ValueError('End time must be after start time.')
    try:
        values['status'] = AppointmentStatus(values['status'] if values['status'] is not None else AppointmentStatus.SCHEDULED)
    except (ValueError, TypeError):
        raise ValueError('Invalid appointment status.') from None
    return values


def lock_schedule():
    # Serialize scheduling writes per company on PostgreSQL and SQLite.
    db.session.execute(update(Company).where(Company.id == g.company_id)
                       .values(updated_at=Company.updated_at))


def conflicts(values, excluded=None):
    if values['status'] == AppointmentStatus.CANCELLED:
        return False
    query = select(Appointment.id).where(
        Appointment.company_id == g.company_id,
        Appointment.assigned_membership_id == values['assigned_membership_id'],
        Appointment.status != AppointmentStatus.CANCELLED,
        Appointment.starts_at < values['ends_at'], Appointment.ends_at > values['starts_at'])
    if excluded is not None:
        query = query.where(Appointment.id != excluded)
    return db.session.scalar(query.limit(1)) is not None


def register_appointments(api):
    @api.get('/appointments')
    @tenant_required
    def get_appointments():
        try:
            start = instant(request.args['start_date']) if request.args.get('start_date') else None
            end = instant(request.args['end_date']) if request.args.get('end_date') else None
            if start and end and start >= end:
                raise ValueError('Invalid date range.')
        except ValueError as error:
            return jsonify(error=str(error)), 400
        query = select(Appointment).where(Appointment.company_id == g.company_id)
        if start:
            query = query.where(Appointment.ends_at > start)
        if end:
            query = query.where(Appointment.starts_at < end)
        return jsonify([serialize(item) for item in db.session.scalars(
            query.order_by(Appointment.starts_at, Appointment.id)).all()])

    @api.get('/appointments/options')
    @tenant_required
    def appointment_options():
        def rows(model):
            return db.session.scalars(select(model).where(model.company_id == g.company_id).order_by(model.id)).all()
        return jsonify(
            clients=[{'id': item.id, 'name': f'{item.first_name} {item.last_name or ""}'.strip()} for item in rows(Client) if item.is_active],
            jobs=[{'id': item.id, 'client_id': item.client_id, 'title': item.title} for item in rows(Job)],
            members=[{'id': item.id, 'name': f'{item.user.first_name} {item.user.last_name or ""}'.strip()} for item in rows(CompanyMembership) if item.is_active and item.user.is_active],
            services=[{'id': item.id, 'name': item.name, 'colour': item.colour} for item in rows(ServiceType) if item.is_active])

    @api.post('/appointments')
    @tenant_required
    def create_appointment():
        try:
            lock_schedule()
            values = payload(request.get_json(silent=True))
            if conflicts(values):
                db.session.rollback()
                return jsonify(error='The assigned user already has an appointment during this time.'), 409
            item = Appointment(company_id=g.company_id, **values)
            db.session.add(item)
            db.session.commit()
            return jsonify(id=item.id, appointment=serialize(item)), 201
        except ValueError as error:
            db.session.rollback()
            return jsonify(error=str(error)), 400
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify(error='Unable to save the appointment.'), 503

    @api.put('/appointments/<int:appointment_id>')
    @tenant_required
    def update_appointment(appointment_id):
        try:
            lock_schedule()
            item = db.session.scalar(select(Appointment).where(Appointment.id == appointment_id, Appointment.company_id == g.company_id))
            if item is None:
                db.session.rollback()
                return jsonify(error='Appointment not found.'), 404
            values = payload(request.get_json(silent=True), item)
            if conflicts(values, item.id):
                db.session.rollback()
                return jsonify(error='The assigned user already has an appointment during this time.'), 409
            for key, value in values.items():
                setattr(item, key, value)
            db.session.commit()
            return jsonify(appointment=serialize(item))
        except ValueError as error:
            db.session.rollback()
            return jsonify(error=str(error)), 400
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify(error='Unable to update the appointment.'), 503

    @api.delete('/appointments/<int:appointment_id>')
    @tenant_required
    def delete_appointment(appointment_id):
        try:
            lock_schedule()
            item = db.session.scalar(select(Appointment).where(Appointment.id == appointment_id, Appointment.company_id == g.company_id))
            if item is None:
                db.session.rollback()
                return jsonify(error='Appointment not found.'), 404
            item.status = AppointmentStatus.CANCELLED
            db.session.commit()
            return jsonify(message='Appointment cancelled.')
        except SQLAlchemyError:
            db.session.rollback()
            return jsonify(error='Unable to cancel the appointment.'), 503
