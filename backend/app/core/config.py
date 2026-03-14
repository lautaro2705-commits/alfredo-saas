"""
Configuración — Alfredo (gestión de agencias de autos).
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import secrets


class Settings(BaseSettings):
    # ── Plataforma ──
    PROJECT_NAME: str = "Alfredo - Gestión de Agencias de Autos"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # ── Base de datos (PostgreSQL async, obligatorio) ──
    # La app DEBE conectar como saas_app (no-superuser) para que RLS funcione.
    # Superuser (postgres) BYPASEA RLS. Solo usar postgres para migraciones/seed.
    DATABASE_URL: str = "postgresql+asyncpg://saas_app:saas_app@localhost:5432/saas_platform"
    # URL admin para scripts de seed/migraciones (superuser, bypasses RLS)
    ADMIN_DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/saas_platform"

    # ── Redis (rate limiting, cache) ──
    REDIS_URL: str = "redis://localhost:6379"

    # ── JWT ──
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 min (refresh token extends session)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v, info):
        if v is None or v == "":
            import os
            if os.getenv("ENVIRONMENT", "development") != "development":
                raise ValueError(
                    "SECRET_KEY es obligatoria en producción. "
                    "Generar con: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            import warnings
            warnings.warn(
                "SECRET_KEY no configurada. Generando clave temporal (solo desarrollo).",
                UserWarning,
            )
            return secrets.token_urlsafe(32)
        return v

    # ── Rate Limiting ──
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    RATE_LIMIT_BURST: int = 20

    # ── Auth Rate Limiting (stricter) ──
    AUTH_RATE_LIMIT_REQUESTS: int = 5
    AUTH_RATE_LIMIT_WINDOW: int = 60  # 5 per minute

    # ── Scheduler ──
    SCHEDULER_ENABLED: bool = True

    # ── CORS ──
    CORS_ORIGINS: str = "*"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def validate_cors_origins(cls, v, info):
        """Block wildcard CORS in production — force explicit origins."""
        import os
        if os.getenv("ENVIRONMENT", "development") == "production":
            if not v or v.strip() == "*":
                raise ValueError(
                    "CORS_ORIGINS no puede ser '*' en producción. "
                    "Configurar: CORS_ORIGINS=https://tudominio.com,https://app.tudominio.com"
                )
        return v

    # ── Trial y Billing ──
    TRIAL_DAYS: int = 14
    MERCADOPAGO_ACCESS_TOKEN: Optional[str] = None
    MERCADOPAGO_PUBLIC_KEY: Optional[str] = None
    MERCADOPAGO_WEBHOOK_SECRET: Optional[str] = None

    # ── Monitoring (Sentry) ──
    SENTRY_DSN: Optional[str] = None

    # ── Email (Resend) ──
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "Alfredo <no-reply@alfredo.app>"

    # ── Integraciones ──
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MERCADOLIBRE_CLIENT_ID: Optional[str] = None
    MERCADOLIBRE_CLIENT_SECRET: Optional[str] = None
    MERCADOLIBRE_REDIRECT_URI: Optional[str] = None

    # ── Frontend ──
    FRONTEND_URL: Optional[str] = "http://localhost:3000"

    # ── Autos: alertas ──
    DIAS_STOCK_INMOVILIZADO: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> list:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
