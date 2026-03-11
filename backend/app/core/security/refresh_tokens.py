"""
Refresh tokens — opaque tokens stored in Redis with TTL.

Each refresh token maps to a user_id + tenant_id. On use, the token
is rotated (old deleted, new created) to detect stolen tokens.

Redis key format: refresh_token:{token} → JSON { user_id, tenant_id }
TTL: settings.REFRESH_TOKEN_EXPIRE_DAYS (default 7 days)
"""
import json
import secrets
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings

REFRESH_PREFIX = "refresh_token:"
REFRESH_TTL = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400  # days → seconds


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def create_refresh_token(user_id: str, tenant_id: str) -> str:
    """Generate an opaque refresh token and store in Redis with TTL."""
    token = secrets.token_urlsafe(48)
    r = await _get_redis()
    try:
        await r.setex(
            f"{REFRESH_PREFIX}{token}",
            REFRESH_TTL,
            json.dumps({"user_id": user_id, "tenant_id": tenant_id}),
        )
    finally:
        await r.aclose()
    return token


async def validate_refresh_token(token: str) -> Optional[dict]:
    """
    Validate and consume a refresh token (one-time use).
    Returns {"user_id": ..., "tenant_id": ...} or None if invalid/expired.
    The token is deleted after validation (rotation: caller must create a new one).
    """
    r = await _get_redis()
    try:
        key = f"{REFRESH_PREFIX}{token}"
        raw = await r.get(key)
        if not raw:
            return None
        # Delete immediately (one-time use → rotation)
        await r.delete(key)
        return json.loads(raw)
    finally:
        await r.aclose()


async def revoke_refresh_token(token: str) -> None:
    """Explicitly revoke a refresh token (used on logout)."""
    r = await _get_redis()
    try:
        await r.delete(f"{REFRESH_PREFIX}{token}")
    finally:
        await r.aclose()
