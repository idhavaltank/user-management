"""Bounded local bulk, CSV preview, and durable job-status endpoints."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Path, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.http import api_error
from app.generated.schemas import (
    BulkUserIdsRequest,
    BulkUserRoleRequest,
    BulkUserStatusRequest,
    ImportCommitRequest,
    ImportPreviewResponse,
    ImportRowResult,
    JobListResponse,
    JobResponse,
    JobStatus,
    UserCreateRequest,
    UserStatus,
)
from app.generated.schemas import (
    Job as JobSchema,
)
from app.models.organization import MembershipStatus, OrganizationMembership, OrganizationRole
from app.models.organization_features import OrganizationJob, UserImportPreview
from app.models.user import User
from app.services.organization_users import create_organization_user
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1/organizations", tags=["Jobs"])
MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_IMPORT_ROWS = 500


def _job_schema(job: OrganizationJob) -> JobSchema:
    """Map the durable job row to the generated response contract."""

    return JobSchema(
        id=job.id,
        kind=job.kind,
        status=job.status,
        progress=job.progress,
        resultUrl=job.result_url,
        errorCode=job.error_code,
        createdAt=job.created_at,
        updatedAt=job.updated_at,
    )


async def _job(
    session: AsyncSession,
    context: OrganizationContext,
    kind: str,
    idempotency_key: str | None = None,
) -> OrganizationJob:
    """Create or reuse one bounded local job record."""

    if idempotency_key:
        existing = await session.scalar(
            select(OrganizationJob).where(
                OrganizationJob.organization_id == context.organization.id,
                OrganizationJob.kind == kind,
                OrganizationJob.idempotency_key == idempotency_key,
            )
        )
        if existing is not None:
            return existing
    job = OrganizationJob(
        organization_id=context.organization.id,
        created_by=context.auth.user.id,
        kind=kind,
        status="running",
        progress=0,
        idempotency_key=idempotency_key,
    )
    session.add(job)
    await session.flush()
    return job


async def _member_ids(
    session: AsyncSession, organization_id: UUID, user_ids: list[UUID]
) -> list[UUID]:
    """Validate that every bulk target belongs to this organization."""

    rows = await session.scalars(
        select(OrganizationMembership.user_id).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id.in_(user_ids),
        )
    )
    found = list(rows)
    if set(found) != set(user_ids):
        raise api_error(404, "not_found", "One or more users are not organization members.")
    return found


@router.post(
    "/{organizationId}/users/bulk/status",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="bulkUpdateUserStatus",
)
async def bulk_status(
    payload: BulkUserStatusRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Apply one validated lifecycle state to at most 500 members."""

    job = await _job(session, context, "bulk_status", payload.idempotencyKey)
    if job.status == JobStatus.succeeded.value:
        return JobResponse(job=_job_schema(job))
    ids = await _member_ids(session, context.organization.id, payload.userIds)
    requested = payload.status.value
    deleted = requested == UserStatus.deleted.value
    now = datetime.now(UTC)
    await session.execute(
        update(User)
        .where(User.id.in_(ids))
        .values(
            status=requested,
            is_active=not deleted,
            deleted_at=now if deleted else None,
            updated_at=now,
        )
    )
    await session.execute(
        update(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id.in_(ids),
        )
        .values(status=MembershipStatus.REMOVED.value if deleted else MembershipStatus.ACTIVE.value)
    )
    job.progress = 100
    job.status = JobStatus.succeeded.value
    await session.commit()
    return JobResponse(job=_job_schema(job))


