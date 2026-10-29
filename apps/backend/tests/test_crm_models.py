"""Contract tests for the first FlowSync CRM domain slice."""

from app.models import (
    Account,
    Activity,
    Contact,
    Deal,
    FlowActivityKind,
    FlowActivityStatus,
    FlowDealStage,
    SyncOperation,
    SyncRecordState,
)


def test_crm_models_are_discoverable_by_alembic() -> None:
    """All CRM aggregates expose organization ownership and stable tables."""

    assert Account.__tablename__ == "crm_accounts"
    assert Contact.__tablename__ == "crm_contacts"
    assert Deal.__tablename__ == "crm_deals"
    assert Activity.__tablename__ == "crm_activities"
    for model in (Account, Contact, Deal, Activity):
        assert "organization_id" in model.__table__.c
        assert "created_at" in model.__table__.c
        assert "updated_at" in model.__table__.c
        assert "deleted_at" in model.__table__.c


def test_sync_models_are_discoverable_by_alembic() -> None:
    """The operation log and merge state are part of the application metadata."""

    assert SyncOperation.__tablename__ == "sync_operations"
    assert SyncRecordState.__tablename__ == "sync_record_states"


def test_crm_lifecycle_enums_keep_the_api_vocabulary_small() -> None:
    """The online foundation uses explicit values suitable for sync later."""

    assert {item.value for item in FlowDealStage} == {
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
    }
    assert {item.value for item in FlowActivityKind} == {
        "call",
        "email",
        "meeting",
        "task",
        "note",
    }
    assert {item.value for item in FlowActivityStatus} == {"planned", "completed", "cancelled"}
