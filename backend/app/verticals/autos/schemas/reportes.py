from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class UnidadVendida(BaseModel):
    id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    fecha_venta: date
    precio_compra: float
    costos_directos: float
    gastos_transferencia: float
    costo_total: float
    precio_venta: float
    utilidad_bruta: float
    margen_porcentaje: float


class ReporteUtilidad(BaseModel):
    fecha_desde: date
    fecha_hasta: date

    # Ventas
    cantidad_ventas: int
    total_ventas: float
    total_costo_adquisicion: float
    total_costos_directos: float
    total_gastos_transferencia: float

    # Utilidad bruta
    utilidad_bruta_total: float
    margen_bruto_promedio: float

    # Gastos operativos (caja diaria)
    total_gastos_fijos: float

    # Utilidad neta
    utilidad_neta: float
    margen_neto: float

    # Detalle por unidad
    unidades_vendidas: List[UnidadVendida]


class UnidadStock(BaseModel):
    id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    color: Optional[str]
    estado: str
    dias_en_stock: int
    stock_inmovilizado: bool
    precio_compra: float
    costos_directos: float
    costo_total: float
    precio_publicado: Optional[float]
    margen_esperado: Optional[float]
    documentacion_completa: bool
    items_pendientes: List[str]


class ReporteStock(BaseModel):
    fecha_reporte: date

    # Totales
    total_unidades: int
    unidades_disponibles: int
    unidades_reservadas: int
    unidades_en_reparacion: int
    unidades_inmovilizadas: int

    # Valores
    valor_stock_costo: float
    valor_stock_venta: float
    inversion_total: float

    # Antigüedad promedio
    dias_promedio_stock: float

    # Detalle
    unidades: List[UnidadStock]


class AlertaStock(BaseModel):
    id: int
    tipo: str  # "inmovilizado", "documentacion_pendiente", "vtv_vencida"
    mensaje: str
    unidad_id: int
    unidad_info: str
    dias_en_stock: Optional[int]
    prioridad: str  # "alta", "media", "baja"


class DashboardResumen(BaseModel):
    # Stock
    total_unidades_stock: int
    valor_stock_costo: float
    unidades_inmovilizadas: int

    # Ventas del mes
    ventas_mes_actual: int
    ingresos_mes_actual: float
    utilidad_bruta_mes: float

    # Caja
    saldo_caja_hoy: float
    ingresos_hoy: float
    egresos_hoy: float

    # Alertas
    alertas_activas: List[AlertaStock]

    # Últimas operaciones
    ultimas_ventas: List[dict]
