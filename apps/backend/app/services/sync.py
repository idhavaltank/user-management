"""Application service for idempotent, tenant-scoped sync operations."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conflict import SyncConflict
from app.models.crm import Account, Activity, Contact, Deal
from app.models.organization import MembershipStatus, OrganizationMembership
from app.models.sync import SyncOperation, SyncRecordState
from app.sync.contracts import validate_changes
from app.sync.hlc import normalize_hlc, parse_hlc


class SyncRejected(ValueError):
    """A client operation that cannot be safely applied to the tenant."""


ENTITY_MODELS: dict[str, type[Account] | type[Contact] | type[Deal] | type[Activity]] = {
    "accounts": Account,
    "contacts": Contact,
    "deals": Deal,
    "activities": Activity,
}

FIELD_COLUMNS: dict[str, dict[str, str]] = {
    "accounts": {
        "name": "name",
        "industry": "industry",
        "website": "website",
        "phone": "phone",
        "address": "address",
        "ownerId": "owner_id",
        "status": "status",
        "notes": "notes",
    },
    "contacts": {
        "accountId": "account_id",
        "firstName": "first_name",
        "lastName": "last_name",
        "email": "email",
        "phone": "phone",
        "jobTitle": "job_title",
        "ownerId": "owner_id",
        "status": "status",
        "notes": "notes",
    },
    "deals": {
        "accountId": "account_id",
        "contactId": "contact_id",
        "ownerId": "owner_id",
        "name": "name",
        "stage": "stage",
        "amount": "amount",
        "currency": "currency",
        "expectedCloseDate": "expected_close_date",
        "notes": "notes",
    },
    "activities": {
        "accountId": "account_id",
        "contactId": "contact_id",
        "dealId": "deal_id",
        "ownerId": "owner_id",
        "kind": "kind",
        "status": "status",
        "subject": "subject",
        "description": "description",
        "dueAt": "due_at",
        "completedAt": "completed_at",
    },
}

UUID_FIELDS = frozenset({"ownerId", "accountId", "contactId", "dealId"})
DATE_FIELDS = frozenset({"expectedCloseDate"})
DATETIME_FIELDS = frozenset({"dueAt", "completedAt"})
REVIEW_REQUIRED_FIELDS = frozenset({"stage", "amount", "ownerId"})


def _clock_key(hlc: str, device_id: str) -> str:
    """Store the clock and tie-breaker together in one JSON-safe string."""

    return f"{normalize_hlc(hlc, device_id)}|{device_id}"


def _is_newer(incoming: tuple[str, str], current: str | None) -> bool:
    """Return whether an incoming HLC wins over the persisted field clock."""

    if not current:
        return True
    current_hlc, _, current_device = current.partition("|")
    return parse_hlc(*incoming) > parse_hlc(current_hlc, current_device)


def _coerce(field: str, value: Any) -> Any:
    """Convert JSON values to the SQLAlchemy column types used by CRM rows."""

    if value is None:
        return None
    if field in UUID_FIELDS:
        return UUID(str(value))
    if field in DATE_FIELDS:
        return date.fromisoformat(str(value))
    if field in DATETIME_FIELDS:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if field == "amount":
        return Decimal(str(value))
    if field == "currency":
        return str(value).upper()
    if isinstance(value, str):
        return value.strip() or None
    return value


def _json_value(value: Any) -> Any:
    """Convert ORM scalar values into JSON-safe values for conflict review."""

    if isinstance(value, (UUID, date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


async def _validate_references(
    session: AsyncSession,
    organization_id: UUID,
    actor_id: UUID,
    entity: str,
    changes: dict[str, Any],
) -> None:
    """Prevent an offline operation from linking to another tenant's record."""

    owner_id = UUID(str(changes["ownerId"])) if changes.get("ownerId") else None
    if owner_id is not None:
        member = await session.scalar(
            select(OrganizationMembership.id).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == owner_id,
                OrganizationMembership.status == MembershipStatus.ACTIVE.value,
            )
        )
        if member is None:
            raise SyncRejected("owner is not an active organization member")
    references: list[tuple[str, type[Any]]] = []
    if entity in {"contacts", "deals", "activities"} and changes.get("accountId"):
        references.append((str(changes["accountId"]), Account))
    if entity in {"deals", "activities"} and changes.get("contactId"):
        references.append((str(changes["contactId"]), Contact))
    if entity == "activities" and changes.get("dealId"):
        references.append((str(changes["dealId"]), Deal))
    for raw_id, model in references:
        record = await session.scalar(
            select(model.id).where(
                model.id == UUID(raw_id),
                model.organization_id == organization_id,
                model.deleted_at.is_(None),
            )
        )
        if record is None:
            raise SyncRejected("linked record does not belong to this organization")


