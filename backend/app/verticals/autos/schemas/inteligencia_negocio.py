from pydantic import BaseModel
from typing import List, Optional
from datetime import date


class CostoOportunidadUnidad(BaseModel):
    """Costo de oportunidad diario de una unidad"""
    unidad_id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    dias_en_stock: int
    costo_total: float
    tasa_diaria: float  # Tasa diaria aplicada
    costo_oportunidad_diario: float  # Costo diario en $
    costo_oportunidad_acumulado: float  # Costo acumulado desde ingreso
    precio_publicado: Optional[float] = None
    requiere_repricing: bool = False  # Si supera dias_alerta_repricing


class ROIPorMarcaModelo(BaseModel):
    """ROI calculado por marca/modelo"""
    marca: str
    modelo: Optional[str] = None  # None si es resumen por marca
    cantidad_vendidas: int
    precio_venta_promedio: float
    costo_total_promedio: float
    utilidad_promedio: float
    roi_promedio: float  # Porcentaje
    dias_stock_promedio: float
    costo_oportunidad_promedio: float


class AlertaRepricing(BaseModel):
    """Alerta de repricing para unidad con mas de X dias sin venderse"""
    unidad_id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    dias_en_stock: int
    precio_publicado: Optional[float] = None
    precio_sugerido: Optional[float] = None  # Basado en ventas similares
    costo_total: float
    utilidad_minima_sugerida: Optional[float] = None


class ResumenInteligenciaNegocio(BaseModel):
    """Resumen general de inteligencia de negocio"""
    # Metricas generales
    total_unidades_stock: int
    capital_inmovilizado: float  # Suma de costo_total de todas las unidades en stock
    costo_oportunidad_total_diario: float
    costo_oportunidad_total_mensual: float

    # Alertas
    unidades_requieren_repricing: int
    unidades_stock_inmovilizado: int

    # ROI historico
    roi_promedio_ultimo_mes: Optional[float] = None
    roi_promedio_ultimo_trimestre: Optional[float] = None

    # Top performers
    marca_mas_rentable: Optional[str] = None
    modelo_mas_rentable: Optional[str] = None


class AnalisisUnidadDetallado(BaseModel):
    """Analisis detallado de rentabilidad de una unidad"""
    unidad_id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    fecha_ingreso: date
    dias_en_stock: int

    # Costos
    precio_compra: float
    gastos_transferencia: float
    costos_directos: float
    costo_total: float

    # Costo de oportunidad
    tasa_anual: float
    tasa_diaria: float
    costo_oportunidad_acumulado: float

    # Precios
    precio_publicado: Optional[float] = None
    precio_minimo: Optional[float] = None

    # Rentabilidad proyectada
    utilidad_bruta_si_vende_hoy: Optional[float] = None
    roi_si_vende_hoy: Optional[float] = None
    utilidad_neta_ajustada: Optional[float] = None  # Utilidad - Costo oportunidad

    # Comparacion mercado
    precio_promedio_similares: Optional[float] = None
    dias_promedio_venta_similares: Optional[float] = None


class HistorialROIResponse(BaseModel):
    """Historial de ROI por periodo"""
    periodo: str  # "2024-01", "2024-Q1", etc.
    ventas_totales: int
    utilidad_total: float
    costo_oportunidad_total: float
    roi_bruto: float
    roi_neto: float  # Considerando costo oportunidad
