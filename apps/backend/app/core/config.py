"""Environment-backed application settings.

Keeping configuration in one Pydantic model gives local, test, staging, and
production processes the same validation rules while allowing secrets to be
injected through environment variables instead of source control.
"""

from datetime import date
from functools import lru_cache
from typing import Literal
from urllib.parse import quote

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated runtime configuration for the API process."""

    # General process identity and environment selection.
    app_name: str = "User Management API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    # These values are shared with Docker Compose for the local PostgreSQL
    # container. They also allow the safe .env.example DATABASE_URL template
    # to be resolved by the API process, because Pydantic does not expand
    # ${VARIABLE} references inside dotenv values automatically.
    postgres_db: str = "user_management"
    postgres_user: str = "anthropic"
    postgres_password: str | None = None
    # SQLAlchemy uses the asyncpg driver for PostgreSQL connections.
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/user_management"

    # Browser security settings: only configured frontend origins may use the
    # credentialed CORS path.
    frontend_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
        ]
    )
    trusted_hosts: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"]
    )
    trusted_proxy_ips: list[str] = Field(default_factory=list)

    # Session, correlation, and cookie policy settings.
    request_id_header: str = "X-Request-ID"
    session_cookie_name: str = "session_id"
    session_cookie_secure: bool = False
    session_cookie_same_site: Literal["lax", "strict", "none"] = "lax"
    session_ttl_seconds: int = Field(default=3600, ge=300, le=2_592_000)
    password_reset_ttl_seconds: int = Field(default=1800, ge=300, le=86_400)
    email_verification_ttl_seconds: int = Field(default=86_400, ge=900, le=604_800)
    login_max_attempts: int = Field(default=5, ge=1, le=20)
    login_lockout_seconds: int = Field(default=900, ge=60, le=86_400)

    # Rate limits are local-memory by default and Redis-backed when configured.
    rate_limit_enabled: bool = True
    rate_limit_requests: int = Field(default=120, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)
    rate_limit_login_requests: int = Field(default=5, ge=1)
    redis_url: str | None = None
    # Optional local/test bootstrap. Production credentials must come from a
    # secret manager or another approved provisioning workflow.
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    bootstrap_admin_name: str = "Administrator"
    bootstrap_admin_birth_date: date = date(1980, 1, 1)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def resolve_database_url_and_validate(self) -> "Settings":
        """Resolve local dotenv templates and validate runtime safety rules."""

        # Docker Compose expands this template itself, but Pydantic Settings
        # intentionally leaves it literal. Resolve it here so Alembic and the
        # FastAPI process connect with exactly the same local credentials.
        if "${" in self.database_url:
            if not self.postgres_password:
                raise ValueError(
                    "POSTGRES_PASSWORD is required when DATABASE_URL uses the local template"
                )
            encoded_user = quote(self.postgres_user, safe="")
            encoded_password = quote(self.postgres_password, safe="")
            self.database_url = (
                f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
                f"@localhost:5432/{self.postgres_db}"
            )

        if self.environment == "production" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true in production")
        if self.session_cookie_same_site == "none" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true when SameSite=None")
        if (
            self.environment in {"staging", "production"}
            and self.rate_limit_enabled
            and not self.redis_url
        ):
            raise ValueError("REDIS_URL is required for rate limiting outside local/test")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings object used by the application factory."""

    return Settings()
