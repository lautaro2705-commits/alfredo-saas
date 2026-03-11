from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import os
import uuid
import shutil
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.core.security.file_validator import validate_file_content
from app.verticals.autos.models.archivo import ArchivoUnidad, TipoDocumentoArchivo
from app.verticals.autos.models.unidad import Unidad
from app.verticals.autos.schemas.archivo import ArchivoResponse, ArchivoListResponse

router = APIRouter(prefix="/autos/archivos", tags=["autos-archivos"])

# Directorio base para almacenar archivos
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")

# Asegurar que existe el directorio
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_upload_path(unidad_id: int, filename: str) -> str:
    """Generar ruta de almacenamiento para un archivo"""
    # Crear subdirectorio por unidad
    unidad_dir = os.path.join(UPLOAD_DIR, f"unidad_{unidad_id}")
    os.makedirs(unidad_dir, exist_ok=True)

    # Generar nombre unico
    ext = os.path.splitext(filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"

    return os.path.join(unidad_dir, unique_name)


# ==================== CRUD ARCHIVOS ====================

@router.get("/unidad/{unidad_id}", response_model=List[ArchivoListResponse])
async def listar_archivos_unidad(
    unidad_id: int,
    tipo: Optional[TipoDocumentoArchivo] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar archivos de una unidad"""
    # Verificar que existe la unidad
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    stmt = select(ArchivoUnidad).where(ArchivoUnidad.unidad_id == unidad_id)

    if tipo:
        stmt = stmt.where(ArchivoUnidad.tipo_documento == tipo)

    stmt = stmt.order_by(ArchivoUnidad.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{archivo_id}", response_model=ArchivoResponse)
async def obtener_archivo(
    archivo_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un archivo"""
    result = await db.execute(select(ArchivoUnidad).where(ArchivoUnidad.id == archivo_id))
    archivo = result.scalar_one_or_none()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return archivo


@router.get("/{archivo_id}/download")
async def descargar_archivo(
    archivo_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Descargar un archivo"""
    result = await db.execute(select(ArchivoUnidad).where(ArchivoUnidad.id == archivo_id))
    archivo = result.scalar_one_or_none()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    if not os.path.exists(archivo.ruta_archivo):
        raise HTTPException(status_code=404, detail="Archivo fisico no encontrado")

    return FileResponse(
        path=archivo.ruta_archivo,
        filename=archivo.nombre_archivo,
        media_type=archivo.mime_type or "application/octet-stream"
    )


@router.post("/unidad/{unidad_id}/upload", response_model=ArchivoResponse)
async def subir_archivo(
    unidad_id: int,
    tipo_documento: TipoDocumentoArchivo = Form(...),
    descripcion: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Subir archivo a una unidad"""
    # Verificar que existe la unidad
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Validar tipo de archivo
    allowed_types = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Permitidos: imagenes, PDF, Word"
        )

    # Validar tamano (max 10MB)
    max_size = 10 * 1024 * 1024
    file_content = await file.read()

    # Validate magic bytes match declared MIME type
    if not validate_file_content(file_content, file.content_type):
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no coincide con el tipo declarado.",
        )

    if len(file_content) > max_size:
        raise HTTPException(status_code=400, detail="Archivo muy grande. Maximo 10MB")

    # Guardar archivo
    ruta = get_upload_path(unidad_id, file.filename)
    with open(ruta, "wb") as f:
        f.write(file_content)

    # Crear registro en BD
    db_archivo = ArchivoUnidad(
        unidad_id=unidad_id,
        tipo_documento=tipo_documento,
        nombre_archivo=file.filename,
        ruta_archivo=ruta,
        mime_type=file.content_type,
        tamano_bytes=len(file_content),
        descripcion=descripcion,
        created_by=token.user_id
    )
    db.add(db_archivo)
    await db.commit()
    await db.refresh(db_archivo)

    return db_archivo


@router.post("/unidad/{unidad_id}/upload-multiple")
async def subir_multiples_archivos(
    unidad_id: int,
    tipo_documento: TipoDocumentoArchivo = Form(...),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Subir multiples archivos a una unidad"""
    # Verificar que existe la unidad
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    allowed_types = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf"
    ]
    max_size = 10 * 1024 * 1024

    subidos = []
    errores = []

    for file in files:
        try:
            if file.content_type not in allowed_types:
                errores.append({"archivo": file.filename, "error": "Tipo no permitido"})
                continue

            file_content = await file.read()

            # Validate magic bytes match declared MIME type
            if not validate_file_content(file_content, file.content_type):
                errores.append({"archivo": file.filename, "error": "Contenido no coincide con tipo declarado"})
                continue

            if len(file_content) > max_size:
                errores.append({"archivo": file.filename, "error": "Muy grande (max 10MB)"})
                continue

            ruta = get_upload_path(unidad_id, file.filename)
            with open(ruta, "wb") as f:
                f.write(file_content)

            db_archivo = ArchivoUnidad(
                unidad_id=unidad_id,
                tipo_documento=tipo_documento,
                nombre_archivo=file.filename,
                ruta_archivo=ruta,
                mime_type=file.content_type,
                tamano_bytes=len(file_content),
                created_by=token.user_id
            )
            db.add(db_archivo)
            subidos.append(file.filename)

        except Exception as e:
            errores.append({"archivo": file.filename, "error": str(e)})

    await db.commit()

    return {
        "subidos": len(subidos),
        "archivos": subidos,
        "errores": errores
    }


@router.delete("/{archivo_id}")
async def eliminar_archivo(
    archivo_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un archivo"""
    result = await db.execute(select(ArchivoUnidad).where(ArchivoUnidad.id == archivo_id))
    archivo = result.scalar_one_or_none()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Eliminar archivo fisico
    if os.path.exists(archivo.ruta_archivo):
        os.remove(archivo.ruta_archivo)

    # Eliminar registro
    await db.delete(archivo)
    await db.commit()

    return {"mensaje": "Archivo eliminado"}


# ==================== TIPOS DE DOCUMENTO ====================

@router.get("/tipos-documento")
async def listar_tipos_documento():
    """Listar tipos de documento disponibles"""
    tipos = []
    for tipo in TipoDocumentoArchivo:
        label = tipo.value.replace("_", " ").title()
        es_foto = tipo.value.startswith("foto_")
        tipos.append({
            "value": tipo.value,
            "label": label,
            "es_foto": es_foto
        })
    return tipos


# ==================== RESUMEN POR UNIDAD ====================

@router.get("/unidad/{unidad_id}/resumen")
async def resumen_archivos_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener resumen de archivos de una unidad"""
    result = await db.execute(
        select(ArchivoUnidad).where(ArchivoUnidad.unidad_id == unidad_id)
    )
    archivos = result.scalars().all()

    por_tipo = {}
    for archivo in archivos:
        tipo = archivo.tipo_documento.value
        if tipo not in por_tipo:
            por_tipo[tipo] = []
        por_tipo[tipo].append({
            "id": archivo.id,
            "nombre": archivo.nombre_archivo,
            "es_imagen": archivo.es_imagen
        })

    # Verificar documentos requeridos
    documentos_requeridos = ["titulo", "form_08", "vpa"]
    faltantes = [d for d in documentos_requeridos if d not in por_tipo]

    return {
        "total_archivos": len(archivos),
        "por_tipo": por_tipo,
        "documentos_faltantes": faltantes,
        "tiene_fotos": any(k.startswith("foto_") for k in por_tipo.keys())
    }
