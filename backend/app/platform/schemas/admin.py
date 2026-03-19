"""Schemas for super-admin endpoints."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


# ── Tenant listing ──

class TenantSummary(BaseModel):
    id: UUID
    nombre: str
    vertical: str
    plan: str
    activa: bool
    email_contacto: str
    cuit: Optional[str] = None
    created_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    user_count: int = 0
    item_count: int = 0

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    tenants: list[TenantSummary]
    total: int
    page: int = 1
    page_size: int = 50
    total_pages: int = 1


# ── Tenant detail ──

class TenantUserInfo(BaseModel):
    id: UUID
    username: str
    email: str
    nombre: str
    apellido: str
    rol: str
    activo: bool
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantSubscriptionInfo(BaseModel):
    id: UUID
    plan: str
    status: str
    amount: Optional[float] = None
    currency: str = "ARS"
    mp_preapproval_id: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantDetail(BaseModel):
    id: UUID
    nombre: str
    razon_social: Optional[str] = None
    cuit: Optional[str] = None
    email_contacto: str
    telefono: Optional[str] = None
    vertical: str
    plan: str
    activa: bool
    max_usuarios: str
    max_items: str
    settings: Optional[dict] = None
    created_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    users: list[TenantUserInfo] = []
    subscription: Optional[TenantSubscriptionInfo] = None
    item_count: int = 0


# ── Tenant update ──

class TenantUpdate(BaseModel):
    activa: Optional[bool] = None
    plan: Optional[str] = None
    max_usuarios: Optional[str] = None
    max_items: Optional[str] = None


# ── Platform metrics ──

class PlatformMetrics(BaseModel):
    total_tenants: int
    active_tenants: int
    trial_tenants: int
    paying_tenants: int
    tenants_by_vertical: dict[str, int]
    tenants_by_plan: dict[str, int]
    total_users: int
    total_revenue_ars: float
    mrr_estimated: float = 0  # MRR estimado basado en planes activos
    recent_signups: int  # last 7 days


# ── Impersonation ──

class ImpersonateResponse(BaseModel):
    access_token: str
    tenant_id: UUID
    tenant_name: str
    vertical: str
    plan: str
    message: str


# ── Gift access ──

class GiftRequest(BaseModel):
    """Crear una cuenta con acceso regalado."""
    # Datos de la agencia
    nombre_agencia: str
    email_contacto: EmailStr
    telefono: Optional[str] = None

    # Datos del usuario admin
    admin_nombre: str
    admin_apellido: str
    admin_email: EmailStr
    admin_password: str  # sin validación compleja — es un regalo

    # Qué se regala
    plan: str = "profesional"   # trial, basico, profesional, premium
    dias: int = 90              # duración del acceso
    motivo: Optional[str] = None  # "amigo", "demo", "partner", etc.


class GiftResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    plan: str
    acceso_hasta: datetime
    admin_email: str
    message: str
