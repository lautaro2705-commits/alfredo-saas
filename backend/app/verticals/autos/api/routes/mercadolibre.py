"""
Endpoints para integración con MercadoLibre.
Maneja OAuth y publicación de unidades.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.mercadolibre import MercadoLibreCredentials
from app.verticals.autos.services import mercadolibre_service as ml_service
from app.core.config import settings


router = APIRouter(prefix="/autos/mercadolibre", tags=["autos-mercadolibre"])


# ============== Schemas ==============

class MLStatusResponse(BaseModel):
    configured: bool  # Si la app ML está configurada en el sistema
    connected: bool  # Si el usuario tiene ML conectado
    ml_user_id: Optional[str] = None
    ml_nickname: Optional[str] = None
    connected_at: Optional[datetime] = None


class MLPublishRequest(BaseModel):
    category_id: str = "MLA1744"  # Autos usados por defecto
    listing_type: str = "gold_special"  # Destacada por defecto
    price_override: Optional[float] = None  # Precio personalizado


class MLPublishResponse(BaseModel):
    success: bool
    mercadolibre_id: str
    mercadolibre_url: str
    status: str


class MLSyncResponse(BaseModel):
    success: bool
    message: str
    new_price: Optional[float] = None


# ============== OAuth Endpoints ==============

@router.get("/status", response_model=MLStatusResponse)
async def get_ml_status(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Obtiene el estado de conexión de MercadoLibre del usuario actual.
    """
    configured = ml_service.is_ml_configured()

    result = await db.execute(
        select(MercadoLibreCredentials).where(
            MercadoLibreCredentials.usuario_id == token.user_id
        )
    )
    credentials = result.scalar_one_or_none()

    if not credentials:
        return MLStatusResponse(
            configured=configured,
            connected=False
        )

    return MLStatusResponse(
        configured=configured,
        connected=True,
        ml_user_id=credentials.ml_user_id,
        ml_nickname=credentials.ml_nickname,
        connected_at=credentials.created_at
    )


