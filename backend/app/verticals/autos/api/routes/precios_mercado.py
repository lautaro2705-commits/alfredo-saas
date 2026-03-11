"""
Endpoints para consulta de precios de mercado y calculadora de retomas.

Endpoints:
- POST /consultar/{unidad_id}  - Consultar precio de unidad (con cache)
- POST /consultar              - Consultar manual (sin guardar)
- POST /calcular-toma          - Calculadora de retomas
- GET /configuracion           - Obtener parametros
- PUT /configuracion/{clave}   - Actualizar parametro (admin)
- POST /actualizar-vencidos    - Actualizar precios vencidos (admin, background)
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.configuracion import ConfiguracionNegocio
from app.verticals.autos.services.precio_mercado import (  # TODO: move to shared services
    get_servicio_precio_mercado,
    calcular_precio_compra_maximo,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/autos/precios-mercado", tags=["autos-precios"])


# ==================== SCHEMAS ====================

class ConsultaPrecioRequest(BaseModel):
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None  # Version/trim del vehiculo


class PrecioMercadoResponse(BaseModel):
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None
    valor_mercado: Optional[float] = None
    valor_mercado_min: Optional[float] = None
    valor_mercado_max: Optional[float] = None
    cantidad_resultados: int = 0
    fuente: str = "kavak"
    fecha_consulta: Optional[datetime] = None
    desde_cache: bool = False
    error: Optional[str] = None


class CalculoRetomaRequest(BaseModel):
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None  # Version/trim del vehiculo
    margen_agencia: Optional[float] = None  # Usar config si no se especifica
    gastos_reacondicionamiento: Optional[float] = None  # Usar config si no se especifica


class CalculoRetomaResponse(BaseModel):
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None
    precio_mercado: Optional[float] = None
    precio_mercado_min: Optional[float] = None
    precio_mercado_max: Optional[float] = None
    cantidad_resultados: int = 0
    fuente: str = "kavak"
    margen_agencia_porcentaje: float
    margen_agencia_pesos: float
    gastos_reacondicionamiento: float
    precio_compra_maximo: float
    utilidad_proyectada: float
    recomendacion: str
    error: Optional[str] = None


class UnidadConPrecioMercadoResponse(BaseModel):
    unidad_id: int
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None
    dominio: str
    precio_publicado: Optional[float] = None
    valor_mercado: Optional[float] = None
    valor_mercado_min: Optional[float] = None
    valor_mercado_max: Optional[float] = None
    cantidad_resultados: int = 0
    fuente: str = "kavak"
    fecha_consulta: Optional[datetime] = None
    competitividad: Optional[str] = None  # "competitivo" o "desfasado"
    diferencia_mercado: Optional[float] = None  # precio_publicado - valor_mercado
    desde_cache: bool = False
    error: Optional[str] = None


class ConfiguracionPreciosResponse(BaseModel):
    margen_agencia_retoma: float
    gastos_estimados_reacondicionamiento: float
    cache_precios_mercado_horas: int


# ==================== HELPERS ====================

async def get_config_valor(db: AsyncSession, clave: str, default):
    """Obtiene valor de configuracion"""
    return await ConfiguracionNegocio.get_valor(db, clave, default)


async def get_horas_cache(db: AsyncSession) -> int:
    """Obtiene horas de validez del cache"""
    return int(await get_config_valor(db, "cache_precios_mercado_horas", 48))


def cache_vigente(unidad: Unidad, horas: int) -> bool:
    """Verifica si el cache de una unidad sigue vigente"""
    if not unidad.fecha_ultima_consulta_mercado:
        return False

    fecha_consulta = unidad.fecha_ultima_consulta_mercado
    if fecha_consulta.tzinfo:
        ahora = datetime.now(fecha_consulta.tzinfo)
    else:
        ahora = datetime.now()
        fecha_consulta = fecha_consulta.replace(tzinfo=None)

    return ahora - fecha_consulta < timedelta(hours=horas)


async def actualizar_precio_mercado_unidad(db: AsyncSession, unidad: Unidad) -> PrecioMercadoResponse:
    """Actualiza el precio de mercado de una unidad incluyendo su version"""
    servicio = get_servicio_precio_mercado()
    # Pasar la version de la unidad para busqueda mas precisa
    resultado = await servicio.consultar_precio(
        unidad.marca,
        unidad.modelo,
        unidad.anio,
        unidad.version  # Incluir version en la busqueda
    )

    if resultado.precios:
        unidad.valor_mercado = resultado.precio_promedio
        unidad.valor_mercado_min = resultado.precio_minimo
        unidad.valor_mercado_max = resultado.precio_maximo
        unidad.valor_mercado_cantidad = resultado.cantidad_resultados
        unidad.fecha_ultima_consulta_mercado = resultado.fecha_consulta
        await db.commit()

    return PrecioMercadoResponse(
        marca=unidad.marca,
        modelo=unidad.modelo,
        anio=unidad.anio,
        version=unidad.version,
        valor_mercado=resultado.precio_promedio,
        valor_mercado_min=resultado.precio_minimo,
        valor_mercado_max=resultado.precio_maximo,
        cantidad_resultados=resultado.cantidad_resultados,
        fuente=resultado.fuente,
        fecha_consulta=resultado.fecha_consulta,
        desde_cache=False,
        error=resultado.error
    )


# ==================== ENDPOINTS ====================

@router.post("/consultar/{unidad_id}", response_model=UnidadConPrecioMercadoResponse)
async def consultar_precio_unidad(
    unidad_id: int,
    forzar: bool = Query(False, description="Forzar consulta aunque haya cache vigente"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Consulta precio de mercado para una unidad especifica.

    - Si hay cache vigente (48h por defecto), retorna cache
    - Si forzar=true, consulta aunque haya cache
    - Actualiza los campos de precio de mercado en la unidad
    """
    result = await db.execute(
        select(Unidad).where(Unidad.id == unidad_id)
    )
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    horas_cache = await get_horas_cache(db)

    # Retornar cache si es vigente y no se forza
    if not forzar and cache_vigente(unidad, horas_cache):
        diferencia = None
        competitividad = None
        if unidad.precio_publicado and unidad.valor_mercado:
            diferencia = round(unidad.precio_publicado - unidad.valor_mercado, 2)
            competitividad = "competitivo" if diferencia <= 0 else "desfasado"

        return UnidadConPrecioMercadoResponse(
            unidad_id=unidad.id,
            marca=unidad.marca,
            modelo=unidad.modelo,
            anio=unidad.anio,
            version=unidad.version,
            dominio=unidad.dominio,
            precio_publicado=unidad.precio_publicado,
            valor_mercado=unidad.valor_mercado,
            valor_mercado_min=unidad.valor_mercado_min,
            valor_mercado_max=unidad.valor_mercado_max,
            cantidad_resultados=unidad.valor_mercado_cantidad or 0,
            fecha_consulta=unidad.fecha_ultima_consulta_mercado,
            competitividad=competitividad,
            diferencia_mercado=diferencia,
            desde_cache=True
        )

    # Consultar precio de mercado
    resultado = await actualizar_precio_mercado_unidad(db, unidad)

    diferencia = None
    competitividad = None
    if unidad.precio_publicado and resultado.valor_mercado:
        diferencia = round(unidad.precio_publicado - resultado.valor_mercado, 2)
        competitividad = "competitivo" if diferencia <= 0 else "desfasado"

    return UnidadConPrecioMercadoResponse(
        unidad_id=unidad.id,
        marca=unidad.marca,
        modelo=unidad.modelo,
        anio=unidad.anio,
        version=unidad.version,
        dominio=unidad.dominio,
        precio_publicado=unidad.precio_publicado,
        valor_mercado=resultado.valor_mercado,
        valor_mercado_min=resultado.valor_mercado_min,
        valor_mercado_max=resultado.valor_mercado_max,
        cantidad_resultados=resultado.cantidad_resultados,
        fuente=resultado.fuente,
        fecha_consulta=resultado.fecha_consulta,
        competitividad=competitividad,
        diferencia_mercado=diferencia,
        desde_cache=False,
        error=resultado.error
    )


