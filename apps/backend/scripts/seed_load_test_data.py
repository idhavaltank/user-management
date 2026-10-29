"""Seed deterministic local data for CRM pagination and load testing.

This command is intentionally separate from migrations. It only targets a
named local organization, creates up to the requested number of test rows, and
can be rerun without duplicating its deterministic records.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.database import create_engine, create_session_factory
from app.core.security import hash_password
from app.models.crm import (
    Account,
    Activity,
    Contact,
    Deal,
    FlowAccountStatus,
    FlowActivityKind,
    FlowActivityStatus,
    FlowContactStatus,
    FlowDealStage,
)
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationRole,
)
from app.models.user import Gender, User, UserRole, UserStatus

SEED_PREFIX = "FlowSync Load Test"
SEED_USER_PREFIX = "flowsync-load-user-"
SEED_EMAIL_DOMAIN = "loadtest.dev"
VALID_BIRTH_DATE = date(1988, 1, 15)
MAX_RECORDS_PER_USER = 100_000
DEFAULT_USER_BATCH_SIZE = 10


def positive_bounded(value: str) -> int:
    """Parse a count while keeping accidental local data explosions bounded."""

    parsed = int(value)
    if parsed < 1 or parsed > 2_000:
        raise argparse.ArgumentTypeError("count must be between 1 and 2000")
    return parsed


def records_per_user(value: str) -> int:
    """Parse a per-user record target without permitting an accidental 400M run."""

    parsed = int(value)
    if parsed < 1 or parsed > MAX_RECORDS_PER_USER:
        raise argparse.ArgumentTypeError(
            f"records per user must be between 1 and {MAX_RECORDS_PER_USER}"
        )
    return parsed


def user_batch_size(value: str) -> int:
    """Keep each PostgreSQL transaction bounded during bulk seeding."""

    parsed = int(value)
    if parsed < 1 or parsed > 100:
        raise argparse.ArgumentTypeError("user batch size must be between 1 and 100")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line interface used by local developers and CI."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organization-slug", default="local")
    parser.add_argument("--users", type=positive_bounded, default=50)
    parser.add_argument("--accounts", type=positive_bounded, default=1_000)
    parser.add_argument("--contacts", type=positive_bounded, default=1_000)
    parser.add_argument("--deals", type=positive_bounded, default=1_000)
    parser.add_argument("--activities", type=positive_bounded, default=1_000)
    parser.add_argument(
        "--records-per-user",
        type=records_per_user,
        default=None,
        help=(
            "Use PostgreSQL bulk mode and create this many accounts, contacts, "
            "deals, and activities for every generated user."
        ),
    )
    parser.add_argument(
        "--user-batch-size",
        type=user_batch_size,
        default=DEFAULT_USER_BATCH_SIZE,
        help="Number of generated users included in one bulk transaction.",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("SEED_USER_PASSWORD"),
        help="Password for generated users; prefer SEED_USER_PASSWORD.",
    )
    return parser


async def find_organization(session: AsyncSession, slug: str) -> Organization:
    """Resolve the explicitly selected organization and fail safely if absent."""

    organization = await session.scalar(select(Organization).where(Organization.slug == slug))
    if organization is None:
        raise RuntimeError(
            f"Organization {slug!r} does not exist. Start the backend once to "
            "create the local bootstrap organization."
        )
    return organization


async def find_member_role(session: AsyncSession, organization_id: UUID) -> OrganizationRole:
    """Resolve the normal member role used by generated test users."""

    role = await session.scalar(
        select(OrganizationRole).where(
            OrganizationRole.organization_id == organization_id,
            OrganizationRole.name == "Member",
        )
    )
    if role is None:
        role = await session.scalar(
            select(OrganizationRole)
            .where(OrganizationRole.organization_id == organization_id)
            .order_by(OrganizationRole.system.desc(), OrganizationRole.name.asc())
        )
    if role is None:
        raise RuntimeError("The organization has no role available for seeded users.")
    return role


async def seed_users(
    session: AsyncSession,
    organization: Organization,
    member_role: OrganizationRole,
    count: int,
    password: str,
) -> list[User]:
    """Create deterministic active users and organization memberships."""

    prefix = f"{SEED_USER_PREFIX}"
    existing_rows = await session.scalars(
        select(User).where(User.name.like(f"{SEED_PREFIX} User %"))
    )
    users_by_name = {row.name: row for row in existing_rows}
    password_hash = hash_password(password)
    for index in range(1, count + 1):
        email = f"{prefix}{index:04d}@{SEED_EMAIL_DOMAIN}"
        user = users_by_name.get(f"{SEED_PREFIX} User {index:04d}")
        if user is None:
            user = User(
                name=f"{SEED_PREFIX} User {index:04d}",
                email=email,
                password_hash=password_hash,
                gender=Gender.MEN if index % 2 else Gender.WOMEN,
                birth_date=VALID_BIRTH_DATE,
                college="FlowSync Load Test College",
                address=f"{index} Load Test Avenue",
                hobbies=["Reading", "Testing"] if index % 2 else ["Travel"],
                custom_hobbies=[],
                role=UserRole.USER,
                status=UserStatus.ACTIVE,
                email_verified_at=datetime.now(UTC),
            )
            session.add(user)
            await session.flush()
            users_by_name[user.name] = user
        else:
            # Repair rows created by the original local seed domain while
            # keeping reruns idempotent and avoiding duplicate test users. The
            # explicit seed password also makes local test credentials
            # recoverable without exposing a generated password.
            user.email = email
            user.password_hash = password_hash

        membership = await session.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization.id,
                OrganizationMembership.user_id == user.id,
            )
        )
        if membership is None:
            session.add(
                OrganizationMembership(
                    organization_id=organization.id,
                    user_id=user.id,
                    role_id=member_role.id,
                    status=MembershipStatus.ACTIVE,
                )
            )
        elif membership.status != MembershipStatus.ACTIVE:
            membership.status = MembershipStatus.ACTIVE

    await session.flush()
    return [
        users_by_name[f"{SEED_PREFIX} User {index:04d}"]
        for index in range(1, count + 1)
    ]


async def seed_accounts(
    session: AsyncSession,
    organization_id: UUID,
    owners: list[User],
    target: int,
) -> list[Account]:
    """Create deterministic accounts and return at least the requested set."""

    existing = await session.scalars(
        select(Account).where(
            Account.organization_id == organization_id,
            Account.name.like(f"{SEED_PREFIX} Account %"),
        )
    )
    by_name = {row.name: row for row in existing}
    for index in range(1, target + 1):
        name = f"{SEED_PREFIX} Account {index:05d}"
        if name not in by_name:
            row = Account(
                organization_id=organization_id,
                name=name,
                industry=("Technology", "Healthcare", "Finance", "Retail")[index % 4],
                website=f"https://account-{index:05d}.{SEED_EMAIL_DOMAIN}",
                phone=f"+1-555-{index % 10_000:04d}",
                address=f"{index} Customer Street",
                owner_id=owners[index % len(owners)].id,
                status=(
                    FlowAccountStatus.PROSPECT,
                    FlowAccountStatus.CUSTOMER,
                    FlowAccountStatus.INACTIVE,
                )[index % 3],
                notes=f"{SEED_PREFIX} account for list and image testing.",
            )
            session.add(row)
            by_name[name] = row
    await session.flush()
    return [by_name[f"{SEED_PREFIX} Account {index:05d}"] for index in range(1, target + 1)]


async def seed_contacts(
    session: AsyncSession,
    organization_id: UUID,
    owners: list[User],
    accounts: list[Account],
    target: int,
) -> list[Contact]:
    """Create deterministic contacts linked to seeded accounts."""

    existing = await session.scalars(
        select(Contact).where(
            Contact.organization_id == organization_id,
            Contact.last_name == "Contact",
            Contact.first_name.like("Load%"),
        )
    )
    by_first_name = {row.first_name: row for row in existing}
    for index in range(1, target + 1):
        email = f"flowsync-load-contact-{index:05d}@{SEED_EMAIL_DOMAIN}"
        first_name = f"Load{index:05d}"
        contact = by_first_name.get(first_name)
        if contact is None:
            row = Contact(
                organization_id=organization_id,
                account_id=accounts[(index - 1) % len(accounts)].id,
                first_name=first_name,
                last_name="Contact",
                email=email,
                phone=f"+1-556-{index % 10_000:04d}",
                job_title=("Manager", "Director", "Engineer", "Coordinator")[index % 4],
                owner_id=owners[index % len(owners)].id,
                status=(
                    FlowContactStatus.LEAD,
                    FlowContactStatus.ACTIVE,
                    FlowContactStatus.INACTIVE,
                )[index % 3],
                notes=f"{SEED_PREFIX} contact for list and image testing.",
            )
            session.add(row)
            by_first_name[first_name] = row
        else:
            # Repair the first local seed domain without creating duplicates.
            contact.email = email
            contact.account_id = accounts[(index - 1) % len(accounts)].id
    await session.flush()
    return [
        by_first_name[f"Load{index:05d}"]
        for index in range(1, target + 1)
    ]


async def seed_deals(
    session: AsyncSession,
    organization_id: UUID,
    owners: list[User],
    accounts: list[Account],
    contacts: list[Contact],
    target: int,
) -> list[Deal]:
    """Create deterministic pipeline opportunities linked to CRM records."""

    existing = await session.scalars(
        select(Deal).where(
            Deal.organization_id == organization_id,
            Deal.name.like(f"{SEED_PREFIX} Deal %"),
        )
    )
    by_name = {row.name: row for row in existing}
    stages = list(FlowDealStage)
    for index in range(1, target + 1):
        name = f"{SEED_PREFIX} Deal {index:05d}"
        if name not in by_name:
            row = Deal(
                organization_id=organization_id,
                account_id=accounts[(index - 1) % len(accounts)].id,
                contact_id=contacts[(index - 1) % len(contacts)].id,
                owner_id=owners[index % len(owners)].id,
                name=name,
                stage=stages[index % len(stages)],
                amount=(index % 250) * 1250,
                currency="USD",
                expected_close_date=date(2027, 1, 1) + timedelta(days=index % 365),
                notes=f"{SEED_PREFIX} opportunity for pipeline testing.",
            )
            session.add(row)
            by_name[name] = row
    await session.flush()
    return [by_name[f"{SEED_PREFIX} Deal {index:05d}"] for index in range(1, target + 1)]


async def seed_activities(
    session: AsyncSession,
    organization_id: UUID,
    owners: list[User],
    accounts: list[Account],
    contacts: list[Contact],
    deals: list[Deal],
    target: int,
) -> int:
    """Create deterministic timeline rows attached to all CRM entity types."""

    existing = await session.scalars(
        select(Activity).where(
            Activity.organization_id == organization_id,
            Activity.subject.like(f"{SEED_PREFIX} Activity %"),
        )
    )
    existing_subjects = {row.subject for row in existing}
    kinds = list(FlowActivityKind)
    statuses = list(FlowActivityStatus)
    added = 0
    for index in range(1, target + 1):
        subject = f"{SEED_PREFIX} Activity {index:05d}"
        if subject in existing_subjects:
            continue
        session.add(
            Activity(
                organization_id=organization_id,
                account_id=accounts[(index - 1) % len(accounts)].id,
                contact_id=contacts[(index - 1) % len(contacts)].id,
                deal_id=deals[(index - 1) % len(deals)].id,
                owner_id=owners[index % len(owners)].id,
                kind=kinds[index % len(kinds)],
                status=statuses[index % len(statuses)],
                subject=subject,
                description=f"{SEED_PREFIX} activity for timeline testing.",
                due_at=datetime.now(UTC) + timedelta(days=index % 30),
                completed_at=datetime.now(UTC) if index % 3 == 0 else None,
            )
        )
        existing_subjects.add(subject)
        added += 1
    await session.flush()
    return added


async def create_bulk_user_table(session: AsyncSession) -> None:
    """Create a transaction-scoped staging table for the PostgreSQL bulk path."""

    await session.execute(
        text(
            """
            CREATE TEMP TABLE IF NOT EXISTS flowsync_seed_users (
                user_index integer NOT NULL,
                user_id uuid NOT NULL PRIMARY KEY
            ) ON COMMIT DELETE ROWS
            """
        )
    )


async def seed_bulk_crm_batch(
    session: AsyncSession,
    organization_id: UUID,
    users: list[User],
    start_index: int,
    end_index: int,
    records_per_user_target: int,
) -> dict[str, int]:
    """Insert one bounded user batch using server-side PostgreSQL generation.

    UUIDs are derived from the entity, stable user ID, and record number. That
    makes retries idempotent without loading millions of existing rows into
    Python memory and lets every foreign-key relationship be generated inside
    the same database transaction.
    """

    await session.execute(text("TRUNCATE flowsync_seed_users"))
    await session.execute(
        text(
            """
            INSERT INTO flowsync_seed_users (user_index, user_id)
            VALUES (:user_index, CAST(:user_id AS uuid))
            """
        ),
        [
            {"user_index": index + 1, "user_id": str(users[index].id)}
            for index in range(start_index, end_index)
        ],
    )

    common = {
        "organization_id": str(organization_id),
        "records_per_user": records_per_user_target,
    }
    inserted: dict[str, int] = {}
    result = await session.execute(
        text(
            """
            INSERT INTO crm_accounts (
                id, organization_id, name, industry, website, phone, address,
                owner_id, status, notes, created_at, updated_at
            )
            SELECT
                md5(
                    concat(
                        'flowsync:bulk:account:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                CAST(:organization_id AS uuid),
                concat(
                    'FlowSync Bulk Account ', lpad(seed.user_index::text, 4, '0'),
                    '-', lpad(series.record_index::text, 5, '0')
                ),
                CASE series.record_index % 4
                    WHEN 0 THEN 'Technology'
                    WHEN 1 THEN 'Healthcare'
                    WHEN 2 THEN 'Finance'
                    ELSE 'Retail'
                END,
                concat(
                    'https://account-', seed.user_index::text, '-',
                    series.record_index::text, '.loadtest.dev'
                ),
                '+1-557-' || lpad((series.record_index % 10000)::text, 4, '0'),
                series.record_index::text || ' Bulk Customer Street',
                seed.user_id,
                CASE series.record_index % 3
                    WHEN 0 THEN 'prospect'
                    WHEN 1 THEN 'customer'
                    ELSE 'inactive'
                END,
                'FlowSync bulk account for load testing.',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM flowsync_seed_users seed
            CROSS JOIN generate_series(1, :records_per_user) AS series(record_index)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        common,
    )
    inserted["accounts"] = result.rowcount or 0

    result = await session.execute(
        text(
            """
            INSERT INTO crm_contacts (
                id, organization_id, account_id, first_name, last_name, email,
                phone, job_title, owner_id, status, notes, created_at, updated_at
            )
            SELECT
                md5(
                    concat(
                        'flowsync:bulk:contact:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                CAST(:organization_id AS uuid),
                md5(
                    concat(
                        'flowsync:bulk:account:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                'Load' || lpad(seed.user_index::text, 4, '0'),
                'Contact' || lpad(series.record_index::text, 5, '0'),
                concat(
                    'flowsync-bulk-', seed.user_index::text, '-',
                    series.record_index::text, '@loadtest.dev'
                ),
                '+1-558-' || lpad((series.record_index % 10000)::text, 4, '0'),
                CASE series.record_index % 4
                    WHEN 0 THEN 'Manager'
                    WHEN 1 THEN 'Director'
                    WHEN 2 THEN 'Engineer'
                    ELSE 'Coordinator'
                END,
                seed.user_id,
                CASE series.record_index % 3
                    WHEN 0 THEN 'lead'
                    WHEN 1 THEN 'active'
                    ELSE 'inactive'
                END,
                'FlowSync bulk contact for load testing.',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM flowsync_seed_users seed
            CROSS JOIN generate_series(1, :records_per_user) AS series(record_index)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        common,
    )
    inserted["contacts"] = result.rowcount or 0

    result = await session.execute(
        text(
            """
            INSERT INTO crm_deals (
                id, organization_id, account_id, contact_id, owner_id, name,
                stage, amount, currency, expected_close_date, notes,
                created_at, updated_at
            )
            SELECT
                md5(
                    concat(
                        'flowsync:bulk:deal:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                CAST(:organization_id AS uuid),
                md5(
                    concat(
                        'flowsync:bulk:account:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                md5(
                    concat(
                        'flowsync:bulk:contact:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                seed.user_id,
                concat(
                    'FlowSync Bulk Deal ', lpad(seed.user_index::text, 4, '0'),
                    '-', lpad(series.record_index::text, 5, '0')
                ),
                CASE series.record_index % 6
                    WHEN 0 THEN 'lead'
                    WHEN 1 THEN 'qualified'
                    WHEN 2 THEN 'proposal'
                    WHEN 3 THEN 'negotiation'
                    WHEN 4 THEN 'won'
                    ELSE 'lost'
                END,
                ((series.record_index % 250) * 1250)::numeric(14, 2),
                'USD',
                CURRENT_DATE + (series.record_index % 365),
                'FlowSync bulk deal for load testing.',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM flowsync_seed_users seed
            CROSS JOIN generate_series(1, :records_per_user) AS series(record_index)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        common,
    )
    inserted["deals"] = result.rowcount or 0

    result = await session.execute(
        text(
            """
            INSERT INTO crm_activities (
                id, organization_id, account_id, contact_id, deal_id, owner_id,
                kind, status, subject, description, due_at, completed_at,
                created_at, updated_at
            )
            SELECT
                md5(
                    concat(
                        'flowsync:bulk:activity:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                CAST(:organization_id AS uuid),
                md5(
                    concat(
                        'flowsync:bulk:account:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                md5(
                    concat(
                        'flowsync:bulk:contact:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                md5(
                    concat(
                        'flowsync:bulk:deal:', seed.user_id::text,
                        ':', series.record_index::text
                    )
                )::uuid,
                seed.user_id,
                CASE series.record_index % 5
                    WHEN 0 THEN 'call'
                    WHEN 1 THEN 'email'
                    WHEN 2 THEN 'meeting'
                    WHEN 3 THEN 'task'
                    ELSE 'note'
                END,
                CASE series.record_index % 3
                    WHEN 0 THEN 'planned'
                    WHEN 1 THEN 'completed'
                    ELSE 'cancelled'
                END,
                concat(
                    'FlowSync Bulk Activity ', lpad(seed.user_index::text, 4, '0'),
                    '-', lpad(series.record_index::text, 5, '0')
                ),
                'FlowSync bulk activity for load testing.',
                CURRENT_TIMESTAMP + ((series.record_index % 30) * INTERVAL '1 day'),
                CASE WHEN series.record_index % 3 = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM flowsync_seed_users seed
            CROSS JOIN generate_series(1, :records_per_user) AS series(record_index)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        common,
    )
    inserted["activities"] = result.rowcount or 0
    await session.commit()
    return inserted


async def seed_bulk_crm(
    session: AsyncSession,
    organization_id: UUID,
    users: list[User],
    records_per_user_target: int,
    batch_size: int,
) -> dict[str, int]:
    """Seed every CRM entity for every generated user in resumable batches."""

    await create_bulk_user_table(session)
    totals = {"accounts": 0, "contacts": 0, "deals": 0, "activities": 0}
    total_batches = (len(users) + batch_size - 1) // batch_size
    for start_index in range(0, len(users), batch_size):
        end_index = min(start_index + batch_size, len(users))
        try:
            inserted = await seed_bulk_crm_batch(
                session,
                organization_id,
                users,
                start_index,
                end_index,
                records_per_user_target,
            )
        except Exception:
            await session.rollback()
            raise
        for entity, count in inserted.items():
            totals[entity] += count
        print(
            "Bulk seed batch "
            f"{start_index // batch_size + 1}/{total_batches}: "
            f"users={end_index - start_index}, inserted={sum(inserted.values())}",
            flush=True,
        )
    return totals


async def seed(args: argparse.Namespace) -> None:
    """Run one transaction that creates the requested local dataset."""

    if not args.password or len(args.password) < 12:
        raise RuntimeError(
            "Set SEED_USER_PASSWORD or pass --password with at least 12 characters."
        )
    settings = Settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            organization = await find_organization(session, args.organization_slug)
            role = await find_member_role(session, organization.id)
            users = await seed_users(session, organization, role, args.users, args.password)
            if args.records_per_user is not None:
                inserted = await seed_bulk_crm(
                    session,
                    organization.id,
                    users,
                    args.records_per_user,
                    args.user_batch_size,
                )
                total_records = sum(inserted.values())
                print(
                    "Seeded local FlowSync bulk data: "
                    f"users={len(users)}, records_per_user_per_entity={args.records_per_user}, "
                    f"accounts={inserted['accounts']}, contacts={inserted['contacts']}, "
                    f"deals={inserted['deals']}, activities={inserted['activities']}, "
                    f"total_inserted={total_records}, organization={organization.slug}"
                )
                return
            accounts = await seed_accounts(session, organization.id, users, args.accounts)
            contacts = await seed_contacts(session, organization.id, users, accounts, args.contacts)
            deals = await seed_deals(
                session, organization.id, users, accounts, contacts, args.deals
            )
            activities_added = await seed_activities(
                session,
                organization.id,
                users,
                accounts,
                contacts,
                deals,
                args.activities,
            )
            await session.commit()
            print(
                "Seeded local FlowSync data: "
                f"users={len(users)}, accounts={len(accounts)}, contacts={len(contacts)}, "
                f"deals={len(deals)}, activities_target={args.activities}, "
                f"activities_added={activities_added}, organization={organization.slug}"
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    arguments = build_parser().parse_args()
    asyncio.run(seed(arguments))