@router.post(
    "/{organizationId}/users/bulk/delete",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="bulkDeleteUsers",
)
async def bulk_delete(
    payload: BulkUserIdsRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("users.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Soft-delete a bounded set of members."""

    adapted = BulkUserStatusRequest(
        userIds=payload.userIds,
        idempotencyKey=payload.idempotencyKey,
        status=UserStatus.deleted,
    )
    return await bulk_status(adapted, context, session)


@router.post(
    "/{organizationId}/users/bulk/restore",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="bulkRestoreUsers",
)
async def bulk_restore(
    payload: BulkUserIdsRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("users.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Restore a bounded set of members to active visibility."""

    adapted = BulkUserStatusRequest(
        userIds=payload.userIds,
        idempotencyKey=payload.idempotencyKey,
        status=UserStatus.active,
    )
    return await bulk_status(adapted, context, session)


@router.post(
    "/{organizationId}/users/bulk/roles",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="bulkAssignUserRole",
)
async def bulk_roles(
    payload: BulkUserRoleRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Assign one organization role to a bounded set of members."""

    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == payload.roleId,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if role is None:
        raise api_error(404, "not_found", "Role not found.")
    ids = await _member_ids(session, context.organization.id, payload.userIds)
    job = await _job(session, context, "bulk_roles", payload.idempotencyKey)
    if job.status == JobStatus.succeeded.value:
        return JobResponse(job=_job_schema(job))
    await session.execute(
        update(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id.in_(ids),
        )
        .values(role_id=role.id, status=MembershipStatus.ACTIVE.value)
    )
    job.progress = 100
    job.status = JobStatus.succeeded.value
    await session.commit()
    return JobResponse(job=_job_schema(job))


@router.post(
    "/{organizationId}/users/import/preview",
    response_model=ImportPreviewResponse,
    operation_id="previewUserImport",
)
async def preview_import(
    file: bytes = File(...),
    mode: Literal["createOnly", "upsert"] = Form(default="createOnly"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> ImportPreviewResponse:
    """Validate a bounded UTF-8 CSV without mutating users."""

    if len(file) > MAX_IMPORT_BYTES:
        raise api_error(413, "payload_too_large", "CSV file is too large.")
    try:
        reader = csv.DictReader(io.StringIO(file.decode("utf-8-sig")))
        rows = list(reader)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise api_error(422, "validation_error", "CSV file is invalid.") from exc
    if len(rows) > MAX_IMPORT_ROWS:
        raise api_error(413, "payload_too_large", "CSV contains too many rows.")
    required = {"name", "email", "gender", "birthDate", "college", "address"}
    accepted: list[dict] = []
    results: list[ImportRowResult] = []
    for row_number, row in enumerate(rows, start=2):
        missing = sorted(field for field in required if not row.get(field, "").strip())
        if missing:
            results.append(
                ImportRowResult(
                    rowNumber=row_number,
                    accepted=False,
                    code="required_field",
                    message=f"Missing fields: {', '.join(missing)}.",
                )
            )
            continue
        candidate = {
            "name": row["name"].strip(),
            "email": row["email"].strip().lower(),
            "gender": row["gender"].strip(),
            "birthDate": row["birthDate"].strip(),
            "college": row["college"].strip(),
            "address": row["address"].strip(),
            "hobbies": [
                value.strip()
                for value in row.get("hobbies", "").split(",")
                if value.strip()
            ],
            "customHobbies": [],
            "role": "user",
        }
        try:
            UserCreateRequest(**candidate)
        except Exception:
            results.append(
                ImportRowResult(
                    rowNumber=row_number,
                    accepted=False,
                    code="invalid_row",
                    message="One or more values do not match the user contract.",
                )
            )
            continue
        accepted.append(candidate)
        results.append(ImportRowResult(rowNumber=row_number, accepted=True))
    preview = UserImportPreview(
        organization_id=context.organization.id,
        created_by=context.auth.user.id,
        payload=accepted,
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )
    session.add(preview)
    await session.commit()
    await session.refresh(preview)
    return ImportPreviewResponse(
        previewId=preview.id,
        totalRows=len(rows),
        acceptedRows=len(accepted),
        rejectedRows=len(rows) - len(accepted),
        rows=results,
    )


@router.post(
    "/{organizationId}/users/import/commit",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="commitUserImport",
)
async def commit_import(
    payload: ImportCommitRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Commit a non-expired preview using the same service validation as CRUD."""

    preview = await session.scalar(
        select(UserImportPreview).where(
            UserImportPreview.id == payload.previewId,
            UserImportPreview.organization_id == context.organization.id,
            UserImportPreview.expires_at > datetime.now(UTC),
        )
    )
    if preview is None:
        raise api_error(409, "preview_expired", "Import preview is missing or expired.")
    job = await _job(session, context, "import_users", payload.idempotencyKey)
    if job.status == JobStatus.succeeded.value:
        return JobResponse(job=_job_schema(job))
    total = len(preview.payload)
    for index, row in enumerate(preview.payload, start=1):
        await create_organization_user(
            session, context.organization.id, UserCreateRequest(**row)
        )
        job.progress = int(index * 100 / max(total, 1))
    job.status = JobStatus.succeeded.value
    job.progress = 100
    await session.delete(preview)
    await session.commit()
    return JobResponse(job=_job_schema(job))


@router.get(
    "/{organizationId}/users/export",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="exportUsers",
)
async def export_users(
    search: str | None = Query(default=None, max_length=120),
    status_filter: UserStatus | None = Query(default=None, alias="status"),
    role: Literal["admin", "user"] | None = None,
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Queue a local export record; a worker adapter can attach a download URL."""

    job = await _job(session, context, "export_users")
    job.progress = 100
    job.status = JobStatus.succeeded.value
    await session.commit()
    return JobResponse(job=_job_schema(job))


@router.get(
    "/{organizationId}/jobs", response_model=JobListResponse, operation_id="listJobs"
)
async def list_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobListResponse:
    """List durable organization jobs for operational monitoring."""

    query = select(OrganizationJob).where(
        OrganizationJob.organization_id == context.organization.id
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(OrganizationJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return JobListResponse(
        items=[_job_schema(row) for row in rows],
        page=page,
        pageSize=page_size,
        total=int(total or 0),
    )


@router.get(
    "/{organizationId}/jobs/{jobId}", response_model=JobResponse, operation_id="getJob"
)
async def get_job(
    job_id: UUID = Path(alias="jobId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Read one organization job status."""

    job = await session.scalar(
        select(OrganizationJob).where(
            OrganizationJob.id == job_id,
            OrganizationJob.organization_id == context.organization.id,
        )
    )
    if job is None:
        raise api_error(404, "not_found", "Job not found.")
    return JobResponse(job=_job_schema(job))


@router.post(
    "/{organizationId}/jobs/{jobId}/cancel",
    response_model=JobResponse,
    operation_id="cancelJob",
)
async def cancel_job(
    job_id: UUID = Path(alias="jobId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> JobResponse:
    """Cancel a queued/running local job before a worker consumes it."""

    job = await session.scalar(
        select(OrganizationJob).where(
            OrganizationJob.id == job_id,
            OrganizationJob.organization_id == context.organization.id,
        )
    )
    if job is None:
        raise api_error(404, "not_found", "Job not found.")
    if job.status not in {JobStatus.queued.value, JobStatus.running.value}:
        raise api_error(409, "job_not_cancellable", "Job has already completed.")
    job.cancel_requested = True
    job.status = JobStatus.cancelled.value
    job.updated_at = datetime.now(UTC)
    await session.commit()
    return JobResponse(job=_job_schema(job))
