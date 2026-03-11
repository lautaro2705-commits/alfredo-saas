"""
Security headers middleware (pure ASGI).
Adds OWASP-recommended headers to every HTTP response.

Uses raw ASGI instead of BaseHTTPMiddleware to avoid the known
Python 3.9 + Starlette bug where async generator dependencies
(like get_db) cause "No response returned" errors.
"""
from starlette.types import ASGIApp, Receive, Scope, Send


SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

# Pre-encode headers once (ASGI uses bytes)
_ENCODED_HEADERS = [
    (k.lower().encode(), v.encode()) for k, v in SECURITY_HEADERS.items()
]


class SecurityHeadersMiddleware:
    """Injects security headers into every HTTP response (pure ASGI)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(_ENCODED_HEADERS)
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
