"""Organization-scoped CRM profile-image upload and retrieval endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Path, Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.crm import _account_or_404, _account_schema, _contact_or_404, _contact_schema
from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.http import api_error
from app.generated.schemas import CrmAccount as CrmAccountSchema
from app.generated.schemas import CrmContact as CrmContactSchema
from app.models.crm import Account, Contact
from app.services.media import (
    LocalProfileImageStorage,
    ProfileImageEntity,
    ProfileImageValidationError,
    detect_profile_image_type,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1/organizations", tags=["CRM media"])


async def _upload(
    request: Request,
    file: UploadFile,
    row: Account | Contact,
    entity: ProfileImageEntity,
    session: AsyncSession,
) -> None:
    """Validate, atomically store, and persist one profile image."""

    max_bytes = request.app.state.settings.profile_image_max_bytes
    declared_type = file.content_type
    payload = await file.read(max_bytes + 1)
    await file.close()
    if len(payload) > max_bytes:
        raise api_error(413, "payload_too_large", "The profile image is too large.")
    try:
        content_type = detect_profile_image_type(payload, declared_type)
    except ProfileImageValidationError as error:
        raise api_error(422, "invalid_profile_image", str(error)) from error

    storage: LocalProfileImageStorage = request.app.state.profile_image_storage
    stored = await run_in_threadpool(
        storage.save,
        payload,
        row.organization_id,
        entity,
        row.id,
        content_type,
    )
    previous_key = row.profile_image_key
    row.profile_image_key = stored.key
    row.profile_image_content_type = stored.content_type
    row.profile_image_size = stored.size
    row.profile_image_sha256 = stored.sha256
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        await run_in_threadpool(storage.remove, stored.key)
        raise
    if previous_key and previous_key != stored.key:
        await run_in_threadpool(storage.remove, previous_key)


async def _image_response(
    request: Request,
    row: Account | Contact,
) -> Response:
    """Return a private cacheable image response for an organization record."""

    if not row.profile_image_key or not row.profile_image_content_type:
        raise api_error(404, "not_found", "This CRM record has no profile image.")
    storage: LocalProfileImageStorage = request.app.state.profile_image_storage
    payload = await run_in_threadpool(storage.read, row.profile_image_key)
    if payload is None:
        raise api_error(404, "not_found", "The profile image file is unavailable.")
    return Response(
        content=payload,
        media_type=row.profile_image_content_type,
        headers={
            "Cache-Control": "private, max-age=300",
            "ETag": f'"{row.profile_image_sha256 or ""}"',
        },
    )


async def _delete(row: Account | Contact, request: Request, session: AsyncSession) -> Response:
    """Clear metadata only after the database transaction is ready to commit."""

    previous_key = row.profile_image_key
    row.profile_image_key = None
    row.profile_image_content_type = None
    row.profile_image_size = None
    row.profile_image_sha256 = None
    await session.commit()
    if previous_key:
        storage: LocalProfileImageStorage = request.app.state.profile_image_storage
        await run_in_threadpool(storage.remove, previous_key)
    return Response(status_code=204)


@router.post(
    "/{organizationId}/accounts/{accountId}/profile-image",
    response_model=CrmAccountSchema,
    operation_id="uploadAccountProfileImage",
)
async def upload_account_profile_image(
    request: Request,
    file: UploadFile = File(...),
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmAccountSchema:
    """Upload or replace an account logo/profile image."""

    row = await _account_or_404(session, context.organization.id, account_id)
    await _upload(request, file, row, "accounts", session)
    return _account_schema(row)


@router.get(
    "/{organizationId}/accounts/{accountId}/profile-image",
    operation_id="getAccountProfileImage",
)
async def get_account_profile_image(
    request: Request,
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Serve an account logo/profile image after organization authorization."""

    row = await _account_or_404(session, context.organization.id, account_id)
    return await _image_response(request, row)


@router.delete(
    "/{organizationId}/accounts/{accountId}/profile-image",
    status_code=204,
    operation_id="deleteAccountProfileImage",
)
async def delete_account_profile_image(
    request: Request,
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Remove an account profile image and its metadata."""

    row = await _account_or_404(session, context.organization.id, account_id)
    return await _delete(row, request, session)


@router.post(
    "/{organizationId}/contacts/{contactId}/profile-image",
    response_model=CrmContactSchema,
    operation_id="uploadContactProfileImage",
)
async def upload_contact_profile_image(
    request: Request,
    file: UploadFile = File(...),
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmContactSchema:
    """Upload or replace a contact profile image."""

    row = await _contact_or_404(session, context.organization.id, contact_id)
    await _upload(request, file, row, "contacts", session)
    return _contact_schema(row)


@router.get(
    "/{organizationId}/contacts/{contactId}/profile-image",
    operation_id="getContactProfileImage",
)
async def get_contact_profile_image(
    request: Request,
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Serve a contact profile image after organization authorization."""

    row = await _contact_or_404(session, context.organization.id, contact_id)
    return await _image_response(request, row)


@router.delete(
    "/{organizationId}/contacts/{contactId}/profile-image",
    status_code=204,
    operation_id="deleteContactProfileImage",
)
async def delete_contact_profile_image(
    request: Request,
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Remove a contact profile image and its metadata."""

    row = await _contact_or_404(session, context.organization.id, contact_id)
    return await _delete(row, request, session)
