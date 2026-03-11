"""
Modelo de suscripción y billing.
Integración con MercadoPago pagos recurrentes.
"""
import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SubscriptionStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REFUNDED = "refunded"


class Subscription(Base):
    """Suscripción activa de un tenant."""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Plan contratado
    plan = Column(String(50), nullable=False)  # basico, profesional, premium
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)

    # MercadoPago
    mp_preapproval_id = Column(String(255), unique=True)  # ID de suscripción en MP
    mp_payer_email = Column(String(255))

    # Período
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    trial_end = Column(DateTime(timezone=True))

    # Precio (en ARS)
    amount = Column(Numeric(10, 2))
    currency = Column(String(3), default="ARS")

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    cancelled_at = Column(DateTime(timezone=True))

    # Relationships
    tenant = relationship("Tenant", backref="subscriptions")

    def is_active(self) -> bool:
        return self.status in (SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE)

    def __repr__(self):
        return f"<Subscription {self.plan} ({self.status.value}) tenant={self.tenant_id}>"


class PaymentRecord(Base):
    """Historial de pagos — cada cobro de MercadoPago queda registrado."""
    __tablename__ = "payment_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    subscription_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Datos del pago
    mp_payment_id = Column(String(255), unique=True)  # ID del pago en MercadoPago
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="ARS")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)

    # Detalle
    description = Column(String(500))
    mp_response = Column(JSONB)  # Respuesta completa de MP para debugging

    # Timestamps
    paid_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    subscription = relationship("Subscription", backref="payments")

    def __repr__(self):
        return f"<Payment {self.mp_payment_id} ${self.amount} {self.status.value}>"
