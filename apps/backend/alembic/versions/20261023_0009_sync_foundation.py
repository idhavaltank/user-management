"""Add durable operation log, merge clocks, and CRM tombstones."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0009"
down_revision = "20261023_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the sync protocol storage and make CRM deletes recoverable."""

    for table in ("crm_accounts", "crm_contacts", "crm_deals", "crm_activities"):
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "sync_operations",
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity", sa.String(32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("changes", postgresql.JSONB(), nullable=True),
        sa.Column("hlc", sa.String(128), nullable=False),
        sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(16), server_default="accepted", nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("operation_id", name="pk_sync_operations"),
        sa.UniqueConstraint("sequence", name="uq_sync_operations_sequence"),
        sa.CheckConstraint(
            "entity IN ('accounts', 'contacts', 'deals', 'activities')", name="sync_entity_valid"
        ),
        sa.CheckConstraint("kind IN ('upsert', 'delete')", name="sync_kind_valid"),
        sa.CheckConstraint("status IN ('accepted', 'rejected')", name="sync_status_valid"),
    )
    op.create_index(
        "ix_sync_operations_organization_sequence",
        "sync_operations",
        ["organization_id", "sequence"],
    )
    op.create_index(
        "ix_sync_operations_organization_device",
        "sync_operations",
        ["organization_id", "device_id"],
    )
    op.create_index(
        "ix_sync_operations_organization_entity",
        "sync_operations",
        ["organization_id", "entity", "entity_id"],
    )

    op.create_table(
        "sync_record_states",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity", sa.String(32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "field_clocks",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_sync_record_states"),
        sa.UniqueConstraint(
            "organization_id", "entity", "entity_id", name="uq_sync_record_states_scope_record"
        ),
        sa.CheckConstraint(
            "entity IN ('accounts', 'contacts', 'deals', 'activities')",
            name="sync_state_entity_valid",
        ),
    )
    op.create_index(
        "ix_sync_record_states_organization_entity",
        "sync_record_states",
        ["organization_id", "entity", "entity_id"],
        unique=True,
    )


def downgrade() -> None:
    """Remove sync metadata and the tombstone columns."""

    op.drop_index("ix_sync_record_states_organization_entity", table_name="sync_record_states")
    op.drop_table("sync_record_states")
    op.drop_index("ix_sync_operations_organization_entity", table_name="sync_operations")
    op.drop_index("ix_sync_operations_organization_device", table_name="sync_operations")
    op.drop_index("ix_sync_operations_organization_sequence", table_name="sync_operations")
    op.drop_table("sync_operations")
    for table in ("crm_activities", "crm_deals", "crm_contacts", "crm_accounts"):
        op.drop_column(table, "deleted_at")
