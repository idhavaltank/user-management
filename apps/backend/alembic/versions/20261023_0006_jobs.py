"""Add durable local job records for bounded bulk operations."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0006"
down_revision = "20261023_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create organization-scoped job status storage."""

    op.create_table(
        "organization_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("result_url", sa.String(2048), nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_organization_jobs"),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired')",
            name="job_status_valid",
        ),
        sa.CheckConstraint(
            "progress IS NULL OR progress BETWEEN 0 AND 100", name="job_progress_valid"
        ),
    )
    op.create_index(
        "ix_organization_jobs_organization_status",
        "organization_jobs",
        ["organization_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    """Drop local job status storage."""

    op.drop_index("ix_organization_jobs_organization_status", table_name="organization_jobs")
    op.drop_table("organization_jobs")
