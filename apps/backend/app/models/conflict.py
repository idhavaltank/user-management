"""Recoverable conflict records produced by the deterministic sync merge."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncConflict(Base):
    """A review-required field update that lost deterministic LWW ordering."""

    __tablename__ = "sync_conflicts"
    __table_args__ = (
        Index("ix_sync_conflicts_organization_status", "organization_id", "status"),
        Index("ix_sync_conflicts_record", "organization_id", "entity", "entity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    entity: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    field: Mapped[str] = mapped_column(String(64), nullable=False)
    local_value: Mapped[Any] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    remote_value: Mapped[Any] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    local_hlc: Mapped[str] = mapped_column(String(128), nullable=False)
    remote_hlc: Mapped[str] = mapped_column(String(128), nullable=False)
    remote_device_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="open", server_default="open"
    )
    resolution_operation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("sync_operations.operation_id", ondelete="SET NULL"), nullable=True
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
