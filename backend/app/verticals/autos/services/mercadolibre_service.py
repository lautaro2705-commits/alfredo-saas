"""
Servicio para integración con MercadoLibre API.
Maneja OAuth, publicación de items y sincronización.
"""
import httpx
import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.verticals.autos.models.mercadolibre import MercadoLibreCredentials
from app.verticals.autos.models.unidad import Unidad

logger = logging.getLogger(__name__)


# URLs de MercadoLibre Argentina
ML_AUTH_URL = "https://auth.mercadolibre.com.ar/authorization"
ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token"
ML_API_URL = "https://api.mercadolibre.com"

ML_CATEGORY_AUTOS = "MLA1744"

ML_LISTING_TYPES = {
    "gold_special": "Destacada",
    "gold_pro": "Clásica Premium",
    "gold": "Clásica",
    "silver": "Gratuita"
}


def is_ml_configured() -> bool:
    """Verifica si las credenciales de la app ML están configuradas."""
    return bool(
        settings.MERCADOLIBRE_CLIENT_ID and
        settings.MERCADOLIBRE_CLIENT_SECRET and
        settings.MERCADOLIBRE_REDIRECT_URI
    )


def get_auth_url(user_id) -> str:
    """Genera la URL de autorización OAuth de MercadoLibre."""
    if not is_ml_configured():
        raise ValueError("MercadoLibre no está configurado")

    state = jwt.encode(
        {
            "user_id": user_id,
            "exp": datetime.utcnow() + timedelta(minutes=30)
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    params = {
        "response_type": "code",
        "client_id": settings.MERCADOLIBRE_CLIENT_ID,
        "redirect_uri": settings.MERCADOLIBRE_REDIRECT_URI,
        "state": state
    }

    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{ML_AUTH_URL}?{query}"


def validate_state(state: str) -> Optional[int]:
    """Valida el state del callback y retorna el user_id."""
    try:
        payload = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Intercambia el code de autorización por tokens de acceso."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            ML_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.MERCADOLIBRE_CLIENT_ID,
                "client_secret": settings.MERCADOLIBRE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.MERCADOLIBRE_REDIRECT_URI
            }
        )

        if response.status_code != 200:
            raise ValueError(f"Error al obtener tokens: {response.text}")

        return response.json()


async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    """Renueva el access_token usando el refresh_token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            ML_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "client_id": settings.MERCADOLIBRE_CLIENT_ID,
                "client_secret": settings.MERCADOLIBRE_CLIENT_SECRET,
                "refresh_token": refresh_token
            }
        )

        if response.status_code != 200:
            raise ValueError(f"Error al renovar token: {response.text}")

        return response.json()


async def get_ml_user(access_token: str) -> Dict[str, Any]:
    """Obtiene información del usuario de MercadoLibre."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ML_API_URL}/users/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code != 200:
            raise ValueError(f"Error al obtener usuario: {response.text}")

        return response.json()


async def get_valid_token(db: AsyncSession, user_id) -> Optional[str]:
    """
    Obtiene un access_token válido para el usuario.
    Si está expirado, intenta renovarlo automáticamente.
    """
    result = await db.execute(
        select(MercadoLibreCredentials).where(
            MercadoLibreCredentials.usuario_id == user_id
        )
    )
    credentials = result.scalar_one_or_none()

    if not credentials:
        return None

    # Verificar si el token está expirado (con 5 minutos de margen)
    now = datetime.now(credentials.expires_at.tzinfo) if credentials.expires_at.tzinfo else datetime.now()
    if credentials.expires_at <= now + timedelta(minutes=5):
        try:
            tokens = await refresh_access_token(credentials.refresh_token)
            credentials.access_token = tokens["access_token"]
            credentials.refresh_token = tokens["refresh_token"]
            credentials.expires_at = datetime.now() + timedelta(seconds=tokens["expires_in"])
            await db.commit()
        except Exception as e:
            logger.warning(f"Error renovando token ML para usuario {user_id}: {e}")
            return None

    return credentials.access_token


