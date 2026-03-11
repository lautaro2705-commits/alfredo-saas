from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from datetime import date, datetime
from app.verticals.autos.models.unidad import EstadoUnidad, OrigenUnidad


class UnidadBase(BaseModel):
    marca: str = Field(..., max_length=100)
    modelo: str = Field(..., max_length=100)
    version: Optional[str] = Field(None, max_length=100)
    anio: int = Field(..., ge=1900, le=2100)
    color: Optional[str] = Field(None, max_length=50)
    kilometraje: Optional[int] = Field(None, ge=0)
    combustible: Optional[str] = None
    transmision: Optional[str] = None
    dominio: str = Field(..., max_length=20)
    numero_chasis: Optional[str] = Field(None, max_length=50)
    numero_motor: Optional[str] = Field(None, max_length=50)

    @field_validator('anio', mode='before')
    @classmethod
    def validate_anio(cls, v):
        """Validar año"""
        if v is None or v == "" or v == "null":
            raise ValueError("El año es requerido")
        try:
            val = int(v)
            if val < 1900 or val > 2100:
                raise ValueError("Año debe estar entre 1900 y 2100")
            return val
        except (ValueError, TypeError):
            raise ValueError("Año debe ser un numero valido")

    @field_validator('kilometraje', mode='before')
    @classmethod
    def validate_kilometraje(cls, v):
        """Validar kilometraje"""
        if v is None or v == "" or v == "null" or v == "undefined":
            return None
        try:
            val = int(v)
            if val < 0:
                return 0
            return val
        except (ValueError, TypeError):
            return None

    @field_validator('version', 'color', 'combustible', 'transmision', 'numero_chasis', 'numero_motor', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convertir strings vacíos a None"""
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class UnidadCreate(UnidadBase):
    estado: Optional[EstadoUnidad] = EstadoUnidad.DISPONIBLE
    origen: Optional[OrigenUnidad] = OrigenUnidad.COMPRA_DIRECTA
    precio_compra: float = Field(default=0, ge=0)
    gastos_transferencia: float = Field(default=0, ge=0)
    precio_publicado: Optional[float] = Field(None, ge=0)
    precio_minimo: Optional[float] = Field(None, ge=0)
    fecha_ingreso: Optional[date] = None
    observaciones: Optional[str] = None
    ubicacion: Optional[str] = None
    fotos: Optional[str] = None

    @field_validator('estado', mode='before')
    @classmethod
    def validate_estado(cls, v):
        if v is None or v == "" or v == "null":
            return EstadoUnidad.DISPONIBLE
        if isinstance(v, str):
            try:
                return EstadoUnidad(v.lower())
            except ValueError:
                return EstadoUnidad.DISPONIBLE
        return v

    @field_validator('origen', mode='before')
    @classmethod
    def validate_origen(cls, v):
        if v is None or v == "" or v == "null":
            return OrigenUnidad.COMPRA_DIRECTA
        if isinstance(v, str):
            try:
                return OrigenUnidad(v.lower())
            except ValueError:
                return OrigenUnidad.COMPRA_DIRECTA
        return v

    @field_validator('precio_compra', 'gastos_transferencia', mode='before')
    @classmethod
    def validate_precio_requerido(cls, v):
        if v is None or v == "" or v == "null" or v == "undefined":
            return 0
        try:
            val = float(v)
            return max(0, val)
        except (ValueError, TypeError):
            return 0

    @field_validator('precio_publicado', 'precio_minimo', mode='before')
    @classmethod
    def validate_precio_opcional(cls, v):
        if v is None or v == "" or v == "null" or v == "undefined":
            return None
        try:
            val = float(v)
            return max(0, val) if val > 0 else None
        except (ValueError, TypeError):
            return None

    @field_validator('fecha_ingreso', mode='before')
    @classmethod
    def validate_fecha_ingreso(cls, v):
        if v is None or v == "" or v == "null" or v == "undefined":
            return None
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)
            except ValueError:
                return None
        return v

    @field_validator('observaciones', 'ubicacion', 'fotos', mode='before')
    @classmethod
    def empty_str_to_none_extra(cls, v):
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class UnidadUpdate(BaseModel):
    marca: Optional[str] = None
    modelo: Optional[str] = None
    version: Optional[str] = None
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje: Optional[int] = None
    combustible: Optional[str] = None
    transmision: Optional[str] = None
    dominio: Optional[str] = None
    numero_chasis: Optional[str] = None
    numero_motor: Optional[str] = None
    estado: Optional[EstadoUnidad] = None
    origen: Optional[OrigenUnidad] = None
    precio_compra: Optional[float] = None
    gastos_transferencia: Optional[float] = None
    precio_publicado: Optional[float] = None
    precio_minimo: Optional[float] = None
    observaciones: Optional[str] = None
    ubicacion: Optional[str] = None
    fotos: Optional[str] = None

    @field_validator('estado', mode='before')
    @classmethod
    def validate_estado(cls, v):
        if v is None or v == "" or v == "null":
            return None
        if isinstance(v, str):
            return EstadoUnidad(v.lower())
        return v

    @field_validator('origen', mode='before')
    @classmethod
    def validate_origen(cls, v):
        if v is None or v == "" or v == "null":
            return None
        if isinstance(v, str):
            return OrigenUnidad(v.lower())
        return v

    @field_validator('version', 'color', 'combustible', 'transmision', 'numero_chasis',
                     'numero_motor', 'observaciones', 'ubicacion', 'fotos', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class CostoDirectoSimple(BaseModel):
    id: int
    categoria: str
    descripcion: str
    monto: float
    fecha: date

    class Config:
        from_attributes = True


class DocumentacionSimple(BaseModel):
    documentacion_completa: bool
    items_pendientes: List[str]

    class Config:
        from_attributes = True


class UnidadResponse(UnidadBase):
    id: int
    estado: EstadoUnidad
    origen: OrigenUnidad
    precio_compra: float
    gastos_transferencia: Optional[float]
    precio_publicado: Optional[float]
    precio_minimo: Optional[float]
    fecha_ingreso: date
    fecha_venta: Optional[date]
    observaciones: Optional[str]
    ubicacion: Optional[str]
    fotos: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    # Campos calculados
    dias_en_stock: int
    costo_total: float
    stock_inmovilizado: bool

    # Precios de mercado (cache de consultas externas)
    valor_mercado: Optional[float] = None
    valor_mercado_min: Optional[float] = None
    valor_mercado_max: Optional[float] = None
    valor_mercado_cantidad: Optional[int] = None
    fecha_ultima_consulta_mercado: Optional[datetime] = None
    competitividad_precio: Optional[str] = None  # "competitivo" o "desfasado"

    # MercadoLibre
    mercadolibre_id: Optional[str] = None
    mercadolibre_status: Optional[str] = None
    mercadolibre_url: Optional[str] = None
    mercadolibre_published_at: Optional[datetime] = None

    # Relaciones
    costos_directos: List[CostoDirectoSimple] = []

    class Config:
        from_attributes = True


class UnidadListResponse(BaseModel):
    id: int
    marca: str
    modelo: str
    anio: int
    dominio: str
    estado: EstadoUnidad
    origen: Optional[OrigenUnidad] = None
    precio_publicado: Optional[float]
    dias_en_stock: int
    costo_total: float
    stock_inmovilizado: bool
    ubicacion: Optional[str]

    # Precios de mercado (campos minimos para lista)
    valor_mercado: Optional[float] = None
    competitividad_precio: Optional[str] = None  # "competitivo" o "desfasado"

    # MercadoLibre (campos mínimos para lista)
    mercadolibre_id: Optional[str] = None
    mercadolibre_status: Optional[str] = None

    class Config:
        from_attributes = True
