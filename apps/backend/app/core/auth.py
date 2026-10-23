"""FastAPI dependencies for session authentication and authorization.

Authentication verifies the opaque cookie against a hashed database value.
Authorization is deliberately separate: an authenticated user is not
automatically an administrator, and unsafe methods additionally require CSRF
validation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hmac import compare_digest
from uuid import UUID

from fastapi import Depends, Header, Path, Request
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.database import get_request_session
from app.core.http import api_error
from app.core.security import hash_token
from app.models.organization_features import OrganizationApiKey
from app.models.session import UserSession
from app.models.user import User, UserRole, UserStatus


@dataclass(frozen=True)
class AuthContext:
    """The validated user and session made available to protected endpoints."""

    user: User
    session: UserSession | None
    api_key_id: UUID | None = None
    api_key_scopes: frozenset[str] = frozenset()


# ``auto_error=False`` lets the dependency return our consistent API error
# shape instead of FastAPI's default security error response. The cookie name
# itself comes from Settings so deployments never have two sources of truth.
csrf_header = APIKeyHeader(
    name="X-CSRF-Token", scheme_name="csrfToken", auto_error=False
)


async def get_auth_context(
    request: Request,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_request_session),
) -> AuthContext:
    """Resolve and validate the current browser session."""

    settings: Settings = request.app.state.settings
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        return await _get_api_key_context(authorization, session)

    # Compare hashes in the database rather than storing or querying raw
    # bearer values. The joined user check also makes deactivated users fail.
    result = await session.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(UserSession.token_hash == hash_token(raw_token))
    )
    row = result.one_or_none()
    now = datetime.now(UTC)
    if row is None:
        raise api_error(401, "invalid_session", "The session is invalid or expired.")
    user_session, user = row
    user_status = getattr(user.status, "value", user.status)
    if (
        user_session.revoked_at is not None
        or user_session.expires_at <= now
        or not user.is_active
        or user.deleted_at is not None
        or user_status
        in {
            UserStatus.PENDING.value,
            UserStatus.INACTIVE.value,
            UserStatus.SUSPENDED.value,
            UserStatus.LOCKED.value,
            UserStatus.DELETED.value,
        }
    ):
        raise api_error(401, "invalid_session", "The session is invalid or expired.")

    request.state.auth_context = AuthContext(user=user, session=user_session)
    return request.state.auth_context


async def _get_api_key_context(
    authorization: str | None,
    session: AsyncSession,
) -> AuthContext:
    """Resolve a scoped bearer API key when no browser session is present."""

    if not authorization or not authorization.startswith("Bearer "):
        raise api_error(401, "authentication_required", "Authentication is required.")
    raw_key = authorization[7:].strip()
    parts = raw_key.split("_", 2)
    if len(parts) != 3 or parts[0] != "umk" or not parts[1] or not parts[2]:
        raise api_error(401, "invalid_api_key", "The API key is invalid or expired.")
    prefix = parts[1]
    result = await session.execute(
        select(OrganizationApiKey, User)
        .join(User, User.id == OrganizationApiKey.created_by)
        .where(
            OrganizationApiKey.prefix == prefix,
            OrganizationApiKey.key_hash == hash_token(raw_key),
            OrganizationApiKey.revoked_at.is_(None),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    row = result.one_or_none()
    if row is None:
        raise api_error(401, "invalid_api_key", "The API key is invalid or expired.")
    api_key, user = row
    api_key.last_used_at = datetime.now(UTC)
    await session.commit()
    return AuthContext(
        user=user,
        session=None,
        api_key_id=api_key.id,
        api_key_scopes=frozenset(api_key.scopes or []),
    )


async def require_admin(context: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Require an authenticated user with the administrator role."""

    if context.session is None:
        raise api_error(401, "session_required", "A browser session is required.")
    role = context.user.role.value if isinstance(context.user.role, UserRole) else context.user.role
    if role != UserRole.ADMIN.value:
        raise api_error(403, "forbidden", "Administrator access is required.")
    return context


async def require_session(context: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Reject API-key credentials on browser-only identity endpoints."""

    if context.session is None:
        raise api_error(401, "session_required", "A browser session is required.")
    return context


async def require_csrf(
    supplied: str | None = Depends(csrf_header),
    context: AuthContext = Depends(get_auth_context),
) -> AuthContext:
    """Require the CSRF token that was issued for the current session."""

    if context.session is None or not supplied or not compare_digest(
        hash_token(supplied), context.session.csrf_token_hash
    ):
        raise api_error(403, "csrf_failed", "A valid CSRF token is required.")
    return context


async def require_admin_csrf(
    context: AuthContext = Depends(require_csrf),
) -> AuthContext:
    """Require both a valid CSRF token and administrator authorization."""

    role = context.user.role.value if isinstance(context.user.role, UserRole) else context.user.role
    if role != UserRole.ADMIN.value:
        raise api_error(403, "forbidden", "Administrator access is required.")
    return context


def user_id(context: AuthContext) -> UUID:
    """Return the authenticated user's UUID for callers that need it."""

    return context.user.id


def require_organization_permission(permission_key: str, unsafe: bool = False):
    """Build a dependency for one organization-scoped permission boundary."""

    async def dependency(
        organization_id: UUID = Path(alias="organizationId"),
        context: AuthContext = Depends(require_csrf if unsafe else get_auth_context),
        session: AsyncSession = Depends(get_request_session),
    ):
        # Imported lazily to keep the authentication dependency graph acyclic.
        from app.services.organizations import resolve_organization_context

        return await resolve_organization_context(
            session, context, organization_id, permission_key
        )

    return dependency
