"""
Audit Logger Middleware (pure ASGI).
Logs every HTTP request with structured metadata.
Does NOT log request/response bodies (privacy by design).

Uses raw ASGI instead of BaseHTTPMiddleware to avoid the known
Python 3.9 + Starlette bug with async generator dependencies.
"""
import time
import uuid
import logging
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("app.audit")


class AuditLoggerMiddleware:
    """Log every request with method, path, status, duration, IP (pure ASGI)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())[:8]
        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        # Extract info from scope
        method = scope.get("method", "?")
        path = scope.get("path", "?")
        headers_raw = dict(scope.get("headers", []))
        forwarded = headers_raw.get(b"x-forwarded-for", b"").decode()
        client_ip = forwarded.split(",")[0].strip() if forwarded else ""
        if not client_ip:
            client = scope.get("client")
            client_ip = client[0] if client else "unknown"
        user_agent = headers_raw.get(b"user-agent", b"").decode()

        start = time.perf_counter()
        status_code = 500  # default if exception

        async def send_with_logging(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                # Inject X-Request-ID header
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_logging)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(
                "%s %s 500 (unhandled exception)",
                method, path,
                extra={
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "ip": client_ip,
                    "user_agent": user_agent,
                },
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        log_level = logging.WARNING if status_code >= 400 else logging.INFO

        logger.log(
            log_level,
            "%s %s %d %.1fms",
            method, path, status_code, duration_ms,
            extra={
                "request_id": request_id,
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "ip": client_ip,
                "user_agent": user_agent,
            },
        )
