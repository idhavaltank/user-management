"""Add teams, invitations, notifications, API keys, and audit records."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0004"
down_revision = "20261023_0003"
branch_labels = None
depends_on = None


def _uuid_column(name: str) -> sa.Column:
    """Return the shared PostgreSQL UUID primary-key column definition."""

    return sa.Column(
        name,
        postgresql.UUID(as_uuid=True),
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )


def _timestamps() -> tuple[sa.Column, sa.Column]:
    """Return timestamp columns with database-side creation defaults."""

    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    """Create organization operational tables with tenant-scoped indexes."""

    created_at, updated_at = _timestamps()
    op.create_table(
        "teams",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_teams"),
        sa.UniqueConstraint("organization_id", "name", name="team_name_unique"),
    )
    op.create_index("ix_teams_organization", "teams", ["organization_id"], unique=False)

    created_at, updated_at = _timestamps()
    op.create_table(
        "organization_invitations",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["organization_roles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_organization_invitations"),
        sa.UniqueConstraint(
            "organization_id",
            "idempotency_key",
            name="organization_invitation_idempotency_unique",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')",
            name="invitation_status_valid",
        ),
    )
    op.create_index(
        "ix_organization_invitations_organization_status",
        "organization_invitations",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_organization_invitations_token_hash",
        "organization_invitations",
        ["token_hash"],
        unique=True,
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "notifications",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
    )
    op.create_index(
        "ix_notifications_user_read", "notifications", ["user_id", "read"], unique=False
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "notification_preferences",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email_security", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_product", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("in_app_security", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("in_app_product", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("organization_id", "user_id", name="pk_notification_preferences"),
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "organization_api_keys",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prefix", sa.String(64), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column(
            "scopes",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_organization_api_keys"),
    )
    op.create_index(
        "ix_organization_api_keys_organization",
        "organization_api_keys",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_organization_api_keys_hash", "organization_api_keys", ["key_hash"], unique=True
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "audit_logs",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", sa.String(16), nullable=False),
        sa.Column("event_type", sa.String(120), nullable=False),
        sa.Column("target_type", sa.String(120), nullable=True),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index(
        "ix_audit_logs_organization_occurred",
        "audit_logs",
        ["organization_id", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop organization operational tables in dependency-safe order."""

    op.drop_index("ix_audit_logs_organization_occurred", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_organization_api_keys_hash", table_name="organization_api_keys")
    op.drop_index("ix_organization_api_keys_organization", table_name="organization_api_keys")
    op.drop_table("organization_api_keys")
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_organization_invitations_token_hash", table_name="organization_invitations")
    op.drop_index(
        "ix_organization_invitations_organization_status",
        table_name="organization_invitations",
    )
    op.drop_table("organization_invitations")
    op.drop_index("ix_teams_organization", table_name="teams")
    op.drop_table("teams")
