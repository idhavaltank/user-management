"""HTTP endpoints for pushing and pulling FlowSync operations."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.generated.schemas import (
    SyncChange,
    SyncOperationAcknowledgement,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusResponse,
)
from app.models.sync import SyncOperation
from app.services.organizations import OrganizationContext
from app.services.sync import SyncRejected, apply_operation

router = APIRouter(prefix="/api/v1/organizations", tags=["Sync"])


async def _latest_sequence(session: AsyncSession, organization_id: UUID) -> int:
    """Read the newest accepted sequence for one organization."""

    return int(
        await session.scalar(
            select(func.max(SyncOperation.sequence)).where(
                SyncOperation.organization_id == organization_id,
                SyncOperation.status == "accepted",
            )
        )
        or 0
    )


@router.post(
    "/{organizationId}/sync/push",
    response_model=SyncPushResponse,
    operation_id="pushSyncOperations",
)
async def push_operations(
    payload: SyncPushRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> SyncPushResponse:
    """Apply a bounded batch and acknowledge each operation independently."""

    acknowledgements: list[SyncOperationAcknowledgement] = []
    for item in payload.operations:
        try:
            async with session.begin_nested():
                operation = await apply_operation(
                    session,
                    organization_id=context.organization.id,
                    actor_id=context.auth.user.id,
                    operation_id=item.opId,
                    device_id=item.deviceId,
                    entity=item.entity.value,
                    entity_id=item.entityId,
                    kind=item.kind.value,
                    changes=item.changes,
                    hlc=item.hlc,
                    schema_version=item.schemaVersion,
                )
            acknowledgements.append(
                SyncOperationAcknowledgement(
                    opId=item.opId,
                    status="accepted",
                    sequence=operation.sequence,
                )
            )
        except (SyncRejected, ValueError) as error:
            acknowledgements.append(
                SyncOperationAcknowledgement(
                    opId=item.opId,
                    status="rejected",
                    error=str(error)[:500],
                )
            )
    await session.commit()
    return SyncPushResponse(
        acknowledgements=acknowledgements,
        nextCursor=await _latest_sequence(session, context.organization.id),
    )


@router.get(
    "/{organizationId}/sync/pull",
    response_model=SyncPullResponse,
    operation_id="pullSyncOperations",
)
async def pull_operations(
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> SyncPullResponse:
    """Return accepted changes strictly after the caller's sequence cursor."""

    rows = list(
        await session.scalars(
            select(SyncOperation)
            .where(
                SyncOperation.organization_id == context.organization.id,
                SyncOperation.status == "accepted",
                SyncOperation.sequence > cursor,
            )
            .order_by(SyncOperation.sequence.asc())
            .limit(limit + 1)
        )
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = rows[-1].sequence if rows else cursor
    return SyncPullResponse(
        changes=[
            SyncChange(
                sequence=row.sequence,
                opId=row.operation_id,
                deviceId=row.device_id,
                entity=row.entity,
                entityId=row.entity_id,
                kind=row.kind,
                changes=row.changes,
                hlc=row.hlc,
                schemaVersion=row.schema_version,
                occurredAt=row.created_at,
            )
            for row in rows
        ],
        nextCursor=next_cursor,
        hasMore=has_more,
    )


@router.get(
    "/{organizationId}/sync/status",
    response_model=SyncStatusResponse,
    operation_id="getSyncStatus",
)
async def sync_status(
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> SyncStatusResponse:
    """Expose the latest tenant cursor for diagnostics and health checks."""

    return SyncStatusResponse(
        latestSequence=await _latest_sequence(session, context.organization.id)
    )
