"""Organization membership and permission resolution services."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthContext
from app.core.http import api_error
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    Permission,
    RolePermission,
)


@dataclass(frozen=True)
class OrganizationContext:
    """Authenticated request context enriched with one active membership."""

    auth: AuthContext
    organization: Organization
    membership: OrganizationMembership
    role: OrganizationRole


async def resolve_organization_context(
    session: AsyncSession,
    auth: AuthContext,
    organization_id: UUID,
    permission_key: str,
) -> OrganizationContext:
    """Require an active organization membership with one named permission."""

    if auth.api_key_id is not None and permission_key not in auth.api_key_scopes:
        raise api_error(403, "forbidden", "The API key scope is insufficient.")

    result = await session.execute(
        select(Organization, OrganizationMembership, OrganizationRole)
        .join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Organization.id,
        )
        .join(OrganizationRole, OrganizationRole.id == OrganizationMembership.role_id)
        .join(RolePermission, RolePermission.role_id == OrganizationRole.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(
            Organization.id == organization_id,
            OrganizationMembership.user_id == auth.user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE.value,
            Permission.key == permission_key,
        )
    )
    row = result.one_or_none()
    if row is None:
        organization_exists = await session.scalar(
            select(Organization.id).where(Organization.id == organization_id)
        )
        if organization_exists is None:
            raise api_error(404, "not_found", "Organization not found.")
        raise api_error(403, "forbidden", "The organization permission is required.")
    organization, membership, role = row
    return OrganizationContext(
        auth=auth,
        organization=organization,
        membership=membership,
        role=role,
    )
