"""Schemas for billing, subscriptions, and plan management."""
from datetime import datetime
from typing import Optional, Union
from uuid import UUID
from pydantic import BaseModel


# ── Plan info ──

class PlanInfo(BaseModel):
    name: str
    display_name: str
    price_ars: int
    max_usuarios: Union[int, str]  # int or "unlimited"
    max_items: Union[int, str]
    features: list[str]
    # Promo / discount fields (optional)
    promo_price_ars: Optional[int] = None
    promo_label: Optional[str] = None
    annual_price_ars: Optional[int] = None
    annual_label: Optional[str] = None


class PlansResponse(BaseModel):
    vertical: str
    plans: list[PlanInfo]


# ── Subscription ──

class SubscriptionInfo(BaseModel):
    id: UUID
    plan: str
    status: str
    amount: Optional[float] = None
    currency: str = "ARS"
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    mp_preapproval_id: Optional[str] = None

    class Config:
        from_attributes = True


class SubscribeRequest(BaseModel):
    plan: str  # basico, profesional, premium
    payer_email: str


class SubscribeResponse(BaseModel):
    subscription_id: UUID
    mp_init_point: str  # URL to redirect user to MercadoPago
    plan: str
    amount: float


class CancelSubscriptionResponse(BaseModel):
    message: str
    status: str


# ── Usage tracking ──

class UsageInfo(BaseModel):
    usuarios_activos: int
    max_usuarios: Union[int, str]
    items_count: int  # vehicles or sales
    max_items: Union[int, str]
    items_label: str  # "vehiculos" or "ventas"
    storage_mb: float = 0.0


class BillingOverview(BaseModel):
    tenant_name: str
    vertical: str
    plan: str
    plan_display_name: str
    status: str
    trial_end: Optional[datetime] = None
    usage: UsageInfo
    subscription: Optional[SubscriptionInfo] = None


# ── Payment history ──

class PaymentInfo(BaseModel):
    id: UUID
    amount: float
    currency: str
    status: str
    description: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentHistoryResponse(BaseModel):
    payments: list[PaymentInfo]
    total: int
