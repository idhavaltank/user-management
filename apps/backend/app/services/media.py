"""Local profile-image storage and lightweight image validation.

The service intentionally keeps binary media behind a small adapter boundary.
The local implementation writes files atomically under a configured directory;
a production deployment can replace it with object storage without changing
CRM routes or database metadata.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from uuid import UUID

ProfileImageEntity = Literal["accounts", "contacts"]

SUPPORTED_PROFILE_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@dataclass(frozen=True)
class StoredProfileImage:
    """Metadata returned after a binary has been written successfully."""

    key: str
    content_type: str
    size: int
    sha256: str


class ProfileImageValidationError(ValueError):
    """Raised when an upload is not a supported profile image."""


def detect_profile_image_type(payload: bytes, declared_type: str | None) -> str:
    """Validate common image signatures instead of trusting a MIME header."""

    detected: str | None = None
    if payload.startswith(b"\xff\xd8\xff"):
        detected = "image/jpeg"
    elif payload.startswith(b"\x89PNG\r\n\x1a\n"):
        detected = "image/png"
    elif len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        detected = "image/webp"

    if detected is None:
        raise ProfileImageValidationError("The uploaded file is not a supported image.")
    if declared_type and declared_type not in SUPPORTED_PROFILE_IMAGE_TYPES:
        raise ProfileImageValidationError("Only JPEG, PNG, and WebP images are supported.")
    if declared_type and declared_type != detected:
        raise ProfileImageValidationError("The file content does not match its MIME type.")
    return detected


class LocalProfileImageStorage:
    """Filesystem adapter for local development and isolated test runs."""

    def __init__(self, root: str) -> None:
        self.root = Path(root).expanduser().resolve()

    def save(
        self,
        payload: bytes,
        organization_id: UUID,
        entity: ProfileImageEntity,
        entity_id: UUID,
        content_type: str,
    ) -> StoredProfileImage:
        """Atomically replace one entity image and return immutable metadata."""

        suffix = SUPPORTED_PROFILE_IMAGE_TYPES[content_type]
        key = f"{organization_id}/{entity}/{entity_id}{suffix}"
        destination = self._safe_path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=destination.parent,
            prefix=f".{destination.stem}.",
            suffix=".upload",
            delete=False,
        ) as temporary:
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, destination)
        return StoredProfileImage(
            key=key,
            content_type=content_type,
            size=len(payload),
            sha256=hashlib.sha256(payload).hexdigest(),
        )

    def read(self, key: str) -> bytes | None:
        """Read a previously generated key, returning None when absent."""

        path = self._safe_path(key)
        try:
            return path.read_bytes()
        except FileNotFoundError:
            return None

    def remove(self, key: str | None) -> None:
        """Delete one generated key without failing for an already missing file."""

        if not key:
            return
        try:
            self._safe_path(key).unlink()
        except FileNotFoundError:
            return

    def _safe_path(self, key: str) -> Path:
        """Resolve only paths that remain inside the configured media root."""

        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Profile image path escaped the configured media root.")
        return path
