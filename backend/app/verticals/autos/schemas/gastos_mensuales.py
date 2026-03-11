from pydantic import BaseModel
from typing import List, Optional
from datetime import date


class GastoUnificado(BaseModel):
    """Un gasto normalizado, ya sea de CajaDiaria o CostoDirecto."""
    id: int
    fecha: date
    origen: str          # "operativo" o "directo"
    categoria: str
    descripcion: str
    monto: float
    # CajaDiaria
    medio_pago: Optional[str] = None
    # CostoDirecto
    unidad_id: Optional[int] = None
    unidad_descripcion: Optional[str] = None  # "Ford Focus (ABC123)"
    proveedor: Optional[str] = None
    numero_comprobante: Optional[str] = None

    class Config:
        from_attributes = True


class ResumenCategoria(BaseModel):
    """Resumen de una categoría de gasto."""
    categoria: str
    origen: str
    total: float
    cantidad: int


class GastosMensualesResponse(BaseModel):
    """Respuesta completa del endpoint de gastos mensuales."""
    mes: int
    anio: int
    periodo: str  # "03/2026"

    total_gastos_operativos: float
    total_costos_directos: float
    gran_total: float

    cantidad_gastos_operativos: int
    cantidad_costos_directos: int
    cantidad_total: int

    resumen_por_categoria: List[ResumenCategoria]
    gastos: List[GastoUnificado]
