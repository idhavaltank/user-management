"""FlowSync CRM HTTP adapter for organization-scoped online records.

The router owns HTTP validation and serialization while every query carries the
organization id resolved by the existing permission dependency.  This keeps
the first online foundation ready for an IndexedDB/outbox adapter later: the
API contract is already tenant-scoped and uses stable UUID records.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_organization_permission
from app.core.database import get_request_session
from app.core.http import api_error
from app.generated.schemas import (
    CrmAccount as CrmAccountSchema,
)
from app.generated.schemas import (
    CrmAccountCreateRequest,
    CrmAccountListResponse,
    CrmAccountUpdateRequest,
    CrmActivityCreateRequest,
    CrmActivityListResponse,
    CrmActivityUpdateRequest,
    CrmContactCreateRequest,
    CrmContactListResponse,
    CrmContactUpdateRequest,
    CrmDashboardResponse,
    CrmDealCreateRequest,
    CrmDealListResponse,
    CrmDealUpdateRequest,
    CrmPipelineStageSummary,
    FlowAccountStatus,
    FlowActivityStatus,
    FlowContactStatus,
    FlowDealStage,
)
from app.generated.schemas import (
    CrmActivity as CrmActivitySchema,
)
from app.generated.schemas import (
    CrmContact as CrmContactSchema,
)
from app.generated.schemas import (
    CrmDeal as CrmDealSchema,
)
from app.models.crm import Account, Activity, Contact, Deal
from app.models.organization import MembershipStatus, OrganizationMembership
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/api/v1/organizations", tags=["CRM"])


def _value(value: Enum | str | None) -> str | None:
    """Normalize generated enum values before assigning them to SQLAlchemy rows."""

    return value.value if isinstance(value, Enum) else value


def _enum_value(value: Enum | str) -> str:
    """Normalize a persisted enum value for a generated response schema."""

    return value.value if isinstance(value, Enum) else value


def _trim(value: str | None) -> str | None:
    """Trim optional text and store empty input as null."""

    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _decimal_float(value: Decimal | float | int | None) -> float:
    """Convert PostgreSQL numeric values into the JSON contract's number type."""

    return float(value or 0)


def _profile_image_url(
    entity: str, organization_id: UUID, entity_id: UUID, image_key: str | None
) -> str | None:
    """Expose a stable API path without exposing the local filesystem key."""

    if not image_key:
        return None
    return f"/api/v1/organizations/{organization_id}/{entity}/{entity_id}/profile-image"


async def _total(session: AsyncSession, query: Any) -> int:
    """Count a filtered query without loading all matching CRM rows."""

    return int(await session.scalar(select(func.count()).select_from(query.subquery())) or 0)


async def _owner_is_member(session: AsyncSession, organization_id: UUID, owner_id: UUID) -> bool:
    """Return whether a candidate owner is an active member of the tenant."""

    return (
        await session.scalar(
            select(OrganizationMembership.id).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == owner_id,
                OrganizationMembership.status == MembershipStatus.ACTIVE.value,
            )
        )
    ) is not None


async def _validate_references(
    session: AsyncSession,
    organization_id: UUID,
    *,
    owner_id: UUID | None = None,
    account_id: UUID | None = None,
    contact_id: UUID | None = None,
    deal_id: UUID | None = None,
) -> None:
    """Reject cross-tenant references before they reach the database."""

    if owner_id is not None and not await _owner_is_member(session, organization_id, owner_id):
        raise api_error(422, "invalid_reference", "The owner is not an active organization member.")
    if account_id is not None:
        account = await session.scalar(
            select(Account.id).where(
                Account.id == account_id, Account.organization_id == organization_id
            )
        )
        if account is None:
            raise api_error(
                422, "invalid_reference", "The account does not belong to this organization."
            )
    if contact_id is not None:
        contact = await session.scalar(
            select(Contact.id).where(
                Contact.id == contact_id, Contact.organization_id == organization_id
            )
        )
        if contact is None:
            raise api_error(
                422, "invalid_reference", "The contact does not belong to this organization."
            )
    if deal_id is not None:
        deal = await session.scalar(
            select(Deal.id).where(Deal.id == deal_id, Deal.organization_id == organization_id)
        )
        if deal is None:
            raise api_error(
                422, "invalid_reference", "The deal does not belong to this organization."
            )


