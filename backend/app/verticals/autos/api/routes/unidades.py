from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, select, delete, update
from typing import List, Optional
from datetime import date, datetime, timezone
import logging
from app.core.database import get_db

logger = logging.getLogger(__name__)
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad, OrigenUnidad
from app.platform.models.user import RolUsuario
from app.verticals.autos.schemas.unidad import UnidadCreate, UnidadUpdate, UnidadResponse, UnidadListResponse
from app.verticals.autos.models.actividad import registrar_actividad, AccionActividad, EntidadActividad
from app.core.soft_delete import soft_delete, soft_delete_many
from app.verticals.autos.services.cloudinary_service import (  # TODO: move to shared services
    upload_foto_unidad,
    is_cloudinary_configured,
    get_thumbnail_url
)

router = APIRouter(prefix="/autos/unidades", tags=["autos-unidades"])


@router.get("/", response_model=List[UnidadListResponse])
async def listar_unidades(
    estado: Optional[EstadoUnidad] = None,
    marca: Optional[str] = None,
    buscar: Optional[str] = None,
    solo_inmovilizados: bool = False,
    excluir_vendidos: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar unidades con filtros opcionales"""
    stmt = select(Unidad).where(Unidad.active())

    if estado:
        stmt = stmt.where(Unidad.estado == estado)
    elif excluir_vendidos:
        stmt = stmt.where(Unidad.estado != EstadoUnidad.VENDIDO)
    if marca:
        stmt = stmt.where(Unidad.marca.ilike(f"%{marca}%"))
    if buscar:
        stmt = stmt.where(
            or_(
                Unidad.marca.ilike(f"%{buscar}%"),
                Unidad.modelo.ilike(f"%{buscar}%"),
                Unidad.dominio.ilike(f"%{buscar}%")
            )
        )

    stmt = stmt.order_by(Unidad.fecha_ingreso.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    unidades = result.scalars().all()

    if solo_inmovilizados:
        unidades = [u for u in unidades if u.stock_inmovilizado]

    return unidades


@router.get("/vendidos", response_model=List[UnidadListResponse])
async def listar_vendidos(
    buscar: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar unidades vendidas"""
    stmt = select(Unidad).where(Unidad.active(), Unidad.estado == EstadoUnidad.VENDIDO)

    if buscar:
        stmt = stmt.where(
            or_(
                Unidad.marca.ilike(f"%{buscar}%"),
                Unidad.modelo.ilike(f"%{buscar}%"),
                Unidad.dominio.ilike(f"%{buscar}%")
            )
        )

    stmt = stmt.order_by(Unidad.fecha_venta.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/stock-disponible", response_model=List[UnidadListResponse])
async def listar_stock_disponible(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar solo unidades disponibles para venta"""
    stmt = select(Unidad).where(
        Unidad.active(),
        Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO])
    ).order_by(Unidad.fecha_ingreso.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/inmovilizados", response_model=List[UnidadListResponse])
async def listar_inmovilizados(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar unidades con más de 60 días en stock"""
    from app.core.config import settings
    stmt = select(Unidad).where(
        Unidad.active(),
        Unidad.estado == EstadoUnidad.DISPONIBLE
    )
    result = await db.execute(stmt)
    unidades = result.scalars().all()
    return [u for u in unidades if u.dias_en_stock > settings.DIAS_STOCK_INMOVILIZADO]


@router.get("/valorizacion/resumen")
async def valorizacion_stock(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Obtener valorización del stock separando propio de consignación.
    Solo accesible para administradores.
    """
    # Unidades disponibles y reservadas (en stock activo)
    stmt = select(Unidad).where(
        Unidad.active(),
        Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO, EstadoUnidad.EN_REPARACION])
    )
    result = await db.execute(stmt)
    unidades_en_stock = result.scalars().all()

    # Separar por origen
    stock_propio = [u for u in unidades_en_stock if u.origen != OrigenUnidad.CONSIGNACION]
    stock_consignacion = [u for u in unidades_en_stock if u.origen == OrigenUnidad.CONSIGNACION]

    # Calcular totales stock propio
    total_costo_propio = sum(u.costo_total for u in stock_propio)
    total_precio_propio = sum(u.precio_publicado or 0 for u in stock_propio)

    # Calcular totales consignación (no suma al stock propio)
    total_costo_consignacion = sum(u.precio_compra for u in stock_consignacion)
    total_precio_consignacion = sum(u.precio_publicado or 0 for u in stock_consignacion)

    return {
        "stock_propio": {
            "cantidad": len(stock_propio),
            "inversion_total": total_costo_propio,
            "valor_publicado": total_precio_propio,
            "utilidad_potencial": total_precio_propio - total_costo_propio,
            "unidades": [
                {
                    "id": u.id,
                    "descripcion": f"{u.marca} {u.modelo} {u.anio}",
                    "dominio": u.dominio,
                    "costo_total": u.costo_total,
                    "precio_publicado": u.precio_publicado,
                    "dias_en_stock": u.dias_en_stock,
                    "estado": u.estado.value,
                    "origen": u.origen.value
                }
                for u in sorted(stock_propio, key=lambda x: x.costo_total, reverse=True)
            ]
        },
        "stock_consignacion": {
            "cantidad": len(stock_consignacion),
            "valor_acordado": total_costo_consignacion,
            "valor_publicado": total_precio_consignacion,
            "comision_potencial": total_precio_consignacion - total_costo_consignacion,
            "unidades": [
                {
                    "id": u.id,
                    "descripcion": f"{u.marca} {u.modelo} {u.anio}",
                    "dominio": u.dominio,
                    "valor_consignacion": u.precio_compra,
                    "precio_publicado": u.precio_publicado,
                    "dias_en_stock": u.dias_en_stock,
                    "estado": u.estado.value
                }
                for u in sorted(stock_consignacion, key=lambda x: x.precio_compra, reverse=True)
            ]
        },
        "resumen_total": {
            "unidades_totales": len(unidades_en_stock),
            "inversion_propia": total_costo_propio,
            "valor_total_publicado": total_precio_propio + total_precio_consignacion
        }
    }


@router.get("/{unidad_id}", response_model=UnidadResponse)
async def obtener_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de una unidad"""
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    return unidad


@router.post("/", response_model=UnidadResponse)
async def crear_unidad(
    unidad: UnidadCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Crear nueva unidad"""
    # Verificar dominio único
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.dominio == unidad.dominio))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una unidad con ese dominio")

    db_unidad = Unidad(**unidad.model_dump())
    if not db_unidad.fecha_ingreso:
        db_unidad.fecha_ingreso = date.today()

    db.add(db_unidad)
    await registrar_actividad(db, token.user_id, AccionActividad.INGRESAR, EntidadActividad.UNIDAD,  # TODO: make registrar_actividad async
                        db_unidad.id, f"Ingresó {db_unidad.marca} {db_unidad.modelo} {db_unidad.anio} ({db_unidad.dominio})")
    await db.commit()
    await db.refresh(db_unidad)

    # Buscar matches con interesados (CRM)
    try:
        from app.verticals.autos.api.routes.interesados import buscar_matches_para_unidad
        await buscar_matches_para_unidad(db, db_unidad, token.user_id)
    except Exception as e:
        logger.warning(f"Error buscando matches para unidad {db_unidad.id}: {e}")

    return db_unidad


@router.put("/{unidad_id}", response_model=UnidadResponse)
async def actualizar_unidad(
    unidad_id: int,
    unidad_update: UnidadUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar una unidad"""
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    db_unidad = result.scalar_one_or_none()
    if not db_unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    update_data = unidad_update.model_dump(exclude_unset=True)

    # Verificar dominio único si se está cambiando
    if "dominio" in update_data and update_data["dominio"] != db_unidad.dominio:
        dup_result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.dominio == update_data["dominio"]))
        if dup_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Ya existe una unidad con ese dominio")

    for field, value in update_data.items():
        setattr(db_unidad, field, value)

    await db.commit()
    await db.refresh(db_unidad)
    return db_unidad


@router.delete("/{unidad_id}")
async def eliminar_unidad(
    unidad_id: int,
    forzar: bool = Query(False, description="Forzar eliminación incluyendo operaciones asociadas (solo admin)"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar una unidad. Si tiene operaciones o está vendida, requiere forzar=true y ser admin."""
    from app.verticals.autos.models.operacion import Operacion
    from app.verticals.autos.models.caja_diaria import CajaDiaria
    from sqlalchemy.exc import IntegrityError

    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    db_unidad = result.scalar_one_or_none()
    if not db_unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Verificar si tiene operaciones asociadas
    op_result = await db.execute(select(Operacion).where(Operacion.unidad_id == unidad_id))
    operaciones = op_result.scalars().all()
    tiene_operaciones = len(operaciones) > 0

    if db_unidad.estado == EstadoUnidad.VENDIDO or tiene_operaciones:
        if not forzar:
            msg = "Esta unidad tiene operaciones asociadas. " if tiene_operaciones else ""
            msg += "Use forzar=true para eliminar (solo admin)."
            raise HTTPException(status_code=400, detail=msg)
        if token.rol != RolUsuario.ADMIN:
            raise HTTPException(status_code=403, detail="Solo administradores pueden forzar esta eliminación")

    try:
        now = datetime.now(timezone.utc)
        sd_values = {"deleted_at": now, "deleted_by": token.user_id}

        # Si hay operaciones, soft-delete movimientos de caja y operaciones
        if tiene_operaciones:
            for op in operaciones:
                await db.execute(
                    update(CajaDiaria)
                    .where(CajaDiaria.operacion_id == op.id, CajaDiaria.deleted_at.is_(None))
                    .values(**sd_values)
                )
                await soft_delete(db, op, deleted_by=token.user_id, commit=False)
            await db.flush()

        # Soft-delete costos directos asociados
        from app.verticals.autos.models.costo_directo import CostoDirecto
        await db.execute(
            update(CostoDirecto)
            .where(CostoDirecto.unidad_id == unidad_id, CostoDirecto.deleted_at.is_(None))
            .values(**sd_values)
        )

        # Soft-delete checklist de documentación
        try:
            from app.verticals.autos.models.documentacion import ChecklistDocumentacion
            await db.execute(
                update(ChecklistDocumentacion)
                .where(ChecklistDocumentacion.unidad_id == unidad_id, ChecklistDocumentacion.deleted_at.is_(None))
                .values(**sd_values)
            )
        except Exception as e:
            logger.warning(f"Error soft-deleting checklist documentación unidad {unidad_id}: {e}")

        # Soft-delete archivos asociados
        try:
            from app.verticals.autos.models.archivo import ArchivoUnidad
            await db.execute(
                update(ArchivoUnidad)
                .where(ArchivoUnidad.unidad_id == unidad_id, ArchivoUnidad.deleted_at.is_(None))
                .values(**sd_values)
            )
        except Exception as e:
            logger.warning(f"Error soft-deleting archivos unidad {unidad_id}: {e}")

        await soft_delete(db, db_unidad, deleted_by=token.user_id)
        return {"mensaje": "Unidad eliminada correctamente"}

    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: hay registros relacionados. Detalle: {str(e.orig)[:200]}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar: {str(e)[:200]}"
        )


@router.get("/{unidad_id}/historial-costos")
async def historial_costos(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener historial de costos/reparaciones de una unidad"""
    from app.verticals.autos.models.costo_directo import CostoDirecto

    # Eager-load costos_directos to avoid lazy-load in async context
    result = await db.execute(
        select(Unidad)
        .options(selectinload(Unidad.costos_directos))
        .where(Unidad.active(), Unidad.id == unidad_id)
    )
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    costos = unidad.costos_directos
    total = sum(c.monto for c in costos)

    return {
        "unidad_id": unidad_id,
        "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
        "total_costos": total,
        "costo_adquisicion": unidad.precio_compra,
        "gastos_transferencia": unidad.gastos_transferencia,
        "costo_total": unidad.costo_total,
        "costos": [
            {
                "id": c.id,
                "fecha": c.fecha,
                "categoria": c.categoria.value,
                "descripcion": c.descripcion,
                "monto": c.monto,
                "proveedor": c.proveedor
            }
            for c in sorted(costos, key=lambda x: x.fecha, reverse=True)
        ]
    }


@router.post("/ocr-titulo")
async def ocr_titulo_automotor(
    file: UploadFile = File(...),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Procesa una foto del título automotor y extrae los datos usando OCR (OpenAI Vision).

    Retorna los datos extraídos del título para autocompletar el formulario de unidad.
    """
    from app.services.titulo_ocr_service import extraer_datos_titulo
    from app.core.config import settings

    # Validar que OpenAI está configurado
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OCR no disponible: OPENAI_API_KEY no está configurada"
        )

    # Validar tipo de archivo
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser una imagen (JPEG, PNG, etc.)"
        )

    # Validar tamaño (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="La imagen es muy grande. Máximo 10MB."
        )

    try:
        # Procesar OCR
        resultado = await extraer_datos_titulo(contents)

        if not resultado["success"]:
            raise HTTPException(
                status_code=422,
                detail=resultado.get("error", "Error al procesar el título")
            )

        return resultado

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar OCR: {str(e)}"
        )


# ==================== FOTOS ====================

@router.get("/{unidad_id}/fotos")
async def listar_fotos_unidad(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener lista de fotos de una unidad."""
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Las fotos se guardan como JSON array en el campo 'fotos'
    import json
    fotos = []
    if unidad.fotos:
        try:
            fotos = json.loads(unidad.fotos)
        except json.JSONDecodeError:
            # Si no es JSON válido, puede ser URLs separadas por coma (formato viejo)
            fotos = [{"url": url.strip(), "public_id": None} for url in unidad.fotos.split(",") if url.strip()]

    return {
        "unidad_id": unidad_id,
        "fotos": fotos,
        "total": len(fotos)
    }


@router.post("/{unidad_id}/fotos")
async def subir_foto_unidad(
    unidad_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Sube una foto para una unidad.
    Las fotos se guardan en Cloudinary y las URLs se almacenan en la unidad.
    """
    import json

    # Verificar que Cloudinary está configurado
    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=500,
            detail="El almacenamiento de imágenes no está configurado"
        )

    # Verificar que la unidad existe
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Validar tipo de archivo
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser una imagen (JPEG, PNG, etc.)"
        )

    # Obtener fotos actuales
    fotos_actuales = []
    if unidad.fotos:
        try:
            fotos_actuales = json.loads(unidad.fotos)
        except json.JSONDecodeError:
            fotos_actuales = []

    # Determinar orden
    orden = len(fotos_actuales)

    try:
        # Subir a Cloudinary
        resultado = await upload_foto_unidad(file, unidad_id, orden)

        # Agregar a la lista de fotos
        nueva_foto = {
            "url": resultado["url"],
            "public_id": resultado["public_id"],
            "thumbnail": get_thumbnail_url(resultado["url"], 200),
            "orden": orden,
            "width": resultado.get("width"),
            "height": resultado.get("height")
        }
        fotos_actuales.append(nueva_foto)

        # Guardar en la unidad
        unidad.fotos = json.dumps(fotos_actuales)
        await db.commit()

        return {
            "success": True,
            "foto": nueva_foto,
            "total_fotos": len(fotos_actuales)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al subir foto: {str(e)}"
        )


@router.delete("/{unidad_id}/fotos/{foto_index}")
async def eliminar_foto_unidad(
    unidad_id: int,
    foto_index: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Elimina una foto de una unidad por su índice en el array.
    """
    import json

    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Obtener fotos actuales
    fotos_actuales = []
    if unidad.fotos:
        try:
            fotos_actuales = json.loads(unidad.fotos)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Error en formato de fotos")

    # Validar índice
    if foto_index < 0 or foto_index >= len(fotos_actuales):
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    # Obtener foto a eliminar
    foto = fotos_actuales[foto_index]

    # NO eliminamos de Cloudinary — preservamos el archivo físico (soft delete)
    # La foto se quita del array visible pero sigue en Cloudinary

    # Eliminar del array
    fotos_actuales.pop(foto_index)

    # Reordenar
    for i, f in enumerate(fotos_actuales):
        f["orden"] = i

    # Guardar
    unidad.fotos = json.dumps(fotos_actuales) if fotos_actuales else None
    await db.commit()

    return {
        "success": True,
        "mensaje": "Foto eliminada",
        "total_fotos": len(fotos_actuales)
    }


@router.put("/{unidad_id}/fotos/reordenar")
async def reordenar_fotos_unidad(
    unidad_id: int,
    nuevo_orden: List[int],
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Reordena las fotos de una unidad.
    nuevo_orden es una lista de índices en el orden deseado.
    """
    import json

    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    fotos_actuales = []
    if unidad.fotos:
        try:
            fotos_actuales = json.loads(unidad.fotos)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Error en formato de fotos")

    # Validar que el nuevo orden tiene la misma cantidad
    if len(nuevo_orden) != len(fotos_actuales):
        raise HTTPException(status_code=400, detail="El orden no coincide con la cantidad de fotos")

    # Reordenar
    fotos_reordenadas = [fotos_actuales[i] for i in nuevo_orden]
    for i, f in enumerate(fotos_reordenadas):
        f["orden"] = i

    unidad.fotos = json.dumps(fotos_reordenadas)
    await db.commit()

    return {
        "success": True,
        "fotos": fotos_reordenadas
    }
