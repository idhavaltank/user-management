"""Hashed one-time credentials used for account recovery and verification."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OneTimeTokenPurpose(enum.StrEnum):
    """Supported single-use account token workflows."""

    PASSWORD_RESET = "password_reset"
    EMAIL_VERIFICATION = "email_verification"


class OneTimeToken(TimestampMixin, Base):
    """Persist only a digest of a short-lived single-use token."""

    __tablename__ = "one_time_tokens"
    __table_args__ = (
        Index("ix_one_time_tokens_user_purpose", "user_id", "purpose"),
        Index("ix_one_time_tokens_hash", "token_hash", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[OneTimeTokenPurpose] = mapped_column(String(32), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
