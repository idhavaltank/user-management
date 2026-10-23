"""Authentication endpoints for browser session management.

The frontend receives an opaque session cookie and keeps the CSRF token in
memory.  Raw session and CSRF values are never stored in PostgreSQL; only
their SHA-256 hashes are persisted by the session model.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.auth import AuthContext, require_csrf, require_session
from app.core.config import Settings
from app.core.database import get_request_session
from app.core.delivery import DeliveryAdapter
from app.core.http import api_error
from app.core.security import generate_token, hash_password, hash_token, verify_password
from app.generated.schemas import (
    AcceptedResponse,
    CsrfResponse,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordResetConsumeRequest,
    PasswordResetRequest,
    SessionListResponse,
    TokenConsumeRequest,
)
from app.generated.schemas import (
    Session as SessionSchema,
)
from app.generated.schemas import User as UserSchema
from app.models.session import UserSession
from app.models.token import OneTimeTokenPurpose
from app.models.user import User, UserStatus
from app.services.auth import (
    change_password,
    consume_one_time_token,
    issue_one_time_token,
    password_is_usable,
    revoke_other_sessions,
    revoke_session,
)
from app.services.users import to_user_schema

# Keeping authentication under one versioned router makes the public API
# contract explicit and allows future authentication versions to coexist.
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def _dummy_password_check(password: str) -> None:
    """Perform a password-hash check when the account does not exist.

    This keeps the response timing for an unknown email closer to the timing
    for a known email with a wrong password, reducing account enumeration risk.
    """

    # A fixed valid hash keeps the missing-account branch comparable to the mismatch branch.
    verify_password(
        password,
        "$argon2id$v=19$m=65536,t=3,p=4$MmJuxX0cn4f7ZAZeb99J7Q$vb8A6pf6RkDFq45nyQg6xfuUY3HqdsntZvlcNW6Hwis",
    )


@router.post("/login", response_model=LoginResponse, operation_id="login")
async def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_request_session),
) -> LoginResponse:
    """Validate credentials and create a database-backed browser session."""

    settings: Settings = request.app.state.settings
    origin = request.headers.get("origin")
    if origin and origin not in settings.frontend_origins:
        raise api_error(403, "origin_forbidden", "The request origin is not allowed.")
    email = str(payload.email).strip().lower()
    # Email is normalized before lookup so login matches CRUD uniqueness rules.
    user = await session.scalar(select(User).where(func.lower(User.email) == email))
    now = datetime.now(UTC)
    if user and user.locked_until is not None and user.locked_until <= now:
        user.locked_until = None
        user.failed_login_attempts = 0
        if getattr(user.status, "value", user.status) == UserStatus.LOCKED.value:
            user.status = UserStatus.ACTIVE

    valid = bool(user and user.password_hash and password_is_usable(user, now))
    if valid:
        valid = await run_in_threadpool(
            verify_password, payload.password.get_secret_value(), user.password_hash
        )
    if not valid:
        await run_in_threadpool(_dummy_password_check, payload.password.get_secret_value())
    if not valid:
        # Failed attempts are counted only for an otherwise eligible account;
        # unknown and disabled accounts remain indistinguishable to callers.
        if user and user.password_hash and user.is_active and user.deleted_at is None:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.login_max_attempts:
                user.status = UserStatus.LOCKED
                user.locked_until = now + timedelta(seconds=settings.login_lockout_seconds)
            await session.commit()
        raise api_error(401, "invalid_credentials", "Invalid email or password.")

    # The browser receives the raw values, while PostgreSQL stores only hashes.
    session_token = generate_token()
    csrf_token = generate_token()
    now = datetime.now(UTC)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.status = UserStatus.ACTIVE
    user.last_login_at = now
    user_session = UserSession(
        user_id=user.id,
        token_hash=hash_token(session_token),
        csrf_token_hash=hash_token(csrf_token),
        expires_at=now + timedelta(seconds=settings.session_ttl_seconds),
        last_seen_at=now,
        user_agent=request.headers.get("user-agent", "")[:512] or None,
        ip_address=request.client.host[:64] if request.client else None,
    )
    session.add(user_session)
    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise api_error(
            503, "dependency_unavailable", "Authentication storage is unavailable."
        ) from exc

    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_same_site,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return LoginResponse(user=to_user_schema(user), csrfToken=csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, operation_id="logout")
async def logout(
    response: Response,
    request: Request,
    context: AuthContext = Depends(require_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Revoke the current session and remove its browser cookie."""

    context.session.revoked_at = datetime.now(UTC)
    await session.commit()
    response.delete_cookie(
        key=request.app.state.settings.session_cookie_name,
        httponly=True,
        secure=request.app.state.settings.session_cookie_secure,
        samesite=request.app.state.settings.session_cookie_same_site,
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserSchema, operation_id="getCurrentUser")
async def current_user(context: AuthContext = Depends(require_session)) -> UserSchema:
    """Return the authenticated user's public profile."""

    return to_user_schema(context.user)


