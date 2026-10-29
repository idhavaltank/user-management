"""Organization-scoped CRM entities used by the FlowSync online foundation.

The models intentionally keep relationships explicit through UUID foreign keys.
That makes the records safe to replicate into the future IndexedDB adapter and
keeps tenant ownership enforceable in every API query.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FlowAccountStatus(enum.StrEnum):
    """Lifecycle values for a company or account in the CRM."""

    PROSPECT = "prospect"
    CUSTOMER = "customer"
    INACTIVE = "inactive"


class FlowContactStatus(enum.StrEnum):
    """Lifecycle values for a person associated with an account."""

    LEAD = "lead"
    ACTIVE = "active"
    INACTIVE = "inactive"


class FlowDealStage(enum.StrEnum):
    """Pipeline stages displayed by the FlowSync deal board."""

    LEAD = "lead"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class FlowActivityKind(enum.StrEnum):
    """Kinds of timeline work that can be attached to CRM records."""

    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    TASK = "task"
    NOTE = "note"


class FlowActivityStatus(enum.StrEnum):
    """State of a planned or completed activity."""

    PLANNED = "planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Account(TimestampMixin, Base):
    """A company or customer account owned by one organization."""

    __tablename__ = "crm_accounts"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="crm_account_name_non_empty"),
        CheckConstraint(
            "status IN ('prospect', 'customer', 'inactive')", name="crm_account_status_valid"
        ),
        Index("ix_crm_accounts_organization_status", "organization_id", "status"),
        Index("ix_crm_accounts_organization_name", "organization_id", "name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(120), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[FlowAccountStatus] = mapped_column(
        String(16), nullable=False, default=FlowAccountStatus.PROSPECT, server_default="prospect"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    profile_image_content_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    profile_image_size: Mapped[int | None] = mapped_column(nullable=True)
    profile_image_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Contact(TimestampMixin, Base):
    """A person who belongs to an organization and optionally an account."""

    __tablename__ = "crm_contacts"
    __table_args__ = (
        CheckConstraint("length(trim(first_name)) > 0", name="crm_contact_first_name_non_empty"),
        CheckConstraint("length(trim(last_name)) > 0", name="crm_contact_last_name_non_empty"),
        CheckConstraint(
            "status IN ('lead', 'active', 'inactive')", name="crm_contact_status_valid"
        ),
        Index("ix_crm_contacts_organization_status", "organization_id", "status"),
        Index("ix_crm_contacts_organization_email", "organization_id", "email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_accounts.id", ondelete="SET NULL"), nullable=True
    )
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[FlowContactStatus] = mapped_column(
        String(16), nullable=False, default=FlowContactStatus.LEAD, server_default="lead"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    profile_image_content_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    profile_image_size: Mapped[int | None] = mapped_column(nullable=True)
    profile_image_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Deal(TimestampMixin, Base):
    """A revenue opportunity in an organization's sales pipeline."""

    __tablename__ = "crm_deals"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="crm_deal_name_non_empty"),
        CheckConstraint("amount >= 0", name="crm_deal_amount_non_negative"),
        CheckConstraint(
            "stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')",
            name="crm_deal_stage_valid",
        ),
        Index("ix_crm_deals_organization_stage", "organization_id", "stage"),
        Index("ix_crm_deals_organization_close_date", "organization_id", "expected_close_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    stage: Mapped[FlowDealStage] = mapped_column(
        String(24), nullable=False, default=FlowDealStage.LEAD, server_default="lead"
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Activity(TimestampMixin, Base):
    """A timeline event or follow-up attached to CRM records."""

    __tablename__ = "crm_activities"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('call', 'email', 'meeting', 'task', 'note')",
            name="crm_activity_kind_valid",
        ),
        CheckConstraint(
            "status IN ('planned', 'completed', 'cancelled')",
            name="crm_activity_status_valid",
        ),
        Index("ix_crm_activities_organization_due", "organization_id", "due_at"),
        Index("ix_crm_activities_organization_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_accounts.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("crm_deals.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[FlowActivityKind] = mapped_column(String(16), nullable=False)
    status: Mapped[FlowActivityStatus] = mapped_column(
        String(16), nullable=False, default=FlowActivityStatus.PLANNED, server_default="planned"
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
