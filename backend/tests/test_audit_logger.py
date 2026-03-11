"""Tests for audit logging middleware."""
import logging
import pytest


class TestAuditLogger:
    """Every request is logged with structured metadata."""

    @pytest.mark.asyncio
    async def test_request_is_logged(self, client, caplog):
        """Health check request produces an audit log entry."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        assert any("GET /health" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_log_includes_status_code(self, client, caplog):
        """Audit log includes HTTP status code."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            resp = await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "status_code")
        # status_code matches the actual response (may be 503 if Redis/DB down)
        assert record.status_code == resp.status_code

    @pytest.mark.asyncio
    async def test_log_includes_duration(self, client, caplog):
        """Audit log includes request duration."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "duration_ms")
        assert record.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_log_includes_request_id(self, client, caplog):
        """Each request gets a unique request ID."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "request_id")
        assert len(record.request_id) > 0

    @pytest.mark.asyncio
    async def test_failed_request_logged(self, client, caplog):
        """401 responses are also logged."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/api/v1/auth/me")
        records = [r for r in caplog.records if "/auth/me" in r.message]
        assert len(records) >= 1
