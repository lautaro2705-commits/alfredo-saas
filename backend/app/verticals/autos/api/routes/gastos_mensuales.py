"""
Endpoint unificado de gastos mensuales.
Combina egresos de CajaDiaria y costos directos de unidades en una sola vista.
"""
import logging
from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenContext
from app.verticals.autos.models.caja_diaria import CajaDiaria, TipoMovimiento
from app.verticals.autos.models.costo_directo import CostoDirecto
from app.verticals.autos.schemas.gastos_mensuales import (
    GastosMensualesResponse,
    GastoUnificado,
    ResumenCategoria,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/autos/gastos", tags=["autos-gastos"])


@router.get("/mensuales", response_model=GastosMensualesResponse)
async def gastos_mensuales(
    mes: int = Query(..., ge=1, le=12, description="Mes (1-12)"),
    anio: int = Query(..., ge=2000, le=2100, description="Anio"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin")),
):
    """
    Detalle completo de todos los gastos de un mes.
    Combina egresos de CajaDiaria + costos directos de unidades.
    Solo admin.
    """
    primer_dia = date(anio, mes, 1)
    ultimo_dia = date(anio, mes, monthrange(anio, mes)[1])

    # 1) Egresos operativos (CajaDiaria)
    result = await db.execute(
        select(CajaDiaria)
        .where(
            CajaDiaria.fecha >= primer_dia,
            CajaDiaria.fecha <= ultimo_dia,
            CajaDiaria.tipo == TipoMovimiento.EGRESO,
        )
        .order_by(CajaDiaria.fecha.desc())
    )
    egresos_caja = result.scalars().all()

    # 2) Costos directos de unidades
    result = await db.execute(
        select(CostoDirecto)
        .options(selectinload(CostoDirecto.unidad))
        .where(
            CostoDirecto.fecha >= primer_dia,
            CostoDirecto.fecha <= ultimo_dia,
        )
        .order_by(CostoDirecto.fecha.desc())
    )
    costos = result.scalars().all()

    # Unificar en lista común
    gastos = []

    for e in egresos_caja:
        gastos.append(
            GastoUnificado(
                id=e.id,
                fecha=e.fecha,
                origen="operativo",
                categoria=e.categoria.value if hasattr(e.categoria, "value") else str(e.categoria),
                descripcion=e.descripcion,
                monto=e.monto,
                medio_pago=e.medio_pago,
                numero_comprobante=e.numero_comprobante,
            )
        )

    for c in costos:
        unidad_desc = None
        if c.unidad:
            unidad_desc = f"{c.unidad.marca} {c.unidad.modelo} ({c.unidad.dominio})"
        gastos.append(
            GastoUnificado(
                id=c.id,
                fecha=c.fecha,
                origen="directo",
                categoria=c.categoria.value if hasattr(c.categoria, "value") else str(c.categoria),
                descripcion=c.descripcion,
                monto=c.monto,
                unidad_id=c.unidad_id,
                unidad_descripcion=unidad_desc,
                proveedor=c.proveedor,
                numero_comprobante=c.numero_comprobante,
            )
        )

    gastos.sort(key=lambda g: (g.fecha, g.id), reverse=True)

    # Resumen por categoría
    cat_map: dict = {}
    for g in gastos:
        key = (g.categoria, g.origen)
        if key not in cat_map:
            cat_map[key] = {"total": 0.0, "cantidad": 0}
        cat_map[key]["total"] += g.monto
        cat_map[key]["cantidad"] += 1

    resumen_categorias = [
        ResumenCategoria(
            categoria=cat,
            origen=origen,
            total=round(data["total"], 2),
            cantidad=data["cantidad"],
        )
        for (cat, origen), data in sorted(
            cat_map.items(), key=lambda x: x[1]["total"], reverse=True
        )
    ]

    total_operativos = sum(e.monto for e in egresos_caja)
    total_directos = sum(c.monto for c in costos)

    return GastosMensualesResponse(
        mes=mes,
        anio=anio,
        periodo=f"{mes:02d}/{anio}",
        total_gastos_operativos=round(total_operativos, 2),
        total_costos_directos=round(total_directos, 2),
        gran_total=round(total_operativos + total_directos, 2),
        cantidad_gastos_operativos=len(egresos_caja),
        cantidad_costos_directos=len(costos),
        cantidad_total=len(gastos),
        resumen_por_categoria=resumen_categorias,
        gastos=gastos,
    )
