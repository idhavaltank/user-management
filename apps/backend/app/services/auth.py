"""Authentication lifecycle services shared by the HTTP adapters.

The router owns transport concerns such as cookies and response status codes.
This module owns token rotation, password/session state transitions, and the
database transaction boundaries so the same rules can be reused by jobs or a
future command-line provisioning adapter.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.http import api_error
from app.core.security import generate_token, hash_password, hash_token, verify_password
from app.generated.schemas import PasswordChangeRequest
from app.models.session import UserSession
from app.models.token import OneTimeToken, OneTimeTokenPurpose
from app.models.user import User, UserStatus


def _enum_value(value: object) -> str:
    """Read either a SQLAlchemy string value or its StrEnum representation."""

    return getattr(value, "value", value)


def password_is_usable(user: User, now: datetime) -> bool:
    """Return whether an account can authenticate at this instant."""

    if not user.is_active or user.deleted_at is not None:
        return False
    if _enum_value(user.status) in {
        UserStatus.PENDING.value,
        UserStatus.INACTIVE.value,
        UserStatus.SUSPENDED.value,
        UserStatus.DELETED.value,
    }:
        return False
    if user.locked_until is not None and user.locked_until > now:
        return False
    return True


async def change_password(
    session: AsyncSession,
    user: User,
    current_session: UserSession,
    payload: PasswordChangeRequest,
) -> None:
    """Change a password and revoke every other browser session."""

    current_password = payload.currentPassword.get_secret_value()
    new_password = payload.newPassword.get_secret_value()
    if not verify_password(current_password, user.password_hash or ""):
        raise api_error(400, "current_password_invalid", "The current password is invalid.")
    if current_password == new_password:
        raise api_error(400, "password_unchanged", "The new password must be different.")

    now = datetime.now(UTC)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    if _enum_value(user.status) == UserStatus.LOCKED.value:
        user.status = UserStatus.ACTIVE
    await session.execute(
        update(UserSession)
        .where(
            UserSession.user_id == user.id,
            UserSession.id != current_session.id,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=now, updated_at=now)
    )
    await session.commit()


async def issue_one_time_token(
    session: AsyncSession,
    user: User,
    purpose: OneTimeTokenPurpose,
    ttl_seconds: int,
) -> str:
    """Rotate prior tokens and return one raw token to the delivery adapter."""

    await session.execute(
        update(OneTimeToken)
        .where(
            OneTimeToken.user_id == user.id,
            OneTimeToken.purpose == purpose.value,
            OneTimeToken.consumed_at.is_(None),
        )
        .values(consumed_at=datetime.now(UTC))
    )
    raw_token = generate_token()
    session.add(
        OneTimeToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=purpose,
            expires_at=datetime.now(UTC) + timedelta(seconds=ttl_seconds),
        )
    )
    await session.commit()
    return raw_token


async def consume_one_time_token(
    session: AsyncSession,
    raw_token: str,
    purpose: OneTimeTokenPurpose,
) -> User:
    """Consume one valid token atomically enough for the request transaction."""

    now = datetime.now(UTC)
    result = await session.execute(
        select(OneTimeToken, User)
        .join(User, User.id == OneTimeToken.user_id)
        .where(
            OneTimeToken.token_hash == hash_token(raw_token),
            OneTimeToken.purpose == purpose.value,
            OneTimeToken.consumed_at.is_(None),
            OneTimeToken.expires_at > now,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise api_error(400, "token_invalid", "The token is invalid or expired.")
    token, user = row
    token.consumed_at = now
    return user


async def revoke_other_sessions(session: AsyncSession, user_id: UUID, current_id: UUID) -> None:
    """Revoke all sessions except the session making the request."""

    await session.execute(
        update(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.id != current_id,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC), updated_at=datetime.now(UTC))
    )
    await session.commit()


async def revoke_session(
    session: AsyncSession, user_id: UUID, session_id: UUID
) -> UserSession:
    """Revoke one session belonging to the authenticated user."""

    user_session = await session.scalar(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )
    if user_session is None:
        raise api_error(404, "not_found", "Session not found.")
    user_session.revoked_at = datetime.now(UTC)
    await session.commit()
    return user_session


async def delete_expired_tokens(session: AsyncSession) -> int:
    """Remove consumed/expired tokens for a maintenance job."""

    result = await session.execute(
        delete(OneTimeToken).where(
            (OneTimeToken.expires_at <= datetime.now(UTC))
            | OneTimeToken.consumed_at.is_not(None)
        )
    )
    await session.commit()
    return result.rowcount or 0
