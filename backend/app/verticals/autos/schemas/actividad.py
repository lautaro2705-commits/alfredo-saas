from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class ActividadResponse(BaseModel):
    id: int
    accion: str
    entidad: str
    entidad_id: Optional[int] = None
    descripcion: str
    datos_extra: Optional[str] = None
    usuario_id: UUID
    usuario_nombre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
