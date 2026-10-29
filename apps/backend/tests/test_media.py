"""Unit tests for profile-image validation and local storage behavior."""

from uuid import uuid4

import pytest

from app.services.media import (
    LocalProfileImageStorage,
    ProfileImageValidationError,
    detect_profile_image_type,
)


def test_profile_image_validation_checks_signature_and_declared_type() -> None:
    """A supported image signature is accepted only with a matching MIME type."""

    png = b"\x89PNG\r\n\x1a\nfixture"

    assert detect_profile_image_type(png, "image/png") == "image/png"
    with pytest.raises(ProfileImageValidationError, match="does not match"):
        detect_profile_image_type(png, "image/jpeg")
    with pytest.raises(ProfileImageValidationError, match="supported image"):
        detect_profile_image_type(b"not-an-image", "image/png")


def test_local_profile_image_storage_replaces_reads_and_removes(tmp_path) -> None:
    """The local adapter writes deterministic keys and cleans up replacements."""

    storage = LocalProfileImageStorage(str(tmp_path))
    organization_id = uuid4()
    entity_id = uuid4()
    first = storage.save(
        b"\x89PNG\r\n\x1a\nfirst",
        organization_id,
        "accounts",
        entity_id,
        "image/png",
    )
    second = storage.save(
        b"\xff\xd8\xffsecond",
        organization_id,
        "accounts",
        entity_id,
        "image/jpeg",
    )

    assert storage.read(first.key) == b"\x89PNG\r\n\x1a\nfirst"
    assert storage.read(second.key) == b"\xff\xd8\xffsecond"
    storage.remove(first.key)
    storage.remove(second.key)
    assert storage.read(first.key) is None
    assert storage.read(second.key) is None