def _account_schema(row: Account) -> CrmAccountSchema:
    """Map an account row to the public FlowSync contract."""

    return CrmAccountSchema(
        id=row.id,
        organizationId=row.organization_id,
        name=row.name,
        industry=row.industry,
        website=row.website,
        phone=row.phone,
        address=row.address,
        ownerId=row.owner_id,
        status=_enum_value(row.status),
        notes=row.notes,
        profileImageUrl=_profile_image_url(
            "accounts", row.organization_id, row.id, row.profile_image_key
        ),
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _contact_schema(row: Contact) -> CrmContactSchema:
    """Map a contact row to the public FlowSync contract."""

    return CrmContactSchema(
        id=row.id,
        organizationId=row.organization_id,
        accountId=row.account_id,
        firstName=row.first_name,
        lastName=row.last_name,
        email=row.email,
        phone=row.phone,
        jobTitle=row.job_title,
        ownerId=row.owner_id,
        status=_enum_value(row.status),
        notes=row.notes,
        profileImageUrl=_profile_image_url(
            "contacts", row.organization_id, row.id, row.profile_image_key
        ),
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _deal_schema(row: Deal) -> CrmDealSchema:
    """Map a deal row to the public FlowSync contract."""

    return CrmDealSchema(
        id=row.id,
        organizationId=row.organization_id,
        accountId=row.account_id,
        contactId=row.contact_id,
        ownerId=row.owner_id,
        name=row.name,
        stage=_enum_value(row.stage),
        amount=_decimal_float(row.amount),
        currency=row.currency,
        expectedCloseDate=row.expected_close_date,
        notes=row.notes,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _activity_schema(row: Activity) -> CrmActivitySchema:
    """Map an activity row to the public FlowSync contract."""

    return CrmActivitySchema(
        id=row.id,
        organizationId=row.organization_id,
        accountId=row.account_id,
        contactId=row.contact_id,
        dealId=row.deal_id,
        ownerId=row.owner_id,
        kind=_enum_value(row.kind),
        status=_enum_value(row.status),
        subject=row.subject,
        description=row.description,
        dueAt=row.due_at,
        completedAt=row.completed_at,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


async def _account_or_404(
    session: AsyncSession, organization_id: UUID, account_id: UUID
) -> Account:
    """Load an organization account or return a tenant-safe 404."""

    row = await session.scalar(
        select(Account).where(
            Account.id == account_id,
            Account.organization_id == organization_id,
            Account.deleted_at.is_(None),
        )
    )
    if row is None:
        raise api_error(404, "not_found", "Account not found.")
    return row


async def _contact_or_404(
    session: AsyncSession, organization_id: UUID, contact_id: UUID
) -> Contact:
    """Load an organization contact or return a tenant-safe 404."""

    row = await session.scalar(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == organization_id,
            Contact.deleted_at.is_(None),
        )
    )
    if row is None:
        raise api_error(404, "not_found", "Contact not found.")
    return row


async def _deal_or_404(session: AsyncSession, organization_id: UUID, deal_id: UUID) -> Deal:
    """Load an organization deal or return a tenant-safe 404."""

    row = await session.scalar(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.organization_id == organization_id,
            Deal.deleted_at.is_(None),
        )
    )
    if row is None:
        raise api_error(404, "not_found", "Deal not found.")
    return row


async def _activity_or_404(
    session: AsyncSession, organization_id: UUID, activity_id: UUID
) -> Activity:
    """Load an organization activity or return a tenant-safe 404."""

    row = await session.scalar(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.organization_id == organization_id,
            Activity.deleted_at.is_(None),
        )
    )
    if row is None:
        raise api_error(404, "not_found", "Activity not found.")
    return row


def _search(query: Any, *columns: Any, value: str | None) -> Any:
    """Apply a case-insensitive search term to one or more text columns."""

    if value:
        pattern = f"%{value.strip().lower()}%"
        query = query.where(or_(*(func.lower(column).like(pattern) for column in columns)))
    return query


@router.get(
    "/{organizationId}/crm/dashboard",
    response_model=CrmDashboardResponse,
    operation_id="getCrmDashboard",
)
async def get_dashboard(
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmDashboardResponse:
    """Return tenant-scoped CRM counts and pipeline values for the home screen."""

    organization_id = context.organization.id
    total_accounts = await session.scalar(
        select(func.count()).select_from(Account).where(
            Account.organization_id == organization_id, Account.deleted_at.is_(None)
        )
    )
    active_accounts = await session.scalar(
        select(func.count())
        .select_from(Account)
        .where(
            Account.organization_id == organization_id,
            Account.deleted_at.is_(None),
            Account.status != "inactive",
        )
    )
    total_contacts = await session.scalar(
        select(func.count()).select_from(Contact).where(
            Contact.organization_id == organization_id, Contact.deleted_at.is_(None)
        )
    )
    total_deals = await session.scalar(
        select(func.count()).select_from(Deal).where(
            Deal.organization_id == organization_id, Deal.deleted_at.is_(None)
        )
    )
    open_deals = await session.scalar(
        select(func.count())
        .select_from(Deal)
        .where(
            Deal.organization_id == organization_id,
            Deal.deleted_at.is_(None),
            Deal.stage.not_in(["won", "lost"]),
        )
    )
    pipeline_value = await session.scalar(
        select(func.coalesce(func.sum(Deal.amount), 0)).where(
            Deal.organization_id == organization_id,
            Deal.deleted_at.is_(None),
            Deal.stage.not_in(["won", "lost"]),
        )
    )
    won_value = await session.scalar(
        select(func.coalesce(func.sum(Deal.amount), 0)).where(
            Deal.organization_id == organization_id,
            Deal.deleted_at.is_(None),
            Deal.stage == "won",
        )
    )
    upcoming = await session.scalar(
        select(func.count())
        .select_from(Activity)
        .where(
            Activity.organization_id == organization_id,
            Activity.deleted_at.is_(None),
            Activity.status == "planned",
            Activity.due_at.is_not(None),
            Activity.due_at >= datetime.now(UTC),
        )
    )
    pipeline: list[CrmPipelineStageSummary] = []
    for stage in FlowDealStage:
        count, value = (
            await session.execute(
                select(
                    func.count(Deal.id),
                    func.coalesce(func.sum(Deal.amount), 0),
                ).where(
                    Deal.organization_id == organization_id,
                    Deal.deleted_at.is_(None),
                    Deal.stage == stage.value,
                )
            )
        ).one()
        pipeline.append(
            CrmPipelineStageSummary(
                stage=stage.value, count=int(count or 0), value=_decimal_float(value)
            )
        )
    return CrmDashboardResponse(
        totalAccounts=int(total_accounts or 0),
        activeAccounts=int(active_accounts or 0),
        totalContacts=int(total_contacts or 0),
        totalDeals=int(total_deals or 0),
        openDeals=int(open_deals or 0),
        pipelineValue=_decimal_float(pipeline_value),
        wonValue=_decimal_float(won_value),
        upcomingActivities=int(upcoming or 0),
        pipeline=pipeline,
    )


@router.get(
    "/{organizationId}/accounts",
    response_model=CrmAccountListResponse,
    operation_id="listCrmAccounts",
)
async def list_accounts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    status_filter: FlowAccountStatus | None = Query(default=None, alias="status"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmAccountListResponse:
    """List accounts with tenant-scoped search and lifecycle filters."""

    query = select(Account).where(
        Account.organization_id == context.organization.id, Account.deleted_at.is_(None)
    )
    query = _search(query, Account.name, Account.industry, value=search)
    if status_filter is not None:
        query = query.where(Account.status == status_filter.value)
    total = await _total(session, query)
    rows = await session.scalars(
        query.order_by(Account.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return CrmAccountListResponse(
        items=[_account_schema(row) for row in rows], page=page, pageSize=page_size, total=total
    )


@router.post(
    "/{organizationId}/accounts",
    response_model=CrmAccountSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createCrmAccount",
)
async def create_account(
    payload: CrmAccountCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmAccountSchema:
    """Create one account and default its owner to the current member."""

    await _validate_references(session, context.organization.id, owner_id=payload.ownerId)
    row = Account(
        organization_id=context.organization.id,
        name=payload.name.strip(),
        industry=_trim(payload.industry),
        website=_trim(payload.website),
        phone=_trim(payload.phone),
        address=_trim(payload.address),
        owner_id=payload.ownerId or context.auth.user.id,
        status=_value(payload.status) or "prospect",
        notes=_trim(payload.notes),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _account_schema(row)


@router.get(
    "/{organizationId}/accounts/{accountId}",
    response_model=CrmAccountSchema,
    operation_id="getCrmAccount",
)
async def get_account(
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmAccountSchema:
    """Read one account inside its organization boundary."""

    return _account_schema(await _account_or_404(session, context.organization.id, account_id))


@router.patch(
    "/{organizationId}/accounts/{accountId}",
    response_model=CrmAccountSchema,
    operation_id="updateCrmAccount",
)
async def update_account(
    payload: CrmAccountUpdateRequest,
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmAccountSchema:
    """Apply a partial account update while preserving explicit nulls."""

    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    row = await _account_or_404(session, context.organization.id, account_id)
    if "ownerId" in payload.model_fields_set:
        await _validate_references(session, context.organization.id, owner_id=payload.ownerId)
        row.owner_id = payload.ownerId
    for field, value in {
        "name": payload.name,
        "industry": payload.industry,
        "website": payload.website,
        "phone": payload.phone,
        "address": payload.address,
        "notes": payload.notes,
    }.items():
        if field in payload.model_fields_set:
            setattr(row, field, value.strip() if isinstance(value, str) else value)
    if "status" in payload.model_fields_set:
        row.status = _value(payload.status)
    await session.commit()
    await session.refresh(row)
    return _account_schema(row)


@router.delete(
    "/{organizationId}/accounts/{accountId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteCrmAccount",
)
async def delete_account(
    account_id: UUID = Path(alias="accountId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete one account; linked records remain valid through SET NULL FKs."""

    row = await _account_or_404(session, context.organization.id, account_id)
    row.deleted_at = datetime.now(UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{organizationId}/contacts",
    response_model=CrmContactListResponse,
    operation_id="listCrmContacts",
)
async def list_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    status_filter: FlowContactStatus | None = Query(default=None, alias="status"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmContactListResponse:
    """List contacts by name or email within one organization."""

    query = select(Contact).where(
        Contact.organization_id == context.organization.id, Contact.deleted_at.is_(None)
    )
    query = _search(query, Contact.first_name, Contact.last_name, Contact.email, value=search)
    if status_filter is not None:
        query = query.where(Contact.status == status_filter.value)
    total = await _total(session, query)
    rows = await session.scalars(
        query.order_by(Contact.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return CrmContactListResponse(
        items=[_contact_schema(row) for row in rows], page=page, pageSize=page_size, total=total
    )


@router.post(
    "/{organizationId}/contacts",
    response_model=CrmContactSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createCrmContact",
)
async def create_contact(
    payload: CrmContactCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmContactSchema:
    """Create one contact after validating account and owner references."""

    await _validate_references(
        session,
        context.organization.id,
        owner_id=payload.ownerId,
        account_id=payload.accountId,
    )
    row = Contact(
        organization_id=context.organization.id,
        account_id=payload.accountId,
        first_name=payload.firstName.strip(),
        last_name=payload.lastName.strip(),
        email=str(payload.email).strip().lower() if payload.email else None,
        phone=_trim(payload.phone),
        job_title=_trim(payload.jobTitle),
        owner_id=payload.ownerId or context.auth.user.id,
        status=_value(payload.status) or "lead",
        notes=_trim(payload.notes),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _contact_schema(row)


@router.get(
    "/{organizationId}/contacts/{contactId}",
    response_model=CrmContactSchema,
    operation_id="getCrmContact",
)
async def get_contact(
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmContactSchema:
    """Read one contact inside its organization boundary."""

    return _contact_schema(await _contact_or_404(session, context.organization.id, contact_id))


@router.patch(
    "/{organizationId}/contacts/{contactId}",
    response_model=CrmContactSchema,
    operation_id="updateCrmContact",
)
async def update_contact(
    payload: CrmContactUpdateRequest,
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmContactSchema:
    """Apply a partial contact update with cross-tenant reference protection."""

    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    row = await _contact_or_404(session, context.organization.id, contact_id)
    if "accountId" in payload.model_fields_set or "ownerId" in payload.model_fields_set:
        await _validate_references(
            session,
            context.organization.id,
            owner_id=payload.ownerId if "ownerId" in payload.model_fields_set else row.owner_id,
            account_id=payload.accountId
            if "accountId" in payload.model_fields_set
            else row.account_id,
        )
    assignments = {
        "account_id": ("accountId", payload.accountId),
        "first_name": ("firstName", payload.firstName),
        "last_name": ("lastName", payload.lastName),
        "email": ("email", str(payload.email).strip().lower() if payload.email else None),
        "phone": ("phone", payload.phone),
        "job_title": ("jobTitle", payload.jobTitle),
        "owner_id": ("ownerId", payload.ownerId),
        "status": ("status", _value(payload.status)),
        "notes": ("notes", payload.notes),
    }
    for column, (field, value) in assignments.items():
        if field in payload.model_fields_set:
            setattr(row, column, value.strip() if isinstance(value, str) else value)
    await session.commit()
    await session.refresh(row)
    return _contact_schema(row)


@router.delete(
    "/{organizationId}/contacts/{contactId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteCrmContact",
)
async def delete_contact(
    contact_id: UUID = Path(alias="contactId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete one contact while preserving the account and deal records."""

    row = await _contact_or_404(session, context.organization.id, contact_id)
    row.deleted_at = datetime.now(UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{organizationId}/deals", response_model=CrmDealListResponse, operation_id="listCrmDeals"
)
async def list_deals(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    stage: FlowDealStage | None = Query(default=None),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmDealListResponse:
    """List deals with search and pipeline-stage filters."""

    query = select(Deal).where(
        Deal.organization_id == context.organization.id, Deal.deleted_at.is_(None)
    )
    query = _search(query, Deal.name, Deal.currency, value=search)
    if stage is not None:
        query = query.where(Deal.stage == stage.value)
    total = await _total(session, query)
    rows = await session.scalars(
        query.order_by(Deal.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return CrmDealListResponse(
        items=[_deal_schema(row) for row in rows], page=page, pageSize=page_size, total=total
    )


@router.post(
    "/{organizationId}/deals",
    response_model=CrmDealSchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createCrmDeal",
)
async def create_deal(
    payload: CrmDealCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmDealSchema:
    """Create one pipeline deal with tenant-safe linked records."""

    await _validate_references(
        session,
        context.organization.id,
        owner_id=payload.ownerId,
        account_id=payload.accountId,
        contact_id=payload.contactId,
    )
    row = Deal(
        organization_id=context.organization.id,
        account_id=payload.accountId,
        contact_id=payload.contactId,
        owner_id=payload.ownerId or context.auth.user.id,
        name=payload.name.strip(),
        stage=_value(payload.stage) or "lead",
        amount=Decimal(str(payload.amount or 0)),
        currency=(payload.currency or "USD").upper(),
        expected_close_date=payload.expectedCloseDate,
        notes=_trim(payload.notes),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _deal_schema(row)


@router.get(
    "/{organizationId}/deals/{dealId}", response_model=CrmDealSchema, operation_id="getCrmDeal"
)
async def get_deal(
    deal_id: UUID = Path(alias="dealId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmDealSchema:
    """Read one deal inside its organization boundary."""

    return _deal_schema(await _deal_or_404(session, context.organization.id, deal_id))


@router.patch(
    "/{organizationId}/deals/{dealId}", response_model=CrmDealSchema, operation_id="updateCrmDeal"
)
async def update_deal(
    payload: CrmDealUpdateRequest,
    deal_id: UUID = Path(alias="dealId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmDealSchema:
    """Apply a partial deal update and preserve numeric precision in storage."""

    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    row = await _deal_or_404(session, context.organization.id, deal_id)
    if any(field in payload.model_fields_set for field in ("accountId", "contactId", "ownerId")):
        await _validate_references(
            session,
            context.organization.id,
            owner_id=payload.ownerId if "ownerId" in payload.model_fields_set else row.owner_id,
            account_id=payload.accountId
            if "accountId" in payload.model_fields_set
            else row.account_id,
            contact_id=payload.contactId
            if "contactId" in payload.model_fields_set
            else row.contact_id,
        )
    assignments = {
        "account_id": ("accountId", payload.accountId),
        "contact_id": ("contactId", payload.contactId),
        "owner_id": ("ownerId", payload.ownerId),
        "name": ("name", payload.name),
        "stage": ("stage", _value(payload.stage)),
        "amount": ("amount", Decimal(str(payload.amount)) if payload.amount is not None else None),
        "currency": ("currency", payload.currency.upper() if payload.currency else None),
        "expected_close_date": ("expectedCloseDate", payload.expectedCloseDate),
        "notes": ("notes", payload.notes),
    }
    for column, (field, value) in assignments.items():
        if field in payload.model_fields_set:
            setattr(row, column, value.strip() if isinstance(value, str) else value)
    await session.commit()
    await session.refresh(row)
    return _deal_schema(row)


@router.delete(
    "/{organizationId}/deals/{dealId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteCrmDeal",
)
async def delete_deal(
    deal_id: UUID = Path(alias="dealId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete one deal from the organization's pipeline."""

    row = await _deal_or_404(session, context.organization.id, deal_id)
    row.deleted_at = datetime.now(UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{organizationId}/activities",
    response_model=CrmActivityListResponse,
    operation_id="listCrmActivities",
)
async def list_activities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    status_filter: FlowActivityStatus | None = Query(default=None, alias="status"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmActivityListResponse:
    """List the tenant timeline ordered by the most recently changed activity."""

    query = select(Activity).where(
        Activity.organization_id == context.organization.id, Activity.deleted_at.is_(None)
    )
    query = _search(query, Activity.subject, Activity.description, value=search)
    if status_filter is not None:
        query = query.where(Activity.status == status_filter.value)
    total = await _total(session, query)
    rows = await session.scalars(
        query.order_by(Activity.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return CrmActivityListResponse(
        items=[_activity_schema(row) for row in rows], page=page, pageSize=page_size, total=total
    )


@router.post(
    "/{organizationId}/activities",
    response_model=CrmActivitySchema,
    status_code=status.HTTP_201_CREATED,
    operation_id="createCrmActivity",
)
async def create_activity(
    payload: CrmActivityCreateRequest,
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmActivitySchema:
    """Create a timeline activity and default its owner to the current member."""

    await _validate_references(
        session,
        context.organization.id,
        owner_id=payload.ownerId,
        account_id=payload.accountId,
        contact_id=payload.contactId,
        deal_id=payload.dealId,
    )
    row = Activity(
        organization_id=context.organization.id,
        account_id=payload.accountId,
        contact_id=payload.contactId,
        deal_id=payload.dealId,
        owner_id=payload.ownerId or context.auth.user.id,
        kind=_value(payload.kind),
        status=_value(payload.status) or "planned",
        subject=payload.subject.strip(),
        description=_trim(payload.description),
        due_at=payload.dueAt,
        completed_at=payload.dueAt if _value(payload.status) == "completed" else None,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _activity_schema(row)


@router.get(
    "/{organizationId}/activities/{activityId}",
    response_model=CrmActivitySchema,
    operation_id="getCrmActivity",
)
async def get_activity(
    activity_id: UUID = Path(alias="activityId"),
    context: OrganizationContext = Depends(require_organization_permission("crm.read")),
    session: AsyncSession = Depends(get_request_session),
) -> CrmActivitySchema:
    """Read one activity inside its organization boundary."""

    return _activity_schema(await _activity_or_404(session, context.organization.id, activity_id))


@router.patch(
    "/{organizationId}/activities/{activityId}",
    response_model=CrmActivitySchema,
    operation_id="updateCrmActivity",
)
async def update_activity(
    payload: CrmActivityUpdateRequest,
    activity_id: UUID = Path(alias="activityId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.write", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> CrmActivitySchema:
    """Apply a partial activity update and set completion time consistently."""

    if not payload.model_fields_set:
        raise api_error(422, "validation_error", "At least one field is required.")
    row = await _activity_or_404(session, context.organization.id, activity_id)
    if any(
        field in payload.model_fields_set
        for field in ("accountId", "contactId", "dealId", "ownerId")
    ):
        await _validate_references(
            session,
            context.organization.id,
            owner_id=payload.ownerId if "ownerId" in payload.model_fields_set else row.owner_id,
            account_id=payload.accountId
            if "accountId" in payload.model_fields_set
            else row.account_id,
            contact_id=payload.contactId
            if "contactId" in payload.model_fields_set
            else row.contact_id,
            deal_id=payload.dealId if "dealId" in payload.model_fields_set else row.deal_id,
        )
    assignments = {
        "account_id": ("accountId", payload.accountId),
        "contact_id": ("contactId", payload.contactId),
        "deal_id": ("dealId", payload.dealId),
        "owner_id": ("ownerId", payload.ownerId),
        "kind": ("kind", _value(payload.kind)),
        "status": ("status", _value(payload.status)),
        "subject": ("subject", payload.subject),
        "description": ("description", payload.description),
        "due_at": ("dueAt", payload.dueAt),
        "completed_at": ("completedAt", payload.completedAt),
    }
    for column, (field, value) in assignments.items():
        if field in payload.model_fields_set:
            setattr(row, column, value.strip() if isinstance(value, str) else value)
    if (
        "status" in payload.model_fields_set
        and _value(payload.status) == "completed"
        and "completedAt" not in payload.model_fields_set
    ):
        row.completed_at = datetime.now(UTC)
    if (
        "status" in payload.model_fields_set
        and _value(payload.status) != "completed"
        and "completedAt" not in payload.model_fields_set
    ):
        row.completed_at = None
    await session.commit()
    await session.refresh(row)
    return _activity_schema(row)


@router.delete(
    "/{organizationId}/activities/{activityId}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteCrmActivity",
)
async def delete_activity(
    activity_id: UUID = Path(alias="activityId"),
    context: OrganizationContext = Depends(
        require_organization_permission("crm.delete", unsafe=True)
    ),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    """Delete one timeline activity."""

    row = await _activity_or_404(session, context.organization.id, activity_id)
    row.deleted_at = datetime.now(UTC)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
