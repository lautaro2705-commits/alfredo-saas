"""
Job: Digest semanal de documentación y VTV.

Se ejecuta los lunes a las 9:00. Envía un resumen con:
- Unidades con documentación incompleta (título, 08, VPA)
- Unidades con VTV por vencer en los próximos 30 días o ya vencida
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import admin_session_maker
from app.core.email import send_documentacion_digest
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.documentacion import ChecklistDocumentacion
from app.jobs.base import (
    get_active_tenants, get_tenant_admin_emails,
    is_already_sent, dedup_key,
    log_job_start, log_job_end, log_job_error,
)

logger = logging.getLogger("app.jobs.documentacion")


async def job_documentacion_digest():
    """Weekly digest of missing documentation and expiring VTV."""
    job_id = "documentacion_digest"
    log_job_start(job_id)

    emails_sent = 0
    tenants_processed = 0
    hoy = date.today()
    vtv_limite = hoy + timedelta(days=30)

    try:
        tenants = await get_active_tenants()

        for tenant in tenants:
            tenants_processed += 1

            # Dedup semanal (TTL 7 días)
            key = dedup_key(job_id, tenant.id)
            if await is_already_sent(key, ttl_hours=168):
                continue

            # Build data dicts INSIDE session to avoid detached instance access
            async with admin_session_maker() as session:
                result = await session.execute(
                    select(Unidad)
                    .options(selectinload(Unidad.checklist_documentacion))
                    .where(
                        Unidad.tenant_id == tenant.id,
                        Unidad.deleted_at.is_(None),
                        Unidad.estado != EstadoUnidad.VENDIDO,
                    )
                )
                unidades = result.scalars().all()

                docs_pendientes = []
                vtv_alertas = []

                for u in unidades:
                    doc = u.checklist_documentacion
                    if not doc:
                        continue

                    # Documentación incompleta
                    if not doc.documentacion_completa:
                        docs_pendientes.append({
                            "unidad": f"{u.marca} {u.modelo} {u.anio} ({u.dominio})",
                            "items": doc.items_pendientes[:5],
                        })

                    # VTV por vencer o vencida
                    if doc.vtv_fecha_vencimiento and doc.vtv_fecha_vencimiento <= vtv_limite:
                        dias = (doc.vtv_fecha_vencimiento - hoy).days
                        vtv_alertas.append({
                            "unidad": f"{u.marca} {u.modelo} {u.anio} ({u.dominio})",
                            "fecha_vtv": doc.vtv_fecha_vencimiento.isoformat(),
                            "dias": dias,
                            "vencida": dias < 0,
                        })

            if not docs_pendientes and not vtv_alertas:
                continue

            admins = await get_tenant_admin_emails(tenant.id)
            for admin in admins:
                sent = await send_documentacion_digest(
                    to=admin["email"],
                    nombre=admin["nombre"],
                    nombre_agencia=tenant.nombre,
                    docs_pendientes=docs_pendientes,
                    vtv_alertas=vtv_alertas,
                )
                if sent:
                    emails_sent += 1

        log_job_end(job_id, tenants_processed, emails_sent)

    except Exception as exc:
        log_job_error(job_id, exc)
