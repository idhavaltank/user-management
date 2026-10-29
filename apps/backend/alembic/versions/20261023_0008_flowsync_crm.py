"""Add the organization-scoped FlowSync CRM foundation."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0008"
down_revision = "20261023_0007"
branch_labels = None
depends_on = None


def _uuid_column(name: str) -> sa.Column:
    """Return a UUID primary-key column consistent with existing migrations."""

    return sa.Column(
        name,
        postgresql.UUID(as_uuid=True),
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )


def _timestamps() -> tuple[sa.Column, sa.Column]:
    """Return database-generated timestamps for each CRM aggregate."""

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
    """Create accounts, contacts, deals, activities, and CRM permissions."""

    created_at, updated_at = _timestamps()
    op.create_table(
        "crm_accounts",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("industry", sa.String(120), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="prospect"),
        sa.Column("notes", sa.Text(), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_crm_accounts"),
        sa.CheckConstraint("length(trim(name)) > 0", name="crm_account_name_non_empty"),
        sa.CheckConstraint(
            "status IN ('prospect', 'customer', 'inactive')", name="crm_account_status_valid"
        ),
    )
    op.create_index(
        "ix_crm_accounts_organization_status",
        "crm_accounts",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_crm_accounts_organization_name",
        "crm_accounts",
        ["organization_id", "name"],
        unique=False,
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "crm_contacts",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("first_name", sa.String(80), nullable=False),
        sa.Column("last_name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("job_title", sa.String(160), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="lead"),
        sa.Column("notes", sa.Text(), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["crm_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_crm_contacts"),
        sa.CheckConstraint("length(trim(first_name)) > 0", name="crm_contact_first_name_non_empty"),
        sa.CheckConstraint("length(trim(last_name)) > 0", name="crm_contact_last_name_non_empty"),
        sa.CheckConstraint(
            "status IN ('lead', 'active', 'inactive')", name="crm_contact_status_valid"
        ),
    )
    op.create_index(
        "ix_crm_contacts_organization_status",
        "crm_contacts",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_crm_contacts_organization_email",
        "crm_contacts",
        ["organization_id", "email"],
        unique=False,
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "crm_deals",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("stage", sa.String(24), nullable=False, server_default="lead"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["crm_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_crm_deals"),
        sa.CheckConstraint("length(trim(name)) > 0", name="crm_deal_name_non_empty"),
        sa.CheckConstraint("amount >= 0", name="crm_deal_amount_non_negative"),
        sa.CheckConstraint(
            "stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')",
            name="crm_deal_stage_valid",
        ),
    )
    op.create_index(
        "ix_crm_deals_organization_stage", "crm_deals", ["organization_id", "stage"], unique=False
    )
    op.create_index(
        "ix_crm_deals_organization_close_date",
        "crm_deals",
        ["organization_id", "expected_close_date"],
        unique=False,
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "crm_activities",
        _uuid_column("id"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="planned"),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["crm_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deal_id"], ["crm_deals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_crm_activities"),
        sa.CheckConstraint(
            "kind IN ('call', 'email', 'meeting', 'task', 'note')", name="crm_activity_kind_valid"
        ),
        sa.CheckConstraint(
            "status IN ('planned', 'completed', 'cancelled')", name="crm_activity_status_valid"
        ),
    )
    op.create_index(
        "ix_crm_activities_organization_due",
        "crm_activities",
        ["organization_id", "due_at"],
        unique=False,
    )
    op.create_index(
        "ix_crm_activities_organization_status",
        "crm_activities",
        ["organization_id", "status"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            INSERT INTO permissions (key, description)
            VALUES
              ('crm.read', 'Read FlowSync CRM records and dashboard'),
              ('crm.write', 'Create and update FlowSync CRM records'),
              ('crm.delete', 'Delete FlowSync CRM records')
            ON CONFLICT (key) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM organization_roles r
            CROSS JOIN permissions p
            WHERE r.name = 'Administrator' AND p.key IN ('crm.read', 'crm.write', 'crm.delete')
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade() -> None:
    """Drop CRM tables and only the permission rows introduced by this migration."""

    op.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (
                SELECT id FROM permissions
                WHERE key IN ('crm.read', 'crm.write', 'crm.delete')
            )
            """
        )
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE key IN ('crm.read', 'crm.write', 'crm.delete')")
    )
    op.drop_index("ix_crm_activities_organization_status", table_name="crm_activities")
    op.drop_index("ix_crm_activities_organization_due", table_name="crm_activities")
    op.drop_table("crm_activities")
    op.drop_index("ix_crm_deals_organization_close_date", table_name="crm_deals")
    op.drop_index("ix_crm_deals_organization_stage", table_name="crm_deals")
    op.drop_table("crm_deals")
    op.drop_index("ix_crm_contacts_organization_email", table_name="crm_contacts")
    op.drop_index("ix_crm_contacts_organization_status", table_name="crm_contacts")
    op.drop_table("crm_contacts")
    op.drop_index("ix_crm_accounts_organization_name", table_name="crm_accounts")
    op.drop_index("ix_crm_accounts_organization_status", table_name="crm_accounts")
    op.drop_table("crm_accounts")
