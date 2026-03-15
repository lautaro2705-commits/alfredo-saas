from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


class InteresadoBase(BaseModel):
    nombre: str = Field(..., max_length=100)
    apellido: str = Field(..., max_length=100)
    telefono: str = Field(..., max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    marca_buscada: Optional[str] = Field(None, max_length=100)
    modelo_buscado: Optional[str] = Field(None, max_length=100)
    anio_desde: Optional[int] = Field(None, ge=1900, le=2100)
    anio_hasta: Optional[int] = Field(None, ge=1900, le=2100)
    precio_maximo: Optional[float] = Field(None, ge=0)
    combustible: Optional[str] = Field(None, max_length=50)
    transmision: Optional[str] = Field(None, max_length=50)
    otras_preferencias: Optional[str] = Field(None, max_length=2000)
    observaciones: Optional[str] = Field(None, max_length=5000)

    @field_validator('email', 'marca_buscada', 'modelo_buscado', 'combustible',
                     'transmision', 'otras_preferencias', 'observaciones', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class InteresadoCreate(InteresadoBase):
    activo: bool = True


class InteresadoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=100)
    apellido: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    marca_buscada: Optional[str] = Field(None, max_length=100)
    modelo_buscado: Optional[str] = Field(None, max_length=100)
    anio_desde: Optional[int] = Field(None, ge=1900, le=2100)
    anio_hasta: Optional[int] = Field(None, ge=1900, le=2100)
    precio_maximo: Optional[float] = Field(None, ge=0)
    combustible: Optional[str] = Field(None, max_length=50)
    transmision: Optional[str] = Field(None, max_length=50)
    otras_preferencias: Optional[str] = Field(None, max_length=2000)
    observaciones: Optional[str] = Field(None, max_length=5000)
    activo: Optional[bool] = None
    fecha_contacto: Optional[date] = None

    @field_validator('email', 'marca_buscada', 'modelo_buscado', 'combustible',
                     'transmision', 'otras_preferencias', 'observaciones', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class InteresadoResponse(InteresadoBase):
    id: int
    activo: bool
    fecha_contacto: Optional[date] = None
    nombre_completo: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InteresadoListResponse(BaseModel):
    id: int
    nombre_completo: str
    telefono: str
    marca_buscada: Optional[str] = None
    modelo_buscado: Optional[str] = None
    precio_maximo: Optional[float] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== NOTIFICACIONES MATCH ====================

class NotificacionMatchBase(BaseModel):
    interesado_id: int
    unidad_id: int


class NotificacionMatchCreate(NotificacionMatchBase):
    score_match: Optional[float] = None


class NotificacionMatchUpdate(BaseModel):
    leida: Optional[bool] = None
    contactado: Optional[bool] = None
    resultado_contacto: Optional[str] = Field(None, max_length=1000)
    observaciones: Optional[str] = Field(None, max_length=5000)


class UnidadMatchSimple(BaseModel):
    id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    precio_publicado: Optional[float] = None

    class Config:
        from_attributes = True


class InteresadoMatchSimple(BaseModel):
    id: int
    nombre_completo: str
    telefono: str

    class Config:
        from_attributes = True


class NotificacionMatchResponse(NotificacionMatchBase):
    id: int
    score_match: Optional[float] = None
    leida: bool
    contactado: bool
    fecha_contacto: Optional[datetime] = None
    resultado_contacto: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime
    interesado: InteresadoMatchSimple
    unidad: UnidadMatchSimple

    class Config:
        from_attributes = True