@router.post("/consultar", response_model=PrecioMercadoResponse)
async def consultar_precio_manual(
    request: ConsultaPrecioRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Consulta precio de mercado para cualquier vehiculo (sin guardar en BD).
    Util para consultas rapidas o vehiculos que no estan en stock.
    Incluye version/trim para busqueda mas precisa.
    """
    servicio = get_servicio_precio_mercado()
    resultado = await servicio.consultar_precio(
        request.marca,
        request.modelo,
        request.anio,
        request.version  # Incluir version en la busqueda
    )

    return PrecioMercadoResponse(
        marca=request.marca,
        modelo=request.modelo,
        anio=request.anio,
        version=request.version,
        valor_mercado=resultado.precio_promedio,
        valor_mercado_min=resultado.precio_minimo,
        valor_mercado_max=resultado.precio_maximo,
        cantidad_resultados=resultado.cantidad_resultados,
        fuente=resultado.fuente,
        fecha_consulta=resultado.fecha_consulta,
        desde_cache=False,
        error=resultado.error
    )


@router.post("/calcular-toma", response_model=CalculoRetomaResponse)
async def calcular_toma(
    request: CalculoRetomaRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Calcula el precio maximo de compra para una retoma.

    Formula: Precio Compra Max = Precio Mercado - Margen Agencia - Gastos Reacondicionamiento

    Retorna sugerencia de precio de compra maximo basado en:
    - Precio promedio de mercado (MercadoLibre/DeAutos Cordoba)
    - Margen deseado por la agencia (config o parametro)
    - Gastos estimados de reacondicionamiento (config o parametro)
    """
    # Obtener configuracion
    margen = request.margen_agencia
    if margen is None:
        margen = float(await get_config_valor(db, "margen_agencia_retoma", 15))

    gastos = request.gastos_reacondicionamiento
    if gastos is None:
        gastos = float(await get_config_valor(db, "gastos_estimados_reacondicionamiento", 200000))

    # Consultar precio de mercado (incluyendo version)
    servicio = get_servicio_precio_mercado()
    resultado = await servicio.consultar_precio(
        request.marca,
        request.modelo,
        request.anio,
        request.version  # Incluir version en la busqueda
    )

    if not resultado.precio_promedio:
        return CalculoRetomaResponse(
            marca=request.marca,
            modelo=request.modelo,
            anio=request.anio,
            version=request.version,
            precio_mercado=None,
            cantidad_resultados=0,
            fuente=resultado.fuente,
            margen_agencia_porcentaje=margen,
            margen_agencia_pesos=0,
            gastos_reacondicionamiento=gastos,
            precio_compra_maximo=0,
            utilidad_proyectada=0,
            recomendacion="No se encontraron precios de mercado. Ingrese el valor manualmente.",
            error=resultado.error
        )

    # Calcular precio de compra maximo
    calculo = calcular_precio_compra_maximo(
        precio_mercado=resultado.precio_promedio,
        margen_agencia_porcentaje=margen,
        gastos_reacondicionamiento=gastos
    )

    return CalculoRetomaResponse(
        marca=request.marca,
        modelo=request.modelo,
        anio=request.anio,
        version=request.version,
        precio_mercado=resultado.precio_promedio,
        precio_mercado_min=resultado.precio_minimo,
        precio_mercado_max=resultado.precio_maximo,
        cantidad_resultados=resultado.cantidad_resultados,
        fuente=resultado.fuente,
        margen_agencia_porcentaje=calculo["margen_agencia_porcentaje"],
        margen_agencia_pesos=calculo["margen_agencia_pesos"],
        gastos_reacondicionamiento=calculo["gastos_reacondicionamiento"],
        precio_compra_maximo=calculo["precio_compra_maximo"],
        utilidad_proyectada=calculo["utilidad_proyectada"],
        recomendacion=calculo["recomendacion"]
    )


@router.get("/configuracion", response_model=ConfiguracionPreciosResponse)
async def obtener_configuracion_precios(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtiene configuracion de parametros de precios de mercado"""
    return ConfiguracionPreciosResponse(
        margen_agencia_retoma=float(await get_config_valor(db, "margen_agencia_retoma", 15)),
        gastos_estimados_reacondicionamiento=float(await get_config_valor(db, "gastos_estimados_reacondicionamiento", 200000)),
        cache_precios_mercado_horas=int(await get_config_valor(db, "cache_precios_mercado_horas", 48))
    )


@router.put("/configuracion/{clave}")
async def actualizar_configuracion_precios(
    clave: str,
    valor: str = Query(..., description="Nuevo valor para la configuracion"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Actualiza parametro de configuracion de precios (solo Admin)"""
    claves_validas = [
        "margen_agencia_retoma",
        "gastos_estimados_reacondicionamiento",
        "cache_precios_mercado_horas"
    ]
    if clave not in claves_validas:
        raise HTTPException(
            status_code=400,
            detail=f"Clave invalida. Claves validas: {', '.join(claves_validas)}"
        )

    await ConfiguracionNegocio.set_valor(db, clave, valor, token.user_id)
    return {
        "mensaje": "Configuracion actualizada",
        "clave": clave,
        "valor": valor
    }


@router.post("/actualizar-vencidos", status_code=202)
async def actualizar_precios_vencidos(
    background_tasks: BackgroundTasks,
    limite: int = Query(10, ge=1, le=50, description="Cantidad maxima de unidades a actualizar"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Actualiza precios de mercado para unidades con cache vencido.
    Ejecuta en background para no bloquear la respuesta.
    Solo Admin.
    """
    horas_cache = await get_horas_cache(db)
    fecha_limite = datetime.now() - timedelta(hours=horas_cache)

    # Unidades disponibles con cache vencido o sin consultar
    result = await db.execute(
        select(Unidad).where(
            Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO]),
            (Unidad.fecha_ultima_consulta_mercado == None) |
            (Unidad.fecha_ultima_consulta_mercado < fecha_limite)
        ).limit(limite)
    )
    unidades = result.scalars().all()

    if not unidades:
        return {"mensaje": "No hay unidades con cache vencido", "actualizadas": 0}

    # Lista de IDs para el background task
    unidad_ids = [u.id for u in unidades]

    # Programar actualizacion en background
    async def actualizar_batch():
        from app.core.database import async_session_factory
        async with async_session_factory() as db_background:
            try:
                for unidad_id in unidad_ids:
                    try:
                        result = await db_background.execute(
                            select(Unidad).where(Unidad.id == unidad_id)
                        )
                        unidad = result.scalar_one_or_none()
                        if unidad:
                            await actualizar_precio_mercado_unidad(db_background, unidad)
                            logger.info(f"Actualizado precio mercado para unidad {unidad_id}")
                    except Exception as e:
                        logger.error(f"Error actualizando unidad {unidad_id}: {e}")
            finally:
                pass  # async context manager handles close

    background_tasks.add_task(actualizar_batch)

    return {
        "mensaje": f"Actualizacion programada para {len(unidades)} unidades",
        "unidades": [
            {"id": u.id, "descripcion": f"{u.marca} {u.modelo} {u.anio}"}
            for u in unidades
        ]
    }


@router.get("/stock-con-precios")
async def listar_stock_con_precios_mercado(
    solo_sin_precio: bool = Query(False, description="Solo unidades sin precio de mercado"),
    solo_desfasados: bool = Query(False, description="Solo unidades con precio desfasado"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Lista unidades del stock con sus precios de mercado.
    Util para ver competitividad general del inventario.
    """
    stmt = select(Unidad).where(
        Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO])
    )

    if solo_sin_precio:
        stmt = stmt.where(Unidad.valor_mercado == None)

    result = await db.execute(stmt)
    unidades = result.scalars().all()

    resultado = []
    for u in unidades:
        competitividad = None
        diferencia = None

        if u.precio_publicado and u.valor_mercado:
            diferencia = round(u.precio_publicado - u.valor_mercado, 2)
            competitividad = "competitivo" if diferencia <= 0 else "desfasado"

        # Filtrar desfasados si se solicito
        if solo_desfasados and competitividad != "desfasado":
            continue

        resultado.append({
            "id": u.id,
            "marca": u.marca,
            "modelo": u.modelo,
            "anio": u.anio,
            "dominio": u.dominio,
            "precio_publicado": u.precio_publicado,
            "valor_mercado": u.valor_mercado,
            "competitividad": competitividad,
            "diferencia": diferencia,
            "dias_en_stock": u.dias_en_stock,
            "fecha_ultima_consulta": u.fecha_ultima_consulta_mercado
        })

    # Estadisticas
    total = len(resultado)
    competitivos = len([r for r in resultado if r["competitividad"] == "competitivo"])
    desfasados = len([r for r in resultado if r["competitividad"] == "desfasado"])
    sin_datos = len([r for r in resultado if r["competitividad"] is None])

    return {
        "unidades": resultado,
        "estadisticas": {
            "total": total,
            "competitivos": competitivos,
            "desfasados": desfasados,
            "sin_datos": sin_datos,
            "porcentaje_competitivo": round((competitivos / total * 100) if total > 0 else 0, 1)
        }
    }
