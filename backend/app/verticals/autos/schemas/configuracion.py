from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ConfiguracionBase(BaseModel):
    clave: str = Field(..., max_length=100)
    valor: str = Field(..., max_length=255)
    descripcion: Optional[str] = None
    tipo: str = Field(default="string", max_length=50)


class ConfiguracionUpdate(BaseModel):
    valor: str = Field(..., max_length=255)


class ConfiguracionResponse(ConfiguracionBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConfiguracionNegocioResponse(BaseModel):
    """Configuraciones actuales del negocio"""
    tasa_costo_oportunidad_anual: float
    dias_alerta_repricing: int
    dias_stock_inmovilizado: int
