from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from app.verticals.autos.models.cheque import EstadoChequeRecibido, EstadoChequeEmitido


# ==================== CHEQUES RECIBIDOS ====================

class ChequeRecibidoBase(BaseModel):
    banco: str = Field(..., max_length=100)
    numero_cheque: str = Field(..., max_length=50)
    monto: float = Field(..., gt=0)
    emisor_nombre: str = Field(..., max_length=100)
    emisor_cuit: Optional[str] = Field(None, max_length=20)
    fecha_recepcion: Optional[date] = None
    fecha_vencimiento: date
    observaciones: Optional[str] = Field(None, max_length=5000)


class ChequeRecibidoCreate(ChequeRecibidoBase):
    operacion_id: Optional[int] = None


class ChequeRecibidoUpdate(BaseModel):
    banco: Optional[str] = None
    numero_cheque: Optional[str] = None
    monto: Optional[float] = None
    emisor_nombre: Optional[str] = None
    emisor_cuit: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    observaciones: Optional[str] = Field(None, max_length=5000)


class DepositarChequeRequest(BaseModel):
    banco_deposito: str = Field(..., max_length=100)
    fecha_deposito: Optional[date] = None


class EndosarChequeRequest(BaseModel):
    endosado_a: str = Field(..., max_length=100)
    endosado_cuit: Optional[str] = Field(None, max_length=20)
    motivo_endoso: Optional[str] = Field(None, max_length=255)
    unidad_compra_id: Optional[int] = None  # Si se endosa para comprar otro auto
    fecha_endoso: Optional[date] = None


class RechazarChequeRequest(BaseModel):
    motivo_rechazo: str = Field(..., max_length=255)
    fecha_rechazo: Optional[date] = None


class ChequeRecibidoResponse(ChequeRecibidoBase):
    id: int
    estado: EstadoChequeRecibido
    operacion_id: Optional[int]
    fecha_deposito: Optional[date]
    banco_deposito: Optional[str]
    fecha_cobro: Optional[date]
    endosado_a: Optional[str]
    endosado_cuit: Optional[str]
    fecha_endoso: Optional[date]
    motivo_endoso: Optional[str]
    unidad_compra_id: Optional[int]
    fecha_rechazo: Optional[date]
    motivo_rechazo: Optional[str]
    dias_para_vencer: int
    vencido: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== CHEQUES EMITIDOS ====================

class ChequeEmitidoBase(BaseModel):
    banco: str = Field(..., max_length=100)
    numero_cheque: str = Field(..., max_length=50)
    monto: float = Field(..., gt=0)
    beneficiario: str = Field(..., max_length=100)
    beneficiario_cuit: Optional[str] = Field(None, max_length=20)
    fecha_emision: Optional[date] = None
    fecha_pago: date
    observaciones: Optional[str] = Field(None, max_length=5000)


class ChequeEmitidoCreate(ChequeEmitidoBase):
    unidad_id: Optional[int] = None  # Si es para compra de unidad
    caja_diaria_id: Optional[int] = None  # Si es para gasto operativo


class ChequeEmitidoUpdate(BaseModel):
    banco: Optional[str] = None
    numero_cheque: Optional[str] = None
    monto: Optional[float] = None
    beneficiario: Optional[str] = None
    beneficiario_cuit: Optional[str] = None
    fecha_pago: Optional[date] = None
    observaciones: Optional[str] = Field(None, max_length=5000)


class PagarChequeRequest(BaseModel):
    fecha_debito: Optional[date] = None


class AnularChequeRequest(BaseModel):
    motivo_anulacion: str = Field(..., max_length=255)
    fecha_anulacion: Optional[date] = None


class ChequeEmitidoResponse(ChequeEmitidoBase):
    id: int
    estado: EstadoChequeEmitido
    unidad_id: Optional[int]
    caja_diaria_id: Optional[int]
    fecha_debito: Optional[date]
    fecha_anulacion: Optional[date]
    motivo_anulacion: Optional[str]
    dias_para_debito: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== REPORTES Y CALENDARIO ====================

class CalendarioVencimientos(BaseModel):
    fecha: date
    cheques_a_cobrar: List[ChequeRecibidoResponse]
    cheques_a_pagar: List[ChequeEmitidoResponse]
    total_a_cobrar: float
    total_a_pagar: float
    saldo_proyectado: float


class ResumenCartera(BaseModel):
    total_en_cartera: float
    cantidad_en_cartera: int
    total_depositados: float
    cantidad_depositados: int
    total_endosados: float
    cantidad_endosados: int
    total_rechazados: float
    cantidad_rechazados: int
    cheques_por_vencer_7_dias: List[ChequeRecibidoResponse]


class ResumenChequesEmitidos(BaseModel):
    total_pendientes: float
    cantidad_pendientes: int
    total_pagados: float
    cantidad_pagados: int
    total_anulados: float
    cantidad_anulados: int
    cheques_por_debitar_7_dias: List[ChequeEmitidoResponse]
