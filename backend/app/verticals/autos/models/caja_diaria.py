from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin, SoftDeleteMixin
import enum


class TipoMovimiento(str, enum.Enum):
    INGRESO = "ingreso"
    EGRESO = "egreso"


class CategoriaGasto(str, enum.Enum):
    # Gastos fijos operativos
    ALQUILER = "alquiler"
    SERVICIOS = "servicios"  # Luz, agua, gas, internet
    SUELDOS = "sueldos"
    IMPUESTOS = "impuestos"
    SEGUROS = "seguros"
    PUBLICIDAD = "publicidad"
    MANTENIMIENTO_LOCAL = "mantenimiento_local"
    CONTADOR = "contador"
    SEGURIDAD = "seguridad"

    # Ingresos operativos
    VENTA_UNIDAD = "venta_unidad"
    COMISION = "comision"
    FINANCIACION = "financiacion"
    OTROS_INGRESOS = "otros_ingresos"

    # Otros egresos
    OTROS_EGRESOS = "otros_egresos"
    RETIRO_SOCIO = "retiro_socio"


class CajaDiaria(SoftDeleteMixin, TenantMixin, Base):
    """
    Movimientos de caja diaria (ingresos y egresos operativos).
    NO incluye costos directos de unidades (esos van en CostoDirecto).
    """
    __tablename__ = "caja_diaria"

    id = Column(Integer, primary_key=True, index=True)

    tipo = Column(Enum(TipoMovimiento), nullable=False)
    categoria = Column(Enum(CategoriaGasto), nullable=False)
    descripcion = Column(String(255), nullable=False)
    monto = Column(Float, nullable=False)

    fecha = Column(Date, nullable=False, server_default=func.current_date(), index=True)

    # Método de pago
    medio_pago = Column(String(50))  # Efectivo, Transferencia, Cheque, Tarjeta

    # Comprobante
    numero_comprobante = Column(String(50))
    observaciones = Column(Text)

    # Vinculación opcional a operación (si es ingreso por venta)
    operacion_id = Column(Integer, ForeignKey("operaciones.id"), nullable=True)

    # Si está incluido en un cierre de caja
    cierre_caja_id = Column(Integer, ForeignKey("cierres_caja.id"), nullable=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    operacion = relationship("Operacion", back_populates="movimientos_caja")
    cierre = relationship("CierreCaja", back_populates="movimientos")


class CierreCaja(SoftDeleteMixin, TenantMixin, Base):
    """
    Cierre mensual de caja para calcular utilidad neta.
    """
    __tablename__ = "cierres_caja"

    id = Column(Integer, primary_key=True, index=True)

    mes = Column(Integer, nullable=False)  # 1-12
    anio = Column(Integer, nullable=False)

    # Totales calculados al momento del cierre
    total_ingresos = Column(Float, default=0)
    total_egresos = Column(Float, default=0)
    total_costos_directos = Column(Float, default=0)  # Suma de costos de unidades vendidas

    # Utilidades
    utilidad_bruta = Column(Float, default=0)  # Ventas - Costo unidades
    utilidad_neta = Column(Float, default=0)   # Utilidad bruta - Gastos operativos

    # Estado
    cerrado = Column(Boolean, default=False)
    fecha_cierre = Column(DateTime(timezone=True))
    observaciones = Column(Text)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cerrado_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    movimientos = relationship("CajaDiaria", back_populates="cierre")
