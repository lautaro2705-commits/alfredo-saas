"""
Job: Aviso de trial por vencer.

Se ejecuta diariamente a las 9:00. Envía email al admin del tenant
cuando faltan 3 días o cuando el trial vence hoy.
"""
import logging
from datetime import date, datetime

from app.core.email import send_trial_expiring
from app.platform.models.tenant import PlanTier
from app.jobs.base import (
    get_active_tenants, get_tenant_admin_emails,
    is_already_sent, dedup_key,
    log_job_start, log_job_end, log_job_error,
)

logger = logging.getLogger("app.jobs.trial_expiring")

# Enviar alerta a 3 días y el día del vencimiento
ALERT_DAYS = [3, 0]


async def job_trial_expiring():
    """Check all trial tenants and send expiry warnings."""
    job_id = "trial_expiring"
    log_job_start(job_id)

    emails_sent = 0
    tenants_processed = 0

    try:
        tenants = await get_active_tenants()

        for tenant in tenants:
            if tenant.plan != PlanTier.TRIAL:
                continue
            if not tenant.trial_ends_at:
                continue

            tenants_processed += 1

            # Calcular días restantes
            trial_end_date = (
                tenant.trial_ends_at.date()
                if isinstance(tenant.trial_ends_at, datetime)
                else tenant.trial_ends_at
            )
            days_left = (trial_end_date - date.today()).days

            if days_left not in ALERT_DAYS:
                continue

            # Dedup: un email por (tenant, fecha, dias_restantes)
            key = dedup_key(job_id, tenant.id, str(days_left))
            if await is_already_sent(key):
                logger.debug(
                    "Skipping (already sent): tenant=%s days_left=%d",
                    tenant.nombre, days_left,
                )
                continue

            # Enviar a todos los admins del tenant
            admins = await get_tenant_admin_emails(tenant.id)
            for admin in admins:
                sent = await send_trial_expiring(
                    to=admin["email"],
                    nombre=admin["nombre"],
                    days_left=days_left,
                )
                if sent:
                    emails_sent += 1
                    logger.info(
                        "Trial expiring email: tenant=%s to=%s days_left=%d",
                        tenant.nombre, admin["email"], days_left,
                    )

        log_job_end(job_id, tenants_processed, emails_sent)

    except Exception as exc:
        log_job_error(job_id, exc)
