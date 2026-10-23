"""Organization-scoped user lifecycle HTTP adapter."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.delivery import DeliveryAdapter
from app.generated.schemas import (
    AuditLog as AuditLogSchema,
)
from app.generated.schemas import (
    AuditLogListResponse,
    RestoreUserRequest,
    UserCreateRequest,
    UserListResponse,
    UserStatus,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)
from app.generated.schemas import (
    User as UserSchema,
)
from app.models.organization_features import AuditLog
from app.models.token import OneTimeTokenPurpose
from app.services.auth import issue_one_time_token
from app.services.organization_users import (
    create_organization_user,
    delete_organization_user,
    get_organization_user,
    list_organization_users,
    restore_organization_user,
    update_organization_user,
    update_organization_user_status,
)
from app.services.organizations import OrganizationContext
from app.services.users import to_user_schema

router = APIRouter(prefix="/api/v1/organizations", tags=["Users"])


@router.get(
    "/{organizationId}/users",
    response_model=UserListResponse,
    operation_id="listOrganizationUsers",
)
async def list_users(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    sort: Literal["name", "email", "birthDate", "createdAt", "updatedAt"] = "createdAt",
    order: Literal["asc", "desc"] = "desc",
    status_filter: UserStatus | None = Query(default=None, alias="status"),
    role_filter: Literal["admin", "user"] | None = Query(default=None, alias="role"),
    session: AsyncSession = Depends(get_request_session),
) -> UserListResponse:
    """Return only users visible through the caller's organization membership."""

    users, total = await list_organization_users(
        session,
        context.organization.id,
        page,
        page_size,
        search,
        sort,
        order,
        getattr(status_filter, "value", status_filter),
        role_filter,
    )
    return UserListResponse(
        items=[to_user_schema(user) for user in users],
        page=page,
        pageSize=page_size,
        total=total,
    )


@router.post(
    "/{organizationId}/users",
    response_model=UserSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createOrganizationUser",
)
async def create_user(
    payload: UserCreateRequest,
    request: Request,
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> UserSchema:
    """Create a pending member using the organization default role."""

    user = await create_organization_user(session, context.organization.id, payload)
    raw_token = await issue_one_time_token(
        session,
        user,
        OneTimeTokenPurpose.EMAIL_VERIFICATION,
        request.app.state.settings.email_verification_ttl_seconds,
    )
    delivery: DeliveryAdapter = request.app.state.delivery
    await delivery.send_token(
        kind="email_verification",
        recipient=user.email,
        token=raw_token,
        metadata={"userId": str(user.id), "organizationId": str(context.organization.id)},
    )
    return to_user_schema(user)


@router.get(
    "/{organizationId}/users/{userId}",
    response_model=UserSchema,
    operation_id="getOrganizationUser",
)
async def get_user(
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> UserSchema:
    """Return one user after enforcing organization visibility."""

    user = await get_organization_user(session, context.organization.id, user_id)
    return to_user_schema(user)


@router.patch(
    "/{organizationId}/users/{userId}",
    response_model=UserSchema,
    operation_id="updateOrganizationUser",
)
async def update_user(
    payload: UserUpdateRequest,
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> UserSchema:
    """Update profile fields without allowing role escalation through CRUD."""

    user = await update_organization_user(
        session, context.organization.id, user_id, payload
    )
    return to_user_schema(user)


@router.delete(
    "/{organizationId}/users/{userId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteOrganizationUser",
)
async def delete_user(
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Soft-delete one organization user while preserving history."""

    await delete_organization_user(session, context.organization.id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{organizationId}/users/{userId}/restore",
    response_model=UserSchema,
    operation_id="restoreOrganizationUser",
)
async def restore_user(
    payload: RestoreUserRequest,
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> UserSchema:
    """Restore one soft-deleted organization user."""

    user = await restore_organization_user(
        session, context.organization.id, user_id, payload
    )
    return to_user_schema(user)


@router.patch(
    "/{organizationId}/users/{userId}/status",
    response_model=UserSchema,
    operation_id="updateOrganizationUserStatus",
)
async def update_status(
    payload: UserStatusUpdateRequest,
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> UserSchema:
    """Update lifecycle state through one explicit state-transition endpoint."""

    user = await update_organization_user_status(
        session, context.organization.id, user_id, payload
    )
    return to_user_schema(user)


@router.get(
    "/{organizationId}/users/{userId}/activity",
    response_model=AuditLogListResponse,
    operation_id="getOrganizationUserActivity",
)
async def user_activity(
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("audit.read")
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    session: AsyncSession = Depends(get_request_session),
) -> AuditLogListResponse:
    """Return audit events whose target is one organization user."""

    query = select(AuditLog).where(
        AuditLog.organization_id == context.organization.id,
        AuditLog.target_type == "user",
        AuditLog.target_id == user_id,
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(AuditLog.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return AuditLogListResponse(
        items=[
            AuditLogSchema(
                id=row.id,
                eventType=row.event_type,
                actorId=row.actor_id,
                actorType=row.actor_type,
                targetType=row.target_type,
                targetId=row.target_id,
                metadata=row.metadata_json,
                occurredAt=row.occurred_at,
            )
            for row in rows
        ],
        page=page,
        pageSize=page_size,
        total=int(total or 0),
    )
