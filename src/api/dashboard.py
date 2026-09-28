"""Tenant-scoped dashboard metrics and chart data."""

from collections import Counter
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import String, cast, func, select

from api.auth import tenant_required
from api.models import (
    Activity,
    Appointment,
    Client,
    CompanyMembership,
    Job,
    Lead,
    User,
    db,
    utc_now,
)


dashboard = Blueprint("dashboard", __name__)


def _period_bounds(period):
    now = utc_now()

    if period == "current_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_end = start
        previous_start = previous_end - (now - start)
        return start, now, previous_start, previous_end

    durations = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "1y": timedelta(days=365),
    }
    duration = durations.get(period)
    if duration is None:
        return None

    start = now - duration
    return start, now, start - duration, start


def _percentage_change(current, previous):
    current = float(current or 0)
    previous = float(previous or 0)

    if previous:
        return round((current - previous) * 100 / previous, 2)
    return 100.0 if current else 0.0


def _metric(value, previous, **extra):
    return {
        "value": float(value) if isinstance(value, float) else int(value or 0),
        "change_percentage": _percentage_change(value, previous),
        **extra,
    }


def _count_between(model, date_column, company_id, start, end, *conditions):
    return db.session.scalar(
        select(func.count(model.id)).where(
            model.company_id == company_id,
            date_column >= start,
            date_column < end,
            *conditions,
        )
    ) or 0


