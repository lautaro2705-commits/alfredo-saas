from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin


class Proveedor(SoftDeleteMixin, TenantMixin, Base):
    """Proveedores de servicios (mecánicos, pintores, gestores, etc.)"""
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False, index=True)
    tipo = Column(String(100))  # Categoría libre: mecánica, chapa/pintura, gestoría, etc.
    telefono = Column(String(50))
    email = Column(String(100))
    direccion = Column(String(300))
    cuit = Column(String(20))
    notas = Column(Text)
    activo = Column(Boolean, default=True, index=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
