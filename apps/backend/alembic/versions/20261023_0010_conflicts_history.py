"""Add recoverable conflict records for review-required fields."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0010"
down_revision = "20261023_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the conflict queue used by the review UI and resolution API."""

    op.create_table(
        "sync_conflicts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity", sa.String(32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("field", sa.String(64), nullable=False),
        sa.Column("local_value", postgresql.JSONB(), nullable=True),
        sa.Column("remote_value", postgresql.JSONB(), nullable=True),
        sa.Column("local_hlc", sa.String(128), nullable=False),
        sa.Column("remote_hlc", sa.String(128), nullable=False),
        sa.Column("remote_device_id", sa.String(128), nullable=False),
        sa.Column("status", sa.String(16), server_default="open", nullable=False),
        sa.Column("resolution_operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["resolution_operation_id"], ["sync_operations.operation_id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sync_conflicts"),
        sa.CheckConstraint("status IN ('open', 'resolved')", name="sync_conflict_status_valid"),
    )
    op.create_index(
        "ix_sync_conflicts_organization_status",
        "sync_conflicts",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_sync_conflicts_record",
        "sync_conflicts",
        ["organization_id", "entity", "entity_id"],
    )


def downgrade() -> None:
    """Remove the conflict queue."""

    op.drop_index("ix_sync_conflicts_record", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_organization_status", table_name="sync_conflicts")
    op.drop_table("sync_conflicts")
