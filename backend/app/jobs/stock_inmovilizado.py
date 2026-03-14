"""
Job: Digest diario de stock inmovilizado.

Se ejecuta diariamente a las 8:00. Envía un email-resumen al admin
listando las unidades que llevan más de DIAS_STOCK_INMOVILIZADO en stock.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.database import admin_session_maker
from app.core.email import send_stock_inmovilizado_digest
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.jobs.base import (
    get_active_tenants, get_tenant_admin_emails,
    is_already_sent, dedup_key,
    log_job_start, log_job_end, log_job_error,
)

logger = logging.getLogger("app.jobs.stock_inmovilizado")


async def job_stock_inmovilizado():
    """Daily digest of inmovilized stock per tenant."""
    job_id = "stock_inmovilizado"
    log_job_start(job_id)

    emails_sent = 0
    tenants_processed = 0
    threshold_date = date.today() - timedelta(days=settings.DIAS_STOCK_INMOVILIZADO)

    try:
        tenants = await get_active_tenants()

        for tenant in tenants:
            tenants_processed += 1

            key = dedup_key(job_id, tenant.id)
            if await is_already_sent(key):
                continue

            # Query directa con tenant_id explícito (bypass RLS)
            # Build data dicts INSIDE session to avoid detached instance access
            async with admin_session_maker() as session:
                result = await session.execute(
                    select(Unidad).where(
                        Unidad.tenant_id == tenant.id,
                        Unidad.deleted_at.is_(None),
                        Unidad.estado == EstadoUnidad.DISPONIBLE,
                        Unidad.fecha_ingreso <= threshold_date,
                    ).order_by(Unidad.fecha_ingreso.asc())
                )
                unidades = result.scalars().all()

                if not unidades:
                    continue

                # Armar datos del digest dentro del scope de la sesión
                items = []
                for u in unidades:
                    dias = (date.today() - u.fecha_ingreso).days
                    items.append({
                        "descripcion": f"{u.marca} {u.modelo} {u.anio}",
                        "dominio": u.dominio,
                        "dias_en_stock": dias,
                        "precio_publicado": u.precio_publicado,
                    })

            admins = await get_tenant_admin_emails(tenant.id)
            for admin in admins:
                sent = await send_stock_inmovilizado_digest(
                    to=admin["email"],
                    nombre=admin["nombre"],
                    nombre_agencia=tenant.nombre,
                    unidades=items,
                    threshold_days=settings.DIAS_STOCK_INMOVILIZADO,
                )
                if sent:
                    emails_sent += 1

        log_job_end(job_id, tenants_processed, emails_sent)

    except Exception as exc:
        log_job_error(job_id, exc)
