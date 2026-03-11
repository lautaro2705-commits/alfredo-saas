from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.verticals.autos.models.usuario import RolUsuario


class UsuarioBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=100)
    nombre: str = Field(..., max_length=100)
    apellido: str = Field(..., max_length=100)
    telefono: Optional[str] = Field(None, max_length=50)
    rol: RolUsuario = RolUsuario.VENDEDOR


class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=6)
    permisos: Optional[List[str]] = None  # Si es None, usa los del rol


class UsuarioUpdate(BaseModel):
    email: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[RolUsuario] = None
    activo: Optional[bool] = None
    password: Optional[str] = None
    permisos: Optional[List[str]] = None


class UsuarioResponse(UsuarioBase):
    id: UUID
    activo: bool
    nombre_completo: str
    permisos: List[str] = []
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    username: str
    password: str
