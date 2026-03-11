from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin
import enum


class TipoOperacion(str, enum.Enum):
    VENTA = "venta"
    VENTA_CON_RETOMA = "venta_con_retoma"


class EstadoOperacion(str, enum.Enum):
    RESERVA = "reserva"
    EN_PROCESO = "en_proceso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class FormaPago(str, enum.Enum):
    CONTADO = "contado"
    FINANCIADO = "financiado"
    MIXTO = "mixto"  # Parte contado, parte financiado


class Operacion(TenantMixin, Base):
    """
    Operación de venta, con posibilidad de incluir retoma.
    """
    __tablename__ = "operaciones"

    id = Column(Integer, primary_key=True, index=True)

    tipo = Column(Enum(TipoOperacion), nullable=False)
    estado = Column(Enum(EstadoOperacion), default=EstadoOperacion.EN_PROCESO)

    # Unidad vendida
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=False)

    # Cliente
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)

    # Fechas
    fecha_operacion = Column(Date, nullable=False, server_default=func.current_date())
    fecha_entrega = Column(Date)

    # Montos
    precio_venta = Column(Float, nullable=False)  # Precio final de venta

    # Forma de pago
    forma_pago = Column(Enum(FormaPago), default=FormaPago.CONTADO)
    monto_contado = Column(Float, default=0)  # Lo que paga en efectivo/transferencia
    monto_financiado = Column(Float, default=0)  # Lo que financia
    entidad_financiera = Column(String(100))  # Banco o financiera

    # RETOMA: Si hay un auto que entra como parte de pago
    tiene_retoma = Column(Boolean, default=False)
    retoma_marca = Column(String(100))
    retoma_modelo = Column(String(100))
    retoma_anio = Column(Integer)
    retoma_dominio = Column(String(20))
    retoma_valor = Column(Float, default=0)  # Valor acordado de la retoma

    # La retoma se convierte en una nueva unidad
    unidad_retoma_id = Column(Integer, nullable=True)  # ID de la unidad creada a partir de la retoma

    # Comisión del vendedor
    vendedor_id = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))
    comision = Column(Float, default=0)

    # Documentación
    boleto_compraventa = Column(Boolean, default=False)
    form_08_firmado = Column(Boolean, default=False)
    transferencia_realizada = Column(Boolean, default=False)

    # Boleto de compra-venta
    km_entrega = Column(Integer, nullable=True)  # Kilometraje al momento de entrega
    costo_transferencia_venta = Column(Float, default=0)  # Costo de transferencia desglosado

    # Garantía (3 meses o 2000 km)
    garantia_km_limite = Column(Integer, nullable=True)  # km_entrega + 2000
    garantia_fecha_limite = Column(Date, nullable=True)  # fecha_entrega + 3 meses

    # Tracking de impresión
    boleto_impreso = Column(Boolean, default=False)
    fecha_boleto = Column(DateTime(timezone=True), nullable=True)

    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    unidad_vendida = relationship("Unidad", back_populates="operacion_venta", foreign_keys=[unidad_id])
    cliente = relationship("Cliente", back_populates="operaciones")
    movimientos_caja = relationship("CajaDiaria", back_populates="operacion")

    @property
    def monto_neto_recibido(self) -> float:
        """Monto efectivamente recibido = Precio venta - Valor retoma"""
        return self.precio_venta - (self.retoma_valor or 0)

    @property
    def utilidad_bruta(self) -> float:
        """Utilidad bruta = Precio venta - Costo total de la unidad"""
        if self.unidad_vendida:
            return self.precio_venta - self.unidad_vendida.costo_total
        return 0
