"""Pure tests for the protocol validation and hybrid-clock ordering rules."""

import pytest

from app.sync.contracts import validate_changes
from app.sync.hlc import compare_hlc, normalize_hlc


def test_hlc_ordering_is_numeric_and_deterministic() -> None:
    """Logical counters and device ids break wall-clock ties predictably."""

    assert compare_hlc(("100.2", "device-a"), ("100.1", "device-z")) == 1
    assert compare_hlc(("100.1", "device-a"), ("100.1", "device-z")) == -1
    assert normalize_hlc("100.0002", "device-a") == "100.2"


def test_sync_changes_reject_unknown_fields_and_delete_payloads() -> None:
    """The allowlist prevents clients from modifying tenant metadata."""

    assert validate_changes("accounts", {"name": "Acme"}, "upsert") == {"name": "Acme"}
    assert validate_changes("accounts", None, "delete") == {}
    with pytest.raises(ValueError, match="unsupported fields"):
        validate_changes("accounts", {"organizationId": "other"}, "upsert")
    with pytest.raises(ValueError, match="cannot contain changes"):
        validate_changes("accounts", {"name": "Acme"}, "delete")

