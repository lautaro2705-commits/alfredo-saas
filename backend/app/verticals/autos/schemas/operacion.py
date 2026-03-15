from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from app.verticals.autos.models.operacion import TipoOperacion, EstadoOperacion, FormaPago


class RetomaData(BaseModel):
    marca: str = Field(..., max_length=100)
    modelo: str = Field(..., max_length=100)
    anio: int = Field(..., ge=1900, le=2100)
    dominio: str = Field(..., max_length=20)
    valor: float = Field(..., ge=0)
    kilometraje: Optional[int] = None
    color: Optional[str] = None


class OperacionBase(BaseModel):
    unidad_id: int
    cliente_id: int
    precio_venta: float = Field(..., gt=0)
    forma_pago: FormaPago = FormaPago.CONTADO
    monto_contado: Optional[float] = Field(0, ge=0)
    monto_financiado: Optional[float] = Field(0, ge=0)
    entidad_financiera: Optional[str] = Field(None, max_length=200)
    fecha_operacion: Optional[date] = None
    fecha_entrega: Optional[date] = None
    vendedor_id: Optional[UUID] = None
    comision: Optional[float] = Field(0, ge=0)
    observaciones: Optional[str] = Field(None, max_length=5000)
    costo_transferencia_venta: Optional[float] = Field(0, ge=0)  # Costo de transferencia desglosado


class OperacionCreate(OperacionBase):
    retoma: Optional[RetomaData] = None


class OperacionUpdate(BaseModel):
    estado: Optional[EstadoOperacion] = None
    precio_venta: Optional[float] = None
    forma_pago: Optional[FormaPago] = None
    monto_contado: Optional[float] = None
    monto_financiado: Optional[float] = None
    entidad_financiera: Optional[str] = Field(None, max_length=200)
    fecha_entrega: Optional[date] = None
    comision: Optional[float] = None
    boleto_compraventa: Optional[bool] = None
    form_08_firmado: Optional[bool] = None
    transferencia_realizada: Optional[bool] = None
    observaciones: Optional[str] = Field(None, max_length=5000)
    costo_transferencia_venta: Optional[float] = None
    km_entrega: Optional[int] = None


class CompletarOperacionRequest(BaseModel):
    """Request para completar una operacion con datos del boleto"""
    km_entrega: int = Field(..., gt=0, description="Kilometraje al momento de entrega")
    costo_transferencia_venta: Optional[float] = Field(0, ge=0, description="Costo de transferencia")


class BoletoCompraVentaResponse(BaseModel):
    """Datos completos para generar el boleto de compra-venta"""
    # Datos de la operacion
    operacion_id: int
    fecha_operacion: date
    fecha_entrega: Optional[date]

    # Datos del vehiculo
    vehiculo_marca: str
    vehiculo_modelo: str
    vehiculo_version: Optional[str]
    vehiculo_anio: int
    vehiculo_dominio: str
    vehiculo_chasis: Optional[str]
    vehiculo_motor: Optional[str]
    vehiculo_color: Optional[str]
    vehiculo_combustible: Optional[str]

    # Datos del cliente (comprador)
    cliente_nombre: str
    cliente_apellido: str
    cliente_dni: str
    cliente_direccion: Optional[str]
    cliente_localidad: Optional[str]
    cliente_provincia: Optional[str]
    cliente_telefono: Optional[str]

    # Datos economicos
    precio_venta: float
    costo_transferencia: float
    precio_sin_transferencia: float
    forma_pago: str

    # Kilometraje y garantia
    km_entrega: int
    garantia_km_limite: int
    garantia_fecha_limite: date

    # Datos de la agencia
    agencia_nombre: str = "Alfredo: Smart Dealer OS"

    class Config:
        from_attributes = True


class UnidadSimple(BaseModel):
    id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    costo_total: float

    class Config:
        from_attributes = True


class ClienteSimple(BaseModel):
    id: int
    nombre_completo: str
    dni_cuit: str
    telefono: Optional[str]

    class Config:
        from_attributes = True


class OperacionResponse(BaseModel):
    id: int
    tipo: TipoOperacion
    estado: EstadoOperacion
    unidad_id: int
    cliente_id: int
    fecha_operacion: date
    fecha_entrega: Optional[date]
    precio_venta: float
    forma_pago: FormaPago
    monto_contado: float
    monto_financiado: float
    entidad_financiera: Optional[str]

    # Retoma
    tiene_retoma: bool
    retoma_marca: Optional[str]
    retoma_modelo: Optional[str]
    retoma_anio: Optional[int]
    retoma_dominio: Optional[str]
    retoma_valor: float
    unidad_retoma_id: Optional[int]

    # Documentacion
    boleto_compraventa: bool
    form_08_firmado: bool
    transferencia_realizada: bool

    # Boleto compra-venta
    km_entrega: Optional[int] = None
    costo_transferencia_venta: float = 0
    garantia_km_limite: Optional[int] = None
    garantia_fecha_limite: Optional[date] = None
    boleto_impreso: bool = False
    fecha_boleto: Optional[datetime] = None

    vendedor_id: Optional[UUID]
    comision: float
    observaciones: Optional[str]

    # Calculados
    monto_neto_recibido: float
    utilidad_bruta: float

    # Relaciones expandidas
    unidad_vendida: Optional[UnidadSimple] = None
    cliente: Optional[ClienteSimple] = None

    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
