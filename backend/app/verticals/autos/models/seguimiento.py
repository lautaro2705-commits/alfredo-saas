"""
Modelo de Seguimientos / Agenda.
Permite agendar tareas, recordatorios y seguimientos vinculados a clientes,
interesados, unidades u operaciones.
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Date, Time, DateTime,
    ForeignKey, Enum, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin


class TipoSeguimiento(str, enum.Enum):
    LLAMADA = "llamada"
    ENTREGA = "entrega"
    PAGO = "pago"
    DOCUMENTACION = "documentacion"
    GENERAL = "general"


class PrioridadSeguimiento(str, enum.Enum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"


class EstadoSeguimiento(str, enum.Enum):
    PENDIENTE = "pendiente"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"


class Seguimiento(SoftDeleteMixin, TenantMixin, Base):
    __tablename__ = "seguimientos"

    id = Column(Integer, primary_key=True, index=True)

    # Datos de la tarea
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(50), nullable=False, default=TipoSeguimiento.GENERAL.value)
    prioridad = Column(String(20), nullable=False, default=PrioridadSeguimiento.MEDIA.value)
    estado = Column(String(20), nullable=False, default=EstadoSeguimiento.PENDIENTE.value, index=True)

    # Cuándo
    fecha_vencimiento = Column(Date, nullable=False, index=True)
    hora = Column(Time, nullable=True)

    # Vínculos opcionales
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True)
    interesado_id = Column(Integer, ForeignKey("interesados.id", ondelete="SET NULL"), nullable=True)
    unidad_id = Column(Integer, ForeignKey("unidades.id", ondelete="SET NULL"), nullable=True)
    operacion_id = Column(Integer, ForeignKey("operaciones.id", ondelete="SET NULL"), nullable=True)

    # Asignación
    asignado_a = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=False, index=True)

    # Cierre
    completado_at = Column(DateTime(timezone=True), nullable=True)
    observaciones_cierre = Column(Text, nullable=True)

    # Auditoría
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    interesado = relationship("Interesado", foreign_keys=[interesado_id])
    unidad = relationship("Unidad", foreign_keys=[unidad_id])
    operacion = relationship("Operacion", foreign_keys=[operacion_id])
    asignado = relationship("PlatformUser", foreign_keys=[asignado_a])
    creador = relationship("PlatformUser", foreign_keys=[created_by])

    @property
    def vencido(self) -> bool:
        from datetime import date
        return (
            self.estado == EstadoSeguimiento.PENDIENTE.value
            and self.fecha_vencimiento < date.today()
        )

    @property
    def vence_hoy(self) -> bool:
        from datetime import date
        return self.fecha_vencimiento == date.today()
