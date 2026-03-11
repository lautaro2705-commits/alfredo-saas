"""Tests for security headers middleware."""
import pytest
import httpx


class TestSecurityHeaders:
    """Every response must include hardening headers."""

    @pytest.mark.asyncio
    async def test_health_has_security_headers(self, client):
        """Even public endpoints get security headers."""
        resp = await client.get("/health")

        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert resp.headers["X-XSS-Protection"] == "1; mode=block"
        assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "max-age=" in resp.headers["Strict-Transport-Security"]
        assert "frame-ancestors" in resp.headers["Content-Security-Policy"]
        assert "camera=()" in resp.headers["Permissions-Policy"]

    @pytest.mark.asyncio
    async def test_api_endpoint_has_security_headers(self, client):
        """Authenticated endpoints also get headers (even on 401)."""
        resp = await client.get("/api/v1/auth/me")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"

    @pytest.mark.asyncio
    async def test_csp_blocks_framing(self, client):
        """CSP frame-ancestors prevents clickjacking."""
        resp = await client.get("/health")
        csp = resp.headers["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in csp

    @pytest.mark.asyncio
    async def test_hsts_includes_subdomains(self, client):
        """HSTS header enforces HTTPS on subdomains."""
        resp = await client.get("/health")
        hsts = resp.headers["Strict-Transport-Security"]
        assert "includeSubDomains" in hsts
