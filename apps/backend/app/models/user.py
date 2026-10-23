"""User profile ORM model, enums, indexes, and database invariants."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Index,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(enum.StrEnum):
    """Roles recognized by the initial authorization boundary."""

    ADMIN = "admin"
    USER = "user"


class UserStatus(enum.StrEnum):
    """Canonical account lifecycle independent from soft deletion."""

    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    LOCKED = "locked"
    DELETED = "deleted"


class Gender(enum.StrEnum):
    """Gender values preserved from the existing frontend contract."""

    MEN = "Men"
    WOMEN = "Women"


class User(TimestampMixin, Base):
    """Persisted profile record with soft-delete and active-email rules."""

    __tablename__ = "users"
    # Database constraints repeat important service validations so direct SQL
    # writes cannot silently violate API assumptions.
    __table_args__ = (
        CheckConstraint("birth_date >= DATE '1960-01-01'", name="birth_date_min"),
        CheckConstraint("birth_date <= DATE '2000-01-01'", name="birth_date_max"),
        CheckConstraint("role IN ('admin', 'user')", name="role_valid"),
        CheckConstraint(
            "status IN ('pending', 'active', 'inactive', 'suspended', 'locked', 'deleted')",
            name="status_valid",
        ),
        CheckConstraint("gender IN ('Men', 'Women')", name="gender_valid"),
        CheckConstraint("length(trim(name)) > 0", name="name_non_empty"),
        CheckConstraint("cardinality(hobbies) <= 20", name="hobbies_max_items"),
        CheckConstraint("cardinality(custom_hobbies) <= 20", name="custom_hobbies_max_items"),
        CheckConstraint("array_position(hobbies, '') IS NULL", name="hobbies_no_empty"),
        CheckConstraint(
            "array_position(custom_hobbies, '') IS NULL", name="custom_hobbies_no_empty"
        ),
        CheckConstraint(
            "(is_active = true AND deleted_at IS NULL) OR "
            "(is_active = false AND deleted_at IS NOT NULL)",
            name="active_deleted_consistent",
        ),
        Index("ix_users_active_name", "is_active", "name"),
        Index("ix_users_active_created_at", "is_active", "created_at"),
        Index(
            "uq_users_active_email",
            func.lower("email"),
            unique=True,
            postgresql_where=text("is_active = true AND deleted_at IS NULL"),
        ),
    )

    # PostgreSQL generates IDs in production; the Python default keeps ORM
    # objects useful before flushes and in database-independent unit tests.
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    # A password is optional for profile records created by the admin UI; the
    # bootstrap administrator is the authenticated local entry point.
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    gender: Mapped[Gender] = mapped_column(String(16), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    college: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    hobbies: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'::text[]")
    )
    custom_hobbies: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default=text("'{}'::text[]")
    )
    role: Mapped[UserRole] = mapped_column(String(16), nullable=False, default=UserRole.USER)
    status: Mapped[UserStatus] = mapped_column(
        String(16), nullable=False, default=UserStatus.ACTIVE, server_default="active"
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        default=0, server_default="0", nullable=False
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Deletion is represented as state so history and email conflict behavior
    # remain explicit instead of physically removing rows.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
