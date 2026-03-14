"""
Schemas de response para el dashboard.

Estos schemas documentan la estructura exacta que devuelven los endpoints
del dashboard en Swagger/Redoc, y además agregan validación en runtime.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Sub-schemas del resumen ──

class StockResumen(BaseModel):
    total_unidades: int
    valor_costo: Optional[float] = Field(
        None, description="Solo visible para usuarios admin"
    )
    inmovilizadas: int
    disponibles: int
    reservadas: int


class VentasMesResumen(BaseModel):
    cantidad: int
    ingresos: float
    utilidad_bruta: Optional[float] = Field(
        None, description="Solo visible para usuarios admin"
    )
    gastos_mes: float
    cantidad_mes_anterior: int
    ingresos_mes_anterior: float
    variacion_cantidad: int = Field(
        description="Diferencia cantidad vs mes anterior (positivo = mejora)"
    )
    variacion_ingresos: float = Field(
        description="Diferencia ingresos vs mes anterior"
    )


class CajaHoyResumen(BaseModel):
    ingresos: float
    egresos: float
    saldo: float


class ChequesResumen(BaseModel):
    por_cobrar_7_dias: int
    monto_por_cobrar: float
    por_pagar_7_dias: int
    monto_por_pagar: float


class AlertaItem(BaseModel):
    tipo: str = Field(
        description="Tipo de alerta: inmovilizado, documentacion_pendiente, "
        "vtv_vencimiento, cheque_por_cobrar, cheque_por_pagar, seguimiento_pendiente"
    )
    prioridad: str = Field(description="alta | media | baja")
    mensaje: str
    unidad_id: Optional[UUID] = None
    unidad_info: str
    link: str


class UltimaVentaItem(BaseModel):
    id: UUID
    fecha: str
    unidad: str
    cliente: str
    monto: float


# ── Response principal ──

class DashboardResumenResponse(BaseModel):
    """Response del dashboard principal con todas las métricas clave."""
    stock: StockResumen
    ventas_mes: VentasMesResumen
    caja_hoy: CajaHoyResumen
    cheques: ChequesResumen
    alertas: list[AlertaItem]
    ultimas_ventas: list[UltimaVentaItem]
    seguimientos_pendientes: int

    class Config:
        json_schema_extra = {
            "example": {
                "stock": {
                    "total_unidades": 45,
                    "valor_costo": 125000000,
                    "inmovilizadas": 3,
                    "disponibles": 38,
                    "reservadas": 4,
                },
                "ventas_mes": {
                    "cantidad": 12,
                    "ingresos": 48000000,
                    "utilidad_bruta": 9600000,
                    "gastos_mes": 2100000,
                    "cantidad_mes_anterior": 10,
                    "ingresos_mes_anterior": 40000000,
                    "variacion_cantidad": 2,
                    "variacion_ingresos": 8000000,
                },
                "caja_hoy": {
                    "ingresos": 3500000,
                    "egresos": 1200000,
                    "saldo": 2300000,
                },
                "cheques": {
                    "por_cobrar_7_dias": 2,
                    "monto_por_cobrar": 4500000,
                    "por_pagar_7_dias": 1,
                    "monto_por_pagar": 2000000,
                },
                "alertas": [
                    {
                        "tipo": "cheque_por_cobrar",
                        "prioridad": "alta",
                        "mensaje": "Cheque $1,500,000 vence en 2 dias",
                        "unidad_id": None,
                        "unidad_info": "Banco Nación - 12345678",
                        "link": "/cheques",
                    }
                ],
                "ultimas_ventas": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "fecha": "2026-03-10",
                        "unidad": "Toyota Hilux",
                        "cliente": "Juan Pérez",
                        "monto": 15000000,
                    }
                ],
                "seguimientos_pendientes": 3,
            }
        }


# ── Métricas rápidas ──

class MetricasRapidasResponse(BaseModel):
    """Métricas numéricas para widgets del dashboard."""
    ventas_7_dias: int = Field(description="Ventas completadas en los últimos 7 días")
    unidades_nuevas_semana: int = Field(description="Unidades ingresadas en los últimos 7 días")
    operaciones_en_proceso: int = Field(description="Operaciones con estado EN_PROCESO")
    total_clientes: int = Field(description="Total de clientes activos del tenant")

    class Config:
        json_schema_extra = {
            "example": {
                "ventas_7_dias": 4,
                "unidades_nuevas_semana": 6,
                "operaciones_en_proceso": 2,
                "total_clientes": 187,
            }
        }


# ── Stock por marca ──

class StockPorMarcaItem(BaseModel):
    marca: str
    cantidad: int

    class Config:
        json_schema_extra = {"example": {"marca": "Toyota", "cantidad": 12}}
