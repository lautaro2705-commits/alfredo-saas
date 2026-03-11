from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_, select
from typing import List, Optional
from datetime import date, timedelta
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.operacion import Operacion, EstadoOperacion
from app.verticals.autos.models.configuracion import ConfiguracionNegocio
from app.verticals.autos.schemas.inteligencia_negocio import (
    CostoOportunidadUnidad,
    ROIPorMarcaModelo,
    AlertaRepricing,
    ResumenInteligenciaNegocio,
    AnalisisUnidadDetallado
)
from app.verticals.autos.schemas.configuracion import ConfiguracionResponse, ConfiguracionNegocioResponse

router = APIRouter(prefix="/autos/inteligencia", tags=["autos-inteligencia"])


async def get_tasa_diaria(db: AsyncSession) -> float:
    """Obtener tasa diaria de costo de oportunidad"""
    tasa_anual = await ConfiguracionNegocio.get_valor(db, "tasa_costo_oportunidad_anual", 30)
    return tasa_anual / 365 / 100  # Convertir a tasa diaria decimal


async def get_dias_repricing(db: AsyncSession) -> int:
    """Obtener dias para alerta de repricing"""
    return int(await ConfiguracionNegocio.get_valor(db, "dias_alerta_repricing", 45))


# ==================== CONFIGURACION ====================

