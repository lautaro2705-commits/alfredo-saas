"""
Modelos para el módulo de Peritaje Digital
Permite realizar inspecciones técnicas y estéticas de vehículos
"""
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin


class EstadoPeritaje(str, enum.Enum):
    """Estados del peritaje"""
    BORRADOR = "borrador"
    COMPLETADO = "completado"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


class TipoPeritaje(str, enum.Enum):
    """Tipos de peritaje según el momento del proceso"""
    TASACION = "tasacion"
    INGRESO_STOCK = "ingreso_stock"
    RETOMA = "retoma"
    PERIODICO = "periodico"


class SectorPeritaje(str, enum.Enum):
    """Sectores del checklist de peritaje"""
    MECANICA = "mecanica"
    ESTETICA = "estetica"
    DOCUMENTACION = "documentacion"


class CalificacionItem(str, enum.Enum):
    """Calificaciones posibles para cada item del checklist"""
    BUENO = "bueno"
    REGULAR = "regular"
    MALO = "malo"
    NA = "na"


class Peritaje(TenantMixin, Base):
    """
    Modelo principal de peritaje/inspección vehicular.
    Puede vincularse a una unidad existente o contener datos de un vehículo
    que aún no está en el sistema (para tasaciones/retomas).
    """
    __tablename__ = "peritajes"

    id = Column(Integer, primary_key=True, index=True)

    # Relación con vehículo existente (opcional)
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=True, index=True)
    operacion_id = Column(Integer, ForeignKey("operaciones.id"), nullable=True, index=True)

    # Datos del vehículo (para cuando no existe en el sistema)
    vehiculo_marca = Column(String(100))
    vehiculo_modelo = Column(String(100))
    vehiculo_version = Column(String(100))
    vehiculo_anio = Column(Integer)
    vehiculo_dominio = Column(String(20))
    vehiculo_kilometraje = Column(Integer)
    vehiculo_color = Column(String(50))
    vehiculo_combustible = Column(String(50))

    # Tipo y estado
    tipo = Column(Enum(TipoPeritaje), nullable=False, default=TipoPeritaje.TASACION)
    estado = Column(Enum(EstadoPeritaje), nullable=False, default=EstadoPeritaje.BORRADOR)

    # Puntajes por sector (0-100)
    puntaje_mecanica = Column(Float, default=0)
    puntaje_estetica = Column(Float, default=0)
    puntaje_documentacion = Column(Float, default=0)
    puntaje_total = Column(Float, default=0)

    # Pesos configurables para el cálculo del puntaje total (suman 100)
    peso_mecanica = Column(Float, default=40)
    peso_estetica = Column(Float, default=35)
    peso_documentacion = Column(Float, default=25)

    # Impacto financiero
    costo_reparaciones_estimado = Column(Float, default=0)
    ajuste_precio_sugerido = Column(Float, default=0)

    # Fechas
    fecha_peritaje = Column(DateTime(timezone=True), server_default=func.now())
    fecha_completado = Column(DateTime(timezone=True), nullable=True)

    # Observaciones
    observaciones_generales = Column(Text)

    # Auditoría
    perito_id = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=False)
    aprobado_por_id = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    unidad = relationship("Unidad", backref="peritajes", foreign_keys=[unidad_id])
    operacion = relationship("Operacion", backref="peritaje", foreign_keys=[operacion_id])
    perito = relationship("PlatformUser", foreign_keys=[perito_id], backref="peritajes_realizados")
    aprobado_por = relationship("PlatformUser", foreign_keys=[aprobado_por_id])
    items = relationship("PeritajeItem", back_populates="peritaje", cascade="all, delete-orphan")
    fotos = relationship("PeritajeFoto", back_populates="peritaje", cascade="all, delete-orphan")

    @property
    def vehiculo_descripcion(self) -> str:
        """Descripción formateada del vehículo"""
        if self.unidad:
            return f"{self.unidad.marca} {self.unidad.modelo} {self.unidad.anio} - {self.unidad.dominio}"
        return f"{self.vehiculo_marca} {self.vehiculo_modelo} {self.vehiculo_anio} - {self.vehiculo_dominio}"

    @property
    def resumen_estado(self) -> str:
        """Resumen textual basado en el puntaje total"""
        if self.puntaje_total >= 80:
            return "Excelente"
        elif self.puntaje_total >= 60:
            return "Bueno"
        elif self.puntaje_total >= 40:
            return "Regular"
        return "Malo"

    @property
    def items_total(self) -> int:
        """Total de items en el checklist"""
        return len(self.items)

    @property
    def items_calificados(self) -> int:
        """Cantidad de items ya calificados"""
        return len([i for i in self.items if i.calificacion is not None])

    @property
    def porcentaje_completado(self) -> float:
        """Porcentaje de completitud del peritaje"""
        if self.items_total == 0:
            return 0
        return round((self.items_calificados / self.items_total) * 100, 1)