@router.get("/csrf", response_model=CsrfResponse, operation_id="getCsrfToken")
async def csrf_token(
    response: Response,
    context: AuthContext = Depends(require_session),
    session: AsyncSession = Depends(get_request_session),
) -> CsrfResponse:
    """Rotate the CSRF token used by subsequent unsafe requests."""

    token = generate_token()
    context.session.csrf_token_hash = hash_token(token)
    await session.commit()
    # CSRF values are response-plus-memory credentials and must never be
    # cached or shared across browser sessions.
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return CsrfResponse(csrfToken=token)


@router.post(
    "/password/change",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="changePassword",
)
async def password_change(
    payload: PasswordChangeRequest,
    context: AuthContext = Depends(require_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Change the current password and preserve only the active session."""

    await change_password(session, context.user, context.session, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/password/forgot",
    response_model=AcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="requestPasswordReset",
)
async def password_forgot(
    payload: PasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_request_session),
) -> AcceptedResponse:
    """Issue a reset token without revealing whether the email exists."""

    email = str(payload.email).strip().lower()
    user = await session.scalar(
        select(User).where(
            func.lower(User.email) == email,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    if user is not None:
        # The raw token is handed directly to the delivery port and is never
        # returned, logged, or persisted in plaintext by the API layer.
        raw_token = await issue_one_time_token(
            session,
            user,
            OneTimeTokenPurpose.PASSWORD_RESET,
            request.app.state.settings.password_reset_ttl_seconds,
        )
        delivery: DeliveryAdapter = request.app.state.delivery
        await delivery.send_token(
            kind="password_reset",
            recipient=email,
            token=raw_token,
            metadata={"userId": str(user.id)},
        )
        request.app.state.telemetry.info(
            "auth.password_reset.requested", {"userId": str(user.id)}
        )
    return AcceptedResponse(accepted=True)


@router.post(
    "/password/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="resetPassword",
)
async def password_reset(
    payload: PasswordResetConsumeRequest,
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Consume a reset token, change the password, and revoke all sessions."""

    user = await consume_one_time_token(
        session, payload.token, OneTimeTokenPurpose.PASSWORD_RESET
    )
    now = datetime.now(UTC)
    user.password_hash = await run_in_threadpool(
        hash_password, payload.newPassword.get_secret_value()
    )
    user.password_changed_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    if getattr(user.status, "value", user.status) == UserStatus.LOCKED.value:
        user.status = UserStatus.ACTIVE
    await session.execute(
        UserSession.__table__.update()
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now, updated_at=now)
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/email/verify",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="verifyEmail",
)
async def verify_email(
    payload: TokenConsumeRequest,
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Consume an email verification token and activate the account."""

    user = await consume_one_time_token(
        session, payload.token, OneTimeTokenPurpose.EMAIL_VERIFICATION
    )
    user.email_verified_at = datetime.now(UTC)
    if getattr(user.status, "value", user.status) == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/sessions", response_model=SessionListResponse, operation_id="listSessions"
)
async def list_sessions(
    request: Request,
    context: AuthContext = Depends(require_session),
    session: AsyncSession = Depends(get_request_session),
) -> SessionListResponse:
    """List session metadata without exposing cookie or CSRF values."""

    raw_cookie = request.cookies.get(request.app.state.settings.session_cookie_name, "")
    token_hash = hash_token(raw_cookie) if raw_cookie else ""
    rows = await session.scalars(
        select(UserSession)
        .where(UserSession.user_id == context.user.id)
        .order_by(UserSession.created_at.desc())
    )
    items = [
        SessionSchema(
            id=item.id,
            createdAt=item.created_at,
            expiresAt=item.expires_at,
            lastSeenAt=item.last_seen_at,
            userAgent=item.user_agent,
            ipAddress=item.ip_address,
            current=item.token_hash == token_hash,
            revoked=item.revoked_at is not None,
        )
        for item in rows
    ]
    return SessionListResponse(items=items)


@router.delete(
    "/sessions",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="revokeOtherSessions",
)
async def revoke_other(
    context: AuthContext = Depends(require_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Revoke all sessions except the one carrying the current request."""

    await revoke_other_sessions(session, context.user.id, context.session.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="revokeSession",
)
async def revoke_one(
    session_id: UUID,
    context: AuthContext = Depends(require_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Revoke one session owned by the current account."""

    await revoke_session(session, context.user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
