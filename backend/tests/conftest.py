"""
Test infrastructure — Alfredo.

Strategy:
- Uses the REAL database — RLS policies already applied.
- admin_engine (superuser) inserts test data, bypassing RLS.
- The FastAPI app connects via saas_app engine (RLS active).
- All test data is cleaned up after each test function.
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import httpx
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app as fastapi_app
from app.core.config import settings
from app.core.database import admin_session_maker
from app.core.security import create_access_token, get_password_hash
from app.platform.models.tenant import Tenant, PlanTier, VERTICAL
from app.platform.models.user import PlatformUser, RolUsuario
from app.platform.models.subscription import Subscription, SubscriptionStatus


# ── Session-scoped event loop ──
# Prevents "Event loop is closed" errors from asyncpg connections
# outliving function-scoped event loops.

@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for all async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


# ── Rate limit cleanup ──

@pytest.fixture(autouse=True)
async def flush_rate_limits():
    """Flush Redis rate-limit keys before each test to prevent 429s."""
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
        keys = await r.keys("rl:*")
        if keys:
            await r.delete(*keys)
        await r.aclose()
    except Exception:
        pass  # Redis may be unavailable in some test environments


# ── App + HTTP Client ──

@pytest.fixture
def app():
    return fastapi_app


@pytest.fixture
async def client(app):
    """Async HTTP client that talks to the FastAPI app in-process."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── Database (admin superuser session for setup/teardown) ──

@pytest.fixture
async def db_admin():
    """Admin session (postgres superuser) for test data setup.

    Uses autocommit-style: fixtures commit their inserts so the app
    (which uses a SEPARATE connection as saas_app) can see the data.
    Cleanup happens explicitly in each fixture's teardown.
    """
    async with admin_session_maker() as session:
        yield session


# ── Test tenants ──

