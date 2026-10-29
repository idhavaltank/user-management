"""Repair the server sequence default for sync operation cursors."""

from __future__ import annotations

from alembic import op

revision = "20261023_0011"
down_revision = "20261023_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Record the ORM identity mapping repair; the column is already an identity."""

    op.execute("SELECT 1")


def downgrade() -> None:
    """Keep the original identity column intact when rolling back the marker."""

    op.execute("SELECT 1")
