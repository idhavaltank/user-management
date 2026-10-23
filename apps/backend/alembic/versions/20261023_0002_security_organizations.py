"""Add account lifecycle and local organization authorization foundations.

This migration is additive and backfills the existing baseline users into one
deterministic local organization.  PostgreSQL remains authoritative for the
backfill; the application does not need to guess tenant membership while the
new API is introduced.

Revision ID: 20261023_0002
Revises: 20261022_0001
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0002"
down_revision = "20261022_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add lifecycle columns, authorization tables, and a local backfill."""

    # Account lifecycle fields are nullable only while the existing rows are
    # backfilled.  They become required before this migration commits.
    op.add_column("users", sa.Column("status", sa.String(length=16), nullable=True))
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute(
        sa.text(
            """
            UPDATE users
            SET status = CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END,
                email_verified_at = created_at,
                password_changed_at = CASE WHEN password_hash IS NULL THEN NULL ELSE created_at END
            WHERE status IS NULL
            """
        )
    )
    op.alter_column("users", "status", nullable=False, server_default="active")
    op.create_check_constraint(
        "status_valid",
        "users",
        "status IN ('pending', 'active', 'inactive', 'suspended', 'locked', 'deleted')",
    )

    # Tenant identity and a global permission catalog.
    op.create_table(
        "organizations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("slug", name="organization_slug_unique"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=False)

    op.create_table(
        "permissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_permissions"),
        sa.UniqueConstraint("key", name="uq_permissions_key"),
    )

    op.create_table(
        "organization_roles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
            name="fk_organization_roles_organization_id_organizations",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organization_roles"),
        sa.UniqueConstraint("organization_id", "name", name="organization_role_name_unique"),
    )
    op.create_index(
        "ix_organization_roles_organization",
        "organization_roles",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["organization_roles.id"],
            ondelete="CASCADE",
            name="fk_role_permissions_role_id_organization_roles",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions.id"],
            ondelete="CASCADE",
            name="fk_role_permissions_permission_id_permissions",
        ),
        sa.PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions"),
    )
    op.create_index(
        "ix_role_permissions_permission",
        "role_permissions",
        ["permission_id"],
        unique=False,
    )

    op.create_table(
        "organization_memberships",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
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
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
            name="fk_organization_memberships_organization_id_organizations",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_organization_memberships_user_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["organization_roles.id"],
            ondelete="RESTRICT",
            name="fk_organization_memberships_role_id_organization_roles",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organization_memberships"),
        sa.UniqueConstraint("organization_id", "user_id", name="organization_membership_unique"),
        sa.CheckConstraint(
            "status IN ('invited', 'active', 'suspended', 'removed')",
            name="membership_status_valid",
        ),
    )
    op.create_index(
        "ix_organization_memberships_user",
        "organization_memberships",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_organization_memberships_organization_status",
        "organization_memberships",
        ["organization_id", "status"],
        unique=False,
    )

    # The local adapter has one deterministic organization and two seeded
    # system roles.  Production provisioning can create its own mapping later.
    op.execute(
        sa.text(
            "INSERT INTO organizations (name, slug) VALUES ('Local Organization', 'local') "
            "ON CONFLICT (slug) DO NOTHING"
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO permissions (key, description)
            VALUES
              ('users.read', 'Read organization users'),
              ('users.write', 'Create and update organization users'),
              ('users.delete', 'Soft-delete and restore organization users'),
              ('roles.manage', 'Manage organization roles and assignments'),
              ('audit.read', 'Read organization audit entries'),
              ('settings.manage', 'Manage organization settings')
            ON CONFLICT (key) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO organization_roles (organization_id, name, description, system)
            SELECT id, role_name, role_description, true
            FROM organizations
            CROSS JOIN (VALUES
              ('Administrator', 'Full local organization administration'),
              ('Member', 'Standard organization membership')
            ) AS seed(role_name, role_description)
            WHERE slug = 'local'
            ON CONFLICT (organization_id, name) DO NOTHING
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
            WHERE r.organization_id = (SELECT id FROM organizations WHERE slug = 'local')
              AND r.name = 'Administrator'
            ON CONFLICT DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM organization_roles r
            JOIN permissions p ON p.key = 'users.read'
            WHERE r.organization_id = (SELECT id FROM organizations WHERE slug = 'local')
              AND r.name = 'Member'
            ON CONFLICT DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO organization_memberships (organization_id, user_id, role_id, status)
            SELECT o.id, u.id,
                   CASE WHEN u.role = 'admin' THEN admin_role.id ELSE member_role.id END,
                   CASE WHEN u.status = 'deleted' THEN 'removed' ELSE 'active' END
            FROM users u
            CROSS JOIN (SELECT id FROM organizations WHERE slug = 'local') o
            CROSS JOIN (
                SELECT id
                FROM organization_roles
                WHERE name = 'Administrator'
                  AND organization_id = (SELECT id FROM organizations WHERE slug = 'local')
            ) admin_role
            CROSS JOIN (
                SELECT id
                FROM organization_roles
                WHERE name = 'Member'
                  AND organization_id = (SELECT id FROM organizations WHERE slug = 'local')
            ) member_role
            ON CONFLICT (organization_id, user_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    """Remove the authorization foundation and restore the prior user shape."""

    op.drop_index(
        "ix_organization_memberships_organization_status",
        table_name="organization_memberships",
    )
    op.drop_index("ix_organization_memberships_user", table_name="organization_memberships")
    op.drop_table("organization_memberships")
    op.drop_index("ix_role_permissions_permission", table_name="role_permissions")
    op.drop_table("role_permissions")
    op.drop_index("ix_organization_roles_organization", table_name="organization_roles")
    op.drop_table("organization_roles")
    op.drop_table("permissions")
    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
    op.drop_constraint("status_valid", "users", type_="check")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "status")