def _required_fields(entity: str, changes: dict[str, Any]) -> None:
    """Require enough data for an offline-created record to be materialized."""

    required = {
        "accounts": ("name",),
        "contacts": ("firstName", "lastName"),
        "deals": ("name",),
        "activities": ("kind", "subject"),
    }[entity]
    missing = [field for field in required if not changes.get(field)]
    if missing:
        raise SyncRejected(f"missing required fields: {', '.join(missing)}")


async def apply_operation(
    session: AsyncSession,
    *,
    organization_id: UUID,
    actor_id: UUID,
    operation_id: UUID,
    device_id: str,
    entity: str,
    entity_id: UUID,
    kind: str,
    changes: dict[str, Any] | None,
    hlc: str,
    schema_version: int,
) -> SyncOperation:
    """Validate, merge, and append one operation in the caller's transaction."""

    if schema_version != 1:
        raise SyncRejected("unsupported sync schema version")
    if not device_id.strip() or len(device_id) > 128:
        raise SyncRejected("device id is invalid")
    normalized_hlc = normalize_hlc(hlc, device_id)
    clean_changes = validate_changes(entity, changes, kind)
    existing = await session.get(SyncOperation, operation_id)
    if existing is not None:
        if existing.organization_id != organization_id:
            raise SyncRejected("operation id is already owned by another organization")
        return existing

    model = ENTITY_MODELS[entity]
    state = await session.scalar(
        select(SyncRecordState).where(
            SyncRecordState.organization_id == organization_id,
            SyncRecordState.entity == entity,
            SyncRecordState.entity_id == entity_id,
        )
    )
    if state is None:
        state = SyncRecordState(
            organization_id=organization_id,
            entity=entity,
            entity_id=entity_id,
            field_clocks={},
        )
        session.add(state)

    row = await session.scalar(
        select(model).where(model.organization_id == organization_id, model.id == entity_id)
    )
    if kind == "delete":
        if _is_newer((normalized_hlc, device_id), state.field_clocks.get("__delete__")):
            if row is not None:
                row.deleted_at = datetime.now(UTC)
            state.deleted_at = datetime.now(UTC)
            state.field_clocks = {
                **state.field_clocks,
                "__delete__": _clock_key(normalized_hlc, device_id),
            }
    else:
        _required_fields(entity, clean_changes) if row is None else None
        await _validate_references(session, organization_id, actor_id, entity, clean_changes)
        if row is None:
            row = model(organization_id=organization_id, id=entity_id, owner_id=actor_id)
            session.add(row)
        for field, value in clean_changes.items():
            if not _is_newer((normalized_hlc, device_id), state.field_clocks.get(field)):
                if field in REVIEW_REQUIRED_FIELDS and row is not None:
                    column = FIELD_COLUMNS[entity][field]
                    current_clock = state.field_clocks.get(field)
                    if current_clock and _json_value(getattr(row, column)) != _json_value(value):
                        session.add(
                            SyncConflict(
                                organization_id=organization_id,
                                entity=entity,
                                entity_id=entity_id,
                                field=field,
                                local_value=_json_value(getattr(row, column)),
                                remote_value=_json_value(value),
                                local_hlc=current_clock,
                                remote_hlc=_clock_key(normalized_hlc, device_id),
                                remote_device_id=device_id,
                                status="open",
                            )
                        )
                continue
            column = FIELD_COLUMNS[entity][field]
            setattr(row, column, _coerce(field, value))
            state.field_clocks = {
                **state.field_clocks,
                field: _clock_key(normalized_hlc, device_id),
            }
        if state.deleted_at is not None and _is_newer(
            (normalized_hlc, device_id), state.field_clocks.get("__delete__")
        ):
            state.deleted_at = None
            if row is not None:
                row.deleted_at = None

    operation = SyncOperation(
        operation_id=operation_id,
        organization_id=organization_id,
        device_id=device_id.strip(),
        actor_id=actor_id,
        entity=entity,
        entity_id=entity_id,
        kind=kind,
        changes=clean_changes or None,
        hlc=normalized_hlc,
        schema_version=schema_version,
        status="accepted",
    )
    session.add(operation)
    await session.flush()
    return operation
