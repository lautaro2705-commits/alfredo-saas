"""Schemas Pydantic para Seguimientos / Agenda."""
from datetime import date, time, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SeguimientoCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    tipo: str = "general"
    prioridad: str = "media"
    fecha_vencimiento: date
    hora: Optional[time] = None
    cliente_id: Optional[int] = None
    interesado_id: Optional[int] = None
    unidad_id: Optional[int] = None
    operacion_id: Optional[int] = None
    asignado_a: Optional[UUID] = None  # Si no se envía, se asigna al creador


class SeguimientoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    prioridad: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    hora: Optional[time] = None
    cliente_id: Optional[int] = None
    interesado_id: Optional[int] = None
    unidad_id: Optional[int] = None
    operacion_id: Optional[int] = None
    asignado_a: Optional[UUID] = None


class SeguimientoCompletarRequest(BaseModel):
    observaciones_cierre: Optional[str] = None


class SeguimientoResponse(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    prioridad: str
    estado: str
    fecha_vencimiento: date
    hora: Optional[time] = None

    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    interesado_id: Optional[int] = None
    interesado_nombre: Optional[str] = None
    unidad_id: Optional[int] = None
    unidad_info: Optional[str] = None
    operacion_id: Optional[int] = None

    asignado_a: UUID
    asignado_nombre: Optional[str] = None
    created_by: UUID
    creador_nombre: Optional[str] = None

    completado_at: Optional[datetime] = None
    observaciones_cierre: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vencido: bool = False
    vence_hoy: bool = False

    model_config = {"from_attributes": True}
