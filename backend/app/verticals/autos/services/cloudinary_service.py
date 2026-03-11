"""
Servicio de integración con Cloudinary para almacenamiento de imágenes.
Maneja upload, transformaciones y eliminación de fotos de peritaje.
"""
import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import Optional, Dict, Any
from fastapi import UploadFile
from app.core.config import settings
import io


def configure_cloudinary():
    """
    Configura las credenciales de Cloudinary desde las variables de entorno.
    Debe llamarse al inicio de la aplicación.
    """
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )


async def upload_foto_peritaje(
    file: UploadFile,
    peritaje_id: int,
    sector: str,
    tipo_foto: str = "general"
) -> Dict[str, Any]:
    """
    Sube una foto de peritaje a Cloudinary con optimización automática.
    """
    contents = await file.read()

    import time
    filename = f"{tipo_foto}_{int(time.time() * 1000)}"
    folder = f"peritajes/{peritaje_id}/{sector}"

    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(contents),
            folder=folder,
            public_id=filename,
            resource_type="image",
            transformation=[
                {"width": 1200, "crop": "limit"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ],
            overwrite=True,
            invalidate=True,
            context={
                "peritaje_id": str(peritaje_id),
                "sector": sector,
                "tipo": tipo_foto
            }
        )

        return {
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "width": result.get("width"),
            "height": result.get("height"),
            "bytes": result.get("bytes"),
            "format": result.get("format"),
            "original_filename": file.filename
        }

    except cloudinary.exceptions.Error as e:
        raise Exception(f"Error al subir imagen a Cloudinary: {str(e)}")


def delete_foto(public_id: str) -> bool:
    """Elimina una foto de Cloudinary."""
    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get("result") == "ok"
    except cloudinary.exceptions.Error:
        return False


def delete_fotos_peritaje(peritaje_id: int) -> Dict[str, Any]:
    """Elimina todas las fotos de un peritaje (carpeta completa)."""
    try:
        folder = f"peritajes/{peritaje_id}"
        result = cloudinary.api.delete_resources_by_prefix(folder)
        cloudinary.api.delete_folder(folder)
        return {"success": True, "deleted": result.get("deleted", {})}
    except cloudinary.exceptions.Error as e:
        return {"success": False, "error": str(e)}


def get_thumbnail_url(url: str, width: int = 200) -> str:
    """Genera URL de thumbnail a partir de la URL original."""
    if not url:
        return None
    return url.replace("/upload/", f"/upload/w_{width},h_{width},c_fill/")


def get_medium_url(url: str, width: int = 400) -> str:
    """Genera URL de tamaño medio para uso en PDF y vistas detalle."""
    if not url:
        return None
    return url.replace("/upload/", f"/upload/w_{width},c_limit/")


def get_optimized_url(url: str, width: Optional[int] = None, quality: str = "auto:good") -> str:
    """Genera URL optimizada con parámetros personalizados."""
    if not url:
        return None
    transformations = [f"q_{quality}"]
    if width:
        transformations.append(f"w_{width},c_limit")
    transform_string = ",".join(transformations)
    return url.replace("/upload/", f"/upload/{transform_string}/")


def is_cloudinary_configured() -> bool:
    """Verifica si Cloudinary está configurado correctamente."""
    return all([
        settings.CLOUDINARY_CLOUD_NAME,
        settings.CLOUDINARY_API_KEY,
        settings.CLOUDINARY_API_SECRET
    ])


async def upload_foto_unidad(
    file: UploadFile,
    unidad_id: int,
    orden: int = 0
) -> Dict[str, Any]:
    """Sube una foto de unidad a Cloudinary con optimización automática."""
    contents = await file.read()

    import time
    filename = f"foto_{orden}_{int(time.time() * 1000)}"
    folder = f"unidades/{unidad_id}"

    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(contents),
            folder=folder,
            public_id=filename,
            resource_type="image",
            transformation=[
                {"width": 1200, "crop": "limit"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ],
            overwrite=True,
            invalidate=True,
            context={
                "unidad_id": str(unidad_id),
                "orden": str(orden)
            }
        )

        return {
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "width": result.get("width"),
            "height": result.get("height"),
            "bytes": result.get("bytes"),
            "format": result.get("format"),
            "original_filename": file.filename
        }

    except cloudinary.exceptions.Error as e:
        raise Exception(f"Error al subir imagen a Cloudinary: {str(e)}")
