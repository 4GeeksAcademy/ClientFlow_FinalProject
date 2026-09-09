from datetime import datetime, timezone
from enum import Enum as PyEnum

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer
from sqlalchemy import JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

db = SQLAlchemy()


def utc_now():
    return datetime.now(timezone.utc)


class MembershipRole(PyEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    TECHNICIAN = "technician"


class SubscriptionStatus(PyEnum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class LeadStatus(PyEnum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    WON = "won"
    LOST = "lost"


class JobStatus(PyEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AppointmentStatus(PyEnum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class ConversationStatus(PyEnum):
    OPEN = "open"
    WAITING = "waiting"
    RESOLVED = "resolved"


class ChannelType(PyEnum):
    WEB = "web"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"


class MessageDirection(PyEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class NextActionStatus(PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class JobStageStatus(PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class MaterialStatus(PyEnum):
    REQUIRED = "required"
    ORDERED = "ordered"
    AVAILABLE = "available"
    USED = "used"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now,
        nullable=False
    )


class Plan(TimestampMixin, db.Model):
    __tablename__ = "plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    billing_interval: Mapped[str] = mapped_column(
        String(20), default="monthly", nullable=False
    )
    trial_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    limits: Mapped[dict | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


class Company(TimestampMixin, db.Model):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    timezone: Mapped[str] = mapped_column(
        String(60), default="Europe/London", nullable=False
    )
    default_language: Mapped[str] = mapped_column(
        String(5), default="en", nullable=False
    )
    theme: Mapped[str] = mapped_column(String(10), default="system", nullable=False)
    primary_colour: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["CompanyMembership"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class Subscription(TimestampMixin, db.Model):
    __tablename__ = "subscriptions"
    __table_args__ = (Index("ix_subscription_company_status", "company_id", "status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.TRIALING, nullable=False
    )
    trial_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_customer_id: Mapped[str | None] = mapped_column(String(255))
    external_subscription_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    company: Mapped["Company"] = relationship(back_populates="subscriptions")
    plan: Mapped["Plan"] = relationship(back_populates="subscriptions")


class User(TimestampMixin, db.Model):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    memberships: Mapped[list["CompanyMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def serialize(self):
        return {"id": self.id, "email": self.email,
                "first_name": self.first_name, "last_name": self.last_name,
                "preferred_language": self.preferred_language,
                "is_active": self.is_active}


class CompanyMembership(db.Model):
    __tablename__ = "company_memberships"
    __table_args__ = (UniqueConstraint("company_id", "user_id", name="uq_company_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[MembershipRole] = mapped_column(
        Enum(MembershipRole), default=MembershipRole.AGENT, nullable=False
    )
    colour: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    company: Mapped["Company"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")


class MemberInvitation(db.Model):
    __tablename__ = "member_invitations"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[MembershipRole] = mapped_column(
        Enum(MembershipRole), default=MembershipRole.AGENT, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_membership_id: Mapped[int] = mapped_column(
        ForeignKey("company_memberships.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")


class ServiceZone(db.Model):
    __tablename__ = "service_zones"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    postcode_pattern: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServiceType(db.Model):
    __tablename__ = "service_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    colour: Mapped[str] = mapped_column(String(20), nullable=False)
    default_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Lead(TimestampMixin, db.Model):
    __tablename__ = "leads"
    __table_args__ = (Index("ix_lead_company_status", "company_id", "status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    assigned_membership_id: Mapped[int | None] = mapped_column(ForeignKey("company_memberships.id"))
    service_type_id: Mapped[int | None] = mapped_column(ForeignKey("service_types.id"))
    converted_client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), unique=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    source: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus), default=LeadStatus.NEW, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Client(TimestampMixin, db.Model):
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    addresses: Mapped[list["ClientAddress"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(back_populates="client")


class ClientAddress(db.Model):
    __tablename__ = "client_addresses"
    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    label: Mapped[str | None] = mapped_column(String(60))
    line_1: Mapped[str] = mapped_column(String(160), nullable=False)
    line_2: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    postcode: Mapped[str] = mapped_column(String(20), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    client: Mapped["Client"] = relationship(back_populates="addresses")


class Job(TimestampMixin, db.Model):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_job_company_status", "company_id", "status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    service_type_id: Mapped[int | None] = mapped_column(ForeignKey("service_types.id"))
    service_zone_id: Mapped[int | None] = mapped_column(ForeignKey("service_zones.id"))
    assigned_membership_id: Mapped[int | None] = mapped_column(ForeignKey("company_memberships.id"))
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.DRAFT, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    quoted_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client: Mapped["Client"] = relationship(back_populates="jobs")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="job")
    stages: Mapped[list["JobStage"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="JobStage.position"
    )
    materials: Mapped[list["JobMaterial"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["JobAssignment"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class JobAssignment(db.Model):
    __tablename__ = "job_assignments"
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("company_memberships.id"), primary_key=True
    )
    role: Mapped[str | None] = mapped_column(String(60))
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    job: Mapped["Job"] = relationship(back_populates="assignments")


class JobStage(TimestampMixin, db.Model):
    __tablename__ = "job_stages"
    __table_args__ = (
        UniqueConstraint("job_id", "position", name="uq_job_stage_position"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[JobStageStatus] = mapped_column(
        Enum(JobStageStatus), default=JobStageStatus.PENDING, nullable=False
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    job: Mapped["Job"] = relationship(back_populates="stages")


class JobMaterial(TimestampMixin, db.Model):
    __tablename__ = "job_materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    status: Mapped[MaterialStatus] = mapped_column(
        Enum(MaterialStatus), default=MaterialStatus.REQUIRED, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    job: Mapped["Job"] = relationship(back_populates="materials")


class Appointment(TimestampMixin, db.Model):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointment_company_start", "company_id", "starts_at"),
        Index("ix_appointment_assignee_start", "assigned_membership_id", "starts_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    assigned_membership_id: Mapped[int] = mapped_column(ForeignKey("company_memberships.id"), nullable=False)
    service_type_id: Mapped[int | None] = mapped_column(ForeignKey("service_types.id"))
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED, nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    address_text: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    job: Mapped["Job | None"] = relationship(back_populates="appointments")


class NextAction(TimestampMixin, db.Model):
    __tablename__ = "next_actions"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN lead_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN client_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN job_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_next_action_one_target",
        ),
        Index("ix_next_action_company_due", "company_id", "due_at"),
        Index("ix_next_action_assignee_status", "assigned_membership_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    assigned_membership_id: Mapped[int] = mapped_column(
        ForeignKey("company_memberships.id"), nullable=False
    )
    created_by_membership_id: Mapped[int] = mapped_column(
        ForeignKey("company_memberships.id"), nullable=False
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[NextActionStatus] = mapped_column(
        Enum(NextActionStatus), default=NextActionStatus.PENDING, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Activity(db.Model):
    __tablename__ = "activities"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN lead_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN client_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN job_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN conversation_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_activity_one_target",
        ),
        Index("ix_activity_company_created", "company_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    actor_membership_id: Mapped[int | None] = mapped_column(
        ForeignKey("company_memberships.id")
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    conversation_id: Mapped[int | None] = mapped_column(ForeignKey("conversations.id"))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class Attachment(db.Model):
    __tablename__ = "attachments"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN lead_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN client_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN job_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN message_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_attachment_one_target",
        ),
        Index("ix_attachment_company_created", "company_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    uploaded_by_membership_id: Mapped[int] = mapped_column(
        ForeignKey("company_memberships.id"), nullable=False
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    message_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id"))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="document", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class AIAgent(TimestampMixin, db.Model):
    __tablename__ = "ai_agents"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    purpose: Mapped[str] = mapped_column(String(120), nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    main_instruction: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_human_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Conversation(TimestampMixin, db.Model):
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("company_id", "channel", "external_id", name="uq_conversation_external_channel"),
        Index("ix_conversation_company_status", "company_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    assigned_membership_id: Mapped[int | None] = mapped_column(ForeignKey("company_memberships.id"))
    ai_agent_id: Mapped[int | None] = mapped_column(ForeignKey("ai_agents.id"))
    channel: Mapped[ChannelType] = mapped_column(Enum(ChannelType), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus), default=ConversationStatus.OPEN, nullable=False
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    participants: Mapped[list["ConversationParticipant"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class ConversationParticipant(db.Model):
    __tablename__ = "conversation_participants"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    membership_id: Mapped[int | None] = mapped_column(ForeignKey("company_memberships.id"))
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"))
    external_identifier: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(160))
    participant_type: Mapped[str] = mapped_column(String(30), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    conversation: Mapped["Conversation"] = relationship(back_populates="participants")


class Message(db.Model):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_message_conversation_created", "conversation_id", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    sender_participant_id: Mapped[int | None] = mapped_column(ForeignKey("conversation_participants.id"))
    direction: Mapped[MessageDirection] = mapped_column(Enum(MessageDirection), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(30), default="text", nullable=False)
    sent_by_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delivery_status: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


agent_documents = db.Table(
    "agent_documents",
    db.Column("agent_id", ForeignKey("ai_agents.id"), primary_key=True),
    db.Column("document_id", ForeignKey("knowledge_documents.id"), primary_key=True),
)


class KnowledgeDocument(TimestampMixin, db.Model):
    __tablename__ = "knowledge_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    checksum: Mapped[str | None] = mapped_column(String(128))
    ingestion_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    uploaded_by_membership_id: Mapped[int] = mapped_column(ForeignKey("company_memberships.id"), nullable=False)
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    agents: Mapped[list["AIAgent"]] = relationship(
        secondary=agent_documents, backref="knowledge_documents"
    )


class KnowledgeChunk(db.Model):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (UniqueConstraint("document_id", "chunk_index", name="uq_document_chunk"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("knowledge_documents.id"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_reference: Mapped[str | None] = mapped_column(String(255))
    token_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    document: Mapped["KnowledgeDocument"] = relationship(back_populates="chunks")


class Integration(TimestampMixin, db.Model):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("company_id", "provider", name="uq_company_provider"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="disconnected", nullable=False)
    external_account_id: Mapped[str | None] = mapped_column(String(255))
    credentials_reference: Mapped[str | None] = mapped_column(String(500))
    settings: Mapped[dict | None] = mapped_column(JSON)
