from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ProveedorCreate(BaseModel):
    nombre: str = Field(..., max_length=200)
    tipo: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=300)
    cuit: Optional[str] = Field(None, max_length=20)
    notas: Optional[str] = None


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=200)
    tipo: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=300)
    cuit: Optional[str] = Field(None, max_length=20)
    notas: Optional[str] = None
    activo: Optional[bool] = None


class ProveedorResponse(BaseModel):
    id: int
    nombre: str
    tipo: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    cuit: Optional[str] = None
    notas: Optional[str] = None
    activo: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Campos calculados (se llenan en el router)
    total_gastado: Optional[float] = None
    cantidad_trabajos: Optional[int] = None

    class Config:
        from_attributes = True
