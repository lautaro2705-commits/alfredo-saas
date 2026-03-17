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

    # ── Start scheduler (alertas automáticas) ──
    from app.core.scheduler import start_scheduler, shutdown_scheduler
    await start_scheduler()

    yield

    # ── Shutdown scheduler ──
    await shutdown_scheduler()
    await engine.dispose()


# ── OpenAPI tag metadata (organiza Swagger UI por sección) ──
openapi_tags = [
    # Plataforma
    {"name": "auth", "description": "Autenticación, JWT tokens, password reset"},
    {"name": "billing", "description": "Suscripciones, planes, pagos con MercadoPago"},
    {"name": "admin", "description": "Administración de la plataforma (super-admin)"},
    # Stock
    {"name": "autos-unidades", "description": "Inventario de vehículos (CRUD, fotos, historial de costos)"},
    {"name": "autos-peritajes", "description": "Inspecciones vehiculares con scoring por sección"},
    {"name": "autos-documentacion", "description": "Checklist de documentación (08, VPA, VTV, título)"},
    {"name": "autos-archivos", "description": "Upload y gestión de archivos/fotos (Cloudinary)"},
    # Ventas
    {"name": "autos-operaciones", "description": "Operaciones de venta, toma, boletos"},
    {"name": "autos-clientes", "description": "Gestión de clientes"},
    {"name": "autos-interesados", "description": "Leads, matching automático con stock"},
    {"name": "autos-seguimientos", "description": "Follow-ups y recordatorios"},
    # Finanzas
    {"name": "autos-caja-diaria", "description": "Movimientos de caja, categorías, cierres diarios"},
    {"name": "autos-cheques", "description": "Cheques recibidos y emitidos (cartera, endosos, depósitos)"},
    {"name": "autos-costos-directos", "description": "Costos directos asociados a unidades"},
    {"name": "autos-gastos-mensuales", "description": "Gastos fijos mensuales de la agencia"},
    # Reportes & BI
    {"name": "autos-dashboard", "description": "KPIs, métricas rápidas, alertas activas"},
    {"name": "autos-reportes", "description": "Reportes de utilidad, stock, ventas, rentabilidad"},
    {"name": "autos-inteligencia", "description": "BI: ROI por marca/modelo, costo de oportunidad, repricing"},
    {"name": "autos-precios-mercado", "description": "Consulta y cache de precios de mercado"},
    # Integraciones
    {"name": "autos-mercadolibre", "description": "Publicación y sincronización con MercadoLibre"},
    # Otros
    {"name": "autos-proveedores", "description": "Gestión de proveedores y estadísticas"},
    {"name": "autos-usuarios", "description": "Usuarios del tenant, roles y permisos"},
    {"name": "autos-actividades", "description": "Log de actividad / auditoría"},
    {"name": "autos-busqueda", "description": "Búsqueda global cross-entidad"},
    {"name": "autos-marketing", "description": "Fichas de venta, compartir por WhatsApp"},
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
## Alfredo — API de gestión para agencias de autos

API REST multi-tenant para administrar stock, ventas, finanzas y documentación
de agencias automotrices argentinas.

### Autenticación
Todos los endpoints (excepto `/auth/login` y `/auth/onboarding`) requieren
un **Bearer token JWT** en el header `Authorization`.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Los tokens expiran en 15 minutos. Usar `/auth/refresh` para renovar.

### Multi-tenancy
Cada request opera dentro del contexto del tenant del usuario autenticado.
Los datos están aislados a nivel de base de datos mediante Row Level Security (RLS).

### Rate Limiting
- General: 100 requests/minuto
- Auth endpoints: 5 requests/minuto (protección anti brute-force)
    """,
    openapi_tags=openapi_tags,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
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


# ── Seed endpoint (temporal, protegido por SECRET_KEY) ──
@app.post("/internal/seed")
async def run_seed(secret: str = ""):
    """Inicializar DB con datos de seed. Requiere SECRET_KEY como parámetro."""
    from fastapi.responses import JSONResponse
    if secret != settings.SECRET_KEY:
        return JSONResponse(content={"error": "unauthorized"}, status_code=403)

    from app.core.database import admin_engine, admin_session_maker, Base
    from app.core.security import get_password_hash
    from app.platform.models.tenant import Tenant, PlanTier, VERTICAL
    from app.platform.models.user import PlatformUser, RolUsuario
    from app.platform.models.subscription import Subscription, SubscriptionStatus
    from sqlalchemy import select
    from datetime import datetime, timedelta

    results = []

    # 1. Create tables
    async with admin_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    results.append("tables_created")

    # 2. Platform admin
    async with admin_session_maker() as db:
        existing = await db.execute(
            select(PlatformUser).where(PlatformUser.email == "superadmin@saas.com")
        )
        if not existing.scalar_one_or_none():
            platform_tenant = Tenant(
                nombre="Alfredo Platform", vertical=VERTICAL,
                email_contacto="superadmin@saas.com", plan=PlanTier.PREMIUM,
                activa=True, settings={"role": "platform"},
            )
            db.add(platform_tenant)
            await db.flush()
            admin = PlatformUser(
                tenant_id=platform_tenant.id, username="superadmin",
                email="superadmin@saas.com",
                hashed_password=get_password_hash("SuperAdmin2024!"),
                nombre="Super", apellido="Admin", rol=RolUsuario.ADMIN,
                is_platform_admin=True, activo=True,
            )
            db.add(admin)
            await db.commit()
            results.append("platform_admin_created")
        else:
            results.append("platform_admin_exists")

    # 3. Demo tenant
    async with admin_session_maker() as db:
        existing = await db.execute(
            select(PlatformUser).where(PlatformUser.email == "admin@demo.com")
        )
        if not existing.scalar_one_or_none():
            trial_end = datetime.utcnow() + timedelta(days=14)
            tenant = Tenant(
                nombre="Demo Automotores", vertical=VERTICAL,
                email_contacto="admin@demo.com", telefono="+54 11 5555-0001",
                plan=PlanTier.TRIAL, activa=True, trial_ends_at=trial_end,
                settings={"moneda_principal": "ARS", "timezone": "America/Argentina/Buenos_Aires"},
            )
            db.add(tenant)
            await db.flush()
            for email, user, last, rol in [
                ("admin@demo.com", "Admin", "Demo", RolUsuario.ADMIN),
                ("vendedor@demo.com", "Carlos", "Vendedor", RolUsuario.VENDEDOR),
            ]:
                db.add(PlatformUser(
                    tenant_id=tenant.id, username=email.split("@")[0],
                    email=email, hashed_password=get_password_hash("demo1234"),
                    nombre=user, apellido=last, rol=rol, activo=True,
                ))
            db.add(Subscription(
                tenant_id=tenant.id, plan=PlanTier.TRIAL.value,
                status=SubscriptionStatus.TRIAL, trial_end=trial_end,
                amount=0, currency="ARS",
            ))
            await db.commit()
            results.append("demo_tenant_created")
        else:
            results.append("demo_tenant_exists")

    return {"status": "ok", "results": results}

