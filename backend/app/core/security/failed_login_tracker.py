"""
Failed login tracker — brute-force protection.
Locks accounts after MAX_ATTEMPTS failures within LOCKOUT_WINDOW.
Uses Redis with hashed email keys (no PII stored).
"""
import hashlib
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("app.security")

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 900  # 15 minutes


def _make_key(ip: str, email: str) -> str:
    """Create Redis key from IP + hashed email (no PII in Redis)."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()[:16]
    return f"failed_login:{ip}:{email_hash}"


async def is_locked_out(ip: str, email: str) -> bool:
    """Check if this IP+email pair is currently locked out."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _make_key(ip, email)
        count = await r.get(key)
        return count is not None and int(count) >= MAX_ATTEMPTS
    except Exception:
        return False  # fail open
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def record_failed_login(ip: str, email: str) -> int:
    """Record a failed attempt. Returns the new count."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _make_key(ip, email)
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        results = await pipe.execute()
        count = results[0]
        if count >= MAX_ATTEMPTS:
            logger.warning(
                "Account locked out after %d failed attempts",
                count,
                extra={"ip": ip, "email_hash": key.split(":")[-1]},
            )
        return count
    except Exception:
        return 0  # fail open
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def reset_failed_logins(ip: str, email: str) -> None:
    """Clear failed login counter after successful login."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await r.delete(_make_key(ip, email))
    except Exception:
        pass  # fail open
    finally:
        try:
            await r.aclose()
        except Exception:
            pass
