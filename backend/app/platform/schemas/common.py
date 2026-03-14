"""
Schemas comunes para documentación de errores en OpenAPI.

Uso en endpoints:
    from app.platform.schemas.common import auth_errors, crud_errors

    @router.get("/items/{id}", responses=crud_errors)
    async def get_item(id: int): ...
"""
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Respuesta de error estándar de FastAPI (HTTPException)."""
    detail: str

    class Config:
        json_schema_extra = {"example": {"detail": "Mensaje de error descriptivo"}}


class ValidationErrorResponse(BaseModel):
    """Respuesta de error de validación (422 Unprocessable Entity)."""
    detail: list[dict]

    class Config:
        json_schema_extra = {
            "example": {
                "detail": [
                    {
                        "loc": ["body", "email"],
                        "msg": "field required",
                        "type": "value_error.missing",
                    }
                ]
            }
        }


# ── Bloques reutilizables para `responses=` en endpoints ──

error_400 = {400: {"model": ErrorResponse, "description": "Datos inválidos o request malformado"}}
error_401 = {401: {"model": ErrorResponse, "description": "No autenticado — token JWT inválido o expirado"}}
error_403 = {403: {"model": ErrorResponse, "description": "Sin permisos para este recurso"}}
error_404 = {404: {"model": ErrorResponse, "description": "Recurso no encontrado"}}
error_409 = {409: {"model": ErrorResponse, "description": "Conflicto — el recurso ya existe"}}
error_429 = {429: {"model": ErrorResponse, "description": "Demasiados intentos — rate limit excedido"}}

# Combinaciones comunes
auth_errors = {**error_401, **error_403}
crud_errors = {**error_401, **error_403, **error_404}
login_errors = {**error_400, **error_401, **error_429}
