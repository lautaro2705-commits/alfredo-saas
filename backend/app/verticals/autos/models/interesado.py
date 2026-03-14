from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin
import enum


class ResultadoContacto(str, enum.Enum):
    PENDIENTE = "pendiente"
    INTERESADO = "interesado"
    NO_INTERESADO = "no_interesado"
    SIN_RESPUESTA = "sin_respuesta"


class Interesado(SoftDeleteMixin, TenantMixin, Base):
    """Lista de espera / CRM - personas buscando autos que no tenemos"""
    __tablename__ = "interesados"

    id = Column(Integer, primary_key=True, index=True)

    # Datos del interesado
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    telefono = Column(String(50), nullable=False)
    email = Column(String(100))

    # Que busca
    marca_buscada = Column(String(100), index=True)
    modelo_buscado = Column(String(100), index=True)
    anio_desde = Column(Integer)
    anio_hasta = Column(Integer)
    precio_maximo = Column(Float)
    combustible = Column(String(50))
    transmision = Column(String(50))
    otras_preferencias = Column(Text)

    # Estado
    activo = Column(Boolean, default=True, index=True)
    fecha_contacto = Column(Date)
    observaciones = Column(Text)

    # Auditoria
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    notificaciones = relationship("NotificacionMatch", back_populates="interesado")

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"

    def match_score(self, unidad) -> float:
        """Calcular porcentaje de coincidencia con una unidad"""
        score = 0
        total_criterios = 0

        # Marca (peso alto)
        if self.marca_buscada:
            total_criterios += 3
            if unidad.marca.lower() == self.marca_buscada.lower():
                score += 3

        # Modelo (peso alto)
        if self.modelo_buscado:
            total_criterios += 3
            if self.modelo_buscado.lower() in unidad.modelo.lower():
                score += 3

        # Rango de anio
        if self.anio_desde or self.anio_hasta:
            total_criterios += 2
            anio_ok = True
            if self.anio_desde and unidad.anio < self.anio_desde:
                anio_ok = False
            if self.anio_hasta and unidad.anio > self.anio_hasta:
                anio_ok = False
            if anio_ok:
                score += 2

        # Precio maximo
        if self.precio_maximo and unidad.precio_publicado:
            total_criterios += 2
            if unidad.precio_publicado <= self.precio_maximo:
                score += 2

        # Combustible
        if self.combustible and unidad.combustible:
            total_criterios += 1
            if unidad.combustible.lower() == self.combustible.lower():
                score += 1

        # Transmision
        if self.transmision and unidad.transmision:
            total_criterios += 1
            if unidad.transmision.lower() == self.transmision.lower():
                score += 1

        if total_criterios == 0:
            return 0

        return round((score / total_criterios) * 100, 1)


class NotificacionMatch(TenantMixin, Base):
    """Notificaciones cuando ingresa unidad que matchea con interesado"""
    __tablename__ = "notificaciones_match"

    id = Column(Integer, primary_key=True, index=True)

    interesado_id = Column(Integer, ForeignKey("interesados.id"), nullable=False, index=True)
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=False, index=True)

    score_match = Column(Float)  # Porcentaje de coincidencia
    leida = Column(Boolean, default=False, index=True)
    contactado = Column(Boolean, default=False)
    fecha_contacto = Column(DateTime(timezone=True))
    resultado_contacto = Column(String(50))  # pendiente, interesado, no_interesado, sin_respuesta
    observaciones = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    interesado = relationship("Interesado", back_populates="notificaciones")
    unidad = relationship("Unidad", backref="notificaciones_match")
