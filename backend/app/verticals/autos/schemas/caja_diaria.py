from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from datetime import date, datetime
from app.verticals.autos.models.caja_diaria import TipoMovimiento, CategoriaGasto


class CajaDiariaBase(BaseModel):
    tipo: TipoMovimiento
    categoria: CategoriaGasto
    descripcion: str = Field(..., max_length=255)
    monto: float = Field(..., gt=0)
    fecha: Optional[date] = None
    medio_pago: Optional[str] = Field(default=None, max_length=50)
    numero_comprobante: Optional[str] = Field(default=None, max_length=50)
    observaciones: Optional[str] = None

    @field_validator('tipo', mode='before')
    @classmethod
    def validate_tipo(cls, v):
        """Validar y convertir tipo de movimiento"""
        if v is None or v == "" or v == "null":
            raise ValueError("Tipo de movimiento es requerido")
        if isinstance(v, str):
            return TipoMovimiento(v.lower())
        return v

    @field_validator('categoria', mode='before')
    @classmethod
    def validate_categoria(cls, v):
        """Validar y convertir categoria"""
        if v is None or v == "" or v == "null":
            raise ValueError("Categoria es requerida")
        if isinstance(v, str):
            return CategoriaGasto(v.lower())
        return v

    @field_validator('monto', mode='before')
    @classmethod
    def validate_monto(cls, v):
        """Validar monto"""
        if v is None or v == "" or v == "null":
            raise ValueError("Monto es requerido")
        try:
            val = float(v)
            if val <= 0:
                raise ValueError("Monto debe ser mayor a 0")
            return val
        except (ValueError, TypeError):
            raise ValueError("Monto debe ser un numero valido")

    @field_validator('fecha', mode='before')
    @classmethod
    def validate_fecha(cls, v):
        """Validar fecha"""
        if v is None or v == "" or v == "null" or v == "undefined":
            return None
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)
            except ValueError:
                return None
        return v

    @field_validator('medio_pago', 'numero_comprobante', 'observaciones', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convertir strings vacíos a None"""
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class CajaDiariaCreate(CajaDiariaBase):
    operacion_id: Optional[int] = None


class CajaDiariaResponse(CajaDiariaBase):
    id: int
    fecha: date
    operacion_id: Optional[int]
    cierre_caja_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class CierreCajaCreate(BaseModel):
    mes: int = Field(..., ge=1, le=12)
    anio: int = Field(..., ge=2000, le=2100)
    observaciones: Optional[str] = None


class CierreCajaResponse(BaseModel):
    id: int
    mes: int
    anio: int
    total_ingresos: float
    total_egresos: float
    total_costos_directos: float
    utilidad_bruta: float
    utilidad_neta: float
    cerrado: bool
    fecha_cierre: Optional[datetime]
    observaciones: Optional[str]
    created_at: datetime
    movimientos: List[CajaDiariaResponse] = []

    class Config:
        from_attributes = True


class ResumenCajaDiaria(BaseModel):
    fecha: date
    total_ingresos: float
    total_egresos: float
    saldo: float
    cantidad_movimientos: int
