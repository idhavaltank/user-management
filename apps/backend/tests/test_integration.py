"""End-to-end API contract tests against a real migrated PostgreSQL database."""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings
from app.core.security import hash_token
from app.main import create_app
from app.models.session import UserSession

pytestmark = pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"),
    reason="Set TEST_DATABASE_URL after applying the Alembic migration to run PostgreSQL tests.",
)


def test_authenticated_crud_contract_against_postgresql() -> None:
    """Exercise authentication, CSRF, CRUD, invariants, logout, and expiry."""

    database_url = os.environ["TEST_DATABASE_URL"]
    admin_email = "integration-admin@example.com"
    admin_password = "integration-admin-password"
    settings = Settings(
        environment="test",
        database_url=database_url,
        trusted_hosts=["testserver"],
        rate_limit_enabled=False,
        bootstrap_admin_email=admin_email,
        bootstrap_admin_password=admin_password,
    )

    # TestClient drives the real FastAPI lifespan, including bootstrap admin
    # creation, while TEST_DATABASE_URL keeps this database explicitly scoped.
    with TestClient(create_app(settings)) as client:
        # Protected reads fail before login, proving the session dependency is
        # attached to the users router.
        assert client.get("/api/v1/users").status_code == 401

        invalid_login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": "wrong-integration-password"},
        )
        assert invalid_login.status_code == 401
        assert invalid_login.json()["code"] == "invalid_credentials"

        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password},
        )
        assert login.status_code == 200
        csrf = login.json()["csrfToken"]

        payload = {
            "name": "Integration User",
            "email": f"integration-{uuid4()}@example.com",
            "gender": "Men",
            "birthDate": "1988-03-02",
            "college": "Integration College",
            "address": "1 Test Street",
            "hobbies": ["Reading"],
            "customHobbies": [],
            "role": "user",
        }
        # Unsafe operations require CSRF even after authentication.
        assert client.post("/api/v1/users", json=payload).status_code == 403

        created = client.post(
            "/api/v1/users", json=payload, headers={"X-CSRF-Token": csrf}
        )
        assert created.status_code == 201
        user_id = created.json()["id"]

        privileged_profile = {
            **payload,
            "email": f"privileged-{uuid4()}@example.com",
            "role": "admin",
        }
        role_change = client.post(
            "/api/v1/users", json=privileged_profile, headers={"X-CSRF-Token": csrf}
        )
        assert role_change.status_code == 403
        assert role_change.json()["code"] == "role_management_required"

        fetched = client.get(f"/api/v1/users/{user_id}")
        assert fetched.status_code == 200
        assert fetched.json()["email"] == payload["email"]

        duplicate = client.post(
            "/api/v1/users", json=payload, headers={"X-CSRF-Token": csrf}
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "email_conflict"

        listed = client.get("/api/v1/users", params={"search": "integration", "pageSize": 10})
        assert listed.status_code == 200
        assert listed.json()["total"] >= 1

        updated = client.patch(
            f"/api/v1/users/{user_id}",
            json={"name": "Updated Integration User"},
            headers={"X-CSRF-Token": csrf},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated Integration User"

        deleted = client.delete(
            f"/api/v1/users/{user_id}", headers={"X-CSRF-Token": csrf}
        )
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/users/{user_id}").status_code == 404

        logout = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        assert logout.status_code == 204
        assert client.get("/api/v1/auth/me").status_code == 401

        second_login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password},
        )
        assert second_login.status_code == 200
        session_token = client.cookies.get("session_id")
        assert session_token

        # Expire the persisted session directly to verify every request checks
        # the database expiry boundary instead of trusting the cookie lifetime.
        engine = create_async_engine(database_url)

        async def expire_session() -> None:
            async with engine.begin() as connection:
                await connection.execute(
                    update(UserSession)
                    .where(UserSession.token_hash == hash_token(session_token))
                    .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
                )
            await engine.dispose()

        asyncio.run(expire_session())
        assert client.get("/api/v1/auth/me").status_code == 401


def test_profile_image_upload_contract_against_postgresql(tmp_path) -> None:
    """Exercise account/contact image upload, retrieval, rejection, and delete."""

    database_url = os.environ["TEST_DATABASE_URL"]
    admin_email = "media-integration-admin@example.com"
    admin_password = "media-integration-admin-password"
    settings = Settings(
        environment="test",
        database_url=database_url,
        trusted_hosts=["testserver"],
        rate_limit_enabled=False,
        media_storage_path=str(tmp_path),
        bootstrap_admin_email=admin_email,
        bootstrap_admin_password=admin_password,
    )

    png = b"\x89PNG\r\n\x1a\nprofile-image-fixture"
    with TestClient(create_app(settings)) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password},
        )
        assert login.status_code == 200
        csrf = login.json()["csrfToken"]
        headers = {"X-CSRF-Token": csrf}

        organizations = client.get("/api/v1/organizations")
        assert organizations.status_code == 200
        organization_id = organizations.json()["items"][0]["id"]

        account = client.post(
            f"/api/v1/organizations/{organization_id}/accounts",
            json={"name": f"Media Account {uuid4()}"},
            headers=headers,
        )
        assert account.status_code == 201
        account_id = account.json()["id"]

        contact = client.post(
            f"/api/v1/organizations/{organization_id}/contacts",
            json={"firstName": "Media", "lastName": "Contact"},
            headers=headers,
        )
        assert contact.status_code == 201
        contact_id = contact.json()["id"]

        account_upload = client.post(
            f"/api/v1/organizations/{organization_id}/accounts/{account_id}/profile-image",
            files={"file": ("account.png", png, "image/png")},
            headers=headers,
        )
        assert account_upload.status_code == 200
        assert account_upload.json()["profileImageUrl"].endswith("/profile-image")

        account_image = client.get(
            f"/api/v1/organizations/{organization_id}/accounts/{account_id}/profile-image"
        )
        assert account_image.status_code == 200
        assert account_image.headers["content-type"] == "image/png"
        assert account_image.content == png

        invalid_upload = client.post(
            f"/api/v1/organizations/{organization_id}/contacts/{contact_id}/profile-image",
            files={"file": ("contact.txt", b"not-an-image", "text/plain")},
            headers=headers,
        )
        assert invalid_upload.status_code == 422
        assert invalid_upload.json()["code"] == "invalid_profile_image"

        contact_upload = client.post(
            f"/api/v1/organizations/{organization_id}/contacts/{contact_id}/profile-image",
            files={"file": ("contact.png", png, "image/png")},
            headers=headers,
        )
        assert contact_upload.status_code == 200
        assert contact_upload.json()["profileImageUrl"].endswith("/profile-image")

        deleted = client.delete(
            f"/api/v1/organizations/{organization_id}/accounts/{account_id}/profile-image",
            headers=headers,
        )
        assert deleted.status_code == 204
        assert (
            client.get(
                f"/api/v1/organizations/{organization_id}/accounts/{account_id}/profile-image"
            ).status_code
            == 404
        )
