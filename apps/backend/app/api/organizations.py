"""Organization administration, roles, membership, teams, and audit adapters."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    AuthContext,
    require_admin,
    require_admin_csrf,
    require_organization_permission,
    require_session,
)
from app.core.database import get_request_session
from app.core.http import api_error
from app.generated.schemas import (
    AuditLog as AuditLogSchema,
)
from app.generated.schemas import (
    AuditLogListResponse,
    DashboardResponse,
    MemberCreateRequest,
    MemberListResponse,
    MemberUpdateRequest,
    OrganizationCreateRequest,
    OrganizationListResponse,
    OrganizationSettings,
    OrganizationSettingsUpdateRequest,
    OrganizationUpdateRequest,
    Permission1,
    PermissionListResponse,
    RoleCreateRequest,
    RoleListResponse,
    RoleUpdateRequest,
    TeamCreateRequest,
    TeamListResponse,
    TeamUpdateRequest,
)
from app.generated.schemas import (
    Member as MemberSchema,
)
from app.generated.schemas import (
    Organization as OrganizationSchema,
)
from app.generated.schemas import (
    Permission as PermissionSchema,
)
from app.generated.schemas import (
    Role as RoleSchema,
)
from app.generated.schemas import (
    Team as TeamSchema,
)
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    Permission,
    RolePermission,
)
from app.models.organization_features import AuditLog, Team
from app.models.user import User
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1", tags=["Organizations"])


def _organization_schema(organization: Organization) -> OrganizationSchema:
    """Map a tenant ORM row to the generated API schema."""

    return OrganizationSchema(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        createdAt=organization.created_at,
        updatedAt=organization.updated_at,
    )


async def _permissions_for_role(session: AsyncSession, role_id: UUID) -> list[Permission]:
    """Load role permissions in stable key order."""

    result = await session.scalars(
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
        .order_by(Permission.key)
    )
    return list(result.all())


async def _role_schema(session: AsyncSession, role: OrganizationRole) -> RoleSchema:
    """Map a role and its permission keys to the public contract."""

    permissions = await _permissions_for_role(session, role.id)
    return RoleSchema(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=[Permission1(root=permission.key) for permission in permissions],
        system=role.system,
    )


async def _permission_rows(session: AsyncSession, keys: list[str]) -> list[Permission]:
    """Resolve requested permission keys and reject unknown capabilities."""

    result = await session.scalars(select(Permission).where(Permission.key.in_(keys)))
    rows = list(result.all())
    if len(rows) != len(set(keys)):
        raise api_error(422, "validation_error", "One or more permissions are unknown.")
    return rows


async def _audit(
    session: AsyncSession,
    context: OrganizationContext | None,
    event_type: str,
    target_type: str | None = None,
    target_id: UUID | None = None,
) -> None:
    """Append a safe audit event to the same transaction as the mutation."""

    if context is None:
        return
    session.add(
        AuditLog(
            organization_id=context.organization.id,
            actor_id=context.auth.user.id,
            actor_type="user",
            event_type=event_type,
            target_type=target_type,
            target_id=target_id,
            metadata_json=None,
        )
    )


@router.get(
    "/permissions", response_model=PermissionListResponse, operation_id="listPermissions"
)
async def list_permissions(
    _: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_request_session),
) -> PermissionListResponse:
    """List the global permission catalog for role editors."""

    rows = await session.scalars(select(Permission).order_by(Permission.key))
    return PermissionListResponse(
        items=[
            PermissionSchema(id=row.id, key=row.key, description=row.description)
            for row in rows
        ]
    )


@router.get(
    "/organizations", response_model=OrganizationListResponse, operation_id="listOrganizations"
)
async def list_organizations(
    context: AuthContext = Depends(require_session),
    session: AsyncSession = Depends(get_request_session),
) -> OrganizationListResponse:
    """List organizations where the current user has an active membership."""

    rows = await session.scalars(
        select(Organization)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(
            OrganizationMembership.user_id == context.user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE.value,
        )
        .order_by(Organization.name)
    )
    return OrganizationListResponse(items=[_organization_schema(row) for row in rows])


@router.post(
    "/organizations",
    response_model=OrganizationSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createOrganization",
)
async def create_organization(
    payload: OrganizationCreateRequest,
    context: AuthContext = Depends(require_admin_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> OrganizationSchema:
    """Create a tenant with deterministic Administrator and Member roles."""

    organization = Organization(name=payload.name.strip(), slug=payload.slug.lower())
    session.add(organization)
    try:
        await session.flush()
        permissions = list(await session.scalars(select(Permission)))
        permission_by_key = {permission.key: permission for permission in permissions}
        required_keys = {"users.read", "users.write", "users.delete"}
        if not required_keys.issubset(permission_by_key):
            raise api_error(503, "dependency_unavailable", "Permission catalog is incomplete.")
        administrator = OrganizationRole(
            organization_id=organization.id,
            name="Administrator",
            description="Full organization administration",
            system=True,
        )
        member = OrganizationRole(
            organization_id=organization.id,
            name="Member",
            description="Standard organization membership",
            system=True,
        )
        session.add_all([administrator, member])
        await session.flush()
        session.add_all(
            [
                RolePermission(role_id=administrator.id, permission_id=permission.id)
                for permission in permissions
            ]
            + [
                RolePermission(
                    role_id=member.id,
                    permission_id=permission_by_key["users.read"].id,
                )
            ]
        )
        organization.default_role_id = member.id
        session.add(
            OrganizationMembership(
                organization_id=organization.id,
                user_id=context.user.id,
                role_id=administrator.id,
            )
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "organization_conflict", "Organization slug already exists.") from exc
    await session.refresh(organization)
    return _organization_schema(organization)


@router.get(
    "/organizations/{organizationId}",
    response_model=OrganizationSchema,
    operation_id="getOrganization",
)
async def get_organization(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
) -> OrganizationSchema:
    """Return one organization after membership authorization."""

    return _organization_schema(context.organization)


@router.patch(
    "/organizations/{organizationId}",
    response_model=OrganizationSchema,
    operation_id="updateOrganization",
)
async def update_organization(
    payload: OrganizationUpdateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> OrganizationSchema:
    """Update tenant display identity without changing its ownership."""

    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    if payload.name is not None:
        context.organization.name = payload.name.strip()
    if payload.slug is not None:
        context.organization.slug = payload.slug.lower()
    context.organization.updated_at = datetime.now(UTC)
    await _audit(session, context, "organization.updated", "organization", context.organization.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "organization_conflict", "Organization slug already exists.") from exc
    await session.refresh(context.organization)
    return _organization_schema(context.organization)


@router.get(
    "/organizations/{organizationId}/roles",
    response_model=RoleListResponse,
    operation_id="listOrganizationRoles",
)
async def list_roles(
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> RoleListResponse:
    """List roles and their permission keys for one organization."""

    roles = await session.scalars(
        select(OrganizationRole)
        .where(OrganizationRole.organization_id == context.organization.id)
        .order_by(OrganizationRole.name)
    )
    return RoleListResponse(items=[await _role_schema(session, role) for role in roles])


@router.post(
    "/organizations/{organizationId}/roles",
    response_model=RoleSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createOrganizationRole",
)
async def create_role(
    payload: RoleCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> RoleSchema:
    """Create a custom organization role from catalog permission keys."""

    permissions = await _permission_rows(
        session, [permission.root for permission in payload.permissions]
    )
    role = OrganizationRole(
        organization_id=context.organization.id,
        name=payload.name.strip(),
        description=payload.description or "",
        system=False,
    )
    session.add(role)
    await session.flush()
    session.add_all(
        [RolePermission(role_id=role.id, permission_id=permission.id) for permission in permissions]
    )
    await _audit(session, context, "role.created", "role", role.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "role_conflict", "Role name already exists.") from exc
    await session.refresh(role)
    return await _role_schema(session, role)


@router.patch(
    "/organizations/{organizationId}/roles/{roleId}",
    response_model=RoleSchema,
    operation_id="updateOrganizationRole",
)
async def update_role(
    payload: RoleUpdateRequest,
    role_id: UUID = Path(alias="roleId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> RoleSchema:
    """Update a custom role; system roles stay protected."""

    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == role_id,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if role is None:
        raise api_error(404, "not_found", "Role not found.")
    if role.system:
        raise api_error(409, "system_role_protected", "System roles cannot be changed.")
    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    if payload.name is not None:
        role.name = payload.name.strip()
    if payload.description is not None:
        role.description = payload.description
    if payload.permissions is not None:
        permissions = await _permission_rows(
            session, [permission.root for permission in payload.permissions]
        )
        await session.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
        session.add_all(
            [
                RolePermission(role_id=role.id, permission_id=permission.id)
                for permission in permissions
            ]
        )
    role.updated_at = datetime.now(UTC)
    await _audit(session, context, "role.updated", "role", role.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "role_conflict", "Role name already exists.") from exc
    await session.refresh(role)
    return await _role_schema(session, role)


@router.delete(
    "/organizations/{organizationId}/roles/{roleId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteOrganizationRole",
)
async def delete_role(
    role_id: UUID = Path(alias="roleId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete an unused custom role."""

    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == role_id,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if role is None:
        raise api_error(404, "not_found", "Role not found.")
    if role.system:
        raise api_error(409, "system_role_protected", "System roles cannot be deleted.")
    assigned = await session.scalar(
        select(func.count()).select_from(OrganizationMembership).where(
            OrganizationMembership.role_id == role.id,
            OrganizationMembership.status != MembershipStatus.REMOVED.value,
        )
    )
    if assigned:
        raise api_error(409, "role_in_use", "Role is assigned to active members.")
    await _audit(session, context, "role.deleted", "role", role.id)
    await session.delete(role)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organizationId}/members",
    response_model=MemberListResponse,
    operation_id="listOrganizationMembers",
)
async def list_members(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    session: AsyncSession = Depends(get_request_session),
) -> MemberListResponse:
    """List tenant membership rows with stable pagination."""

    query = select(OrganizationMembership).where(
        OrganizationMembership.organization_id == context.organization.id
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(OrganizationMembership.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return MemberListResponse(
        items=[
            MemberSchema(
                organizationId=row.organization_id,
                userId=row.user_id,
                roleId=row.role_id,
                status=row.status,
                createdAt=row.created_at,
            )
            for row in rows
        ],
        page=page,
        pageSize=page_size,
        total=int(total or 0),
    )


@router.post(
    "/organizations/{organizationId}/members",
    response_model=MemberSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="addOrganizationMember",
)
async def add_member(
    payload: MemberCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> MemberSchema:
    """Attach an existing user to an organization role."""

    user = await session.scalar(select(User).where(User.id == payload.userId))
    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.id == payload.roleId,
            OrganizationRole.organization_id == context.organization.id,
        )
    )
    if user is None or role is None:
        raise api_error(404, "not_found", "User or role not found.")
    membership = OrganizationMembership(
        organization_id=context.organization.id,
        user_id=user.id,
        role_id=role.id,
    )
    session.add(membership)
    await _audit(session, context, "member.added", "user", user.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "membership_conflict", "User is already a member.") from exc
    await session.refresh(membership)
    return MemberSchema(
        organizationId=membership.organization_id,
        userId=membership.user_id,
        roleId=membership.role_id,
        status=membership.status,
        createdAt=membership.created_at,
    )


@router.patch(
    "/organizations/{organizationId}/members/{userId}",
    response_model=MemberSchema,
    operation_id="updateOrganizationMember",
)
async def update_member(
    payload: MemberUpdateRequest,
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> MemberSchema:
    """Change one member role or membership status."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise api_error(404, "not_found", "Member not found.")
    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    if payload.roleId is not None:
        role = await session.scalar(
            select(OrganizationRole).where(
                OrganizationRole.id == payload.roleId,
                OrganizationRole.organization_id == context.organization.id,
            )
        )
        if role is None:
            raise api_error(404, "not_found", "Role not found.")
        membership.role_id = role.id
    if payload.status is not None:
        membership.status = payload.status.value
    membership.updated_at = datetime.now(UTC)
    await _audit(session, context, "member.updated", "user", user_id)
    await session.commit()
    await session.refresh(membership)
    return MemberSchema(
        organizationId=membership.organization_id,
        userId=membership.user_id,
        roleId=membership.role_id,
        status=membership.status,
        createdAt=membership.created_at,
    )


@router.delete(
    "/organizations/{organizationId}/members/{userId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="removeOrganizationMember",
)
async def remove_member(
    user_id: UUID = Path(alias="userId"),
    context: OrganizationContext = Depends(
        require_organization_permission("roles.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Mark membership removed without deleting the user identity."""

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == context.organization.id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise api_error(404, "not_found", "Member not found.")
    membership.status = MembershipStatus.REMOVED
    membership.updated_at = datetime.now(UTC)
    await _audit(session, context, "member.removed", "user", user_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organizationId}/teams",
    response_model=TeamListResponse,
    operation_id="listOrganizationTeams",
)
async def list_teams(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> TeamListResponse:
    """List teams in one organization."""

    rows = await session.scalars(
        select(Team).where(Team.organization_id == context.organization.id).order_by(Team.name)
    )
    return TeamListResponse(
        items=[
            TeamSchema(
                id=row.id,
                organizationId=row.organization_id,
                name=row.name,
                description=row.description,
                createdAt=row.created_at,
                updatedAt=row.updated_at,
            )
            for row in rows
        ]
    )


@router.post(
    "/organizations/{organizationId}/teams",
    response_model=TeamSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createOrganizationTeam",
)
async def create_team(
    payload: TeamCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> TeamSchema:
    """Create a tenant-scoped team."""

    team = Team(
        organization_id=context.organization.id,
        name=payload.name.strip(),
        description=payload.description,
    )
    session.add(team)
    await _audit(session, context, "team.created", "team", team.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "team_conflict", "Team name already exists.") from exc
    await session.refresh(team)
    return TeamSchema(
        id=team.id,
        organizationId=team.organization_id,
        name=team.name,
        description=team.description,
        createdAt=team.created_at,
        updatedAt=team.updated_at,
    )


@router.patch(
    "/organizations/{organizationId}/teams/{teamId}",
    response_model=TeamSchema,
    operation_id="updateOrganizationTeam",
)
async def update_team(
    payload: TeamUpdateRequest,
    team_id: UUID = Path(alias="teamId"),
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> TeamSchema:
    """Update one organization team."""

    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.organization_id == context.organization.id)
    )
    if team is None:
        raise api_error(404, "not_found", "Team not found.")
    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    if payload.name is not None:
        team.name = payload.name.strip()
    if payload.description is not None:
        team.description = payload.description
    team.updated_at = datetime.now(UTC)
    await _audit(session, context, "team.updated", "team", team.id)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise api_error(409, "team_conflict", "Team name already exists.") from exc
    await session.refresh(team)
    return TeamSchema(
        id=team.id,
        organizationId=team.organization_id,
        name=team.name,
        description=team.description,
        createdAt=team.created_at,
        updatedAt=team.updated_at,
    )


@router.delete(
    "/organizations/{organizationId}/teams/{teamId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteOrganizationTeam",
)
async def delete_team(
    team_id: UUID = Path(alias="teamId"),
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete one organization team."""

    team = await session.scalar(
        select(Team).where(Team.id == team_id, Team.organization_id == context.organization.id)
    )
    if team is None:
        raise api_error(404, "not_found", "Team not found.")
    await _audit(session, context, "team.deleted", "team", team.id)
    await session.delete(team)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organizationId}/dashboard",
    response_model=DashboardResponse,
    operation_id="getOrganizationDashboard",
)
async def dashboard(
    context: OrganizationContext = Depends(
        require_organization_permission("users.read")
    ),
    session: AsyncSession = Depends(get_request_session),
) -> DashboardResponse:
    """Return bounded dashboard counts from tenant-scoped rows."""

    base = select(func.count()).select_from(OrganizationMembership).where(
        OrganizationMembership.organization_id == context.organization.id,
        OrganizationMembership.status != MembershipStatus.REMOVED.value,
    )
    total = await session.scalar(base)
    active = await session.scalar(
        base.where(User.status == "active")
        .join(User, User.id == OrganizationMembership.user_id)
    )
    pending = await session.scalar(
        base.where(User.status == "pending")
        .join(User, User.id == OrganizationMembership.user_id)
    )
    suspended = await session.scalar(
        base.where(User.status == "suspended")
        .join(User, User.id == OrganizationMembership.user_id)
    )
    teams = await session.scalar(
        select(func.count())
        .select_from(Team)
        .where(Team.organization_id == context.organization.id)
    )
    return DashboardResponse(
        totalUsers=int(total or 0),
        activeUsers=int(active or 0),
        pendingUsers=int(pending or 0),
        suspendedUsers=int(suspended or 0),
        teams=int(teams or 0),
    )


@router.get(
    "/organizations/{organizationId}/settings",
    response_model=OrganizationSettings,
    operation_id="getOrganizationSettings",
)
async def get_settings(
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage")
    ),
) -> OrganizationSettings:
    """Read persisted tenant policy settings."""

    if context.organization.default_role_id is None:
        raise api_error(503, "dependency_unavailable", "Organization settings are not initialized.")
    return OrganizationSettings(
        organizationId=context.organization.id,
        defaultRoleId=context.organization.default_role_id,
        requireEmailVerification=context.organization.require_email_verification,
        allowSelfJoin=context.organization.allow_self_join,
    )


@router.patch(
    "/organizations/{organizationId}/settings",
    response_model=OrganizationSettings,
    operation_id="updateOrganizationSettings",
)
async def update_settings(
    payload: OrganizationSettingsUpdateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> OrganizationSettings:
    """Update tenant policy settings after validating a role belongs to it."""

    if payload.defaultRoleId is not None:
        role = await session.scalar(
            select(OrganizationRole).where(
                OrganizationRole.id == payload.defaultRoleId,
                OrganizationRole.organization_id == context.organization.id,
            )
        )
        if role is None:
            raise api_error(404, "not_found", "Default role not found.")
        context.organization.default_role_id = role.id
    if payload.requireEmailVerification is not None:
        context.organization.require_email_verification = payload.requireEmailVerification
    if payload.allowSelfJoin is not None:
        context.organization.allow_self_join = payload.allowSelfJoin
    context.organization.updated_at = datetime.now(UTC)
    await _audit(session, context, "settings.updated", "organization", context.organization.id)
    await session.commit()
    await session.refresh(context.organization)
    return OrganizationSettings(
        organizationId=context.organization.id,
        defaultRoleId=context.organization.default_role_id,
        requireEmailVerification=context.organization.require_email_verification,
        allowSelfJoin=context.organization.allow_self_join,
    )


@router.get(
    "/organizations/{organizationId}/audit-logs",
    response_model=AuditLogListResponse,
    operation_id="listAuditLogs",
)
async def list_audit_logs(
    context: OrganizationContext = Depends(
        require_organization_permission("audit.read")
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    session: AsyncSession = Depends(get_request_session),
) -> AuditLogListResponse:
    """Read organization activity with bounded pagination."""

    query = select(AuditLog).where(AuditLog.organization_id == context.organization.id)
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
