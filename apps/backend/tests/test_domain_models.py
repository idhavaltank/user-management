"""RED tests for the first durable user-management domain expansion.

These tests intentionally assert the public ORM boundary instead of merely
checking that modules import. They fail until the canonical lifecycle and
organization membership models exist.
"""

from app.models import (
    Base,
    OneTimeToken,
    Organization,
    OrganizationMembership,
    OrganizationRole,
    User,
    UserSession,
    UserStatus,
)


def test_user_has_canonical_lifecycle_fields() -> None:
    """The user model exposes status while retaining the migration projection."""

    assert set(UserStatus) == {
        UserStatus.PENDING,
        UserStatus.ACTIVE,
        UserStatus.INACTIVE,
        UserStatus.SUSPENDED,
        UserStatus.LOCKED,
        UserStatus.DELETED,
    }
    assert "status" in User.__table__.c
    assert "email_verified_at" in User.__table__.c
    assert "failed_login_attempts" in User.__table__.c
    assert "locked_until" in User.__table__.c


def test_organization_authorization_tables_are_part_of_shared_metadata() -> None:
    """Alembic can discover the organization and role relationship tables."""

    assert {"organizations", "organization_roles", "organization_memberships"}.issubset(
        Base.metadata.tables
    )
    assert Organization.__tablename__ == "organizations"
    assert OrganizationRole.__tablename__ == "organization_roles"
    assert OrganizationMembership.__tablename__ == "organization_memberships"
    assert "organization_id" in OrganizationMembership.__table__.c
    assert "role_id" in OrganizationMembership.__table__.c


def test_authentication_models_keep_tokens_hashed_and_sessions_auditable() -> None:
    """Reset/verification tokens and sessions expose only safe metadata."""

    assert OneTimeToken.__tablename__ == "one_time_tokens"
    assert {"token_hash", "purpose", "expires_at", "consumed_at"}.issubset(
        OneTimeToken.__table__.c.keys()
    )
    assert {"user_agent", "ip_address", "last_seen_at"}.issubset(
        UserSession.__table__.c.keys()
    )
