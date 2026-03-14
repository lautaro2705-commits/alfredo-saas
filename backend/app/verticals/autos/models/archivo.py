from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin
import enum


class TipoDocumentoArchivo(str, enum.Enum):
    TITULO = "titulo"
    FORM_08 = "form_08"
    VPA = "vpa"
    VTV = "vtv"
    INFORME_DOMINIO = "informe_dominio"
    CEDULA = "cedula"
    FACTURA_COMPRA = "factura_compra"
    BOLETO_COMPRAVENTA = "boleto_compraventa"
    FOTO_FRENTE = "foto_frente"
    FOTO_LATERAL = "foto_lateral"
    FOTO_INTERIOR = "foto_interior"
    FOTO_MOTOR = "foto_motor"
    FOTO_DOCUMENTO = "foto_documento"
    OTRO = "otro"


class ArchivoUnidad(SoftDeleteMixin, TenantMixin, Base):
    """Archivos y fotos adjuntos a una unidad (legajo digital)"""
    __tablename__ = "archivos_unidad"

    id = Column(Integer, primary_key=True, index=True)

    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=False, index=True)
    tipo_documento = Column(Enum(TipoDocumentoArchivo), nullable=False, index=True)

    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo = Column(String(500), nullable=False)
    mime_type = Column(String(100))
    tamano_bytes = Column(Integer)
    descripcion = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    unidad = relationship("Unidad", backref="archivos")

    @property
    def tamano_legible(self) -> str:
        """Retorna el tamano en formato legible (KB, MB)"""
        if not self.tamano_bytes:
            return "N/A"
        if self.tamano_bytes < 1024:
            return f"{self.tamano_bytes} B"
        if self.tamano_bytes < 1024 * 1024:
            return f"{self.tamano_bytes / 1024:.1f} KB"
        return f"{self.tamano_bytes / (1024 * 1024):.1f} MB"

    @property
    def es_imagen(self) -> bool:
        """Verifica si el archivo es una imagen"""
        if not self.mime_type:
            return False
        return self.mime_type.startswith("image/")
