from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import date, datetime
from zoneinfo import ZoneInfo
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.caja_diaria import CajaDiaria, CierreCaja, TipoMovimiento, CategoriaGasto
from app.verticals.autos.models.costo_directo import CostoDirecto
from app.verticals.autos.models.operacion import Operacion, EstadoOperacion
from app.verticals.autos.schemas.caja_diaria import (
    CajaDiariaCreate,
    CajaDiariaResponse,
    CierreCajaCreate,
    CierreCajaResponse,
    ResumenCajaDiaria
)
from app.verticals.autos.models.actividad import registrar_actividad, AccionActividad, EntidadActividad
from app.core.soft_delete import soft_delete

router = APIRouter(prefix="/autos/caja", tags=["autos-caja"])


@router.get("/movimientos/", response_model=List[CajaDiariaResponse])
async def listar_movimientos(
    tipo: Optional[TipoMovimiento] = None,
    categoria: Optional[CategoriaGasto] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar movimientos de caja con filtros"""
    stmt = select(CajaDiaria).where(CajaDiaria.active())

    if tipo:
        stmt = stmt.where(CajaDiaria.tipo == tipo)
    if categoria:
        stmt = stmt.where(CajaDiaria.categoria == categoria)
    if fecha_desde:
        stmt = stmt.where(CajaDiaria.fecha >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(CajaDiaria.fecha <= fecha_hasta)

    stmt = stmt.order_by(CajaDiaria.fecha.desc(), CajaDiaria.id.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/categorias")
async def listar_categorias_caja():
    """Listar categorías de movimientos de caja"""
    ingresos = []
    egresos = []

    for c in CategoriaGasto:
        item = {"value": c.value, "label": c.value.replace("_", " ").title()}
        if c.value in ["venta_unidad", "comision", "financiacion", "otros_ingresos"]:
            ingresos.append(item)
        else:
            egresos.append(item)

    return {"ingresos": ingresos, "egresos": egresos}


@router.get("/resumen-diario", response_model=ResumenCajaDiaria)
async def resumen_diario(
    fecha: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener resumen de caja de un día específico"""
    if not fecha:
        # Usar zona horaria de Argentina
        tz_argentina = ZoneInfo("America/Argentina/Buenos_Aires")
        fecha = datetime.now(tz_argentina).date()

    result = await db.execute(select(CajaDiaria).where(CajaDiaria.active(), CajaDiaria.fecha == fecha))
    movimientos = result.scalars().all()

    total_ingresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.INGRESO)
    total_egresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.EGRESO)

    return ResumenCajaDiaria(
        fecha=fecha,
        total_ingresos=total_ingresos,
        total_egresos=total_egresos,
        saldo=total_ingresos - total_egresos,
        cantidad_movimientos=len(movimientos)
    )


