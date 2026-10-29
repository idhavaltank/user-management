"""Conflict review and record-history endpoints for FlowSync."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.http import api_error
from app.generated.schemas import (
    SyncConflict as SyncConflictSchema,
)
from app.generated.schemas import (
    SyncConflictListResponse,
    SyncConflictResolutionRequest,
    SyncHistoryItem,
    SyncHistoryResponse,
)
from app.models.conflict import SyncConflict
from app.models.sync import SyncOperation
from app.services.organizations import OrganizationContext
from app.services.sync import SyncRejected, apply_operation

router = APIRouter(prefix="/api/v1/organizations", tags=["Sync"])


def _conflict_schema(row: SyncConflict) -> SyncConflictSchema:
    """Map a database conflict into the stable review API."""

    return SyncConflictSchema(
        id=row.id,
        organizationId=row.organization_id,
        entity=row.entity,
        entityId=row.entity_id,
        field=row.field,
        localValue=row.local_value,
        remoteValue=row.remote_value,
        localHlc=row.local_hlc,
        remoteHlc=row.remote_hlc,
        remoteDeviceId=row.remote_device_id,
        status=row.status,
        resolutionOperationId=row.resolution_operation_id,
        resolutionNote=row.resolution_note,
        createdAt=row.created_at,
        resolvedAt=row.resolved_at,
    )


@router.get(
    "/{organizationId}/sync/conflicts",
    response_model=SyncConflictListResponse,
    operation_id="listSyncConflicts",
)
async def list_conflicts(
    status_filter: str = Query(default="open", alias="status", pattern="^(open|resolved)$"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> SyncConflictListResponse:
    """List only conflicts belonging to the authenticated organization."""

    rows = await session.scalars(
        select(SyncConflict)
        .where(
            SyncConflict.organization_id == context.organization.id,
            SyncConflict.status == status_filter,
        )
        .order_by(SyncConflict.created_at.desc())
    )
    return SyncConflictListResponse(items=[_conflict_schema(row) for row in rows])


@router.post(
    "/{organizationId}/sync/conflicts/{conflictId}/resolve",
    response_model=SyncConflictSchema,
    operation_id="resolveSyncConflict",
)
async def resolve_conflict(
    payload: SyncConflictResolutionRequest,
    conflict_id: UUID = Path(alias="conflictId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> SyncConflictSchema:
    """Resolve a conflict by appending a normal sync operation."""

    conflict = await session.scalar(
        select(SyncConflict).where(
            SyncConflict.id == conflict_id,
            SyncConflict.organization_id == context.organization.id,
        )
    )
    if conflict is None:
        raise api_error(404, "not_found", "Sync conflict not found.")
    if conflict.status != "open":
        raise api_error(409, "conflict_already_resolved", "The sync conflict is already resolved.")

    choice = payload.choice.value
    if choice == "mine":
        value: Any = conflict.local_value
    elif choice == "theirs":
        value = conflict.remote_value
    else:
        value = payload.value
    try:
        async with session.begin_nested():
            operation = await apply_operation(
                session,
                organization_id=context.organization.id,
                actor_id=context.auth.user.id,
                operation_id=uuid4(),
                device_id=payload.deviceId,
                entity=conflict.entity,
                entity_id=conflict.entity_id,
                kind="upsert",
                changes={conflict.field: value},
                hlc=payload.hlc,
                schema_version=1,
            )
            conflict.status = "resolved"
            conflict.resolution_operation_id = operation.operation_id
            conflict.resolution_note = payload.note
            conflict.resolved_at = datetime.now(UTC)
        await session.commit()
    except (SyncRejected, ValueError) as error:
        raise api_error(422, "invalid_resolution", str(error)) from error
    await session.refresh(conflict)
    return _conflict_schema(conflict)


@router.get(
    "/{organizationId}/sync/history/{entity}/{entityId}",
    response_model=SyncHistoryResponse,
    operation_id="listSyncHistory",
)
async def list_history(
    entity: str = Path(pattern="^(accounts|contacts|deals|activities)$"),
    entity_id: UUID = Path(alias="entityId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> SyncHistoryResponse:
    """Return the append-only operation history for one CRM record."""

    rows = await session.scalars(
        select(SyncOperation)
        .where(
            SyncOperation.organization_id == context.organization.id,
            SyncOperation.entity == entity,
            SyncOperation.entity_id == entity_id,
        )
        .order_by(SyncOperation.sequence.desc())
    )
    return SyncHistoryResponse(
        items=[
            SyncHistoryItem(
                sequence=row.sequence,
                opId=row.operation_id,
                deviceId=row.device_id,
                entity=row.entity,
                entityId=row.entity_id,
                kind=row.kind,
                changes=row.changes or {},
                hlc=row.hlc,
                schemaVersion=row.schema_version,
                occurredAt=row.created_at,
                status=row.status,
            )
            for row in rows
        ]
    )