@router.get("/auth-url")
async def get_auth_url(
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Genera la URL para autorizar MercadoLibre.
    El frontend debe redirigir al usuario a esta URL.
    """
    if not ml_service.is_ml_configured():
        raise HTTPException(
            status_code=400,
            detail="MercadoLibre no está configurado en el sistema"
        )

    auth_url = ml_service.get_auth_url(token.user_id)
    return {"auth_url": auth_url}


@router.get("/callback")
async def ml_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Callback de OAuth de MercadoLibre.
    Intercambia el code por tokens y guarda las credenciales.
    Redirige al frontend con el resultado.
    """
    # Obtener URL base del frontend
    if settings.FRONTEND_URL:
        frontend_url = settings.FRONTEND_URL.rstrip("/")
    else:
        # Fallback: intentar derivar del redirect_uri
        frontend_url = settings.MERCADOLIBRE_REDIRECT_URI.replace(
            "/api/v1/mercadolibre/callback",
            ""
        ).replace("/api/mercadolibre/callback", "")

    # Validar state
    user_id = ml_service.validate_state(state)
    if not user_id:
        return RedirectResponse(
            url=f"{frontend_url}/mercadolibre/callback?error=invalid_state"
        )

    try:
        # Intercambiar code por tokens
        tokens = await ml_service.exchange_code_for_tokens(code)

        # Obtener info del usuario de ML
        ml_user = await ml_service.get_ml_user(tokens["access_token"])

        # Calcular fecha de expiración
        expires_at = datetime.now() + timedelta(seconds=tokens["expires_in"])

        # Buscar credenciales existentes o crear nuevas
        result = await db.execute(
            select(MercadoLibreCredentials).where(
                MercadoLibreCredentials.usuario_id == user_id
            )
        )
        credentials = result.scalar_one_or_none()

        if credentials:
            # Actualizar
            credentials.ml_user_id = str(ml_user["id"])
            credentials.ml_nickname = ml_user.get("nickname", "")
            credentials.access_token = tokens["access_token"]
            credentials.refresh_token = tokens["refresh_token"]
            credentials.expires_at = expires_at
        else:
            # Crear nuevas
            credentials = MercadoLibreCredentials(
                usuario_id=user_id,
                ml_user_id=str(ml_user["id"]),
                ml_nickname=ml_user.get("nickname", ""),
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                expires_at=expires_at
            )
            db.add(credentials)

        await db.commit()

        return RedirectResponse(
            url=f"{frontend_url}/mercadolibre/callback?success=true"
        )

    except Exception as e:
        return RedirectResponse(
            url=f"{frontend_url}/mercadolibre/callback?error={str(e)[:100]}"
        )


@router.post("/disconnect")
async def disconnect_ml(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Desconecta la cuenta de MercadoLibre del usuario.
    """
    result = await db.execute(
        select(MercadoLibreCredentials).where(
            MercadoLibreCredentials.usuario_id == token.user_id
        )
    )
    credentials = result.scalar_one_or_none()

    if not credentials:
        raise HTTPException(
            status_code=404,
            detail="No hay cuenta de MercadoLibre conectada"
        )

    await db.delete(credentials)
    await db.commit()

    return {"success": True, "message": "MercadoLibre desconectado"}


# ============== Publicación Endpoints ==============

@router.get("/categories")
async def get_categories():
    """
    Obtiene las categorías de autos disponibles en MercadoLibre.
    """
    categories = await ml_service.get_categories()
    return {
        "categories": categories,
        "default": "MLA1744"  # Autos usados
    }


@router.get("/listing-types")
async def get_listing_types():
    """
    Obtiene los tipos de publicación disponibles.
    """
    return {
        "listing_types": [
            {"id": "gold_special", "name": "Destacada", "recommended": True},
            {"id": "gold_pro", "name": "Clásica Premium", "recommended": False},
            {"id": "gold", "name": "Clásica", "recommended": False},
        ]
    }


@router.post("/unidades/{unidad_id}/publish", response_model=MLPublishResponse)
async def publish_unidad(
    unidad_id: int,
    request: MLPublishRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Publica una unidad en MercadoLibre.
    """
    # Verificar que el usuario tiene ML conectado
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if not ml_token:
        raise HTTPException(
            status_code=400,
            detail="Debes conectar tu cuenta de MercadoLibre primero"
        )

    # Obtener la unidad
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Verificar que no esté vendida
    if unidad.estado == EstadoUnidad.VENDIDO:
        raise HTTPException(
            status_code=400,
            detail="No se puede publicar una unidad vendida"
        )

    # Verificar que no esté ya publicada
    if unidad.mercadolibre_id:
        raise HTTPException(
            status_code=400,
            detail="Esta unidad ya está publicada en MercadoLibre"
        )

    # Verificar que tenga precio
    price = request.price_override or unidad.precio_publicado
    if not price or price <= 0:
        raise HTTPException(
            status_code=400,
            detail="La unidad debe tener un precio publicado"
        )

    try:
        # Convertir unidad a formato ML
        item_data = ml_service.unidad_to_ml_item(
            unidad,
            category_id=request.category_id,
            listing_type=request.listing_type,
            price_override=request.price_override
        )

        # Crear publicación en ML
        result_ml = await ml_service.create_item(ml_token, item_data)

        # Guardar datos en la unidad
        unidad.mercadolibre_id = result_ml["id"]
        unidad.mercadolibre_url = result_ml["permalink"]
        unidad.mercadolibre_status = result_ml["status"]
        unidad.mercadolibre_published_at = datetime.now()
        await db.commit()

        return MLPublishResponse(
            success=True,
            mercadolibre_id=result_ml["id"],
            mercadolibre_url=result_ml["permalink"],
            status=result_ml["status"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error al publicar: {str(e)}"
        )


@router.put("/unidades/{unidad_id}/sync", response_model=MLSyncResponse)
async def sync_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Sincroniza el precio de la unidad con MercadoLibre.
    """
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if not ml_token:
        raise HTTPException(
            status_code=400,
            detail="Debes conectar tu cuenta de MercadoLibre primero"
        )

    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    if not unidad.mercadolibre_id:
        raise HTTPException(
            status_code=400,
            detail="Esta unidad no está publicada en MercadoLibre"
        )

    try:
        # Actualizar precio en ML
        await ml_service.update_item(
            ml_token,
            unidad.mercadolibre_id,
            {"price": unidad.precio_publicado}
        )

        return MLSyncResponse(
            success=True,
            message="Precio sincronizado correctamente",
            new_price=unidad.precio_publicado
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error al sincronizar: {str(e)}"
        )


@router.post("/unidades/{unidad_id}/pause")
async def pause_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Pausa la publicación de una unidad en MercadoLibre.
    """
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if not ml_token:
        raise HTTPException(status_code=400, detail="ML no conectado")

    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad or not unidad.mercadolibre_id:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    try:
        await ml_service.pause_item(ml_token, unidad.mercadolibre_id)
        unidad.mercadolibre_status = "paused"
        await db.commit()
        return {"success": True, "status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unidades/{unidad_id}/activate")
async def activate_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Reactiva la publicación de una unidad en MercadoLibre.
    """
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if not ml_token:
        raise HTTPException(status_code=400, detail="ML no conectado")

    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad or not unidad.mercadolibre_id:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    try:
        await ml_service.activate_item(ml_token, unidad.mercadolibre_id)
        unidad.mercadolibre_status = "active"
        await db.commit()
        return {"success": True, "status": "active"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/unidades/{unidad_id}")
async def close_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Cierra (finaliza) la publicación de una unidad en MercadoLibre.
    """
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if not ml_token:
        raise HTTPException(status_code=400, detail="ML no conectado")

    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad or not unidad.mercadolibre_id:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    try:
        await ml_service.close_item(ml_token, unidad.mercadolibre_id)
        unidad.mercadolibre_status = "closed"
        unidad.mercadolibre_id = None  # Limpiar para poder republicar
        unidad.mercadolibre_url = None
        await db.commit()
        return {"success": True, "message": "Publicación cerrada"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unidades/{unidad_id}/status")
async def get_unidad_ml_status(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Obtiene el estado actual de la publicación en MercadoLibre.
    """
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    if not unidad.mercadolibre_id:
        return {
            "published": False,
            "mercadolibre_id": None,
            "mercadolibre_url": None,
            "status": None
        }

    # Opcionalmente, obtener estado actualizado de ML
    ml_token = await ml_service.get_valid_token(db, token.user_id)
    if ml_token:
        try:
            item = await ml_service.get_item(ml_token, unidad.mercadolibre_id)
            # Actualizar estado si cambió
            if item.get("status") != unidad.mercadolibre_status:
                unidad.mercadolibre_status = item.get("status")
                await db.commit()
        except Exception:
            pass  # Si falla, usar el estado guardado

    return {
        "published": True,
        "mercadolibre_id": unidad.mercadolibre_id,
        "mercadolibre_url": unidad.mercadolibre_url,
        "status": unidad.mercadolibre_status,
        "published_at": unidad.mercadolibre_published_at
    }