@pytest.fixture
async def tenant_a(db_admin: AsyncSession):
    """Create test tenant A (autos vertical, profesional plan)."""
    t = Tenant(
        id=uuid.uuid4(),
        nombre="Test Motors A",
        vertical=VERTICAL,
        email_contacto="test_a@motors.com",
        plan=PlanTier.PROFESIONAL,
        activa=True,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_admin.add(t)
    await db_admin.commit()
    yield t
    # Cleanup: delete tenant and cascade
    await db_admin.execute(
        text(f"DELETE FROM tenants WHERE id = '{t.id}'")
    )
    await db_admin.commit()


@pytest.fixture
async def tenant_b(db_admin: AsyncSession):
    """Create test tenant B (autos vertical, basico plan)."""
    t = Tenant(
        id=uuid.uuid4(),
        nombre="Test Motors B",
        vertical=VERTICAL,
        email_contacto="test_b@motors.com",
        plan=PlanTier.BASICO,
        activa=True,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_admin.add(t)
    await db_admin.commit()
    yield t
    await db_admin.execute(
        text(f"DELETE FROM tenants WHERE id = '{t.id}'")
    )
    await db_admin.commit()


@pytest.fixture
async def tenant_trial_expired(db_admin: AsyncSession):
    """Tenant with expired trial (for plan limit tests)."""
    t = Tenant(
        id=uuid.uuid4(),
        nombre="Expired Trial Corp",
        vertical=VERTICAL,
        email_contacto="expired@test.com",
        plan=PlanTier.TRIAL,
        activa=True,
        trial_ends_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db_admin.add(t)
    await db_admin.commit()
    yield t
    await db_admin.execute(
        text(f"DELETE FROM tenants WHERE id = '{t.id}'")
    )
    await db_admin.commit()


@pytest.fixture
async def tenant_inactive(db_admin: AsyncSession):
    """Inactive tenant (should block login)."""
    t = Tenant(
        id=uuid.uuid4(),
        nombre="Inactive Corp",
        vertical=VERTICAL,
        email_contacto="inactive@test.com",
        plan=PlanTier.BASICO,
        activa=False,
    )
    db_admin.add(t)
    await db_admin.commit()
    yield t
    await db_admin.execute(
        text(f"DELETE FROM tenants WHERE id = '{t.id}'")
    )
    await db_admin.commit()


# ── Test users ──

@pytest.fixture
async def user_a_admin(db_admin: AsyncSession, tenant_a: Tenant):
    """Admin user for tenant A."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        username="admin_a",
        email=f"admin_a_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="Admin",
        apellido="TenantA",
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


@pytest.fixture
async def user_b_admin(db_admin: AsyncSession, tenant_b: Tenant):
    """Admin user for tenant B."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_b.id,
        username="admin_b",
        email=f"admin_b_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="Admin",
        apellido="TenantB",
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


@pytest.fixture
async def user_vendedor_a(db_admin: AsyncSession, tenant_a: Tenant):
    """Vendedor user for tenant A (limited permissions)."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        username="vendedor_a",
        email=f"vendedor_a_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="Vendedor",
        apellido="TenantA",
        rol=RolUsuario.VENDEDOR,
        activo=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


@pytest.fixture
async def user_inactive(db_admin: AsyncSession, tenant_a: Tenant):
    """Inactive user for tenant A (should block login)."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        username="inactive_user",
        email=f"inactive_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="Inactive",
        apellido="User",
        rol=RolUsuario.VENDEDOR,
        activo=False,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


@pytest.fixture
async def user_inactive_tenant(db_admin: AsyncSession, tenant_inactive: Tenant):
    """Active user belonging to an inactive tenant."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_inactive.id,
        username="user_inactive_tenant",
        email=f"inactive_tenant_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="User",
        apellido="InactiveTenant",
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


@pytest.fixture
async def platform_admin_user(db_admin: AsyncSession, tenant_a: Tenant):
    """Platform super-admin user."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_a.id,
        username="superadmin_test",
        email=f"superadmin_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("SuperAdmin!"),
        nombre="Super",
        apellido="Admin",
        rol=RolUsuario.ADMIN,
        activo=True,
        is_platform_admin=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    yield u


# ── JWT Tokens ──

def _make_token(user: PlatformUser, tenant: Tenant, **overrides) -> str:
    """Helper to create JWT token from user + tenant."""
    return create_access_token(
        user_id=str(user.id),
        username=user.username,
        tenant_id=str(tenant.id),
        tenant_name=tenant.nombre,
        vertical=tenant.vertical if isinstance(tenant.vertical, str) else tenant.vertical.value,
        rol=user.rol.value,
        plan=tenant.plan.value,
        permissions=user.permisos,
        is_platform_admin=user.is_platform_admin,
        **overrides,
    )


@pytest.fixture
def token_a(user_a_admin: PlatformUser, tenant_a: Tenant) -> str:
    """JWT for tenant A admin."""
    return _make_token(user_a_admin, tenant_a)


@pytest.fixture
def token_b(user_b_admin: PlatformUser, tenant_b: Tenant) -> str:
    """JWT for tenant B admin."""
    return _make_token(user_b_admin, tenant_b)


@pytest.fixture
def token_vendedor_a(user_vendedor_a: PlatformUser, tenant_a: Tenant) -> str:
    """JWT for tenant A vendedor."""
    return _make_token(user_vendedor_a, tenant_a)


@pytest.fixture
def platform_admin_token(platform_admin_user: PlatformUser, tenant_a: Tenant) -> str:
    """JWT for platform super-admin."""
    return _make_token(platform_admin_user, tenant_a)


@pytest.fixture
def expired_token(user_a_admin: PlatformUser, tenant_a: Tenant) -> str:
    """Expired JWT token."""
    return _make_token(
        user_a_admin, tenant_a,
        expires_delta=timedelta(seconds=-1),
    )


@pytest.fixture
async def token_trial_expired(db_admin, tenant_trial_expired):
    """Token for a tenant whose trial has expired."""
    u = PlatformUser(
        id=uuid.uuid4(),
        tenant_id=tenant_trial_expired.id,
        username="trial_expired_user",
        email=f"trial_expired_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=get_password_hash("TestPass123!"),
        nombre="Trial",
        apellido="Expired",
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db_admin.add(u)
    await db_admin.commit()
    return _make_token(u, tenant_trial_expired)


# ── Helper: auth header ──

def auth_header(token: str) -> dict:
    """Build Authorization header for requests."""
    return {"Authorization": f"Bearer {token}"}
