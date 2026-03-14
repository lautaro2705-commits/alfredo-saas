"""
Utilidades compartidas para scheduled jobs.

Cada job itera tenants, consulta datos via admin_session_maker (bypasea RLS)
y envía emails. Redis keys con TTL previenen duplicados en reinicios.
"""
from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select

from app.core.config import settings
from app.core.database import admin_session_maker
from app.platform.models.tenant import Tenant
from app.platform.models.user import PlatformUser, RolUsuario

logger = logging.getLogger("app.jobs")


async def get_active_tenants() -> list:
    """
    Fetch all active tenants. Uses admin_session_maker to bypass RLS
    (jobs run without HTTP request context → no tenant_id in SET LOCAL).
    """
    async with admin_session_maker() as session:
        result = await session.execute(
            select(Tenant).where(Tenant.activa == True)  # noqa: E712
        )
        return result.scalars().all()


async def get_tenant_admin_emails(tenant_id: UUID) -> list[dict]:
    """
    Get admin users for a tenant. Returns list of {email, nombre}.
    """
    async with admin_session_maker() as session:
        result = await session.execute(
            select(PlatformUser).where(
                PlatformUser.tenant_id == tenant_id,
                PlatformUser.rol == RolUsuario.ADMIN,
                PlatformUser.activo == True,  # noqa: E712
            )
        )
        admins = result.scalars().all()
        return [{"email": a.email, "nombre": a.nombre} for a in admins]


# ── Deduplicación con Redis ──

async def is_already_sent(key: str, ttl_hours: int = 24) -> bool:
    """
    Redis-based deduplication. Returns True if this email was already
    dispatched (key exists). If not, sets key with TTL.

    Fail-open: si Redis no responde, retorna False → mejor duplicar
    un email que perder una alerta importante.
    """
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        full_key = f"alfredo:email_sent:{key}"
        exists = await r.exists(full_key)
        if not exists:
            await r.setex(full_key, ttl_hours * 3600, "1")
            await r.aclose()
            return False
        await r.aclose()
        return True
    except Exception as exc:
        logger.warning("Redis dedup check failed (will send anyway): %s", exc)
        return False


def dedup_key(job_id: str, tenant_id, extra: str = "") -> str:
    """
    Generate a dedup key scoped to job + tenant + today's date.
    Optional extra for finer granularity (e.g., days_left for trial).
    """
    today = date.today().isoformat()
    parts = [job_id, str(tenant_id), today]
    if extra:
        parts.append(extra)
    return ":".join(parts)


# ── Logging estructurado ──

def log_job_start(job_id: str):
    logger.info("JOB_START job=%s", job_id)


def log_job_end(job_id: str, tenants_processed: int, emails_sent: int):
    logger.info(
        "JOB_END job=%s tenants=%d emails_sent=%d",
        job_id, tenants_processed, emails_sent,
    )


def log_job_error(job_id: str, error: Exception):
    logger.error("JOB_ERROR job=%s error=%s", job_id, str(error), exc_info=True)
