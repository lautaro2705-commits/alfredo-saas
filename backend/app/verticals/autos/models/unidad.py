from typing import Optional
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin
import enum


class EstadoUnidad(str, enum.Enum):
    DISPONIBLE = "disponible"
    RESERVADO = "reservado"
    VENDIDO = "vendido"
    EN_REPARACION = "en_reparacion"
    RETOMA_PENDIENTE = "retoma_pendiente"


class OrigenUnidad(str, enum.Enum):
    COMPRA_DIRECTA = "compra_directa"
    RETOMA = "retoma"
    CONSIGNACION = "consignacion"


class Unidad(SoftDeleteMixin, TenantMixin, Base):
    __tablename__ = "unidades"
    __table_args__ = (
        UniqueConstraint("tenant_id", "dominio", name="uq_unidad_tenant_dominio"),
        UniqueConstraint("tenant_id", "numero_chasis", name="uq_unidad_tenant_chasis"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Datos del vehículo
    marca = Column(String(100), nullable=False, index=True)
    modelo = Column(String(100), nullable=False, index=True)
    version = Column(String(100))
    anio = Column(Integer, nullable=False)
    color = Column(String(50))
    kilometraje = Column(Integer)
    combustible = Column(String(50))  # Nafta, Diesel, GNC, Híbrido, Eléctrico
    transmision = Column(String(50))  # Manual, Automática

    # Identificación legal
    dominio = Column(String(20), nullable=False, index=True)  # Patente — unique per-tenant
    numero_chasis = Column(String(50))  # unique per-tenant
    numero_motor = Column(String(50))

    # Estado y origen
    estado = Column(Enum(EstadoUnidad), default=EstadoUnidad.DISPONIBLE)
    origen = Column(Enum(OrigenUnidad), default=OrigenUnidad.COMPRA_DIRECTA)

    # Costos de adquisición
    precio_compra = Column(Float, nullable=False, default=0)
    gastos_transferencia = Column(Float, default=0)

    # Precio de venta
    precio_publicado = Column(Float)
    precio_minimo = Column(Float)  # Precio mínimo aceptable

    # Fechas importantes
    fecha_ingreso = Column(Date, nullable=False, server_default=func.current_date())
    fecha_venta = Column(Date)

    # Notas
    observaciones = Column(Text)
    ubicacion = Column(String(100))  # Sucursal o ubicación física

    # Fotos (URLs separadas por coma o JSON)
    fotos = Column(Text)

    # Precios de mercado (cache de consultas externas)
    valor_mercado = Column(Float, nullable=True)  # Promedio de precios encontrados
    valor_mercado_min = Column(Float, nullable=True)  # Precio mínimo encontrado
    valor_mercado_max = Column(Float, nullable=True)  # Precio máximo encontrado
    valor_mercado_cantidad = Column(Integer, nullable=True)  # Cantidad de resultados
    fecha_ultima_consulta_mercado = Column(DateTime(timezone=True), nullable=True)

    # Peritaje (último peritaje realizado)
    puntaje_ultimo_peritaje = Column(Float, nullable=True)  # Puntaje 0-100
    fecha_ultimo_peritaje = Column(DateTime(timezone=True), nullable=True)

    # MercadoLibre
    mercadolibre_id = Column(String(50), unique=True, nullable=True)  # ID de la publicación en ML
    mercadolibre_status = Column(String(20), nullable=True)  # active, paused, closed, under_review
    mercadolibre_url = Column(String(255), nullable=True)  # URL de la publicación
    mercadolibre_published_at = Column(DateTime(timezone=True), nullable=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Si es retoma, de qué operación viene
    operacion_retoma_id = Column(Integer, ForeignKey("operaciones.id"), nullable=True)

    # Relaciones
    costos_directos = relationship("CostoDirecto", back_populates="unidad", lazy="selectin")
    checklist_documentacion = relationship("ChecklistDocumentacion", back_populates="unidad", uselist=False)
    operacion_venta = relationship("Operacion", back_populates="unidad_vendida", foreign_keys="Operacion.unidad_id")

    @property
    def dias_en_stock(self) -> int:
        from datetime import date
        if self.fecha_venta:
            return (self.fecha_venta - self.fecha_ingreso).days
        return (date.today() - self.fecha_ingreso).days

    @property
    def costo_total(self) -> float:
        """Costo total = Compra + Gastos Transferencia + Costos Directos"""
        costos = sum(c.monto or 0 for c in self.costos_directos) if self.costos_directos else 0
        return (self.precio_compra or 0) + (self.gastos_transferencia or 0) + costos

    @property
    def stock_inmovilizado(self) -> bool:
        from app.core.config import settings
        return self.dias_en_stock > settings.DIAS_STOCK_INMOVILIZADO and self.estado == EstadoUnidad.DISPONIBLE

    @property
    def competitividad_precio(self) -> Optional[str]:
        """Retorna 'competitivo', 'desfasado' o None si no hay datos"""
        if not self.valor_mercado or not self.precio_publicado:
            return None
        if self.precio_publicado <= self.valor_mercado:
            return "competitivo"
        return "desfasado"

    @property
    def cache_mercado_vigente(self) -> bool:
        """Verifica si el cache de precios de mercado aún es válido (48h por defecto)"""
        if not self.fecha_ultima_consulta_mercado:
            return False
        from datetime import datetime, timedelta
        horas_cache = 48  # Configurable desde configuracion_negocio
        fecha_consulta = self.fecha_ultima_consulta_mercado
        if fecha_consulta.tzinfo:
            ahora = datetime.now(fecha_consulta.tzinfo)
        else:
            ahora = datetime.now()
            fecha_consulta = fecha_consulta.replace(tzinfo=None)
        return ahora - fecha_consulta < timedelta(hours=horas_cache)
