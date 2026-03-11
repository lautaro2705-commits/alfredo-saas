"""Tests for rate limiting middleware."""
import pytest
import fakeredis.aioredis
from app.core.config import settings
from app.core.middleware import rate_limiting as rl_module


@pytest.fixture(autouse=True)
async def fake_redis(monkeypatch):
    """Replace real Redis with in-memory fakeredis for all rate limit tests."""
    server = fakeredis.aioredis.FakeServer()

    original_from_url = rl_module.aioredis.from_url

    def fake_from_url(*args, **kwargs):
        return fakeredis.aioredis.FakeRedis(server=server, decode_responses=False)

    monkeypatch.setattr(rl_module.aioredis, "from_url", fake_from_url)
    yield server


class TestGlobalRateLimit:
    """Global rate limiting protects all endpoints."""

    @pytest.mark.asyncio
    async def test_normal_request_passes(self, client):
        """Single request is never rate limited."""
        resp = await client.get("/health")
        assert resp.status_code != 429

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(self, client):
        """Exceeding global limit returns 429 with Retry-After."""
        # Use a non-excluded endpoint (/health is excluded from rate limiting)
        for i in range(105):
            resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

    @pytest.mark.asyncio
    async def test_429_response_body(self, client):
        """429 response includes helpful message."""
        for i in range(105):
            resp = await client.get("/api/v1/auth/me")
        data = resp.json()
        assert "detail" in data


class TestAuthRateLimit:
    """Auth endpoints have stricter limits."""

    @pytest.mark.asyncio
    async def test_login_rate_limited_after_5(self, client):
        """Login allows max 5 requests per minute."""
        for i in range(7):
            resp = await client.post("/api/v1/auth/login", json={
                "email": "fake@test.com",
                "password": "WrongPassword1!",
            })
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_onboarding_rate_limited(self, client):
        """Onboarding shares auth rate limit."""
        for i in range(7):
            resp = await client.post("/api/v1/auth/onboarding", json={
                "nombre_agencia": "Spam Agency",
                "email_contacto": "spam@test.com",
                "admin_nombre": "Spam",
                "admin_apellido": "User",
                "admin_email": f"spam{i}@test.com",
                "admin_password": "MyStr0ng!Password",
            })
        assert resp.status_code == 429
