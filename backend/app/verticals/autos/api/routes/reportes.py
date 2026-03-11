from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy import func, select
from typing import Optional
from datetime import date, datetime
from calendar import monthrange
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.operacion import Operacion, EstadoOperacion
from app.verticals.autos.models.caja_diaria import CajaDiaria, TipoMovimiento
from app.verticals.autos.models.costo_directo import CostoDirecto
from app.verticals.autos.models.usuario import RolUsuario
from app.verticals.autos.schemas.reportes import ReporteUtilidad, ReporteStock, UnidadVendida, UnidadStock

router = APIRouter(prefix="/autos/reportes", tags=["autos-reportes"])


@router.get("/utilidad", response_model=ReporteUtilidad)
async def reporte_utilidad(
    fecha_desde: date = Query(..., description="Fecha inicio del período"),
    fecha_hasta: date = Query(..., description="Fecha fin del período"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Reporte de utilidad bruta y neta.
    Solo accesible para administradores.
    """
    # Verificar permisos (solo admin puede ver utilidad)
    if token.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver reportes de utilidad"
        )

    # Operaciones completadas en el período
    result = await db.execute(
        select(Operacion).where(
            Operacion.fecha_operacion >= fecha_desde,
            Operacion.fecha_operacion <= fecha_hasta,
            Operacion.estado == EstadoOperacion.COMPLETADA
        )
    )
    operaciones = result.scalars().all()

    unidades_vendidas = []
    total_ventas = 0
    total_costo_adquisicion = 0
    total_costos_directos = 0
    total_gastos_transferencia = 0

    for op in operaciones:
        unidad = op.unidad_vendida
        if not unidad:
            continue

        costos_directos = sum(c.monto for c in unidad.costos_directos)
        costo_total = unidad.costo_total
        utilidad_bruta = op.precio_venta - costo_total
        margen = (utilidad_bruta / op.precio_venta * 100) if op.precio_venta > 0 else 0

        unidades_vendidas.append(UnidadVendida(
            id=unidad.id,
            marca=unidad.marca,
            modelo=unidad.modelo,
            anio=unidad.anio,
            dominio=unidad.dominio,
            fecha_venta=op.fecha_operacion,
            precio_compra=unidad.precio_compra,
            costos_directos=costos_directos,
            gastos_transferencia=unidad.gastos_transferencia or 0,
            costo_total=costo_total,
            precio_venta=op.precio_venta,
            utilidad_bruta=utilidad_bruta,
            margen_porcentaje=round(margen, 2)
        ))

        total_ventas += op.precio_venta
        total_costo_adquisicion += unidad.precio_compra
        total_costos_directos += costos_directos
        total_gastos_transferencia += unidad.gastos_transferencia or 0

    # Gastos fijos del período (caja diaria - egresos)
    result = await db.execute(
        select(func.sum(CajaDiaria.monto)).where(
            CajaDiaria.fecha >= fecha_desde,
            CajaDiaria.fecha <= fecha_hasta,
            CajaDiaria.tipo == TipoMovimiento.EGRESO
        )
    )
    gastos_fijos = result.scalar() or 0

    utilidad_bruta_total = total_ventas - total_costo_adquisicion - total_costos_directos - total_gastos_transferencia
    margen_bruto_promedio = (utilidad_bruta_total / total_ventas * 100) if total_ventas > 0 else 0

    utilidad_neta = utilidad_bruta_total - gastos_fijos
    margen_neto = (utilidad_neta / total_ventas * 100) if total_ventas > 0 else 0

    return ReporteUtilidad(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        cantidad_ventas=len(operaciones),
        total_ventas=total_ventas,
        total_costo_adquisicion=total_costo_adquisicion,
        total_costos_directos=total_costos_directos,
        total_gastos_transferencia=total_gastos_transferencia,
        utilidad_bruta_total=utilidad_bruta_total,
        margen_bruto_promedio=round(margen_bruto_promedio, 2),
        total_gastos_fijos=gastos_fijos,
        utilidad_neta=utilidad_neta,
        margen_neto=round(margen_neto, 2),
        unidades_vendidas=unidades_vendidas
    )


@router.get("/stock", response_model=ReporteStock)
async def reporte_stock(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Reporte de stock actual.
    Los vendedores no pueden ver costos de compra.
    """
    from app.verticals.autos.models.documentacion import ChecklistDocumentacion
    from app.core.config import settings

    es_admin = token.rol == RolUsuario.ADMIN

    result = await db.execute(
        select(Unidad).where(
            Unidad.estado != EstadoUnidad.VENDIDO
        )
    )
    unidades = result.scalars().all()

    unidades_stock = []
    valor_stock_costo = 0
    valor_stock_venta = 0
    total_dias = 0
    inmovilizadas = 0

    for unidad in unidades:
        result = await db.execute(
            select(ChecklistDocumentacion).where(
                ChecklistDocumentacion.unidad_id == unidad.id
            )
        )
        checklist = result.scalar_one_or_none()

        doc_completa = checklist.documentacion_completa if checklist else False
        items_pend = checklist.items_pendientes if checklist else ["Sin checklist"]

        costos_directos = sum(c.monto for c in unidad.costos_directos)

        # Margen esperado (solo para admin)
        margen = None
        if es_admin and unidad.precio_publicado:
            margen = unidad.precio_publicado - unidad.costo_total

        unidades_stock.append(UnidadStock(
            id=unidad.id,
            marca=unidad.marca,
            modelo=unidad.modelo,
            anio=unidad.anio,
            dominio=unidad.dominio,
            color=unidad.color,
            estado=unidad.estado.value,
            dias_en_stock=unidad.dias_en_stock,
            stock_inmovilizado=unidad.stock_inmovilizado,
            # Solo admin ve costos
            precio_compra=unidad.precio_compra if es_admin else 0,
            costos_directos=costos_directos if es_admin else 0,
            costo_total=unidad.costo_total if es_admin else 0,
            precio_publicado=unidad.precio_publicado,
            margen_esperado=margen,
            documentacion_completa=doc_completa,
            items_pendientes=items_pend
        ))

        if es_admin:
            valor_stock_costo += unidad.costo_total

        valor_stock_venta += unidad.precio_publicado or 0
        total_dias += unidad.dias_en_stock

        if unidad.stock_inmovilizado:
            inmovilizadas += 1

    dias_promedio = total_dias / len(unidades) if unidades else 0

    disponibles = sum(1 for u in unidades if u.estado == EstadoUnidad.DISPONIBLE)
    reservadas = sum(1 for u in unidades if u.estado == EstadoUnidad.RESERVADO)
    en_reparacion = sum(1 for u in unidades if u.estado == EstadoUnidad.EN_REPARACION)

    return ReporteStock(
        fecha_reporte=date.today(),
        total_unidades=len(unidades),
        unidades_disponibles=disponibles,
        unidades_reservadas=reservadas,
        unidades_en_reparacion=en_reparacion,
        unidades_inmovilizadas=inmovilizadas,
        valor_stock_costo=valor_stock_costo if es_admin else 0,
        valor_stock_venta=valor_stock_venta,
        inversion_total=valor_stock_costo if es_admin else 0,
        dias_promedio_stock=round(dias_promedio, 1),
        unidades=unidades_stock
    )


@router.get("/ventas-mensuales")
async def reporte_ventas_mensuales(
    anio: int = Query(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Resumen de ventas por mes"""
    if token.rol != RolUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    resultados = []
    for mes in range(1, 13):
        primer_dia = date(anio, mes, 1)
        ultimo_dia = date(anio, mes, monthrange(anio, mes)[1])

        result = await db.execute(
            select(Operacion).where(
                Operacion.fecha_operacion >= primer_dia,
                Operacion.fecha_operacion <= ultimo_dia,
                Operacion.estado == EstadoOperacion.COMPLETADA
            )
        )
        operaciones = result.scalars().all()

        total_ventas = sum(op.precio_venta for op in operaciones)
        total_utilidad = sum(op.utilidad_bruta for op in operaciones)

        resultados.append({
            "mes": mes,
            "nombre_mes": primer_dia.strftime("%B"),
            "cantidad_ventas": len(operaciones),
            "total_ventas": total_ventas,
            "utilidad_bruta": total_utilidad
        })

    return {
        "anio": anio,
        "meses": resultados,
        "total_anual_ventas": sum(r["total_ventas"] for r in resultados),
        "total_anual_utilidad": sum(r["utilidad_bruta"] for r in resultados)
    }


@router.get("/costos-por-unidad")
async def reporte_costos_por_unidad(
    unidad_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Detalle de costos por unidad"""
    if token.rol != RolUsuario.ADMIN:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    stmt = select(Unidad)
    if unidad_id:
        stmt = stmt.where(Unidad.id == unidad_id)

    result = await db.execute(stmt)
    unidades = result.scalars().all()
    resultado = []

    for unidad in unidades:
        costos_por_categoria = {}
        for costo in unidad.costos_directos:
            cat = costo.categoria.value
            if cat not in costos_por_categoria:
                costos_por_categoria[cat] = 0
            costos_por_categoria[cat] += costo.monto

        resultado.append({
            "id": unidad.id,
            "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
            "precio_compra": unidad.precio_compra,
            "gastos_transferencia": unidad.gastos_transferencia or 0,
            "costos_por_categoria": costos_por_categoria,
            "total_costos_directos": sum(c.monto for c in unidad.costos_directos),
            "costo_total": unidad.costo_total,
            "precio_publicado": unidad.precio_publicado,
            "margen_esperado": (unidad.precio_publicado - unidad.costo_total) if unidad.precio_publicado else None
        })

    return resultado


@router.get("/rentabilidad-vendedores")
async def reporte_rentabilidad_vendedores(
    fecha_desde: date = Query(..., description="Fecha inicio del período"),
    fecha_hasta: date = Query(..., description="Fecha fin del período"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Reporte de rentabilidad por vendedor.
    Muestra ventas, utilidad, comisiones y métricas por cada vendedor.
    Solo accesible para administradores.
    """
    from app.verticals.autos.models.usuario import Usuario

    if token.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver este reporte"
        )

    # Operaciones completadas en el período
    result = await db.execute(
        select(Operacion).where(
            Operacion.fecha_operacion >= fecha_desde,
            Operacion.fecha_operacion <= fecha_hasta,
            Operacion.estado == EstadoOperacion.COMPLETADA
        )
    )
    operaciones = result.scalars().all()

    # Obtener todos los vendedores activos
    result = await db.execute(
        select(Usuario).where(
            Usuario.rol == RolUsuario.VENDEDOR,
            Usuario.activo == True
        )
    )
    vendedores = result.scalars().all()

    # Inicializar datos por vendedor
    por_vendedor = {}
    for vendedor in vendedores:
        por_vendedor[vendedor.id] = {
            "vendedor_id": vendedor.id,
            "vendedor_nombre": f"{vendedor.nombre} {vendedor.apellido}",
            "operaciones": [],
            "cantidad_ventas": 0,
            "total_ventas": 0,
            "total_utilidad": 0,
            "comisiones_total": 0
        }

    # Agrupar operaciones por vendedor
    for op in operaciones:
        vendedor_id = op.vendedor_id
        if not vendedor_id:
            continue

        # Si el vendedor no está en la lista (inactivo o eliminado), agregarlo
        if vendedor_id not in por_vendedor:
            result = await db.execute(
                select(Usuario).where(Usuario.id == vendedor_id)
            )
            vendedor = result.scalar_one_or_none()
            if vendedor:
                por_vendedor[vendedor_id] = {
                    "vendedor_id": vendedor_id,
                    "vendedor_nombre": f"{vendedor.nombre} {vendedor.apellido}",
                    "operaciones": [],
                    "cantidad_ventas": 0,
                    "total_ventas": 0,
                    "total_utilidad": 0,
                    "comisiones_total": 0
                }
            else:
                continue

        unidad = op.unidad_vendida
        if not unidad:
            continue

        utilidad = op.precio_venta - unidad.costo_total
        comision = op.comision or 0

        por_vendedor[vendedor_id]["operaciones"].append({
            "id": op.id,
            "fecha": op.fecha_operacion.isoformat(),
            "unidad": f"{unidad.marca} {unidad.modelo} {unidad.anio}",
            "dominio": unidad.dominio,
            "precio_venta": op.precio_venta,
            "costo_total": unidad.costo_total,
            "utilidad": utilidad,
            "comision": comision
        })

        por_vendedor[vendedor_id]["cantidad_ventas"] += 1
        por_vendedor[vendedor_id]["total_ventas"] += op.precio_venta
        por_vendedor[vendedor_id]["total_utilidad"] += utilidad
        por_vendedor[vendedor_id]["comisiones_total"] += comision

    # Calcular métricas adicionales y formatear respuesta
    resultado = []
    for vendedor_id, datos in por_vendedor.items():
        cantidad = datos["cantidad_ventas"]
        total_ventas = datos["total_ventas"]
        total_utilidad = datos["total_utilidad"]

        resultado.append({
            "vendedor_id": datos["vendedor_id"],
            "vendedor_nombre": datos["vendedor_nombre"],
            "cantidad_ventas": cantidad,
            "total_ventas": total_ventas,
            "promedio_por_venta": round(total_ventas / cantidad, 2) if cantidad > 0 else 0,
            "total_utilidad": total_utilidad,
            "promedio_utilidad": round(total_utilidad / cantidad, 2) if cantidad > 0 else 0,
            "margen_promedio": round((total_utilidad / total_ventas * 100), 2) if total_ventas > 0 else 0,
            "comisiones_total": datos["comisiones_total"],
            "operaciones": datos["operaciones"]
        })

    # Ordenar por utilidad total (descendente)
    resultado.sort(key=lambda x: x["total_utilidad"], reverse=True)

    # Calcular totales generales de ventas
    total_utilidad_bruta = sum(v["total_utilidad"] for v in resultado)
    total_comisiones = sum(v["comisiones_total"] for v in resultado)

    total_general = {
        "cantidad_ventas": sum(v["cantidad_ventas"] for v in resultado),
        "total_ventas": sum(v["total_ventas"] for v in resultado),
        "total_utilidad": total_utilidad_bruta,
        "comisiones_pagadas": total_comisiones
    }

    # --- Gastos del período para rentabilidad neta ---
    # Egresos operativos (alquiler, sueldos, servicios, etc.)
    result = await db.execute(
        select(CajaDiaria).where(
            CajaDiaria.fecha >= fecha_desde,
            CajaDiaria.fecha <= fecha_hasta,
            CajaDiaria.tipo == TipoMovimiento.EGRESO,
        )
    )
    egresos_caja = result.scalars().all()

    # Costos directos de unidades (reparaciones, chapa, mecánica, etc.)
    result = await db.execute(
        select(CostoDirecto).where(
            CostoDirecto.fecha >= fecha_desde,
            CostoDirecto.fecha <= fecha_hasta,
        )
    )
    costos_directos = result.scalars().all()

    total_gastos_operativos = sum(e.monto for e in egresos_caja)
    total_costos_directos = sum(c.monto for c in costos_directos)
    total_gastos = total_gastos_operativos + total_costos_directos

    # Desglose por categoría de gasto
    cat_gastos = {}
    for e in egresos_caja:
        cat = e.categoria.value if hasattr(e.categoria, "value") else str(e.categoria)
        if cat not in cat_gastos:
            cat_gastos[cat] = {"total": 0.0, "cantidad": 0, "origen": "operativo"}
        cat_gastos[cat]["total"] += e.monto
        cat_gastos[cat]["cantidad"] += 1
    for c in costos_directos:
        cat = c.categoria.value if hasattr(c.categoria, "value") else str(c.categoria)
        if cat not in cat_gastos:
            cat_gastos[cat] = {"total": 0.0, "cantidad": 0, "origen": "directo"}
        cat_gastos[cat]["total"] += c.monto
        cat_gastos[cat]["cantidad"] += 1

    desglose_gastos = [
        {"categoria": cat, "total": round(d["total"], 2), "cantidad": d["cantidad"], "origen": d["origen"]}
        for cat, d in sorted(cat_gastos.items(), key=lambda x: x[1]["total"], reverse=True)
    ]

    # Rentabilidad neta = utilidad bruta de ventas - gastos operativos - comisiones
    # (los costos directos ya están restados en la utilidad bruta via costo_total de la unidad)
    rentabilidad_neta = total_utilidad_bruta - total_gastos_operativos - total_comisiones

    rentabilidad = {
        "utilidad_bruta": round(total_utilidad_bruta, 2),
        "gastos_operativos": round(total_gastos_operativos, 2),
        "costos_directos_periodo": round(total_costos_directos, 2),
        "comisiones": round(total_comisiones, 2),
        "rentabilidad_neta": round(rentabilidad_neta, 2),
        "margen_neto": round((rentabilidad_neta / total_general["total_ventas"] * 100), 2) if total_general["total_ventas"] > 0 else 0,
        "desglose_gastos": desglose_gastos,
    }

    return {
        "fecha_desde": fecha_desde.isoformat(),
        "fecha_hasta": fecha_hasta.isoformat(),
        "vendedores": resultado,
        "total_general": total_general,
        "rentabilidad": rentabilidad,
    }


@router.get("/antiguedad-stock")
async def reporte_antiguedad_stock(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Análisis de antigüedad del stock agrupado por rangos de días.
    Identifica unidades inmovilizadas y capital estancado.
    """
    result = await db.execute(
        select(Unidad).where(
            Unidad.estado != EstadoUnidad.VENDIDO
        )
    )
    unidades = result.scalars().all()

    rangos = {
        "0-15": {"label": "0-15 días", "color": "green", "min": 0, "max": 15, "unidades": [], "cantidad": 0, "valor_costo": 0, "valor_publicado": 0},
        "16-30": {"label": "16-30 días", "color": "green", "min": 16, "max": 30, "unidades": [], "cantidad": 0, "valor_costo": 0, "valor_publicado": 0},
        "31-60": {"label": "31-60 días", "color": "yellow", "min": 31, "max": 60, "unidades": [], "cantidad": 0, "valor_costo": 0, "valor_publicado": 0},
        "61-90": {"label": "61-90 días", "color": "orange", "min": 61, "max": 90, "unidades": [], "cantidad": 0, "valor_costo": 0, "valor_publicado": 0},
        "90+": {"label": "90+ días", "color": "red", "min": 91, "max": 99999, "unidades": [], "cantidad": 0, "valor_costo": 0, "valor_publicado": 0},
    }

    dias_list = []
    unidad_mas_antigua = None
    max_dias = 0

    for u in unidades:
        dias = u.dias_en_stock
        dias_list.append(dias)

        info = {
            "id": u.id,
            "marca": u.marca,
            "modelo": u.modelo,
            "anio": u.anio,
            "dominio": u.dominio,
            "estado": u.estado.value,
            "dias_en_stock": dias,
            "costo_total": u.costo_total,
            "precio_publicado": u.precio_publicado,
            "fecha_ingreso": u.fecha_ingreso.isoformat() if u.fecha_ingreso else None,
        }

        if dias > max_dias:
            max_dias = dias
            unidad_mas_antigua = info

        for key, rango in rangos.items():
            if rango["min"] <= dias <= rango["max"]:
                rango["unidades"].append(info)
                rango["cantidad"] += 1
                rango["valor_costo"] += u.costo_total
                rango["valor_publicado"] += u.precio_publicado or 0
                break

    # Ordenar unidades dentro de cada rango por días (más antiguo primero)
    for rango in rangos.values():
        rango["unidades"].sort(key=lambda x: x["dias_en_stock"], reverse=True)

    promedio_dias = sum(dias_list) / len(dias_list) if dias_list else 0
    mediana_dias = sorted(dias_list)[len(dias_list) // 2] if dias_list else 0

    return {
        "rangos": [
            {
                "key": key,
                "label": r["label"],
                "color": r["color"],
                "cantidad": r["cantidad"],
                "valor_costo": r["valor_costo"],
                "valor_publicado": r["valor_publicado"],
                "unidades": r["unidades"],
            }
            for key, r in rangos.items()
        ],
        "resumen": {
            "total_unidades": len(unidades),
            "promedio_dias": round(promedio_dias, 1),
            "mediana_dias": mediana_dias,
            "inversion_total": sum(u.costo_total for u in unidades),
            "unidad_mas_antigua": unidad_mas_antigua,
        }
    }


@router.get("/comparativo-mensual")
async def reporte_comparativo_mensual(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Comparativo del mes indicado vs el mes anterior.
    Retorna métricas de ambos meses y variaciones porcentuales.
    """
    MESES_NOMBRES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                     "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

    async def calcular_metricas_mes(m, a):
        primer_dia = date(a, m, 1)
        ultimo_dia = date(a, m, monthrange(a, m)[1])

        # Ventas completadas
        result = await db.execute(
            select(Operacion).where(
                Operacion.fecha_operacion >= primer_dia,
                Operacion.fecha_operacion <= ultimo_dia,
                Operacion.estado == EstadoOperacion.COMPLETADA
            )
        )
        operaciones = result.scalars().all()

        ventas_total = sum(op.precio_venta for op in operaciones)
        utilidad_bruta = sum(
            (op.precio_venta - op.unidad_vendida.costo_total)
            for op in operaciones if op.unidad_vendida
        )

        # Gastos operativos
        result = await db.execute(
            select(func.sum(CajaDiaria.monto)).where(
                CajaDiaria.fecha >= primer_dia,
                CajaDiaria.fecha <= ultimo_dia,
                CajaDiaria.tipo == TipoMovimiento.EGRESO
            )
        )
        gastos_op = result.scalar() or 0

        # Costos directos del período
        result = await db.execute(
            select(func.sum(CostoDirecto.monto)).where(
                CostoDirecto.fecha >= primer_dia,
                CostoDirecto.fecha <= ultimo_dia
            )
        )
        gastos_dir = result.scalar() or 0

        rentabilidad_neta = utilidad_bruta - gastos_op

        # Unidades ingresadas en el mes
        result = await db.execute(
            select(func.count()).select_from(Unidad).where(
                Unidad.fecha_ingreso >= primer_dia,
                Unidad.fecha_ingreso <= ultimo_dia
            )
        )
        ingresadas = result.scalar()

        ticket_promedio = ventas_total / len(operaciones) if operaciones else 0
        margen_promedio = (utilidad_bruta / ventas_total * 100) if ventas_total > 0 else 0

        # Días promedio de venta (de las unidades vendidas este mes)
        dias_venta = []
        for op in operaciones:
            if op.unidad_vendida and op.unidad_vendida.fecha_ingreso:
                dias = (op.fecha_operacion - op.unidad_vendida.fecha_ingreso).days
                dias_venta.append(dias)
        dias_promedio_venta = sum(dias_venta) / len(dias_venta) if dias_venta else 0

        return {
            "anio": a,
            "mes": m,
            "nombre_mes": MESES_NOMBRES[m],
            "ventas_cantidad": len(operaciones),
            "ventas_total": round(ventas_total, 2),
            "utilidad_bruta": round(utilidad_bruta, 2),
            "gastos_operativos": round(gastos_op, 2),
            "gastos_directos": round(gastos_dir, 2),
            "rentabilidad_neta": round(rentabilidad_neta, 2),
            "unidades_ingresadas": ingresadas,
            "ticket_promedio": round(ticket_promedio, 2),
            "margen_promedio": round(margen_promedio, 2),
            "dias_promedio_venta": round(dias_promedio_venta, 1),
        }

    def calcular_variacion(actual, anterior):
        absoluta = actual - anterior
        porcentaje = ((actual - anterior) / anterior * 100) if anterior != 0 else (100 if actual > 0 else 0)
        return {"absoluta": round(absoluta, 2), "porcentaje": round(porcentaje, 2)}

    # Mes anterior
    if mes == 1:
        mes_ant, anio_ant = 12, anio - 1
    else:
        mes_ant, anio_ant = mes - 1, anio

    actual = await calcular_metricas_mes(mes, anio)
    anterior = await calcular_metricas_mes(mes_ant, anio_ant)

    campos_comparar = [
        "ventas_cantidad", "ventas_total", "utilidad_bruta",
        "gastos_operativos", "gastos_directos", "rentabilidad_neta",
        "unidades_ingresadas", "ticket_promedio", "margen_promedio",
        "dias_promedio_venta"
    ]

    variaciones = {}
    for campo in campos_comparar:
        variaciones[campo] = calcular_variacion(actual[campo], anterior[campo])

    return {
        "mes_actual": actual,
        "mes_anterior": anterior,
        "variaciones": variaciones,
    }
