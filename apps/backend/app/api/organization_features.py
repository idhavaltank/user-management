"""Invitations, notifications, role assignments, and API-key adapters."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.organizations import _organization_schema, _role_schema
from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.delivery import DeliveryAdapter
from app.core.http import api_error
from app.core.security import generate_token, hash_token
from app.generated.schemas import (
    AcceptedResponse,
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyListResponse,
    InvitationAcceptanceResponse,
    InvitationAcceptRequest,
    InvitationCreateRequest,
    InvitationListResponse,
    NotificationListResponse,
    NotificationPreferences,
    NotificationPreferencesUpdateRequest,
    RoleAssignment,
    RoleAssignmentRequest,
    RoleListResponse,
)
from app.generated.schemas import (
    ApiKey as ApiKeySchema,
)
from app.generated.schemas import (
    Invitation as InvitationSchema,
)
from app.generated.schemas import (
    Member as MemberSchema,
)
from app.generated.schemas import (
    Notification as NotificationSchema,
)
from app.models.organization import (
    MembershipStatus,
    OrganizationMembership,
    OrganizationRole,
    Permission,
)
from app.models.organization_features import (
    InAppNotification,
    NotificationPreference,
    OrganizationApiKey,
    OrganizationInvitation,
)
from app.models.user import User
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1", tags=["Organizations"])


def _invitation_schema(invitation: OrganizationInvitation) -> InvitationSchema:
    """Map an invitation without exposing its token digest."""

    return InvitationSchema(
        id=invitation.id,
        organizationId=invitation.organization_id,
        email=invitation.email,
        roleId=invitation.role_id,
        status=invitation.status,
        expiresAt=invitation.expires_at,
        createdAt=invitation.created_at,
    )


def _api_key_schema(key: OrganizationApiKey) -> ApiKeySchema:
    """Map safe API-key metadata; the secret is never persisted or returned here."""

    from app.generated.schemas import Scope

    return ApiKeySchema(
        id=key.id,
        prefix=key.prefix,
        name=key.name,
        scopes=[Scope(root=scope) for scope in key.scopes],
        createdAt=key.created_at,
        lastUsedAt=key.last_used_at,
        revoked=key.revoked_at is not None,
    )


@router.get(
    "/organizations/{organizationId}/invitations",
    response_model=InvitationListResponse,
    operation_id="listInvitations",
)
async def list_invitations(
    context: OrganizationContext = Depends(require_organization_permission("roles.manage")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    session: AsyncSession = Depends(get_request_session),
) -> InvitationListResponse:
    """List invitation metadata without token values."""

    query = select(OrganizationInvitation).where(
        OrganizationInvitation.organization_id == context.organization.id
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(OrganizationInvitation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return InvitationListResponse(
        items=[_invitation_schema(row) for row in rows],
        page=page,
        pageSize=page_size,
        total=int(total or 0),
    )


@router.post(
    "/organizations/{organizationId}/invitations",
    response_model=InvitationSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createInvitation",
)
async def create_invitation(
    payload: InvitationCreateRequest,
    request: Request,
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> InvitationSchema:
    """Create an expiring invitation with an idempotent request boundary."""

    existing = await session.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == context.organization.id,
            OrganizationInvitation.idempotency_key == payload.idempotencyKey,
        )
    )
    if existing is not None:
        return _invitation_schema(existing)
    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == payload.roleId,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if role is None:
        raise api_error(404, "not_found", "Role not found.")
    raw_token = generate_token()
    invitation = OrganizationInvitation(
        organization_id=context.organization.id,
        email=str(payload.email).strip().lower(),
        role_id=role.id,
        status="pending",
        token_hash=hash_token(raw_token),
        idempotency_key=payload.idempotencyKey,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(invitation)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "invitation_conflict", "Invitation request already exists.") from exc
    await session.refresh(invitation)
    delivery: DeliveryAdapter = request.app.state.delivery
    await delivery.send_token(
        kind="organization_invitation",
        recipient=invitation.email,
        token=raw_token,
        metadata={
            "organizationId": str(context.organization.id),
            "invitationId": str(invitation.id),
        },
    )
    return _invitation_schema(invitation)


@router.post(
    "/invitations/accept",
    response_model=InvitationAcceptanceResponse,
    operation_id="acceptInvitation",
)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    session: AsyncSession = Depends(get_request_session),
) -> InvitationAcceptanceResponse:
    """Accept a valid invitation for an already-provisioned user identity."""

    invitation = await session.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.token_hash == hash_token(payload.token),
            OrganizationInvitation.status == "pending",
            OrganizationInvitation.expires_at > datetime.now(UTC),
        )
    )
    if invitation is None:
        raise api_error(400, "token_invalid", "The invitation is invalid or expired.")
    user = await session.scalar(select(User).where(func.lower(User.email) == invitation.email))
    if user is None:
        raise api_error(409, "user_required", "Create the invited user before accepting.")
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == invitation.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if membership is None:
        membership = OrganizationMembership(
            organization_id=invitation.organization_id,
            user_id=user.id,
            role_id=invitation.role_id,
        )
        session.add(membership)
    else:
        membership.role_id = invitation.role_id
        membership.status = MembershipStatus.ACTIVE
    invitation.status = "accepted"
    invitation.accepted_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(membership)
    organization = await session.get(
        __import__("app.models.organization", fromlist=["Organization"]).Organization,
        invitation.organization_id,
    )
    if organization is None:
        raise api_error(404, "not_found", "Organization not found.")
    return InvitationAcceptanceResponse(
        organization=_organization_schema(organization),
        member=MemberSchema(
            organizationId=membership.organization_id,
            userId=membership.user_id,
            roleId=membership.role_id,
            status=membership.status,
            createdAt=membership.created_at,
        ),
    )


async def _load_invitation(
    session: AsyncSession, organization_id: UUID, invitation_id: UUID
) -> OrganizationInvitation:
    """Load one tenant invitation or return a safe 404."""

    invitation = await session.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.organization_id == organization_id,
        )
    )
    if invitation is None:
        raise api_error(404, "not_found", "Invitation not found.")
    return invitation


@router.delete(
    "/organizations/{organizationId}/invitations/{invitationId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="revokeInvitation",
)
async def revoke_invitation(
    invitation_id: UUID = Path(alias="invitationId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Revoke one pending invitation."""

    invitation = await _load_invitation(session, context.organization.id, invitation_id)
    if invitation.status != "pending":
        raise api_error(409, "invitation_not_pending", "Only pending invitations can be revoked.")
    invitation.status = "revoked"
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/organizations/{organizationId}/invitations/{invitationId}/resend",
    response_model=AcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="resendInvitation",
)
async def resend_invitation(
    request: Request,
    invitation_id: UUID = Path(alias="invitationId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> AcceptedResponse:
    """Rotate an invitation token while keeping its metadata stable."""

    invitation = await _load_invitation(session, context.organization.id, invitation_id)
    if invitation.status != "pending":
        raise api_error(409, "invitation_not_pending", "Only pending invitations can be resent.")
    raw_token = generate_token()
    invitation.token_hash = hash_token(raw_token)
    invitation.expires_at = datetime.now(UTC) + timedelta(days=7)
    await session.commit()
    delivery: DeliveryAdapter = request.app.state.delivery
    await delivery.send_token(
        kind="organization_invitation",
        recipient=invitation.email,
        token=raw_token,
        metadata={
            "organizationId": str(context.organization.id),
            "invitationId": str(invitation.id),
        },
    )
    return AcceptedResponse(accepted=True)


@router.get(
    "/organizations/{organizationId}/notifications",
    response_model=NotificationListResponse,
    operation_id="listNotifications",
)
async def list_notifications(
    context: OrganizationContext = Depends(require_organization_permission("users.read")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    session: AsyncSession = Depends(get_request_session),
) -> NotificationListResponse:
    """List only the current user's tenant notifications."""

    query = select(InAppNotification).where(
        InAppNotification.organization_id == context.organization.id,
        InAppNotification.user_id == context.auth.user.id,
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    unread = await session.scalar(
        select(func.count()).select_from(query.where(InAppNotification.read.is_(False)).subquery())
    )
    rows = await session.scalars(
        query.order_by(InAppNotification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return NotificationListResponse(
        items=[
            NotificationSchema(
                id=row.id,
                kind=row.kind,
                title=row.title,
                body=row.body,
                read=row.read,
                createdAt=row.created_at,
            )
            for row in rows
        ],
        unreadCount=int(unread or 0),
        page=page,
        pageSize=page_size,
        total=int(total or 0),
    )


@router.patch(
    "/organizations/{organizationId}/notifications/{notificationId}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="markNotificationRead",
)
async def mark_notification_read(
    notification_id: UUID = Path(alias="notificationId"),
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Mark one current-user notification read."""

    notification = await session.scalar(
        select(InAppNotification).where(
            InAppNotification.id == notification_id,
            InAppNotification.organization_id == context.organization.id,
            InAppNotification.user_id == context.auth.user.id,
        )
    )
    if notification is None:
        raise api_error(404, "not_found", "Notification not found.")
    notification.read = True
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/organizations/{organizationId}/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="markAllNotificationsRead",
)
async def mark_all_notifications_read(
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Mark all current-user notifications read in one tenant."""

    await session.execute(
        update(InAppNotification)
        .where(
            InAppNotification.organization_id == context.organization.id,
            InAppNotification.user_id == context.auth.user.id,
        )
        .values(read=True, updated_at=datetime.now(UTC))
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organizationId}/notifications/preferences",
    response_model=NotificationPreferences,
    operation_id="getNotificationPreferences",
)
async def get_notification_preferences(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> NotificationPreferences:
    """Read or initialize current-user notification preferences."""

    preference = await session.get(
        NotificationPreference, (context.organization.id, context.auth.user.id)
    )
    if preference is None:
        preference = NotificationPreference(
            organization_id=context.organization.id,
            user_id=context.auth.user.id,
        )
        session.add(preference)
        await session.commit()
        await session.refresh(preference)
    return NotificationPreferences(
        emailSecurity=preference.email_security,
        emailProduct=preference.email_product,
        inAppSecurity=preference.in_app_security,
        inAppProduct=preference.in_app_product,
    )


@router.patch(
    "/organizations/{organizationId}/notifications/preferences",
    response_model=NotificationPreferences,
    operation_id="updateNotificationPreferences",
)
async def update_notification_preferences(
    payload: NotificationPreferencesUpdateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("users.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> NotificationPreferences:
    """Persist current-user notification channel preferences."""

    preference = await session.get(
        NotificationPreference, (context.organization.id, context.auth.user.id)
    )
    if preference is None:
        preference = NotificationPreference(
            organization_id=context.organization.id,
            user_id=context.auth.user.id,
        )
        session.add(preference)
    preference.email_security = payload.emailSecurity
    preference.email_product = payload.emailProduct
    preference.in_app_security = payload.inAppSecurity
    preference.in_app_product = payload.inAppProduct
    preference.updated_at = datetime.now(UTC)
    await session.commit()
    return NotificationPreferences(
        emailSecurity=preference.email_security,
        emailProduct=preference.email_product,
        inAppSecurity=preference.in_app_security,
        inAppProduct=preference.in_app_product,
    )


@router.get(
    "/organizations/{organizationId}/api-keys",
    response_model=ApiKeyListResponse,
    operation_id="listApiKeys",
)
async def list_api_keys(
    context: OrganizationContext = Depends(require_organization_permission("settings.manage")),
    session: AsyncSession = Depends(get_request_session),
) -> ApiKeyListResponse:
    """List API-key metadata without secrets."""

    rows = await session.scalars(
        select(OrganizationApiKey)
        .where(OrganizationApiKey.organization_id == context.organization.id)
        .order_by(OrganizationApiKey.created_at.desc())
    )
    return ApiKeyListResponse(items=[_api_key_schema(row) for row in rows])


@router.post(
    "/organizations/{organizationId}/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createApiKey",
)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> ApiKeyCreatedResponse:
    """Create an API key and return its raw secret exactly once."""

    scopes = [scope.root for scope in payload.scopes]
    known_scopes = set(await session.scalars(select(Permission.key)))
    if not set(scopes).issubset(known_scopes):
        raise api_error(422, "validation_error", "One or more API-key scopes are unknown.")
    prefix = secrets.token_hex(4)
    raw_key = f"umk_{prefix}_{generate_token()}"
    key = OrganizationApiKey(
        organization_id=context.organization.id,
        created_by=context.auth.user.id,
        prefix=prefix,
        name=payload.name.strip(),
        key_hash=hash_token(raw_key),
        scopes=scopes,
    )
    session.add(key)
    await session.commit()
    await session.refresh(key)
    return ApiKeyCreatedResponse(key=raw_key, metadata=_api_key_schema(key))


@router.delete(
    "/organizations/{organizationId}/api-keys/{apiKeyId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="revokeApiKey",
)
async def revoke_api_key(
    api_key_id: UUID = Path(alias="apiKeyId"),
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Revoke one tenant API key without deleting its audit metadata."""

    key = await session.scalar(
        select(OrganizationApiKey).where(
            OrganizationApiKey.id == api_key_id,
            OrganizationApiKey.organization_id == context.organization.id,
        )
    )
    if key is None:
        raise api_error(404, "not_found", "API key not found.")
    key.revoked_at = datetime.now(UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organizationId}/users/{userId}/roles",
    response_model=RoleListResponse,
    operation_id="listUserRoles",
)
async def list_user_roles(
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(require_organization_permission("users.read")),
    session: AsyncSession = Depends(get_request_session),
) -> RoleListResponse:
    """Return the role currently assigned to one member."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise api_error(404, "not_found", "Member not found.")
    role = await session.get(OrganizationRole, membership.role_id)
    if role is None:
        raise api_error(503, "dependency_unavailable", "Member role is missing.")
    return RoleListResponse(items=[await _role_schema(session, role)])


@router.post(
    "/organizations/{organizationId}/users/{userId}/roles",
    response_model=RoleAssignment,
    status_code=status.HTTP_201_CREATED,
    operation_id="assignUserRole",
)
async def assign_user_role(
    payload: RoleAssignmentRequest,
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> RoleAssignment:
    """Assign one organization role to a member."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == user_id,
        )
    )
    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == payload.roleId,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if membership is None or role is None:
        raise api_error(404, "not_found", "Member or role not found.")
    membership.role_id = role.id
    membership.status = MembershipStatus.ACTIVE
    await session.commit()
    return RoleAssignment(userId=user_id, roleId=role.id, createdAt=membership.updated_at)


@router.delete(
    "/organizations/{organizationId}/users/{userId}/roles/{roleId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="removeUserRole",
)
async def remove_user_role(
    user_id: UUID = Path(alias="userId"),
    role_id: UUID = Path(alias="roleId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Remove a role assignment by returning the member to the baseline role."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.role_id == role_id,
        )
    )
    member_role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.organization_id == context.organization.id,
            OrganizationRole.name == "Member",
        )
    )
    if membership is None or member_role is None:
        raise api_error(404, "not_found", "Role assignment not found.")
    membership.role_id = member_role.id
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
