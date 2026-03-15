from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.verticals.autos.models.archivo import TipoDocumentoArchivo


class ArchivoBase(BaseModel):
    tipo_documento: TipoDocumentoArchivo
    descripcion: Optional[str] = Field(None, max_length=1000)


class ArchivoCreate(ArchivoBase):
    unidad_id: int
    nombre_archivo: str = Field(..., max_length=255)
    ruta_archivo: str = Field(..., max_length=500)
    mime_type: Optional[str] = Field(None, max_length=100)
    tamano_bytes: Optional[int] = None


class ArchivoResponse(ArchivoBase):
    id: int
    unidad_id: int
    nombre_archivo: str
    ruta_archivo: str
    mime_type: Optional[str] = None
    tamano_bytes: Optional[int] = None
    tamano_legible: str
    es_imagen: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ArchivoListResponse(BaseModel):
    id: int
    tipo_documento: TipoDocumentoArchivo
    nombre_archivo: str
    tamano_legible: str
    es_imagen: bool
    created_at: datetime

    class Config:
        from_attributes = True
