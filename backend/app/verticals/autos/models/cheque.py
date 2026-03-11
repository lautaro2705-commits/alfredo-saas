from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin
import enum


class EstadoChequeRecibido(str, enum.Enum):
    EN_CARTERA = "en_cartera"
    DEPOSITADO = "depositado"
    COBRADO = "cobrado"
    ENDOSADO = "endosado"  # Entregado a tercero
    RECHAZADO = "rechazado"


class EstadoChequeEmitido(str, enum.Enum):
    PENDIENTE = "pendiente"
    PAGADO = "pagado"
    ANULADO = "anulado"


class ChequeRecibido(TenantMixin, Base):
    """
    Cheques recibidos como medio de pago (cartera).
    Pueden asociarse a ventas o quedar en cartera para luego depositarlos o endosarlos.
    """
    __tablename__ = "cheques_recibidos"

    id = Column(Integer, primary_key=True, index=True)

    # Datos del cheque
    banco = Column(String(100), nullable=False)
    numero_cheque = Column(String(50), nullable=False)
    monto = Column(Float, nullable=False)

    # Emisor
    emisor_nombre = Column(String(100), nullable=False)
    emisor_cuit = Column(String(20))

    # Fechas
    fecha_recepcion = Column(Date, nullable=False, server_default=func.current_date())
    fecha_vencimiento = Column(Date, nullable=False)  # Fecha de cobro

    # Estado
    estado = Column(Enum(EstadoChequeRecibido), default=EstadoChequeRecibido.EN_CARTERA)

    # Vinculación a operación de venta
    operacion_id = Column(Integer, ForeignKey("operaciones.id"), nullable=True)

    # Si fue depositado
    fecha_deposito = Column(Date, nullable=True)
    banco_deposito = Column(String(100), nullable=True)

    # Si fue cobrado
    fecha_cobro = Column(Date, nullable=True)

    # Si fue endosado (entregado a tercero)
    endosado_a = Column(String(100), nullable=True)  # Nombre de a quién se endosó
    endosado_cuit = Column(String(20), nullable=True)
    fecha_endoso = Column(Date, nullable=True)
    motivo_endoso = Column(String(255), nullable=True)  # Pago a proveedor, compra auto, etc.
    # Si se endosó para comprar otra unidad
    unidad_compra_id = Column(Integer, ForeignKey("unidades.id"), nullable=True)

    # Si fue rechazado
    fecha_rechazo = Column(Date, nullable=True)
    motivo_rechazo = Column(String(255), nullable=True)

    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    operacion = relationship("Operacion", backref="cheques_recibidos")

    @property
    def dias_para_vencer(self) -> int:
        from datetime import date
        if self.fecha_vencimiento:
            return (self.fecha_vencimiento - date.today()).days
        return 0

    @property
    def vencido(self) -> bool:
        return self.dias_para_vencer < 0 and self.estado == EstadoChequeRecibido.EN_CARTERA


class ChequeEmitido(TenantMixin, Base):
    """
    Cheques propios emitidos para pagos.
    Pueden asociarse a compras de unidades o gastos operativos.
    """
    __tablename__ = "cheques_emitidos"

    id = Column(Integer, primary_key=True, index=True)

    # Datos del cheque
    banco = Column(String(100), nullable=False)
    numero_cheque = Column(String(50), nullable=False)
    monto = Column(Float, nullable=False)

    # Beneficiario
    beneficiario = Column(String(100), nullable=False)
    beneficiario_cuit = Column(String(20))

    # Fechas
    fecha_emision = Column(Date, nullable=False, server_default=func.current_date())
    fecha_pago = Column(Date, nullable=False)  # Fecha en que será debitado

    # Estado
    estado = Column(Enum(EstadoChequeEmitido), default=EstadoChequeEmitido.PENDIENTE)

    # Vinculación
    # Si es para compra de unidad
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=True)
    # Si es para gasto operativo (referencia a movimiento de caja)
    caja_diaria_id = Column(Integer, ForeignKey("caja_diaria.id"), nullable=True)

    # Fecha efectiva de débito
    fecha_debito = Column(Date, nullable=True)

    # Si fue anulado
    fecha_anulacion = Column(Date, nullable=True)
    motivo_anulacion = Column(String(255), nullable=True)

    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    unidad = relationship("Unidad", backref="cheques_compra")
    caja = relationship("CajaDiaria", backref="cheque_pago")

    @property
    def dias_para_debito(self) -> int:
        from datetime import date
        if self.fecha_pago:
            return (self.fecha_pago - date.today()).days
        return 0
