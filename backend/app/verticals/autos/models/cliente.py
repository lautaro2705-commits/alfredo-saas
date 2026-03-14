from sqlalchemy import Column, Integer, String, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin


class Cliente(SoftDeleteMixin, TenantMixin, Base):
    __tablename__ = "clientes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "dni_cuit", name="uq_cliente_tenant_dni"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Datos personales
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    dni_cuit = Column(String(20), nullable=False, index=True)  # unique per-tenant
    telefono = Column(String(50))
    email = Column(String(100))

    # Dirección
    direccion = Column(String(200))
    localidad = Column(String(100))
    provincia = Column(String(100))
    codigo_postal = Column(String(20))

    # Notas
    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    operaciones = relationship("Operacion", back_populates="cliente")

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"
