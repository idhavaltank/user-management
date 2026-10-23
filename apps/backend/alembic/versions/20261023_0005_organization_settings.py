"""Add persisted organization settings used by management screens."""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261023_0005"
down_revision = "20261023_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add safe defaults without requiring a role foreign key cycle."""

    op.add_column("organizations", sa.Column("default_role_id", sa.Uuid(), nullable=True))
    op.add_column(
        "organizations",
        sa.Column(
            "require_email_verification",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "organizations",
        sa.Column("allow_self_join", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute(
        sa.text(
            """
            UPDATE organizations o
            SET default_role_id = r.id
            FROM organization_roles r
            WHERE r.organization_id = o.id AND r.name = 'Member'
            """
        )
    )


def downgrade() -> None:
    """Remove organization settings while retaining role data."""

    op.drop_column("organizations", "allow_self_join")
    op.drop_column("organizations", "require_email_verification")
    op.drop_column("organizations", "default_role_id")
