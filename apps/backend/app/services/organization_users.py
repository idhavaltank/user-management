"""Organization-scoped user lifecycle operations."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.http import api_error
from app.generated.schemas import RestoreUserRequest, UserStatusUpdateRequest
from app.models.organization import MembershipStatus, OrganizationMembership, OrganizationRole
from app.models.user import User, UserRole, UserStatus
from app.services.users import create_user, update_user


def _organization_query(
    organization_id: UUID,
    include_removed: bool = False,
) -> Select[tuple[User]]:
    """Build a user query whose visibility is constrained by membership."""

    query = (
        select(User)
        .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
        .where(OrganizationMembership.organization_id == organization_id)
    )
    if not include_removed:
        query = query.where(OrganizationMembership.status != MembershipStatus.REMOVED.value)
    return query


async def list_organization_users(
    session: AsyncSession,
    organization_id: UUID,
    page: int,
    page_size: int,
    search: str | None,
    sort: str,
    order: str,
    status_filter: str | None,
    role_filter: str | None,
) -> tuple[list[User], int]:
    """Return a filtered, deterministic page of organization members."""

    query = _organization_query(organization_id, include_removed=status_filter == "deleted")
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
    if status_filter:
        query = query.where(User.status == status_filter)
    if role_filter:
        query = query.where(User.role == role_filter)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    sort_map = {
        "name": User.name,
        "email": User.email,
        "birthDate": User.birth_date,
        "createdAt": User.created_at,
        "updatedAt": User.updated_at,
    }
    if sort not in sort_map:
        raise api_error(422, "validation_error", "Unsupported user sort field.")
    query = query.order_by(sort_map[sort].asc() if order == "asc" else sort_map[sort].desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    return list(result.scalars().all()), int(total or 0)


async def get_organization_user(
    session: AsyncSession, organization_id: UUID, user_id: UUID
) -> User:
    """Load any member record, including deleted records for restoration."""

    user = await session.scalar(
        _organization_query(organization_id, include_removed=True).where(User.id == user_id)
    )
    if user is None:
        raise api_error(404, "not_found", "User not found in this organization.")
    return user


async def _membership(
    session: AsyncSession, organization_id: UUID, user_id: UUID
) -> OrganizationMembership:
    """Load the single membership row or return a consistent 404."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise api_error(404, "not_found", "User membership not found.")
    return membership


async def create_organization_user(
    session: AsyncSession, organization_id: UUID, payload
) -> User:
    """Create a pending profile and attach the default Member role."""

    user = await create_user(session, payload)
    user.status = UserStatus.PENDING
    user.email_verified_at = None
    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.organization_id == organization_id,
            OrganizationRole.name == "Member",
        )
    )
    if role is None:
        raise api_error(503, "dependency_unavailable", "Organization roles are not initialized.")
    session.add(
        OrganizationMembership(
            organization_id=organization_id,
            user_id=user.id,
            role_id=role.id,
        )
    )
    await session.commit()
    await session.refresh(user)
    return user


async def update_organization_user(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    payload,
) -> User:
    """Reuse the profile update policy after checking organization membership."""

    await get_organization_user(session, organization_id, user_id)
    return await update_user(session, user_id, payload)


async def restore_organization_user(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    payload: RestoreUserRequest,
) -> User:
    """Restore a soft-deleted profile with an explicit safe status."""

    user = await get_organization_user(session, organization_id, user_id)
    membership = await _membership(session, organization_id, user_id)
    requested = getattr(payload.status, "value", payload.status) or "inactive"
    if (
        user.deleted_at is None
        and getattr(user.status, "value", user.status) != UserStatus.DELETED.value
    ):
        raise api_error(409, "not_deleted", "The user is not deleted.")
    user.is_active = True
    user.deleted_at = None
    user.status = requested
    membership.status = MembershipStatus.ACTIVE
    user.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(user)
    return user


async def update_organization_user_status(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    payload: UserStatusUpdateRequest,
) -> User:
    """Apply account lifecycle state while preserving legacy soft-delete rules."""

    user = await get_organization_user(session, organization_id, user_id)
    membership = await _membership(session, organization_id, user_id)
    requested = getattr(payload.status, "value", payload.status)
    if requested == UserStatus.DELETED.value:
        user.is_active = False
        user.deleted_at = datetime.now(UTC)
        membership.status = MembershipStatus.REMOVED
    else:
        user.is_active = True
        user.deleted_at = None
        membership.status = MembershipStatus.ACTIVE
    user.status = requested
    user.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(user)
    return user


async def delete_organization_user(
    session: AsyncSession, organization_id: UUID, user_id: UUID
) -> None:
    """Soft-delete one organization member and remove active visibility."""

    user = await get_organization_user(session, organization_id, user_id)
    if user.deleted_at is not None:
        raise api_error(409, "already_deleted", "The user is already deleted.")
    current_role = getattr(user.role, "value", user.role)
    if current_role == UserRole.ADMIN.value:
        admin_count = await session.scalar(
            select(func.count())
            .select_from(_organization_query(organization_id))
            .where(User.role == UserRole.ADMIN.value)
        )
        if (admin_count or 0) <= 1:
            raise api_error(
                409,
                "admin_invariant",
                "The last active administrator cannot be deleted.",
            )
    membership = await _membership(session, organization_id, user_id)
    now = datetime.now(UTC)
    user.is_active = False
    user.deleted_at = now
    user.status = UserStatus.DELETED
    user.updated_at = now
    membership.status = MembershipStatus.REMOVED
    await session.commit()
