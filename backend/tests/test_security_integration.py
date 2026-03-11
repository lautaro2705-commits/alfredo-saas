"""Integration smoke tests — verify all security layers work together."""
import pytest
import fakeredis.aioredis
from app.core.security import failed_login_tracker as flt_module
from app.core.middleware import rate_limiting as rl_module


@pytest.fixture(autouse=True)
async def fake_redis_for_integration(monkeypatch):
    """Replace real Redis with fakeredis for all security components."""
    server = fakeredis.aioredis.FakeServer()

    def fake_from_url(*args, **kwargs):
        decode = kwargs.get("decode_responses", False)
        return fakeredis.aioredis.FakeRedis(
            server=server, decode_responses=decode,
        )

    monkeypatch.setattr(flt_module.aioredis, "from_url", fake_from_url)
    monkeypatch.setattr(rl_module.aioredis, "from_url", fake_from_url)
    yield server


class TestSecurityStack:
    """All security layers work in concert."""

    @pytest.mark.asyncio
    async def test_healthy_request_gets_all_protections(self, client):
        """A normal request passes through all layers."""
        resp = await client.get("/health")
        # SecurityHeaders
        assert resp.headers["X-Frame-Options"] == "DENY"
        # AuditLogger
        assert "X-Request-ID" in resp.headers

    @pytest.mark.asyncio
    async def test_login_with_strong_password_works(
        self, client, user_a_admin,
    ):
        """Login with valid credentials succeeds through all layers."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a_admin.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()
        # Security headers present on auth endpoint too
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert "X-Request-ID" in resp.headers

    @pytest.mark.asyncio
    async def test_brute_force_triggers_lockout(self, client):
        """5 wrong passwords trigger lockout (429) before global rate limit."""
        email = "bruteforce-integration@test.com"
        for i in range(5):
            resp = await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })
            assert resp.status_code == 401

        # 6th: lockout
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 429
        body = resp.json()["detail"].lower()
        assert "bloqueada" in body or "intentos" in body
