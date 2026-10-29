"""Sync protocol constants and safe payload helpers.

This module is intentionally independent from SQLAlchemy.  It is used by the
HTTP router and service layer to keep the accepted entity names and mutable
field allowlists in one place.
"""

from __future__ import annotations

from typing import Any

SYNC_ENTITIES = frozenset({"accounts", "contacts", "deals", "activities"})
SYNC_KINDS = frozenset({"upsert", "delete"})
MAX_SYNC_BATCH = 500
MAX_PULL_PAGE = 500

MUTABLE_FIELDS: dict[str, frozenset[str]] = {
    "accounts": frozenset(
        {"name", "industry", "website", "phone", "address", "ownerId", "status", "notes"}
    ),
    "contacts": frozenset(
        {
            "accountId",
            "firstName",
            "lastName",
            "email",
            "phone",
            "jobTitle",
            "ownerId",
            "status",
            "notes",
        }
    ),
    "deals": frozenset(
        {
            "accountId",
            "contactId",
            "ownerId",
            "name",
            "stage",
            "amount",
            "currency",
            "expectedCloseDate",
            "notes",
        }
    ),
    "activities": frozenset(
        {
            "accountId",
            "contactId",
            "dealId",
            "ownerId",
            "kind",
            "status",
            "subject",
            "description",
            "dueAt",
            "completedAt",
        }
    ),
}


def validate_changes(entity: str, changes: dict[str, Any] | None, kind: str) -> dict[str, Any]:
    """Reject unknown or malformed mutation fields before touching the ORM."""

    if entity not in SYNC_ENTITIES:
        raise ValueError("unsupported sync entity")
    if kind not in SYNC_KINDS:
        raise ValueError("unsupported sync operation kind")
    if kind == "delete":
        if changes not in (None, {}):
            raise ValueError("delete operations cannot contain changes")
        return {}
    if not isinstance(changes, dict) or not changes:
        raise ValueError("upsert operations require a non-empty changes object")
    unknown = set(changes) - MUTABLE_FIELDS[entity]
    if unknown:
        raise ValueError(f"unsupported fields: {', '.join(sorted(unknown))}")
    return changes
