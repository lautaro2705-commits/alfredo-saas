from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin
import enum


class CategoriaCosto(str, enum.Enum):
    MECANICA = "mecanica"
    ELECTRICIDAD = "electricidad"
    CHAPA_PINTURA = "chapa_pintura"
    TAPICERIA = "tapiceria"
    NEUMATICOS = "neumaticos"
    CRISTALES = "cristales"
    GESTORIA = "gestoria"
    LAVADO = "lavado"
    COMBUSTIBLE = "combustible"
    GRUA = "grua"
    VTV = "vtv"
    OTROS = "otros"


class CostoDirecto(SoftDeleteMixin, TenantMixin, Base):
    """
    Costos vinculados directamente a una unidad específica.
    Incluye: reparaciones, gestoría, lavado, etc.
    """
    __tablename__ = "costos_directos"

    id = Column(Integer, primary_key=True, index=True)
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=False, index=True)

    categoria = Column(Enum(CategoriaCosto), nullable=False)
    descripcion = Column(String(255), nullable=False)
    monto = Column(Float, nullable=False)
    proveedor = Column(String(100))

    fecha = Column(Date, nullable=False, server_default=func.current_date())

    # Comprobante (número de factura, recibo, etc.)
    numero_comprobante = Column(String(50))
    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    unidad = relationship("Unidad", back_populates="costos_directos")
