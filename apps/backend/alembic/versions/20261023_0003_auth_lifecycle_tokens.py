"""Add one-time account tokens and auditable session metadata."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261023_0003"
down_revision = "20261023_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Persist only hashed recovery/verification tokens and safe session facts."""

    op.add_column(
        "user_sessions",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("user_sessions", sa.Column("user_agent", sa.String(512), nullable=True))
    op.add_column("user_sessions", sa.Column("ip_address", sa.String(64), nullable=True))
    op.create_table(
        "one_time_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
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
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_one_time_tokens_user_id_users"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_one_time_tokens"),
        sa.CheckConstraint(
            "purpose IN ('password_reset', 'email_verification')",
            name="purpose_valid",
        ),
        sa.UniqueConstraint("token_hash", name="one_time_token_hash_unique"),
    )
    op.create_index(
        "ix_one_time_tokens_user_purpose",
        "one_time_tokens",
        ["user_id", "purpose"],
        unique=False,
    )
    op.create_index("ix_one_time_tokens_hash", "one_time_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    """Remove token storage and session metadata added by this revision."""

    op.drop_index("ix_one_time_tokens_hash", table_name="one_time_tokens")
    op.drop_index("ix_one_time_tokens_user_purpose", table_name="one_time_tokens")
    op.drop_table("one_time_tokens")
    op.drop_column("user_sessions", "ip_address")
    op.drop_column("user_sessions", "user_agent")
    op.drop_column("user_sessions", "last_seen_at")
