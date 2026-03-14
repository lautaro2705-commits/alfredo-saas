"""
Job: Alerta diaria de cheques por vencer.

Se ejecuta diariamente a las 8:30. Envía un email al admin cuando hay
cheques recibidos o emitidos que vencen dentro de los próximos 3 días.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import admin_session_maker
from app.core.email import send_cheques_digest
from app.verticals.autos.models.cheque import (
    ChequeRecibido, ChequeEmitido,
    EstadoChequeRecibido, EstadoChequeEmitido,
)
from app.jobs.base import (
    get_active_tenants, get_tenant_admin_emails,
    is_already_sent, dedup_key,
    log_job_start, log_job_end, log_job_error,
)

logger = logging.getLogger("app.jobs.cheques_por_vencer")

DIAS_ALERTA = 3


async def job_cheques_por_vencer():
    """Daily alert for checks expiring within 3 days."""
    job_id = "cheques_por_vencer"
    log_job_start(job_id)

    emails_sent = 0
    tenants_processed = 0
    hoy = date.today()
    limite = hoy + timedelta(days=DIAS_ALERTA)

    try:
        tenants = await get_active_tenants()

        for tenant in tenants:
            tenants_processed += 1

            key = dedup_key(job_id, tenant.id)
            if await is_already_sent(key):
                continue

            async with admin_session_maker() as session:
                # Cheques recibidos en cartera por vencer
                result = await session.execute(
                    select(ChequeRecibido).where(
                        ChequeRecibido.tenant_id == tenant.id,
                        ChequeRecibido.deleted_at.is_(None),
                        ChequeRecibido.estado == EstadoChequeRecibido.EN_CARTERA,
                        ChequeRecibido.fecha_vencimiento >= hoy,
                        ChequeRecibido.fecha_vencimiento <= limite,
                    )
                )
                cheques_recibidos = result.scalars().all()

                # Cheques emitidos pendientes por debitar
                result = await session.execute(
                    select(ChequeEmitido).where(
                        ChequeEmitido.tenant_id == tenant.id,
                        ChequeEmitido.deleted_at.is_(None),
                        ChequeEmitido.estado == EstadoChequeEmitido.PENDIENTE,
                        ChequeEmitido.fecha_pago >= hoy,
                        ChequeEmitido.fecha_pago <= limite,
                    )
                )
                cheques_emitidos = result.scalars().all()

            if not cheques_recibidos and not cheques_emitidos:
                continue

            recibidos_data = [{
                "banco": c.banco,
                "numero": c.numero_cheque,
                "monto": c.monto,
                "emisor": c.emisor_nombre,
                "vencimiento": c.fecha_vencimiento.isoformat(),
                "dias": (c.fecha_vencimiento - hoy).days,
            } for c in cheques_recibidos]

            emitidos_data = [{
                "banco": c.banco,
                "numero": c.numero_cheque,
                "monto": c.monto,
                "beneficiario": c.beneficiario,
                "fecha_pago": c.fecha_pago.isoformat(),
                "dias": (c.fecha_pago - hoy).days,
            } for c in cheques_emitidos]

            admins = await get_tenant_admin_emails(tenant.id)
            for admin in admins:
                sent = await send_cheques_digest(
                    to=admin["email"],
                    nombre=admin["nombre"],
                    nombre_agencia=tenant.nombre,
                    cheques_recibidos=recibidos_data,
                    cheques_emitidos=emitidos_data,
                )
                if sent:
                    emails_sent += 1

        log_job_end(job_id, tenants_processed, emails_sent)

    except Exception as exc:
        log_job_error(job_id, exc)
