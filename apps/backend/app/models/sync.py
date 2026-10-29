"""Durable synchronization metadata for the FlowSync local-first protocol.

The operation log is append-only from the application's point of view.  It is
the server cursor that clients pull after reconnecting, while ``SyncRecordState``
stores the last accepted hybrid-clock value for each field.  Keeping these two
concerns separate makes replay idempotent and lets conflict handling evolve
without changing the CRM tables again.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncOperation(Base):
    """One accepted or rejected client mutation in an organization's log."""

    __tablename__ = "sync_operations"
    __table_args__ = (
        Index("ix_sync_operations_organization_sequence", "organization_id", "sequence"),
        Index("ix_sync_operations_organization_device", "organization_id", "device_id"),
        Index("ix_sync_operations_organization_entity", "organization_id", "entity", "entity_id"),
    )

    operation_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    sequence: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        nullable=False,
        unique=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    device_id: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    entity: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    changes: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    hlc: Mapped[str] = mapped_column(String(128), nullable=False)
    schema_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="accepted", server_default="accepted"
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )


class SyncRecordState(Base):
    """Per-record merge clocks used to make field updates deterministic."""

    __tablename__ = "sync_record_states"
    __table_args__ = (
        Index(
            "ix_sync_record_states_organization_entity",
            "organization_id",
            "entity",
            "entity_id",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    entity: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    field_clocks: Mapped[dict[str, str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict, server_default="{}"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
