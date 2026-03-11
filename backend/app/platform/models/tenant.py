"""
Modelo de Tenant (organización/agencia).
Alfredo — gestión de agencias de autos.
"""
import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base


VERTICAL = "autos"  # Alfredo es single-vertical


class PlanTier(str, enum.Enum):
    TRIAL = "trial"
    BASICO = "basico"
    PROFESIONAL = "profesional"
    PREMIUM = "premium"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Datos de la organización
    nombre = Column(String(255), nullable=False)
    razon_social = Column(String(255))
    cuit = Column(String(13), unique=True, index=True)
    email_contacto = Column(String(255), nullable=False)
    telefono = Column(String(50))
    direccion = Column(Text)

    # Tipo de negocio (siempre "autos" en Alfredo)
    vertical = Column(String(20), nullable=False, default=VERTICAL)

    # Plan y estado
    plan = Column(Enum(PlanTier), default=PlanTier.TRIAL)
    activa = Column(Boolean, default=True)

    # Configuración específica del tenant (branding, preferencias, etc.)
    settings = Column(JSONB, default=dict)

    # Límites del plan (se verifican en middleware)
    max_usuarios = Column(String(10), default="2")  # "unlimited" para premium
    max_items = Column(String(10), default="30")  # vehículos

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    trial_ends_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<Tenant {self.nombre} (autos)>"
