"""Dashboard principal — métricas y alertas."""
from __future__ import annotations
from datetime import date, timedelta, datetime
from calendar import monthrange
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.platform.schemas.common import auth_errors
from app.verticals.autos.schemas.dashboard import (
    DashboardResumenResponse,
    MetricasRapidasResponse,
    StockPorMarcaItem,
)
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.operacion import Operacion, EstadoOperacion
from app.verticals.autos.models.caja_diaria import CajaDiaria, TipoMovimiento
from app.verticals.autos.models.documentacion import ChecklistDocumentacion
from app.verticals.autos.models.cheque import (
    ChequeRecibido, ChequeEmitido,
    EstadoChequeRecibido, EstadoChequeEmitido,
)
from app.verticals.autos.models.seguimiento import Seguimiento, EstadoSeguimiento
from app.verticals.autos.models.cliente import Cliente

router = APIRouter(prefix="/autos/dashboard", tags=["autos-dashboard"])


@router.get("/resumen", response_model=DashboardResumenResponse, responses=auth_errors)
async def dashboard_resumen(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """
    Dashboard principal con métricas clave.

    Retorna un resumen completo: stock, ventas del mes (con variación vs anterior),
    caja del día, cheques próximos a vencer, alertas activas, y últimas ventas.

    - **valor_costo** y **utilidad_bruta** solo se incluyen para usuarios admin
    - **alertas** ordenadas por prioridad (alta → media → baja), máximo 20
    """
    es_admin = token.rol == "admin"
    tz_argentina = ZoneInfo("America/Argentina/Buenos_Aires")
    hoy = datetime.now(tz_argentina).date()
    primer_dia_mes = date(hoy.year, hoy.month, 1)

    if hoy.month == 1:
        primer_dia_mes_ant = date(hoy.year - 1, 12, 1)
        ultimo_dia_mes_ant = date(hoy.year - 1, 12, 31)
    else:
        primer_dia_mes_ant = date(hoy.year, hoy.month - 1, 1)
        ultimo_dia_mes_ant = date(hoy.year, hoy.month, 1) - timedelta(days=1)

    # Stock
    result = await db.execute(
        select(Unidad)
        .options(selectinload(Unidad.checklist_documentacion))
        .where(Unidad.active(), Unidad.estado != EstadoUnidad.VENDIDO)
    )
    unidades_stock = result.scalars().all()

    total_stock = len(unidades_stock)
    valor_stock_costo = sum(u.costo_total for u in unidades_stock) if es_admin else None
    inmovilizadas = sum(1 for u in unidades_stock if u.stock_inmovilizado)

    # Ventas del mes actual
    result = await db.execute(
        select(Operacion).where(
            Operacion.active(),
            Operacion.fecha_operacion >= primer_dia_mes,
            Operacion.estado == EstadoOperacion.COMPLETADA,
        )
    )
    ventas_mes = result.scalars().all()
    cantidad_ventas_mes = len(ventas_mes)
    ingresos_mes = sum(op.precio_venta for op in ventas_mes)
    utilidad_bruta_mes = sum(op.utilidad_bruta for op in ventas_mes) if es_admin else None

    # Ventas del mes anterior
    result = await db.execute(
        select(Operacion).where(
            Operacion.active(),
            Operacion.fecha_operacion >= primer_dia_mes_ant,
            Operacion.fecha_operacion <= ultimo_dia_mes_ant,
            Operacion.estado == EstadoOperacion.COMPLETADA,
        )
    )
    ventas_mes_ant = result.scalars().all()
    cantidad_ventas_mes_ant = len(ventas_mes_ant)
    ingresos_mes_ant = sum(op.precio_venta for op in ventas_mes_ant)

    # Caja del día
    result = await db.execute(
        select(CajaDiaria).where(CajaDiaria.active(), CajaDiaria.fecha == hoy)
    )
    movimientos_hoy = result.scalars().all()
    ingresos_hoy = sum(m.monto for m in movimientos_hoy if m.tipo == TipoMovimiento.INGRESO)
    egresos_hoy = sum(m.monto for m in movimientos_hoy if m.tipo == TipoMovimiento.EGRESO)
    saldo_hoy = ingresos_hoy - egresos_hoy

    # Caja del mes
    result = await db.execute(
        select(CajaDiaria).where(CajaDiaria.active(), CajaDiaria.fecha >= primer_dia_mes)
    )
    movimientos_mes = result.scalars().all()
    egresos_mes = sum(m.monto for m in movimientos_mes if m.tipo == TipoMovimiento.EGRESO)

    # Cheques por vencer (próximos 7 días)
    result = await db.execute(
        select(ChequeRecibido).where(
            ChequeRecibido.active(),
            ChequeRecibido.estado == EstadoChequeRecibido.EN_CARTERA,
            ChequeRecibido.fecha_vencimiento <= hoy + timedelta(days=7),
            ChequeRecibido.fecha_vencimiento >= hoy,
        )
    )
    cheques_por_vencer = result.scalars().all()

    result = await db.execute(
        select(ChequeEmitido).where(
            ChequeEmitido.active(),
            ChequeEmitido.estado == EstadoChequeEmitido.PENDIENTE,
            ChequeEmitido.fecha_pago <= hoy + timedelta(days=7),
            ChequeEmitido.fecha_pago >= hoy,
        )
    )
    cheques_emitidos_prox = result.scalars().all()

    # Seguimientos pendientes
    result = await db.execute(
        select(Seguimiento).where(
            Seguimiento.active(),
            Seguimiento.asignado_a == token.user_id,
            Seguimiento.estado == EstadoSeguimiento.PENDIENTE,
            Seguimiento.fecha_vencimiento <= hoy,
        )
    )
    seguimientos_pendientes = result.scalars().all()

    alertas = _obtener_alertas(
        unidades_stock, cheques_por_vencer,
        cheques_emitidos_prox, seguimientos_pendientes,
    )

    # Últimas operaciones
    result = await db.execute(
        select(Operacion)
        .options(
            selectinload(Operacion.unidad_vendida),
            selectinload(Operacion.cliente),
        )
        .where(Operacion.active(), Operacion.estado == EstadoOperacion.COMPLETADA)
        .order_by(Operacion.fecha_operacion.desc())
        .limit(5)
    )
    ultimas_ventas = result.scalars().all()

    ultimas = [
        {
            "id": op.id,
            "fecha": op.fecha_operacion.isoformat(),
            "unidad": f"{op.unidad_vendida.marca} {op.unidad_vendida.modelo}" if op.unidad_vendida else "N/A",
            "cliente": op.cliente.nombre_completo if op.cliente else "N/A",
            "monto": op.precio_venta,
        }
        for op in ultimas_ventas
    ]

    return {
        "stock": {
            "total_unidades": total_stock,
            "valor_costo": valor_stock_costo,
            "inmovilizadas": inmovilizadas,
            "disponibles": sum(1 for u in unidades_stock if u.estado == EstadoUnidad.DISPONIBLE),
            "reservadas": sum(1 for u in unidades_stock if u.estado == EstadoUnidad.RESERVADO),
        },
        "ventas_mes": {
            "cantidad": cantidad_ventas_mes,
            "ingresos": ingresos_mes,
            "utilidad_bruta": utilidad_bruta_mes,
            "gastos_mes": egresos_mes,
            "cantidad_mes_anterior": cantidad_ventas_mes_ant,
            "ingresos_mes_anterior": ingresos_mes_ant,
            "variacion_cantidad": cantidad_ventas_mes - cantidad_ventas_mes_ant,
            "variacion_ingresos": ingresos_mes - ingresos_mes_ant,
        },
        "caja_hoy": {
            "ingresos": ingresos_hoy,
            "egresos": egresos_hoy,
            "saldo": saldo_hoy,
        },
        "cheques": {
            "por_cobrar_7_dias": len(cheques_por_vencer),
            "monto_por_cobrar": sum(c.monto for c in cheques_por_vencer),
            "por_pagar_7_dias": len(cheques_emitidos_prox),
            "monto_por_pagar": sum(c.monto for c in cheques_emitidos_prox),
        },
        "alertas": alertas,
        "ultimas_ventas": ultimas,
        "seguimientos_pendientes": len(seguimientos_pendientes),
    }


def _obtener_alertas(
    unidades: list,
    cheques_recibidos: list | None = None,
    cheques_emitidos: list | None = None,
    seguimientos: list | None = None,
) -> list:
    """Generar lista de alertas activas (sync — opera sobre objetos ya cargados)."""
    alertas = []
    cheques_recibidos = cheques_recibidos or []
    cheques_emitidos = cheques_emitidos or []
    seguimientos = seguimientos or []

    for seg in seguimientos:
        dias = (seg.fecha_vencimiento - date.today()).days
        alertas.append({
            "tipo": "seguimiento_pendiente",
            "prioridad": "alta" if dias < 0 else ("media" if seg.prioridad != "alta" else "alta"),
            "mensaje": f"{'VENCIDO: ' if dias < 0 else ''}{seg.titulo}",
            "unidad_id": seg.unidad_id,
            "unidad_info": f"Vence: {seg.fecha_vencimiento.strftime('%d/%m')}",
            "link": "/agenda",
        })

    for cheque in cheques_recibidos:
        dias = cheque.dias_para_vencer
        alertas.append({
            "tipo": "cheque_por_cobrar",
            "prioridad": "alta" if dias <= 2 else "media",
            "mensaje": f"Cheque ${cheque.monto:,.0f} vence {'HOY' if dias == 0 else f'en {dias} dias'}",
            "unidad_id": None,
            "unidad_info": f"{cheque.banco} - {cheque.numero_cheque} ({cheque.emisor_nombre})",
            "link": "/cheques",
        })

    for cheque in cheques_emitidos:
        dias = cheque.dias_para_debito
        alertas.append({
            "tipo": "cheque_por_pagar",
            "prioridad": "alta" if dias <= 2 else "media",
            "mensaje": f"Cheque propio ${cheque.monto:,.0f} se debita {'HOY' if dias == 0 else f'en {dias} dias'}",
            "unidad_id": None,
            "unidad_info": f"{cheque.banco} - {cheque.numero_cheque} a {cheque.beneficiario}",
            "link": "/cheques",
        })

    for unidad in unidades:
        if unidad.stock_inmovilizado:
            alertas.append({
                "tipo": "inmovilizado",
                "prioridad": "alta" if unidad.dias_en_stock > 90 else "media",
                "mensaje": f"Stock inmovilizado: {unidad.dias_en_stock} dias",
                "unidad_id": unidad.id,
                "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                "link": f"/unidades/{unidad.id}",
            })

        if unidad.checklist_documentacion:
            if not unidad.checklist_documentacion.documentacion_completa:
                items = unidad.checklist_documentacion.items_pendientes
                alertas.append({
                    "tipo": "documentacion_pendiente",
                    "prioridad": "media",
                    "mensaje": f"Documentacion pendiente: {', '.join(items[:3])}",
                    "unidad_id": unidad.id,
                    "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                    "link": f"/unidades/{unidad.id}",
                })

            vtv = unidad.checklist_documentacion.vtv_fecha_vencimiento
            if vtv and vtv <= date.today() + timedelta(days=30):
                dias = (vtv - date.today()).days
                alertas.append({
                    "tipo": "vtv_vencimiento",
                    "prioridad": "alta" if dias <= 7 else "media",
                    "mensaje": f"VTV vence en {dias} dias" if dias > 0 else "VTV VENCIDA",
                    "unidad_id": unidad.id,
                    "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                    "link": f"/unidades/{unidad.id}",
                })

    orden = {"alta": 0, "media": 1, "baja": 2}
    alertas.sort(key=lambda x: orden.get(x["prioridad"], 2))
    return alertas[:20]


@router.get("/metricas-rapidas", response_model=MetricasRapidasResponse, responses=auth_errors)
async def metricas_rapidas(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """
    Métricas rápidas para widgets del dashboard.

    Contadores livianos diseñados para renderizar rápido en la UI:
    ventas recientes, unidades nuevas, operaciones en curso, y total de clientes.
    """
    hoy = date.today()
    hace_7_dias = hoy - timedelta(days=7)

    ventas_7d = (await db.execute(
        select(func.count(Operacion.id)).where(
            Operacion.active(),
            Operacion.fecha_operacion >= hace_7_dias,
            Operacion.estado == EstadoOperacion.COMPLETADA,
        )
    )).scalar() or 0

    unidades_nuevas = (await db.execute(
        select(func.count(Unidad.id)).where(Unidad.active(), Unidad.fecha_ingreso >= hace_7_dias)
    )).scalar() or 0

    en_proceso = (await db.execute(
        select(func.count(Operacion.id)).where(
            Operacion.active(),
            Operacion.estado == EstadoOperacion.EN_PROCESO
        )
    )).scalar() or 0

    total_clientes = (await db.execute(
        select(func.count(Cliente.id)).where(Cliente.active())
    )).scalar() or 0

    return {
        "ventas_7_dias": ventas_7d,
        "unidades_nuevas_semana": unidades_nuevas,
        "operaciones_en_proceso": en_proceso,
        "total_clientes": total_clientes,
    }


@router.get("/stock-por-marca", response_model=list[StockPorMarcaItem], responses=auth_errors)
async def stock_por_marca(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """
    Distribución de stock actual por marca.

    Retorna la cantidad de unidades (no vendidas) agrupadas por marca,
    ordenadas de mayor a menor. Ideal para gráfico de torta/barras.
    """
    result = await db.execute(
        select(Unidad.marca, func.count(Unidad.id).label("cantidad"))
        .where(Unidad.active(), Unidad.estado != EstadoUnidad.VENDIDO)
        .group_by(Unidad.marca)
        .order_by(func.count(Unidad.id).desc())
    )
    return [{"marca": r.marca, "cantidad": r.cantidad} for r in result.all()]