@dashboard.get("/dashboard/metrics")
@tenant_required
def dashboard_metrics():
    period = request.args.get("period", "current_month")
    bounds = _period_bounds(period)
    if bounds is None:
        return jsonify({"error": "Invalid dashboard period"}), 400

    start, end, previous_start, previous_end = bounds
    company_id = g.company_id
    completed_job = func.lower(cast(Job.status, String)) == "completed"
    active_appointment = func.lower(cast(Appointment.status, String)).in_(
        ("scheduled", "confirmed")
    )
    in_progress_job = func.lower(cast(Job.status, String)) == "in_progress"

    sales = db.session.scalar(
        select(func.coalesce(func.sum(Job.quoted_amount), 0)).where(
            Job.company_id == company_id,
            completed_job,
            Job.completed_at >= start,
            Job.completed_at < end,
        )
    ) or 0
    previous_sales = db.session.scalar(
        select(func.coalesce(func.sum(Job.quoted_amount), 0)).where(
            Job.company_id == company_id,
            completed_job,
            Job.completed_at >= previous_start,
            Job.completed_at < previous_end,
        )
    ) or 0

    new_leads = _count_between(Lead, Lead.created_at, company_id, start, end)
    previous_leads = _count_between(
        Lead, Lead.created_at, company_id, previous_start, previous_end
    )
    active_clients = db.session.scalar(
        select(func.count(Client.id)).where(
            Client.company_id == company_id,
            Client.is_active.is_(True),
            Client.created_at < end,
        )
    ) or 0
    previous_active_clients = db.session.scalar(
        select(func.count(Client.id)).where(
            Client.company_id == company_id,
            Client.is_active.is_(True),
            Client.created_at < previous_end,
        )
    ) or 0
    jobs_in_progress = _count_between(
        Job, Job.created_at, company_id, start, end, in_progress_job
    )
    previous_jobs_in_progress = _count_between(
        Job,
        Job.created_at,
        company_id,
        previous_start,
        previous_end,
        in_progress_job,
    )
    appointments = _count_between(
        Appointment,
        Appointment.starts_at,
        company_id,
        start,
        end,
        active_appointment,
    )
    previous_appointments = _count_between(
        Appointment,
        Appointment.starts_at,
        company_id,
        previous_start,
        previous_end,
        active_appointment,
    )

    sales_rows = db.session.execute(
        select(
            Job.id,
            Job.title,
            Job.quoted_amount,
            Job.completed_at,
            cast(Job.status, String).label("status"),
            Client.id.label("client_id"),
            Client.first_name,
            Client.last_name,
            User.first_name.label("assignee_first_name"),
            User.last_name.label("assignee_last_name"),
        )
        .join(Client, Client.id == Job.client_id)
        .outerjoin(
            CompanyMembership,
            CompanyMembership.id == Job.assigned_membership_id,
        )
        .outerjoin(User, User.id == CompanyMembership.user_id)
        .where(
            Job.company_id == company_id,
            completed_job,
            Job.completed_at >= start,
            Job.completed_at < end,
        )
        .order_by(Job.completed_at.desc(), Job.id.desc())
    ).all()
    associated_clients = len({row.client_id for row in sales_rows})

    return jsonify(
        {
            "period": period,
            "range": {
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "sales_this_month": _metric(
                float(sales),
                float(previous_sales),
                currency="EUR",
            ),
            "new_leads": _metric(new_leads, previous_leads),
            "active_clients": _metric(
                active_clients, previous_active_clients
            ),
            "jobs_in_progress": _metric(
                jobs_in_progress, previous_jobs_in_progress
            ),
            "appointments": _metric(appointments, previous_appointments),
            "sales_summary": {
                "completed_jobs": len(sales_rows),
                "associated_clients": associated_clients,
                "average_per_job": (
                    round(float(sales) / len(sales_rows), 2)
                    if sales_rows
                    else 0.0
                ),
                "records": [
                    {
                        "client": " ".join(
                            part
                            for part in (row.first_name, row.last_name)
                            if part
                        ),
                        "job": row.title,
                        "amount": float(row.quoted_amount or 0),
                        "completion_date": (
                            row.completed_at.isoformat()
                            if row.completed_at
                            else None
                        ),
                        "status": row.status.lower(),
                        "assigned_user": " ".join(
                            part
                            for part in (
                                row.assignee_first_name,
                                row.assignee_last_name,
                            )
                            if part
                        ) or None,
                    }
                    for row in sales_rows
                ],
            },
        }
    )


def _month_start(value, offset):
    month_index = value.year * 12 + value.month - 1 + offset
    return datetime(
        month_index // 12,
        month_index % 12 + 1,
        1,
        tzinfo=timezone.utc,
    )


def _chart_buckets(scale):
    now = utc_now()

    if scale == "years":
        starts = [
            datetime(year, 1, 1, tzinfo=timezone.utc)
            for year in range(now.year - 5, now.year + 1)
        ]
        labels = [str(value.year) for value in starts]
        key = lambda value: str(value.year)
    elif scale == "months":
        current = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        starts = [_month_start(current, offset) for offset in range(-11, 1)]
        labels = [value.strftime("%Y-%m") for value in starts]
        key = lambda value: value.strftime("%Y-%m")
    elif scale == "days":
        current = now.replace(hour=0, minute=0, second=0, microsecond=0)
        starts = [current - timedelta(days=offset) for offset in range(6, -1, -1)]
        labels = [value.strftime("%Y-%m-%d") for value in starts]
        key = lambda value: value.strftime("%Y-%m-%d")
    elif scale == "hours":
        current = now.replace(minute=0, second=0, microsecond=0)
        starts = [current - timedelta(hours=offset) for offset in range(23, -1, -1)]
        labels = [value.strftime("%Y-%m-%dT%H:00") for value in starts]
        key = lambda value: value.strftime("%Y-%m-%dT%H:00")
    else:
        return None

    return starts[0], now, labels, key


def _aware(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dashboard.get("/dashboard/charts")
@tenant_required
def dashboard_charts():
    scale = request.args.get("scale", "months")
    buckets = _chart_buckets(scale)
    if buckets is None:
        return jsonify({"error": "Invalid dashboard scale"}), 400

    start, end, labels, bucket_key = buckets
    company_id = g.company_id
    leads = db.session.scalars(
        select(Lead.created_at).where(
            Lead.company_id == company_id,
            Lead.created_at >= start,
            Lead.created_at <= end,
        )
    ).all()
    clients = db.session.scalars(
        select(Client.created_at).where(
            Client.company_id == company_id,
            Client.created_at >= start,
            Client.created_at <= end,
        )
    ).all()
    lead_counts = Counter(bucket_key(_aware(value)) for value in leads)
    client_counts = Counter(bucket_key(_aware(value)) for value in clients)
    series = [
        {
            "label": label,
            "leads": lead_counts[label],
            "clients": client_counts[label],
        }
        for label in labels
    ]
    total_leads = sum(lead_counts.values())
    total_clients = sum(client_counts.values())
    best = max(series, key=lambda item: item["leads"] + item["clients"])

    status_rows = db.session.execute(
        select(
            func.lower(cast(Job.status, String)).label("status"),
            func.count(Job.id).label("count"),
        )
        .where(Job.company_id == company_id)
        .group_by(func.lower(cast(Job.status, String)))
    ).all()
    source_rows = db.session.execute(
        select(Lead.source, func.count(Lead.id).label("count"))
        .where(Lead.company_id == company_id)
        .group_by(Lead.source)
        .order_by(func.count(Lead.id).desc())
    ).all()
    source_total = sum(row.count for row in source_rows)
    activities = db.session.execute(
        select(Activity.id, Activity.event_type, Activity.description, Activity.created_at)
        .where(Activity.company_id == company_id)
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(8)
    ).all()

    return jsonify(
        {
            "scale": scale,
            "series": series,
            "metrics": {
                "conversion_percentage": (
                    round(total_clients * 100 / total_leads, 2)
                    if total_leads
                    else 0.0
                ),
                "best_moment": (
                    best["label"]
                    if best["leads"] or best["clients"]
                    else None
                ),
                "average_leads": round(total_leads / len(series), 2),
            },
            "job_status": [
                {"status": row.status, "count": row.count}
                for row in status_rows
            ],
            "lead_sources": [
                {
                    "source": row.source or "Unknown",
                    "count": row.count,
                    "percentage": (
                        round(row.count * 100 / source_total, 2)
                        if source_total
                        else 0.0
                    ),
                }
                for row in source_rows
            ],
            "recent_activity": [
                {
                    "id": row.id,
                    "event_type": row.event_type,
                    "description": row.description,
                    "created_at": row.created_at.isoformat(),
                }
                for row in activities
            ],
        }
    )
