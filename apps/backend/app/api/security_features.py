"""Local MFA adapter and explicit OIDC provider boundary endpoints."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status

from app.core.auth import AuthContext, require_csrf, require_organization_permission
from app.core.http import api_error
from app.generated.schemas import (
    LoginResponse,
    MfaChallengeRequest,
    MfaCodeRequest,
    MfaEnrollmentResponse,
    MfaRecoveryCodesResponse,
    OidcLinkRequest,
    OidcStartRequest,
    OidcStartResponse,
    RecoveryCode,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1", tags=["Authentication"])


def _totp(secret: str, timestamp: int | None = None) -> str:
    """Generate a six-digit RFC 6238-compatible local TOTP value."""

    counter = int((timestamp or time.time()) // 30).to_bytes(8, "big")
    digest = hmac.new(
        base64.b32decode(secret + "=" * (-len(secret) % 8)),
        counter,
        hashlib.sha1,
    ).digest()
    offset = digest[-1] & 0x0F
    value = int.from_bytes(digest[offset : offset + 4], "big") & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def _state(request: Request, user_id: UUID) -> dict:
    """Return or create the in-process local MFA record for one user."""

    return request.app.state.local_mfa.setdefault(str(user_id), {})


def _recovery_codes() -> list[str]:
    """Generate one-time local recovery codes."""

    return [secrets.token_urlsafe(9) for _ in range(10)]


@router.post(
    "/auth/mfa/enroll",
    response_model=MfaEnrollmentResponse,
    operation_id="beginMfaEnrollment",
)
async def begin_mfa(
    request: Request,
    context: AuthContext = Depends(require_csrf),
) -> MfaEnrollmentResponse:
    """Begin local TOTP enrollment; production must provide encrypted storage."""

    record = _state(request, context.user.id)
    if record.get("enabled"):
        raise api_error(409, "mfa_already_enabled", "MFA is already enabled.")
    secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
    enrollment_id = uuid4()
    record.update({"enrollment_id": str(enrollment_id), "secret": secret})
    return MfaEnrollmentResponse(
        enrollmentId=enrollment_id,
        issuer="User Management Local",
        accountName=context.user.email,
        secret=secret,
    )


@router.post(
    "/auth/mfa/verify",
    response_model=MfaRecoveryCodesResponse,
    operation_id="verifyMfaEnrollment",
)
async def verify_mfa(
    payload: MfaCodeRequest,
    request: Request,
    context: AuthContext = Depends(require_csrf),
) -> MfaRecoveryCodesResponse:
    """Confirm a pending local TOTP enrollment and issue recovery codes once."""

    record = _state(request, context.user.id)
    if not record.get("secret"):
        raise api_error(409, "mfa_not_started", "Begin MFA enrollment first.")
    if not hmac.compare_digest(_totp(record["secret"]), payload.code):
        raise api_error(400, "mfa_code_invalid", "The MFA code is invalid.")
    codes = _recovery_codes()
    record.update(
        {
            "enabled": True,
            "recovery": {hashlib.sha256(code.encode()).hexdigest() for code in codes},
        }
    )
    return MfaRecoveryCodesResponse(recoveryCodes=[RecoveryCode(root=code) for code in codes])


@router.post(
    "/auth/mfa/disable", status_code=status.HTTP_204_NO_CONTENT, operation_id="disableMfa"
)
async def disable_mfa(
    payload: MfaCodeRequest,
    request: Request,
    context: AuthContext = Depends(require_csrf),
) -> Response:
    """Disable local MFA after verifying a current TOTP code."""

    record = _state(request, context.user.id)
    if not record.get("enabled") or not hmac.compare_digest(_totp(record["secret"]), payload.code):
        raise api_error(400, "mfa_code_invalid", "The MFA code is invalid.")
    record.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/auth/mfa/recovery-codes/rotate",
    response_model=MfaRecoveryCodesResponse,
    operation_id="rotateMfaRecoveryCodes",
)
async def rotate_recovery_codes(
    request: Request,
    context: AuthContext = Depends(require_csrf),
) -> MfaRecoveryCodesResponse:
    """Rotate local recovery codes after CSRF/session authentication."""

    record = _state(request, context.user.id)
    if not record.get("enabled"):
        raise api_error(409, "mfa_not_enabled", "MFA is not enabled.")
    codes = _recovery_codes()
    record["recovery"] = {hashlib.sha256(code.encode()).hexdigest() for code in codes}
    return MfaRecoveryCodesResponse(recoveryCodes=[RecoveryCode(root=code) for code in codes])


@router.post(
    "/auth/mfa/challenge/verify",
    response_model=LoginResponse,
    operation_id="verifyMfaChallenge",
)
async def verify_mfa_challenge(_: MfaChallengeRequest) -> LoginResponse:
    """Reject incomplete provider-neutral challenges instead of silently bypassing MFA."""

    raise api_error(
        409,
        "mfa_challenge_unavailable",
        "A pending MFA challenge is not available in this local adapter.",
    )


@router.post(
    "/auth/mfa/recovery-codes/use",
    response_model=LoginResponse,
    operation_id="useMfaRecoveryCode",
)
async def use_recovery_code(_: MfaChallengeRequest) -> LoginResponse:
    """Reject recovery-code login until a shared challenge store is configured."""

    raise api_error(
        409,
        "mfa_challenge_unavailable",
        "A pending MFA challenge is not available in this local adapter.",
    )


@router.post("/auth/oidc/start", response_model=OidcStartResponse, operation_id="startOidcLogin")
async def start_oidc(_: OidcStartRequest) -> OidcStartResponse:
    """Expose an explicit provider boundary until OIDC credentials are configured."""

    raise api_error(
        503,
        "oidc_not_configured",
        "No OIDC provider adapter is configured for this environment.",
    )


@router.get(
    "/auth/oidc/{provider}/callback",
    response_model=LoginResponse,
    operation_id="completeOidcLogin",
)
async def complete_oidc(
    provider: str = Path(min_length=1, max_length=64),
    code: str = Query(min_length=1, max_length=2048),
    state: str = Query(min_length=16, max_length=256),
) -> LoginResponse:
    """Reject callbacks when the matching provider transaction is unavailable."""

    del provider, code, state
    raise api_error(
        503,
        "oidc_not_configured",
        "No OIDC provider adapter is configured for this environment.",
    )


@router.post(
    "/organizations/{organizationId}/auth/oidc/{provider}/link",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="linkOidcIdentity",
)
async def link_oidc(
    _: OidcLinkRequest,
    provider: str = Path(min_length=1, max_length=64),
    context: OrganizationContext = Depends(
        require_organization_permission("settings.manage", unsafe=True)
    ),
) -> Response:
    """Reject identity linking until provider verification is configured."""

    del provider, context
    raise api_error(
        503,
        "oidc_not_configured",
        "No OIDC provider adapter is configured for this environment.",
    )
