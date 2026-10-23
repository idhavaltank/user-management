"""Provider-neutral delivery ports and a safe local development sink.

The application must create one-time tokens in the database as hashes, then
hand the raw value to a delivery adapter exactly once.  The local adapter keeps
that value only in process memory so local tests and manual development can
complete a flow without exposing a token in an HTTP response, database row, or
log message.  A real deployment must replace this adapter with an approved
email provider implementation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from app.core.config import Settings


@dataclass(frozen=True)
class DeliveryMessage:
    """A local-only record representing one token handed to a provider."""

    kind: str
    recipient: str
    token: str
    metadata: dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class DeliveryAdapter(Protocol):
    """Minimal port used by password, verification, and invitation flows."""

    async def send_token(
        self,
        *,
        kind: str,
        recipient: str,
        token: str,
        metadata: dict[str, str] | None = None,
    ) -> None:
        """Deliver a raw one-time token without persisting it in the API layer."""


class LocalDeliveryAdapter:
    """In-memory local sink used by development and automated tests only."""

    def __init__(self) -> None:
        """Start with an empty message list for this application process."""

        self.messages: list[DeliveryMessage] = []

    async def send_token(
        self,
        *,
        kind: str,
        recipient: str,
        token: str,
        metadata: dict[str, str] | None = None,
    ) -> None:
        """Capture a provider handoff without logging or exposing the token."""

        self.messages.append(
            DeliveryMessage(
                kind=kind,
                recipient=recipient,
                token=token,
                metadata=metadata or {},
            )
        )


class UnconfiguredDeliveryAdapter:
    """Fail closed when a non-local process has no approved provider."""

    async def send_token(
        self,
        *,
        kind: str,
        recipient: str,
        token: str,
        metadata: dict[str, str] | None = None,
    ) -> None:
        """Reject delivery instead of silently discarding security credentials."""

        del kind, recipient, token, metadata
        raise RuntimeError("No approved delivery adapter is configured.")


def create_delivery_adapter(settings: Settings) -> DeliveryAdapter:
    """Select the only safe local adapter or fail closed outside local/test."""

    if settings.environment in {"local", "test"}:
        return LocalDeliveryAdapter()
    raise RuntimeError(
        "A provider-backed delivery adapter must be configured outside local/test environments."
    )
