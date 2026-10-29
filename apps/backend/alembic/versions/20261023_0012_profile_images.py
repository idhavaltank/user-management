"""Add profile-image metadata for CRM accounts and contacts."""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261023_0012"
down_revision = "20261023_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add metadata columns while keeping binary content outside PostgreSQL."""

    for table in ("crm_accounts", "crm_contacts"):
        op.add_column(table, sa.Column("profile_image_key", sa.String(512), nullable=True))
        op.add_column(
            table,
            sa.Column("profile_image_content_type", sa.String(64), nullable=True),
        )
        op.add_column(table, sa.Column("profile_image_size", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column("profile_image_sha256", sa.String(64), nullable=True))


def downgrade() -> None:
    """Remove profile-image metadata columns; local files need separate cleanup."""

    for table in ("crm_contacts", "crm_accounts"):
        op.drop_column(table, "profile_image_sha256")
        op.drop_column(table, "profile_image_size")
        op.drop_column(table, "profile_image_content_type")
        op.drop_column(table, "profile_image_key")
