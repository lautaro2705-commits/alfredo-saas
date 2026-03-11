"""
Alfredo — Gestión de agencias de autos.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# ── Sentry (must init before FastAPI) ──
if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.VERSION,
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1,
        send_default_pii=False,  # GDPR safe
    )
from app.core.database import engine, Base

# Importar modelos para que SQLAlchemy los registre
from app.platform.models import (  # noqa: F401
    Tenant, PlatformUser, Subscription, PaymentRecord,
)
from app.verticals.autos.models import *  # noqa: F401,F403

# Rutas de la plataforma
from app.platform.routes.auth import router as auth_router
from app.platform.routes.billing import router as billing_router
from app.platform.routes.admin import router as admin_router

# Rutas de verticales
from app.verticals.autos.api.routes import autos_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: configurar logging, verificar dependencias. Shutdown: cerrar engine."""
    import logging
    from app.core.logging_config import setup_logging
    setup_logging()
    logger = logging.getLogger("app.startup")

    if settings.DEBUG:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # ── Production startup checks ──
    if settings.ENVIRONMENT == "production":
        # Redis MUST be reachable (rate limiting, brute-force protection)
        import redis.asyncio as aioredis
        try:
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await r.ping()
            await r.aclose()
            logger.info("Redis connection verified")
        except Exception as e:
            raise RuntimeError(
                f"Redis no accesible en producción ({e}). "
                f"Rate limiting y brute-force protection requieren Redis."
            ) from e

        # DB must be reachable
        from sqlalchemy import text as sa_text
        from app.core.database import async_session_maker
        try:
            async with async_session_maker() as session:
                await session.execute(sa_text("SELECT 1"))
            logger.info("PostgreSQL connection verified")
        except Exception as e:
            raise RuntimeError(
                f"PostgreSQL no accesible en producción ({e})."
            ) from e

        logger.info("All production startup checks passed ✓")

    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow_origins needs a list, not string.
# With allow_credentials=True, wildcard "*" won't work;
# in dev we explicitly allow localhost origins.
cors_origins = settings.cors_origins_list
if cors_origins == ["*"]:
    # Dev mode: allow common local origins
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security middleware stack ──
# Registration order is REVERSE of execution order in Starlette.
# Execution: AuditLogger → RateLimit → SecurityHeaders → CORS → Handler
from app.core.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

from app.core.middleware.rate_limiting import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

from app.core.middleware.audit_logger import AuditLoggerMiddleware
app.add_middleware(AuditLoggerMiddleware)

# ── Platform routes ──
app.include_router(auth_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")

# ── Autos vertical (22 routers, each with /autos/* prefix) ──
for router in autos_routers:
    app.include_router(router, prefix="/api/v1")


# ── Health check ──
@app.get("/health")
async def health():
    """
    Deep health check: verifica PostgreSQL + Redis.
    Retorna 503 si alguna dependencia falla.
    """
    from sqlalchemy import text as sa_text
    import redis.asyncio as aioredis
    from fastapi.responses import JSONResponse
    from app.core.database import async_session_maker

    checks = {"service": "alfredo"}

    # ── PostgreSQL ──
    try:
        async with async_session_maker() as session:
            await session.execute(sa_text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {type(e).__name__}"

    # ── Redis ──
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {type(e).__name__}"

    all_ok = checks.get("db") == "ok" and checks.get("redis") == "ok"
    checks["status"] = "ok" if all_ok else "degraded"

    status_code = 200 if all_ok else 503
    return JSONResponse(content=checks, status_code=status_code)

