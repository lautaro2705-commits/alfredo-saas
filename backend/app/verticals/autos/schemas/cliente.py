from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class ClienteBase(BaseModel):
    nombre: str = Field(..., max_length=100)
    apellido: str = Field(..., max_length=100)
    dni_cuit: str = Field(..., max_length=20)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=200)
    localidad: Optional[str] = Field(None, max_length=100)
    provincia: Optional[str] = Field(None, max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=20)
    observaciones: Optional[str] = Field(None, max_length=5000)


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=100)
    apellido: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=200)
    localidad: Optional[str] = Field(None, max_length=100)
    provincia: Optional[str] = Field(None, max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=20)
    observaciones: Optional[str] = Field(None, max_length=5000)


class ClienteResponse(ClienteBase):
    id: int
    nombre_completo: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