@router.post("/movimientos/", response_model=CajaDiariaResponse)
async def crear_movimiento(
    movimiento: CajaDiariaCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Registrar movimiento de caja"""
    db_movimiento = CajaDiaria(
        **movimiento.model_dump(),
        created_by=token.user_id
    )
    if not db_movimiento.fecha:
        tz_argentina = ZoneInfo("America/Argentina/Buenos_Aires")
        db_movimiento.fecha = datetime.now(tz_argentina).date()

    db.add(db_movimiento)
    await registrar_actividad(db, token.user_id, AccionActividad.CREAR, EntidadActividad.CAJA,  # TODO: make async
                        db_movimiento.id, f"Movimiento {movimiento.tipo}: ${movimiento.monto:,.0f} ({movimiento.categoria})")
    await db.commit()
    await db.refresh(db_movimiento)
    return db_movimiento


@router.delete("/movimientos/{movimiento_id}")
async def eliminar_movimiento(
    movimiento_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un movimiento de caja"""
    result = await db.execute(select(CajaDiaria).where(CajaDiaria.id == movimiento_id))
    movimiento = result.scalar_one_or_none()
    if not movimiento:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")

    if movimiento.cierre_caja_id:
        raise HTTPException(status_code=400, detail="No se puede eliminar un movimiento de un cierre cerrado")

    await soft_delete(db, movimiento, deleted_by=token.user_id)
    return {"mensaje": "Movimiento eliminado"}


# ==================== CIERRE DE CAJA ====================

@router.get("/cierres/", response_model=List[CierreCajaResponse])
async def listar_cierres(
    anio: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar cierres de caja"""
    stmt = select(CierreCaja).where(CierreCaja.active())
    if anio:
        stmt = stmt.where(CierreCaja.anio == anio)
    stmt = stmt.order_by(CierreCaja.anio.desc(), CierreCaja.mes.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/cierres/{mes}/{anio}", response_model=CierreCajaResponse)
async def obtener_cierre(
    mes: int,
    anio: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener cierre de un mes específico"""
    result = await db.execute(
        select(CierreCaja).where(
            CierreCaja.active(),
            CierreCaja.mes == mes,
            CierreCaja.anio == anio
        )
    )
    cierre = result.scalar_one_or_none()

    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    return cierre


@router.post("/cierres/calcular")
async def calcular_cierre(
    mes: int,
    anio: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Calcular (sin guardar) el cierre de un mes.
    Útil para previsualizar antes de confirmar.
    """
    from calendar import monthrange

    primer_dia = date(anio, mes, 1)
    ultimo_dia = date(anio, mes, monthrange(anio, mes)[1])

    # Movimientos de caja del mes
    result = await db.execute(
        select(CajaDiaria).where(
            CajaDiaria.active(),
            CajaDiaria.fecha >= primer_dia,
            CajaDiaria.fecha <= ultimo_dia
        )
    )
    movimientos = result.scalars().all()

    total_ingresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.INGRESO)
    total_egresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.EGRESO)

    # Operaciones completadas del mes
    result = await db.execute(
        select(Operacion).where(
            Operacion.active(),
            Operacion.fecha_operacion >= primer_dia,
            Operacion.fecha_operacion <= ultimo_dia,
            Operacion.estado == EstadoOperacion.COMPLETADA
        )
    )
    operaciones = result.scalars().all()

    # Calcular utilidad bruta de ventas
    total_ventas = sum(op.precio_venta for op in operaciones)
    total_costo_unidades = sum(op.unidad_vendida.costo_total for op in operaciones if op.unidad_vendida)

    utilidad_bruta = total_ventas - total_costo_unidades

    # Gastos fijos = egresos que no son de unidades específicas
    gastos_fijos = total_egresos

    utilidad_neta = utilidad_bruta - gastos_fijos

    return {
        "mes": mes,
        "anio": anio,
        "periodo": f"{mes:02d}/{anio}",
        "cantidad_ventas": len(operaciones),
        "total_ventas": total_ventas,
        "total_costo_unidades": total_costo_unidades,
        "utilidad_bruta": utilidad_bruta,
        "total_ingresos_caja": total_ingresos,
        "total_egresos_caja": total_egresos,
        "gastos_fijos": gastos_fijos,
        "utilidad_neta": utilidad_neta,
        "cantidad_movimientos": len(movimientos)
    }


@router.post("/cierres/", response_model=CierreCajaResponse)
async def crear_cierre(
    cierre: CierreCajaCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Crear y confirmar cierre de caja mensual.
    Una vez cerrado, los movimientos del mes no se pueden modificar.
    """
    from calendar import monthrange

    # Verificar que no exista cierre
    result = await db.execute(
        select(CierreCaja).where(
            CierreCaja.active(),
            CierreCaja.mes == cierre.mes,
            CierreCaja.anio == cierre.anio
        )
    )
    existente = result.scalar_one_or_none()

    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un cierre para este período")

    # Calcular totales
    primer_dia = date(cierre.anio, cierre.mes, 1)
    ultimo_dia = date(cierre.anio, cierre.mes, monthrange(cierre.anio, cierre.mes)[1])

    result = await db.execute(
        select(CajaDiaria).where(
            CajaDiaria.active(),
            CajaDiaria.fecha >= primer_dia,
            CajaDiaria.fecha <= ultimo_dia
        )
    )
    movimientos = result.scalars().all()

    total_ingresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.INGRESO)
    total_egresos = sum(m.monto for m in movimientos if m.tipo == TipoMovimiento.EGRESO)

    # Operaciones del mes
    result = await db.execute(
        select(Operacion).where(
            Operacion.active(),
            Operacion.fecha_operacion >= primer_dia,
            Operacion.fecha_operacion <= ultimo_dia,
            Operacion.estado == EstadoOperacion.COMPLETADA
        )
    )
    operaciones = result.scalars().all()

    total_ventas = sum(op.precio_venta for op in operaciones)
    total_costo_unidades = sum(op.unidad_vendida.costo_total for op in operaciones if op.unidad_vendida)

    # Costos directos del período
    result = await db.execute(
        select(func.sum(CostoDirecto.monto)).where(
            CostoDirecto.active(),
            CostoDirecto.fecha >= primer_dia,
            CostoDirecto.fecha <= ultimo_dia
        )
    )
    costos_directos = result.scalar() or 0

    utilidad_bruta = total_ventas - total_costo_unidades
    utilidad_neta = utilidad_bruta - total_egresos

    # Crear cierre
    db_cierre = CierreCaja(
        mes=cierre.mes,
        anio=cierre.anio,
        total_ingresos=total_ingresos,
        total_egresos=total_egresos,
        total_costos_directos=costos_directos,
        utilidad_bruta=utilidad_bruta,
        utilidad_neta=utilidad_neta,
        cerrado=True,
        fecha_cierre=datetime.now(),
        cerrado_by=token.user_id,
        observaciones=cierre.observaciones
    )

    db.add(db_cierre)

    # Vincular movimientos al cierre
    for mov in movimientos:
        mov.cierre_caja_id = db_cierre.id

    await db.commit()
    await db.refresh(db_cierre)

    return db_cierre