class PeritajeItem(TenantMixin, Base):
    """
    Items individuales del checklist de peritaje.
    Cada item pertenece a un sector y tiene una calificación.
    """
    __tablename__ = "peritaje_items"

    id = Column(Integer, primary_key=True, index=True)
    peritaje_id = Column(Integer, ForeignKey("peritajes.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identificación del item
    sector = Column(Enum(SectorPeritaje), nullable=False, index=True)
    codigo_item = Column(String(50), nullable=False)
    nombre_item = Column(String(200), nullable=False)
    orden = Column(Integer, default=0)

    # Evaluación
    calificacion = Column(Enum(CalificacionItem), nullable=True)
    observaciones = Column(Text)
    costo_reparacion_estimado = Column(Float, default=0)
    urgente = Column(Boolean, default=False)

    # Relaciones
    peritaje = relationship("Peritaje", back_populates="items")
    fotos = relationship("PeritajeFoto", back_populates="item", cascade="all, delete-orphan")

    @property
    def valor_puntaje(self) -> int:
        """Valor numérico de la calificación para cálculos"""
        if self.calificacion == CalificacionItem.BUENO:
            return 100
        elif self.calificacion == CalificacionItem.REGULAR:
            return 50
        elif self.calificacion == CalificacionItem.MALO:
            return 0
        return None  # NA no cuenta en el cálculo


class PeritajeFoto(TenantMixin, Base):
    """
    Fotos asociadas a un peritaje.
    Pueden estar vinculadas a un item específico o ser generales del sector.
    Se almacenan en Cloudinary.
    """
    __tablename__ = "peritaje_fotos"

    id = Column(Integer, primary_key=True, index=True)
    peritaje_id = Column(Integer, ForeignKey("peritajes.id", ondelete="CASCADE"), nullable=False, index=True)
    peritaje_item_id = Column(Integer, ForeignKey("peritaje_items.id", ondelete="SET NULL"), nullable=True)

    # Clasificación
    sector = Column(Enum(SectorPeritaje), nullable=False)
    tipo_foto = Column(String(50), default="general")  # general, detalle, defecto
    descripcion = Column(String(255))

    # Datos del archivo (Cloudinary)
    nombre_archivo = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    public_id = Column(String(255), nullable=False)  # ID de Cloudinary para eliminación
    mime_type = Column(String(100))
    tamano_bytes = Column(Integer)

    # Dimensiones
    ancho = Column(Integer)
    alto = Column(Integer)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    peritaje = relationship("Peritaje", back_populates="fotos")
    item = relationship("PeritajeItem", back_populates="fotos")

    @property
    def thumbnail_url(self) -> str:
        """URL del thumbnail (200px) usando transformación de Cloudinary"""
        if self.url:
            return self.url.replace("/upload/", "/upload/w_200,h_200,c_fill/")
        return None

    @property
    def medium_url(self) -> str:
        """URL tamaño medio (400px) para PDF"""
        if self.url:
            return self.url.replace("/upload/", "/upload/w_400,c_limit/")
        return None