@router.get("/configuracion", response_model=ConfiguracionNegocioResponse)
async def obtener_configuracion(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener configuracion actual de parametros de negocio"""
    return ConfiguracionNegocioResponse(
        tasa_costo_oportunidad_anual=await ConfiguracionNegocio.get_valor(db, "tasa_costo_oportunidad_anual", 30),
        dias_alerta_repricing=int(await ConfiguracionNegocio.get_valor(db, "dias_alerta_repricing", 45)),
        dias_stock_inmovilizado=int(await ConfiguracionNegocio.get_valor(db, "dias_stock_inmovilizado", 60))
    )


@router.put("/configuracion/{clave}")
async def actualizar_configuracion(
    clave: str,
    valor: str = Query(..., description="Nuevo valor para la configuracion"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Actualizar parametro de configuracion (solo Admin). Crea si no existe."""
    config = await ConfiguracionNegocio.set_valor(db, clave, str(valor), token.user_id)
    return {"mensaje": "Configuracion actualizada", "clave": clave, "valor": valor}


# ==================== COSTO DE OPORTUNIDAD ====================

@router.get("/costo-oportunidad", response_model=List[CostoOportunidadUnidad])
async def listar_costo_oportunidad(
    solo_disponibles: bool = True,
    ordenar_por: str = Query(default="costo_acumulado", enum=["dias", "costo_acumulado", "costo_total"]),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Listar costo de oportunidad de todas las unidades en stock.
    Muestra cuanto dinero 'pierde' cada unidad por estar inmovilizada.
    """
    stmt = select(Unidad)
    if solo_disponibles:
        stmt = stmt.where(Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO]))

    result = await db.execute(stmt)
    unidades = result.scalars().all()
    tasa_diaria = await get_tasa_diaria(db)
    dias_repricing = await get_dias_repricing(db)

    resultados = []
    for u in unidades:
        costo_diario = u.costo_total * tasa_diaria
        costo_acumulado = costo_diario * u.dias_en_stock

        resultados.append(CostoOportunidadUnidad(
            unidad_id=u.id,
            marca=u.marca,
            modelo=u.modelo,
            anio=u.anio,
            dominio=u.dominio,
            dias_en_stock=u.dias_en_stock,
            costo_total=u.costo_total,
            tasa_diaria=tasa_diaria * 100,  # Mostrar como porcentaje
            costo_oportunidad_diario=round(costo_diario, 2),
            costo_oportunidad_acumulado=round(costo_acumulado, 2),
            precio_publicado=u.precio_publicado,
            requiere_repricing=u.dias_en_stock >= dias_repricing
        ))

    # Ordenar
    if ordenar_por == "dias":
        resultados.sort(key=lambda x: x.dias_en_stock, reverse=True)
    elif ordenar_por == "costo_acumulado":
        resultados.sort(key=lambda x: x.costo_oportunidad_acumulado, reverse=True)
    else:
        resultados.sort(key=lambda x: x.costo_total, reverse=True)

    return resultados


# ==================== ROI POR MARCA/MODELO ====================

@router.get("/roi-por-marca", response_model=List[ROIPorMarcaModelo])
async def roi_por_marca(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Calcular ROI promedio por marca basado en ventas historicas.
    Solo accesible por Admin.
    """
    if not fecha_desde:
        fecha_desde = date.today() - timedelta(days=365)
    if not fecha_hasta:
        fecha_hasta = date.today()

    # Obtener operaciones completadas con sus unidades
    result = await db.execute(
        select(Operacion).where(
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_desde,
            Operacion.fecha_operacion <= fecha_hasta
        )
    )
    operaciones = result.scalars().all()

    tasa_diaria = await get_tasa_diaria(db)

    # Agrupar por marca
    por_marca = {}
    for op in operaciones:
        if not op.unidad_vendida:
            continue

        unidad = op.unidad_vendida
        marca = unidad.marca

        if marca not in por_marca:
            por_marca[marca] = {
                "ventas": [],
                "utilidades": [],
                "costos": [],
                "precios": [],
                "dias_stock": [],
                "costos_oportunidad": []
            }

        costo = unidad.costo_total
        utilidad = op.precio_venta - costo
        roi = (utilidad / costo * 100) if costo > 0 else 0
        dias = unidad.dias_en_stock
        costo_op = costo * tasa_diaria * dias

        por_marca[marca]["ventas"].append(1)
        por_marca[marca]["utilidades"].append(utilidad)
        por_marca[marca]["costos"].append(costo)
        por_marca[marca]["precios"].append(op.precio_venta)
        por_marca[marca]["dias_stock"].append(dias)
        por_marca[marca]["costos_oportunidad"].append(costo_op)

    # Calcular promedios
    resultados = []
    for marca, datos in por_marca.items():
        n = len(datos["ventas"])
        if n == 0:
            continue

        resultados.append(ROIPorMarcaModelo(
            marca=marca,
            modelo=None,
            cantidad_vendidas=n,
            precio_venta_promedio=round(sum(datos["precios"]) / n, 2),
            costo_total_promedio=round(sum(datos["costos"]) / n, 2),
            utilidad_promedio=round(sum(datos["utilidades"]) / n, 2),
            roi_promedio=round(sum(datos["utilidades"]) / sum(datos["costos"]) * 100, 2) if sum(datos["costos"]) > 0 else 0,
            dias_stock_promedio=round(sum(datos["dias_stock"]) / n, 1),
            costo_oportunidad_promedio=round(sum(datos["costos_oportunidad"]) / n, 2)
        ))

    # Ordenar por ROI
    resultados.sort(key=lambda x: x.roi_promedio, reverse=True)
    return resultados


@router.get("/roi-por-modelo", response_model=List[ROIPorMarcaModelo])
async def roi_por_modelo(
    marca: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Calcular ROI promedio por modelo basado en ventas historicas.
    Solo accesible por Admin.
    """
    if not fecha_desde:
        fecha_desde = date.today() - timedelta(days=365)
    if not fecha_hasta:
        fecha_hasta = date.today()

    result = await db.execute(
        select(Operacion).where(
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_desde,
            Operacion.fecha_operacion <= fecha_hasta
        )
    )
    operaciones = result.scalars().all()
    tasa_diaria = await get_tasa_diaria(db)

    # Agrupar por marca+modelo
    por_modelo = {}
    for op in operaciones:
        if not op.unidad_vendida:
            continue

        unidad = op.unidad_vendida
        if marca and unidad.marca.lower() != marca.lower():
            continue

        key = f"{unidad.marca}|{unidad.modelo}"

        if key not in por_modelo:
            por_modelo[key] = {
                "marca": unidad.marca,
                "modelo": unidad.modelo,
                "ventas": [],
                "utilidades": [],
                "costos": [],
                "precios": [],
                "dias_stock": [],
                "costos_oportunidad": []
            }

        costo = unidad.costo_total
        utilidad = op.precio_venta - costo
        dias = unidad.dias_en_stock
        costo_op = costo * tasa_diaria * dias

        por_modelo[key]["ventas"].append(1)
        por_modelo[key]["utilidades"].append(utilidad)
        por_modelo[key]["costos"].append(costo)
        por_modelo[key]["precios"].append(op.precio_venta)
        por_modelo[key]["dias_stock"].append(dias)
        por_modelo[key]["costos_oportunidad"].append(costo_op)

    # Calcular promedios
    resultados = []
    for key, datos in por_modelo.items():
        n = len(datos["ventas"])
        if n == 0:
            continue

        resultados.append(ROIPorMarcaModelo(
            marca=datos["marca"],
            modelo=datos["modelo"],
            cantidad_vendidas=n,
            precio_venta_promedio=round(sum(datos["precios"]) / n, 2),
            costo_total_promedio=round(sum(datos["costos"]) / n, 2),
            utilidad_promedio=round(sum(datos["utilidades"]) / n, 2),
            roi_promedio=round(sum(datos["utilidades"]) / sum(datos["costos"]) * 100, 2) if sum(datos["costos"]) > 0 else 0,
            dias_stock_promedio=round(sum(datos["dias_stock"]) / n, 1),
            costo_oportunidad_promedio=round(sum(datos["costos_oportunidad"]) / n, 2)
        ))

    resultados.sort(key=lambda x: x.roi_promedio, reverse=True)
    return resultados


# ==================== ALERTAS DE REPRICING ====================

@router.get("/alertas-repricing", response_model=List[AlertaRepricing])
async def alertas_repricing(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Listar unidades que requieren revision de precio por llevar
    mas de X dias sin venderse.
    """
    dias_repricing = await get_dias_repricing(db)

    result = await db.execute(
        select(Unidad).where(
            Unidad.estado == EstadoUnidad.DISPONIBLE
        )
    )
    unidades = result.scalars().all()

    alertas = []
    for u in unidades:
        if u.dias_en_stock < dias_repricing:
            continue

        # Buscar precio promedio de ventas similares
        result = await db.execute(
            select(Operacion).join(Unidad).where(
                Operacion.estado == EstadoOperacion.COMPLETADA,
                Unidad.marca == u.marca,
                Unidad.modelo == u.modelo,
                Unidad.anio.between(u.anio - 1, u.anio + 1)
            )
        )
        ventas_similares = result.scalars().all()

        precio_sugerido = None
        if ventas_similares:
            precios = [op.precio_venta for op in ventas_similares]
            precio_sugerido = round(sum(precios) / len(precios), 2)

        alertas.append(AlertaRepricing(
            unidad_id=u.id,
            marca=u.marca,
            modelo=u.modelo,
            anio=u.anio,
            dominio=u.dominio,
            dias_en_stock=u.dias_en_stock,
            precio_publicado=u.precio_publicado,
            precio_sugerido=precio_sugerido,
            costo_total=u.costo_total,
            utilidad_minima_sugerida=u.costo_total * 0.1 if u.costo_total else None  # 10% minimo sugerido
        ))

    alertas.sort(key=lambda x: x.dias_en_stock, reverse=True)
    return alertas


# ==================== RESUMEN GENERAL ====================

@router.get("/resumen", response_model=ResumenInteligenciaNegocio)
async def resumen_inteligencia(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Resumen general de inteligencia de negocio.
    Solo accesible por Admin.
    """
    tasa_diaria = await get_tasa_diaria(db)
    dias_repricing = await get_dias_repricing(db)
    dias_inmovilizado = int(await ConfiguracionNegocio.get_valor(db, "dias_stock_inmovilizado", 60))

    # Unidades en stock
    result = await db.execute(
        select(Unidad).where(
            Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO])
        )
    )
    unidades = result.scalars().all()

    total_unidades = len(unidades)
    capital_inmovilizado = sum(u.costo_total for u in unidades)
    costo_diario_total = sum(u.costo_total * tasa_diaria for u in unidades)
    unidades_repricing = sum(1 for u in unidades if u.dias_en_stock >= dias_repricing)
    unidades_inmovilizado = sum(1 for u in unidades if u.dias_en_stock >= dias_inmovilizado)

    # ROI ultimo mes
    fecha_mes = date.today() - timedelta(days=30)
    result = await db.execute(
        select(Operacion).where(
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_mes
        )
    )
    ops_mes = result.scalars().all()

    roi_mes = None
    if ops_mes:
        utilidades = []
        costos = []
        for op in ops_mes:
            if op.unidad_vendida:
                costo = op.unidad_vendida.costo_total
                utilidades.append(op.precio_venta - costo)
                costos.append(costo)
        if costos and sum(costos) > 0:
            roi_mes = round(sum(utilidades) / sum(costos) * 100, 2)

    # ROI ultimo trimestre
    fecha_trim = date.today() - timedelta(days=90)
    result = await db.execute(
        select(Operacion).where(
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_trim
        )
    )
    ops_trim = result.scalars().all()

    roi_trim = None
    if ops_trim:
        utilidades = []
        costos = []
        for op in ops_trim:
            if op.unidad_vendida:
                costo = op.unidad_vendida.costo_total
                utilidades.append(op.precio_venta - costo)
                costos.append(costo)
        if costos and sum(costos) > 0:
            roi_trim = round(sum(utilidades) / sum(costos) * 100, 2)

    # Top performers (marca y modelo mas rentable)
    roi_marca_list = await roi_por_marca(fecha_desde=fecha_trim, db=db, token=token)
    marca_top = roi_marca_list[0].marca if roi_marca_list else None

    roi_modelo_list = await roi_por_modelo(fecha_desde=fecha_trim, db=db, token=token)
    modelo_top = f"{roi_modelo_list[0].marca} {roi_modelo_list[0].modelo}" if roi_modelo_list else None

    return ResumenInteligenciaNegocio(
        total_unidades_stock=total_unidades,
        capital_inmovilizado=round(capital_inmovilizado, 2),
        costo_oportunidad_total_diario=round(costo_diario_total, 2),
        costo_oportunidad_total_mensual=round(costo_diario_total * 30, 2),
        unidades_requieren_repricing=unidades_repricing,
        unidades_stock_inmovilizado=unidades_inmovilizado,
        roi_promedio_ultimo_mes=roi_mes,
        roi_promedio_ultimo_trimestre=roi_trim,
        marca_mas_rentable=marca_top,
        modelo_mas_rentable=modelo_top
    )


# ==================== ANALISIS DETALLADO POR UNIDAD ====================

@router.get("/analisis-unidad/{unidad_id}", response_model=AnalisisUnidadDetallado)
async def analisis_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Analisis detallado de rentabilidad de una unidad especifica.
    Solo accesible por Admin.
    """
    result = await db.execute(
        select(Unidad).where(Unidad.id == unidad_id)
    )
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    tasa_anual = await ConfiguracionNegocio.get_valor(db, "tasa_costo_oportunidad_anual", 30)
    tasa_diaria = tasa_anual / 365 / 100

    # Costos desglosados
    costos_directos = sum(c.monto for c in unidad.costos_directos) if unidad.costos_directos else 0
    costo_oportunidad = unidad.costo_total * tasa_diaria * unidad.dias_en_stock

    # Rentabilidad proyectada
    utilidad_bruta = None
    roi = None
    utilidad_neta = None
    if unidad.precio_publicado:
        utilidad_bruta = unidad.precio_publicado - unidad.costo_total
        roi = (utilidad_bruta / unidad.costo_total * 100) if unidad.costo_total > 0 else 0
        utilidad_neta = utilidad_bruta - costo_oportunidad

    # Comparacion con mercado (ventas similares)
    result = await db.execute(
        select(Operacion).join(Unidad).where(
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Unidad.marca == unidad.marca,
            Unidad.modelo == unidad.modelo,
            Unidad.anio.between(unidad.anio - 1, unidad.anio + 1)
        )
    )
    ventas_similares = result.scalars().all()

    precio_similares = None
    dias_similares = None
    if ventas_similares:
        precio_similares = round(sum(op.precio_venta for op in ventas_similares) / len(ventas_similares), 2)
        dias_similares = round(sum(op.unidad_vendida.dias_en_stock for op in ventas_similares if op.unidad_vendida) / len(ventas_similares), 1)

    return AnalisisUnidadDetallado(
        unidad_id=unidad.id,
        marca=unidad.marca,
        modelo=unidad.modelo,
        anio=unidad.anio,
        dominio=unidad.dominio,
        fecha_ingreso=unidad.fecha_ingreso,
        dias_en_stock=unidad.dias_en_stock,
        precio_compra=unidad.precio_compra,
        gastos_transferencia=unidad.gastos_transferencia or 0,
        costos_directos=costos_directos,
        costo_total=unidad.costo_total,
        tasa_anual=tasa_anual,
        tasa_diaria=round(tasa_diaria * 100, 4),
        costo_oportunidad_acumulado=round(costo_oportunidad, 2),
        precio_publicado=unidad.precio_publicado,
        precio_minimo=unidad.precio_minimo,
        utilidad_bruta_si_vende_hoy=round(utilidad_bruta, 2) if utilidad_bruta else None,
        roi_si_vende_hoy=round(roi, 2) if roi else None,
        utilidad_neta_ajustada=round(utilidad_neta, 2) if utilidad_neta else None,
        precio_promedio_similares=precio_similares,
        dias_promedio_venta_similares=dias_similares
    )
