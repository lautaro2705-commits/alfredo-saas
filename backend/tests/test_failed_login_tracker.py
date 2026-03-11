"""Tests for failed login tracking and account lockout."""
import pytest
import fakeredis.aioredis
from app.core.config import settings
from app.core.security import failed_login_tracker as flt_module
from app.core.middleware import rate_limiting as rl_module


@pytest.fixture(autouse=True)
async def fake_redis_for_tracker(monkeypatch):
    """Replace real Redis with fakeredis for tracker + rate limiter."""
    server = fakeredis.aioredis.FakeServer()

    def fake_from_url(*args, **kwargs):
        # Preserve decode_responses kwarg for the tracker (uses True)
        decode = kwargs.get("decode_responses", False)
        return fakeredis.aioredis.FakeRedis(
            server=server, decode_responses=decode,
        )

    monkeypatch.setattr(flt_module.aioredis, "from_url", fake_from_url)
    monkeypatch.setattr(rl_module.aioredis, "from_url", fake_from_url)
    yield server


class TestFailedLoginTracker:
    """Account lockout after repeated failed logins."""

    @pytest.mark.asyncio
    async def test_first_failed_login_returns_401(self, client):
        """First failure returns normal 401, not lockout."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "anyone@test.com",
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_lockout_after_5_failures(self, client):
        """6th attempt returns 429 lockout."""
        email = "lockout-test@test.com"
        for i in range(5):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })

        # 6th attempt — should be locked
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 429
        assert "bloqueada" in resp.json()["detail"].lower() or "intentos" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_successful_login_resets_counter(
        self, client, user_a_admin, token_a, fake_redis_for_tracker,
    ):
        """Successful login resets the failure counter."""
        email = user_a_admin.email
        # Fail 3 times
        for i in range(3):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })

        # Succeed (TestPass123! is the password in conftest fixtures)
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200

        # Clear rate limit keys so they don't interfere with the second phase
        # (auth rate limit is 5/min, and we've already made 4 requests)
        r = fakeredis.aioredis.FakeRedis(
            server=fake_redis_for_tracker, decode_responses=False,
        )
        keys = await r.keys(b"rl:*")
        if keys:
            await r.delete(*keys)
        await r.aclose()

        # Counter reset — 3 more failures should NOT lock out
        for i in range(3):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        # 4th failure after reset — not yet locked (need 5)
        assert resp.status_code == 401
