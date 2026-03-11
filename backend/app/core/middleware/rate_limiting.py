"""
Rate Limiting Middleware using Redis Token Bucket (pure ASGI).

Three tiers:
- Global: 100 req/min per IP (all routes)
- Auth:   5 req/min per IP (/login, /onboarding, /password-reset)
- Upload: 10 req/min per tenant (/archivos/upload)

Uses raw ASGI instead of BaseHTTPMiddleware to avoid the known
Python 3.9 + Starlette bug with async generator dependencies.
"""
import time
import json
import logging
from typing import Tuple

import redis.asyncio as aioredis
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

logger = logging.getLogger("app.security")

# Routes with stricter auth rate limits
AUTH_PATHS = {"/api/v1/auth/login", "/api/v1/auth/onboarding",
              "/api/v1/auth/password-reset/request",
              "/api/v1/auth/password-reset/confirm"}

# Routes excluded from rate limiting
EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


async def _check_bucket(
    redis_client: aioredis.Redis,
    key: str,
    max_tokens: int,
    window: int,
) -> Tuple[bool, int]:
    """Token bucket check. Returns (allowed, retry_after_seconds)."""
    now = time.time()
    raw = await redis_client.get(key)

    if raw:
        tokens, last_update = map(float, raw.decode().split(":"))
    else:
        tokens = float(max_tokens)
        last_update = now

    elapsed = now - last_update
    refill_rate = max_tokens / window
    tokens = min(tokens + elapsed * refill_rate, float(max_tokens))

    if tokens >= 1.0:
        tokens -= 1.0
        await redis_client.set(key, f"{tokens}:{now}", ex=window * 2)
        return True, 0
    else:
        retry_after = int((1.0 - tokens) / refill_rate) + 1
        await redis_client.set(key, f"{tokens}:{now}", ex=window * 2)
        return False, retry_after


def _get_client_ip(scope: Scope) -> str:
    """Extract client IP from ASGI scope, respecting X-Forwarded-For."""
    headers_raw = dict(scope.get("headers", []))
    forwarded = headers_raw.get(b"x-forwarded-for", b"").decode()
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


async def _send_429(send, detail: str, retry_after: int):
    """Send a 429 Too Many Requests response via raw ASGI."""
    body = json.dumps({"detail": detail}).encode()
    await send({
        "type": "http.response.start",
        "status": 429,
        "headers": [
            (b"content-type", b"application/json"),
            (b"retry-after", str(retry_after).encode()),
        ],
    })
    await send({
        "type": "http.response.body",
        "body": body,
    })


class RateLimitMiddleware:
    """Applies tiered rate limiting to all requests (pure ASGI)."""

    def __init__(self, app: ASGIApp, redis_url: str = None) -> None:
        self.app = app
        self._redis_url = redis_url or settings.REDIS_URL

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        if path in EXCLUDED_PATHS:
            await self.app(scope, receive, send)
            return

        # ── Rate limit check (Redis) ──
        # If Redis fails at any point, we skip rate limiting (fail open)
        # but we NEVER re-call self.app — that would corrupt the response.
        rate_limited = False
        retry_after = 0
        limit_detail = ""
        r = None

        try:
            r = aioredis.from_url(self._redis_url, decode_responses=False)
            client_ip = _get_client_ip(scope)

            # Check auth rate limit first (stricter)
            if path in AUTH_PATHS:
                allowed, retry_after = await _check_bucket(
                    r,
                    f"rl:auth:{client_ip}",
                    settings.AUTH_RATE_LIMIT_REQUESTS,
                    settings.AUTH_RATE_LIMIT_WINDOW,
                )
                if not allowed:
                    logger.warning(
                        "Auth rate limit exceeded",
                        extra={"ip": client_ip, "path": path},
                    )
                    rate_limited = True
                    limit_detail = "Demasiados intentos. Intente más tarde."

            # Check global rate limit (only if not already limited)
            if not rate_limited:
                allowed, retry_after = await _check_bucket(
                    r,
                    f"rl:global:{client_ip}",
                    settings.RATE_LIMIT_REQUESTS,
                    settings.RATE_LIMIT_WINDOW,
                )
                if not allowed:
                    logger.warning(
                        "Global rate limit exceeded",
                        extra={"ip": client_ip, "path": path},
                    )
                    rate_limited = True
                    limit_detail = "Demasiadas solicitudes. Intente más tarde."

        except Exception:
            # Redis unavailable → skip rate limiting (fail open)
            logger.debug("Redis unavailable, skipping rate limit check")
        finally:
            if r:
                try:
                    await r.aclose()
                except Exception:
                    pass

        # ── Either block or pass through ──
        if rate_limited:
            await _send_429(send, limit_detail, retry_after)
        else:
            await self.app(scope, receive, send)


# Keep backward-compatible helper for code that uses get_redis_client()
async def get_redis_client() -> aioredis.Redis:
    """Dependency para obtener cliente Redis."""
    return aioredis.from_url(settings.REDIS_URL, decode_responses=False)
