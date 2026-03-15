"""Schemas de autenticación y onboarding."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.security.password_validator import validate_password_strength


# ── Login ──
class LoginRequest(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    tenant_id: UUID
    tenant_name: str
    vertical: str
    plan: str
    rol: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Onboarding (registro de nueva agencia) ──
class OnboardingRequest(BaseModel):
    """Una nueva agencia de autos se registra en Alfredo."""
    # Datos del tenant
    nombre_agencia: str = Field(..., min_length=2, max_length=255)
    email_contacto: EmailStr
    telefono: Optional[str] = None
    cuit: Optional[str] = None

    # Datos del admin (primer usuario)
    admin_nombre: str = Field(..., min_length=2, max_length=100)
    admin_apellido: str = Field(..., min_length=2, max_length=100)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=12)

    @field_validator("admin_password")
    @classmethod
    def password_strength(cls, v, info):
        email = info.data.get("admin_email")
        errors = validate_password_strength(v, email=email)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class OnboardingResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    vertical: str
    plan: str
    trial_ends_at: datetime
    admin_user_id: UUID
    access_token: str
    refresh_token: str
    message: str = "Agencia registrada exitosamente. Trial de 14 días activado."


# ── User info ──
class UserProfile(BaseModel):
    id: UUID
    username: str
    email: str
    nombre: str
    apellido: str
    rol: str
    tenant_id: UUID
    tenant_name: str
    vertical: str
    plan: str
    is_platform_admin: bool

    class Config:
        from_attributes = True


# ── Password Reset ──
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=12)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class MessageResponse(BaseModel):
    message: str
