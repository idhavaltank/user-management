"""Optional first-administrator bootstrap used by local and test startup."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.security import hash_password
from app.core.telemetry import Telemetry
from app.models.organization import Organization, OrganizationMembership, OrganizationRole
from app.models.user import Gender, User, UserRole


async def ensure_bootstrap_admin(
    settings: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    telemetry: Telemetry,
) -> None:
    """Create the configured administrator once, if bootstrap settings exist.

    The operation is idempotent: an existing email is left unchanged. This is
    useful for local startup while avoiding accidental password overwrites on
    every application restart.
    """

    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        # Deployments without bootstrap credentials use a separate provisioning
        # workflow to create their first administrator.
        return

    try:
        async with session_factory() as session:
            email = settings.bootstrap_admin_email.strip().lower()
            # Case-insensitive lookup matches the active-email uniqueness rule.
            existing = await session.scalar(select(User).where(func.lower(User.email) == email))
            created = existing is None
            if existing is None:
                # Hash before persistence; the raw bootstrap password never enters
                # the database or telemetry.
                existing = User(
                    name=settings.bootstrap_admin_name,
                    email=email,
                    password_hash=hash_password(settings.bootstrap_admin_password),
                    gender=Gender.MEN,
                    birth_date=settings.bootstrap_admin_birth_date,
                    college="System",
                    address="System",
                    hobbies=[],
                    custom_hobbies=[],
                    role=UserRole.ADMIN,
                )
                session.add(existing)
                await session.flush()

            # New local bootstrap users are added to the same deterministic
            # organization as migrated users so organization-scoped APIs work
            # immediately after startup.
            organization = await session.scalar(
                select(Organization).where(Organization.slug == "local")
            )
            administrator = None
            if organization is not None:
                administrator = await session.scalar(
                    select(OrganizationRole).where(
                        OrganizationRole.organization_id == organization.id,
                        OrganizationRole.name == "Administrator",
                    )
                )
            if organization is not None and administrator is not None:
                membership = await session.scalar(
                    select(OrganizationMembership).where(
                        OrganizationMembership.organization_id == organization.id,
                        OrganizationMembership.user_id == existing.id,
                    )
                )
                if membership is None:
                    session.add(
                        OrganizationMembership(
                            organization_id=organization.id,
                            user_id=existing.id,
                            role_id=administrator.id,
                        )
                    )
            await session.commit()
            telemetry.info(
                "bootstrap.admin.ready",
                {"provisioned": True, "created": created},
            )
    except SQLAlchemyError as exc:
        telemetry.error("bootstrap.admin.skipped", {"reason": "database_unavailable"}, error=exc)
