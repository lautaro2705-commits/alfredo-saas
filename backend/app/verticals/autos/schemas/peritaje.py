"""
Schemas Pydantic para el módulo de Peritaje Digital
"""
from datetime import datetime
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, Field, computed_field
from app.verticals.autos.models.peritaje import EstadoPeritaje, TipoPeritaje, SectorPeritaje, CalificacionItem


# ============== Schemas de Foto ==============

class PeritajeFotoBase(BaseModel):
    sector: SectorPeritaje
    tipo_foto: str = "general"
    descripcion: Optional[str] = None


class PeritajeFotoCreate(PeritajeFotoBase):
    peritaje_item_id: Optional[int] = None


class PeritajeFotoResponse(PeritajeFotoBase):
    id: int
    peritaje_id: int
    peritaje_item_id: Optional[int] = None
    nombre_archivo: str
    url: str
    public_id: str
    mime_type: Optional[str] = None
    tamano_bytes: Optional[int] = None
    ancho: Optional[int] = None
    alto: Optional[int] = None
    thumbnail_url: Optional[str] = None
    medium_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PeritajeFotoSimple(BaseModel):
    """Versión simplificada para listados"""
    id: int
    url: str
    thumbnail_url: Optional[str] = None
    tipo_foto: str
    descripcion: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Schemas de Item ==============

class PeritajeItemBase(BaseModel):
    sector: SectorPeritaje
    codigo_item: str
    nombre_item: str
    orden: int = 0


class PeritajeItemCreate(PeritajeItemBase):
    pass


class CalificacionItemUpdate(BaseModel):
    """Para actualizar la calificación de un item"""
    calificacion: CalificacionItem
    observaciones: Optional[str] = None
    costo_reparacion_estimado: float = 0
    urgente: bool = False


class CalificacionItemBatch(BaseModel):
    """Para actualización por lotes"""
    item_id: int
    calificacion: CalificacionItem
    observaciones: Optional[str] = None
    costo_reparacion_estimado: float = 0
    urgente: bool = False


class PeritajeItemResponse(PeritajeItemBase):
    id: int
    peritaje_id: int
    calificacion: Optional[CalificacionItem] = None
    observaciones: Optional[str] = None
    costo_reparacion_estimado: float = 0
    urgente: bool = False
    fotos: List[PeritajeFotoSimple] = []

    class Config:
        from_attributes = True


# ============== Schemas de Peritaje ==============

class PeritajeBase(BaseModel):
    tipo: TipoPeritaje = TipoPeritaje.TASACION
    unidad_id: Optional[int] = None
    operacion_id: Optional[int] = None
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_version: Optional[str] = None
    vehiculo_anio: Optional[int] = None
    vehiculo_dominio: Optional[str] = None
    vehiculo_kilometraje: Optional[int] = None
    vehiculo_color: Optional[str] = None
    vehiculo_combustible: Optional[str] = None
    observaciones_generales: Optional[str] = None


class PeritajeCreate(PeritajeBase):
    """Schema para crear un nuevo peritaje"""
    pass


class PeritajeUpdate(BaseModel):
    """Schema para actualizar metadata del peritaje"""
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_version: Optional[str] = None
    vehiculo_anio: Optional[int] = None
    vehiculo_dominio: Optional[str] = None
    vehiculo_kilometraje: Optional[int] = None
    vehiculo_color: Optional[str] = None
    vehiculo_combustible: Optional[str] = None
    observaciones_generales: Optional[str] = None
    peso_mecanica: Optional[float] = None
    peso_estetica: Optional[float] = None
    peso_documentacion: Optional[float] = None


class PeritajeListResponse(BaseModel):
    """Schema para listados (información resumida)"""
    id: int
    tipo: TipoPeritaje
    estado: EstadoPeritaje
    unidad_id: Optional[int] = None
    vehiculo_descripcion: str
    puntaje_total: float
    resumen_estado: str
    fecha_peritaje: datetime
    perito_nombre: str
    porcentaje_completado: float

    class Config:
        from_attributes = True


class PeritajeResponse(PeritajeBase):
    """Schema completo para detalle del peritaje"""
    id: int
    estado: EstadoPeritaje

    # Puntajes
    puntaje_mecanica: float
    puntaje_estetica: float
    puntaje_documentacion: float
    puntaje_total: float
    resumen_estado: str

    # Pesos
    peso_mecanica: float
    peso_estetica: float
    peso_documentacion: float

    # Financiero
    costo_reparaciones_estimado: float
    ajuste_precio_sugerido: float

    # Fechas
    fecha_peritaje: datetime
    fecha_completado: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Auditoría
    perito_id: UUID
    perito_nombre: str
    aprobado_por_id: Optional[UUID] = None
    aprobado_por_nombre: Optional[str] = None

    # Progreso
    items_total: int
    items_calificados: int
    porcentaje_completado: float

    # Descripción del vehículo
    vehiculo_descripcion: str

    # Items agrupados por sector
    items_por_sector: Dict[str, List[PeritajeItemResponse]] = {}

    # Fotos
    fotos: List[PeritajeFotoResponse] = []

    class Config:
        from_attributes = True


# ============== Schemas de Integración ==============

class PuntajeEstadoResponse(BaseModel):
    """Respuesta para integración con CalculadoraRetoma"""
    peritaje_id: int
    puntaje_estado: float = Field(..., ge=0, le=100, description="Puntaje de 0 a 100")
    resumen_estado: str = Field(..., description="Excelente/Bueno/Regular/Malo")
    ajuste_precio: float = Field(..., description="Ajuste sugerido (valor negativo = descuento)")
    costo_reparaciones: float = Field(..., ge=0, description="Costo estimado de reparaciones")
    items_urgentes: List[str] = Field(default=[], description="Lista de items marcados como urgentes")
    recomendacion: str = Field(..., description="Recomendación textual basada en el estado")

    # Desglose por sector
    puntaje_mecanica: float
    puntaje_estetica: float
    puntaje_documentacion: float


class AprobacionRequest(BaseModel):
    """Request para aprobar/rechazar un peritaje"""
    aprobado: bool
    observaciones: Optional[str] = None


# ============== Schemas de Respuesta Genérica ==============

class MessageResponse(BaseModel):
    """Respuesta genérica con mensaje"""
    message: str
    success: bool = True


class PuntajeCalculadoResponse(BaseModel):
    """Respuesta del cálculo de puntaje"""
    puntaje_mecanica: float
    puntaje_estetica: float
    puntaje_documentacion: float
    puntaje_total: float
    resumen_estado: str
    costo_reparaciones_estimado: float
    ajuste_precio_sugerido: float
    items_evaluados: int
    items_pendientes: int
