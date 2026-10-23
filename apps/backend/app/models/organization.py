"""Organization and authorization relationship models.

These tables establish the tenant boundary without coupling the service layer
to a particular UI.  A user remains a global identity; visibility and
permissions are derived from the organization membership and role rows.
"""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MembershipStatus(enum.StrEnum):
    """Lifecycle values for a user's membership in one organization."""

    INVITED = "invited"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REMOVED = "removed"


class Organization(TimestampMixin, Base):
    """Tenant identity and human-readable URL slug."""

    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("slug", name="organization_slug_unique"),
        Index("ix_organizations_slug", "slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    default_role_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    require_email_verification: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    allow_self_join: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )


class Permission(Base):
    """Global permission catalog entry used by organization roles."""

    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class OrganizationRole(TimestampMixin, Base):
    """Role definition whose permissions are scoped to one organization."""

    __tablename__ = "organization_roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="organization_role_name_unique"),
        Index("ix_organization_roles_organization", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )


class RolePermission(Base):
    """Many-to-many assignment between a role and the global permission catalog."""

    __tablename__ = "role_permissions"
    __table_args__ = (Index("ix_role_permissions_permission", "permission_id"),)

    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organization_roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class OrganizationMembership(TimestampMixin, Base):
    """The authoritative organization visibility and role relationship."""

    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="organization_membership_unique"),
        Index("ix_organization_memberships_user", "user_id"),
        Index("ix_organization_memberships_organization_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organization_roles.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[MembershipStatus] = mapped_column(
        String(16), nullable=False, default=MembershipStatus.ACTIVE, server_default="active"
    )
