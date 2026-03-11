from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class ChecklistDocumentacionBase(BaseModel):
    # Título
    titulo_tiene: bool = False
    titulo_nombre: Optional[str] = Field(None, max_length=100)
    titulo_observaciones: Optional[str] = None

    # Formulario 08
    form_08_tiene: bool = False
    form_08_firmado: bool = False
    form_08_certificado: bool = False
    form_08_fecha_vencimiento: Optional[date] = None

    # VPA
    vpa_tiene: bool = False
    vpa_fecha: Optional[date] = None
    vpa_resultado: Optional[str] = Field(None, max_length=50)

    # VTV
    vtv_tiene: bool = False
    vtv_fecha_vencimiento: Optional[date] = None
    vtv_oblea: Optional[str] = Field(None, max_length=50)

    # Informe de dominio
    informe_dominio_tiene: bool = False
    informe_dominio_fecha: Optional[date] = None
    informe_dominio_estado: Optional[str] = Field(None, max_length=50)

    # Multas
    multas_tiene: bool = False
    multas_monto_total: float = 0
    multas_detalle: Optional[str] = None

    # Patentes
    patentes_deuda: bool = False
    patentes_monto: float = 0
    patentes_periodos: Optional[str] = Field(None, max_length=100)

    # Seguro
    seguro_compania: Optional[str] = Field(None, max_length=100)
    seguro_poliza: Optional[str] = Field(None, max_length=50)
    seguro_vencimiento: Optional[date] = None

    # Llaves
    llave_original: bool = True
    llave_copia: bool = False
    cantidad_llaves: int = 1

    # Manual
    manual_usuario: bool = False
    libreta_service: bool = False

    observaciones: Optional[str] = None

    # Estado de Gestoria
    estado_gestoria: Optional[str] = "sin_iniciar"
    gestor_nombre: Optional[str] = Field(None, max_length=100)
    gestor_telefono: Optional[str] = Field(None, max_length=50)
    fecha_inicio_tramite: Optional[date] = None
    fecha_finalizacion_tramite: Optional[date] = None
    notas_gestoria: Optional[str] = None


class ChecklistDocumentacionCreate(ChecklistDocumentacionBase):
    unidad_id: int


class ChecklistDocumentacionUpdate(ChecklistDocumentacionBase):
    pass


class ChecklistDocumentacionResponse(ChecklistDocumentacionBase):
    id: int
    unidad_id: int
    documentacion_completa: bool
    items_pendientes: List[str]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
