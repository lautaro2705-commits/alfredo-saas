from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from app.verticals.autos.models.costo_directo import CategoriaCosto


class CostoDirectoBase(BaseModel):
    categoria: CategoriaCosto
    descripcion: str = Field(..., max_length=255)
    monto: float = Field(..., gt=0)
    proveedor: Optional[str] = Field(None, max_length=100)
    fecha: Optional[date] = None
    numero_comprobante: Optional[str] = Field(None, max_length=50)
    observaciones: Optional[str] = Field(None, max_length=5000)


class CostoDirectoCreate(CostoDirectoBase):
    unidad_id: int


class CostoDirectoUpdate(BaseModel):
    categoria: Optional[CategoriaCosto] = None
    descripcion: Optional[str] = Field(None, max_length=255)
    monto: Optional[float] = None
    proveedor: Optional[str] = Field(None, max_length=100)
    fecha: Optional[date] = None
    numero_comprobante: Optional[str] = Field(None, max_length=50)
    observaciones: Optional[str] = Field(None, max_length=5000)


class CostoDirectoResponse(CostoDirectoBase):
    id: int
    unidad_id: int
    fecha: date
    created_at: datetime

    class Config:
        from_attributes = True