def unidad_to_ml_item(
    unidad: Unidad,
    category_id: str,
    listing_type: str = "gold_special",
    price_override: Optional[float] = None,
    user_id: str = None
) -> Dict[str, Any]:
    """Convierte una Unidad a formato de item de MercadoLibre."""
    price = price_override or unidad.precio_publicado or 0

    title = f"{unidad.marca} {unidad.modelo}"
    if unidad.version:
        title += f" {unidad.version}"
    title += f" {unidad.anio}"
    title = title[:60]

    description = f"""
{unidad.marca} {unidad.modelo} {unidad.version or ''} - Año {unidad.anio}

Características:
- Kilometraje: {unidad.kilometraje or 'Consultar'} km
- Combustible: {unidad.combustible or 'Consultar'}
- Transmisión: {unidad.transmision or 'Consultar'}
- Color: {unidad.color or 'Consultar'}

{unidad.observaciones or ''}

¡Consulte financiación disponible!
    """.strip()

    pictures = []
    if unidad.fotos:
        foto_urls = []
        if isinstance(unidad.fotos, str):
            try:
                import json
                parsed = json.loads(unidad.fotos)
                if isinstance(parsed, list):
                    foto_urls = [f.get('url', f) if isinstance(f, dict) else f for f in parsed]
                else:
                    foto_urls = unidad.fotos.split(",")
            except (json.JSONDecodeError, TypeError):
                foto_urls = unidad.fotos.split(",")
        elif isinstance(unidad.fotos, list):
            foto_urls = [f.get('url', f) if isinstance(f, dict) else f for f in unidad.fotos]

        pictures = [{"source": url.strip()} for url in foto_urls[:12] if url and str(url).strip()]

    item = {
        "title": title,
        "category_id": category_id,
        "price": price,
        "currency_id": "ARS",
        "available_quantity": 1,
        "buying_mode": "classified",
        "listing_type_id": listing_type,
        "condition": "used",
        "description": {"plain_text": description},
        "pictures": pictures,
        "attributes": [
            {"id": "BRAND", "value_name": unidad.marca},
            {"id": "MODEL", "value_name": unidad.modelo},
            {"id": "VEHICLE_YEAR", "value_name": str(unidad.anio)},
            {"id": "KILOMETERS", "value_name": str(unidad.kilometraje or 0)},
            {"id": "FUEL_TYPE", "value_name": unidad.combustible or "Nafta"},
            {"id": "TRANSMISSION", "value_name": unidad.transmision or "Manual"},
            {"id": "COLOR", "value_name": unidad.color or "Otro"},
            {"id": "DOORS", "value_name": "4"},
        ]
    }

    if unidad.dominio:
        item["attributes"].append({
            "id": "LICENSE_PLATE",
            "value_name": unidad.dominio
        })

    return item


async def create_item(access_token: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
    """Crea un ítem (publicación) en MercadoLibre."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{ML_API_URL}/items",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=item_data
        )

        if response.status_code not in [200, 201]:
            error_data = response.json()
            raise ValueError(f"Error al crear publicación: {error_data.get('message', response.text)}")

        return response.json()


async def update_item(
    access_token: str,
    item_id: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """Actualiza un ítem existente en MercadoLibre."""
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{ML_API_URL}/items/{item_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=data
        )

        if response.status_code != 200:
            error_data = response.json()
            raise ValueError(f"Error al actualizar: {error_data.get('message', response.text)}")

        return response.json()


async def change_item_status(
    access_token: str,
    item_id: str,
    status: str
) -> Dict[str, Any]:
    return await update_item(access_token, item_id, {"status": status})


async def pause_item(access_token: str, item_id: str) -> Dict[str, Any]:
    return await change_item_status(access_token, item_id, "paused")


async def activate_item(access_token: str, item_id: str) -> Dict[str, Any]:
    return await change_item_status(access_token, item_id, "active")


async def close_item(access_token: str, item_id: str) -> Dict[str, Any]:
    return await change_item_status(access_token, item_id, "closed")


async def get_item(access_token: str, item_id: str) -> Dict[str, Any]:
    """Obtiene información de un ítem de MercadoLibre."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ML_API_URL}/items/{item_id}",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code != 200:
            raise ValueError(f"Error al obtener item: {response.text}")

        return response.json()


async def get_categories(access_token: str = None) -> list:
    """Obtiene las subcategorías de autos usados."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ML_API_URL}/categories/{ML_CATEGORY_AUTOS}"
        )

        if response.status_code != 200:
            return []

        data = response.json()
        return data.get("children_categories", [])
