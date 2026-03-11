from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin
import enum


class AccionActividad(str, enum.Enum):
    CREAR = "crear"
    EDITAR = "editar"
    ELIMINAR = "eliminar"
    VENDER = "vender"
    COMPLETAR = "completar"
    CANCELAR = "cancelar"
    INGRESAR = "ingresar"
    RESERVAR = "reservar"


class EntidadActividad(str, enum.Enum):
    UNIDAD = "unidad"
    OPERACION = "operacion"
    CLIENTE = "cliente"
    CAJA = "caja"
    COSTO = "costo"
    CHEQUE = "cheque"
    SEGUIMIENTO = "seguimiento"
    INTERESADO = "interesado"


class Actividad(TenantMixin, Base):
    """Log de actividades / auditoría del sistema"""
    __tablename__ = "actividades"

    id = Column(Integer, primary_key=True, index=True)
    accion = Column(Enum(AccionActividad), nullable=False, index=True)
    entidad = Column(Enum(EntidadActividad), nullable=False, index=True)
    entidad_id = Column(Integer)
    descripcion = Column(String(500), nullable=False)
    datos_extra = Column(Text)  # JSON opcional con info contextual

    # Auditoría
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relaciones
    usuario = relationship("PlatformUser")


async def registrar_actividad(db, usuario_id, accion: AccionActividad,
                              entidad: EntidadActividad, entidad_id: int,
                              descripcion: str, datos_extra: str = None):
    """Helper para registrar una actividad en el log.

    Nota: db.add() es sincrónico incluso con AsyncSession,
    pero la función es async porque los callers usan `await`.
    """
    try:
        actividad = Actividad(
            accion=accion,
            entidad=entidad,
            entidad_id=entidad_id,
            descripcion=descripcion,
            datos_extra=datos_extra,
            usuario_id=usuario_id
        )
        db.add(actividad)
        # No hacemos commit aquí - se commitea con la transacción principal
    except Exception:
        pass  # No queremos que el logging rompa la operación principal
