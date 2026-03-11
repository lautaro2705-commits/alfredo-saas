"""
Endpoints para el módulo de Peritaje Digital.
Gestión completa de inspecciones vehiculares con fotos y puntajes.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.usuario import RolUsuario
from app.verticals.autos.models.unidad import Unidad
from app.verticals.autos.models.peritaje import (
    Peritaje, PeritajeItem, PeritajeFoto,
    EstadoPeritaje, TipoPeritaje, SectorPeritaje, CalificacionItem
)
from app.verticals.autos.schemas.peritaje import (
    PeritajeCreate, PeritajeUpdate, PeritajeResponse, PeritajeListResponse,
    CalificacionItemUpdate, CalificacionItemBatch, PeritajeItemResponse,
    PeritajeFotoResponse, PuntajeEstadoResponse, AprobacionRequest,
    MessageResponse, PuntajeCalculadoResponse
)
from app.verticals.autos.core.peritaje_config import (
    get_all_checklist_items, PUNTAJE_BUENO, PUNTAJE_REGULAR, PUNTAJE_MALO,
    calcular_ajuste_precio, obtener_resumen_estado, obtener_recomendacion
)
from app.verticals.autos.services.cloudinary_service import (
    upload_foto_peritaje, delete_foto, delete_fotos_peritaje,
    is_cloudinary_configured, configure_cloudinary
)

router = APIRouter(prefix="/autos/peritajes", tags=["autos-peritajes"])


# ============== Helpers ==============

def calcular_puntajes(peritaje: Peritaje) -> dict:
    """Calcula los puntajes por sector y total"""
    puntajes = {
        "mecanica": [],
        "estetica": [],
        "documentacion": []
    }
    costo_total = 0

    for item in peritaje.items:
        if item.calificacion and item.calificacion != CalificacionItem.NA:
            valor = item.valor_puntaje
            if valor is not None:
                puntajes[item.sector.value].append(valor)
        costo_total += item.costo_reparacion_estimado or 0

    # Calcular promedio por sector
    puntaje_mecanica = sum(puntajes["mecanica"]) / len(puntajes["mecanica"]) if puntajes["mecanica"] else 0
    puntaje_estetica = sum(puntajes["estetica"]) / len(puntajes["estetica"]) if puntajes["estetica"] else 0
    puntaje_documentacion = sum(puntajes["documentacion"]) / len(puntajes["documentacion"]) if puntajes["documentacion"] else 0

    # Calcular puntaje total ponderado
    puntaje_total = (
        puntaje_mecanica * (peritaje.peso_mecanica / 100) +
        puntaje_estetica * (peritaje.peso_estetica / 100) +
        puntaje_documentacion * (peritaje.peso_documentacion / 100)
    )

    return {
        "puntaje_mecanica": round(puntaje_mecanica, 1),
        "puntaje_estetica": round(puntaje_estetica, 1),
        "puntaje_documentacion": round(puntaje_documentacion, 1),
        "puntaje_total": round(puntaje_total, 1),
        "costo_reparaciones_estimado": costo_total
    }


async def crear_items_checklist(db: AsyncSession, peritaje_id: int):
    """Crea los items del checklist predefinido para un peritaje"""
    checklist = get_all_checklist_items()

    for sector_name, items in checklist.items():
        sector = SectorPeritaje(sector_name)
        for item_data in items:
            item = PeritajeItem(
                peritaje_id=peritaje_id,
                sector=sector,
                codigo_item=item_data["codigo"],
                nombre_item=item_data["nombre"],
                orden=item_data["orden"]
            )
            db.add(item)

    await db.commit()


def serializar_peritaje(peritaje: Peritaje) -> dict:
    """Serializa un peritaje con todos sus datos relacionados"""
    # Agrupar items por sector
    items_por_sector = {
        "mecanica": [],
        "estetica": [],
        "documentacion": []
    }

    for item in sorted(peritaje.items, key=lambda x: x.orden):
        item_dict = {
            "id": item.id,
            "peritaje_id": item.peritaje_id,
            "sector": item.sector.value if item.sector else None,
            "codigo_item": item.codigo_item,
            "nombre_item": item.nombre_item,
            "orden": item.orden,
            "calificacion": item.calificacion.value if item.calificacion else None,
            "observaciones": item.observaciones,
            "costo_reparacion_estimado": item.costo_reparacion_estimado or 0,
            "urgente": item.urgente,
            "fotos": [
                {
                    "id": f.id,
                    "url": f.url,
                    "thumbnail_url": f.thumbnail_url,
                    "tipo_foto": f.tipo_foto,
                    "descripcion": f.descripcion
                } for f in item.fotos
            ]
        }
        items_por_sector[item.sector.value].append(item_dict)

    # Serializar fotos
    fotos = [
        {
            "id": f.id,
            "peritaje_id": f.peritaje_id,
            "peritaje_item_id": f.peritaje_item_id,
            "sector": f.sector.value if f.sector else None,
            "tipo_foto": f.tipo_foto,
            "descripcion": f.descripcion,
            "nombre_archivo": f.nombre_archivo,
            "url": f.url,
            "public_id": f.public_id,
            "mime_type": f.mime_type,
            "tamano_bytes": f.tamano_bytes,
            "ancho": f.ancho,
            "alto": f.alto,
            "thumbnail_url": f.thumbnail_url,
            "medium_url": f.medium_url,
            "created_at": f.created_at
        } for f in peritaje.fotos
    ]

    return {
        "id": peritaje.id,
        "tipo": peritaje.tipo.value if peritaje.tipo else None,
        "estado": peritaje.estado.value if peritaje.estado else None,
        "unidad_id": peritaje.unidad_id,
        "operacion_id": peritaje.operacion_id,
        "vehiculo_marca": peritaje.vehiculo_marca,
        "vehiculo_modelo": peritaje.vehiculo_modelo,
        "vehiculo_version": peritaje.vehiculo_version,
        "vehiculo_anio": peritaje.vehiculo_anio,
        "vehiculo_dominio": peritaje.vehiculo_dominio,
        "vehiculo_kilometraje": peritaje.vehiculo_kilometraje,
        "vehiculo_color": peritaje.vehiculo_color,
        "vehiculo_combustible": peritaje.vehiculo_combustible,
        "vehiculo_descripcion": peritaje.vehiculo_descripcion,
        "puntaje_mecanica": peritaje.puntaje_mecanica,
        "puntaje_estetica": peritaje.puntaje_estetica,
        "puntaje_documentacion": peritaje.puntaje_documentacion,
        "puntaje_total": peritaje.puntaje_total,
        "resumen_estado": peritaje.resumen_estado,
        "peso_mecanica": peritaje.peso_mecanica,
        "peso_estetica": peritaje.peso_estetica,
        "peso_documentacion": peritaje.peso_documentacion,
        "costo_reparaciones_estimado": peritaje.costo_reparaciones_estimado,
        "ajuste_precio_sugerido": peritaje.ajuste_precio_sugerido,
        "fecha_peritaje": peritaje.fecha_peritaje,
        "fecha_completado": peritaje.fecha_completado,
        "observaciones_generales": peritaje.observaciones_generales,
        "perito_id": peritaje.perito_id,
        "perito_nombre": peritaje.perito.nombre_completo if peritaje.perito else "N/A",
        "aprobado_por_id": peritaje.aprobado_por_id,
        "aprobado_por_nombre": peritaje.aprobado_por.nombre_completo if peritaje.aprobado_por else None,
        "items_total": peritaje.items_total,
        "items_calificados": peritaje.items_calificados,
        "porcentaje_completado": peritaje.porcentaje_completado,
        "items_por_sector": items_por_sector,
        "fotos": fotos,
        "created_at": peritaje.created_at,
        "updated_at": peritaje.updated_at
    }


# ============== CRUD Endpoints ==============

@router.get("/", response_model=List[PeritajeListResponse])
async def listar_peritajes(
    estado: Optional[EstadoPeritaje] = None,
    tipo: Optional[TipoPeritaje] = None,
    unidad_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Lista todos los peritajes con filtros opcionales"""
    stmt = select(Peritaje).options(selectinload(Peritaje.perito))

    if estado:
        stmt = stmt.where(Peritaje.estado == estado)
    if tipo:
        stmt = stmt.where(Peritaje.tipo == tipo)
    if unidad_id:
        stmt = stmt.where(Peritaje.unidad_id == unidad_id)

    stmt = stmt.order_by(desc(Peritaje.fecha_peritaje)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    peritajes = result.scalars().all()

    return [
        {
            "id": p.id,
            "tipo": p.tipo,
            "estado": p.estado,
            "unidad_id": p.unidad_id,
            "vehiculo_descripcion": p.vehiculo_descripcion,
            "puntaje_total": p.puntaje_total,
            "resumen_estado": p.resumen_estado,
            "fecha_peritaje": p.fecha_peritaje,
            "perito_nombre": p.perito.nombre_completo if p.perito else "N/A",
            "porcentaje_completado": p.porcentaje_completado
        }
        for p in peritajes
    ]


@router.post("/", response_model=dict)
async def crear_peritaje(
    peritaje_data: PeritajeCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Crea un nuevo peritaje e inicializa el checklist.
    Si se proporciona unidad_id, carga los datos del vehículo automáticamente.
    """
    # Si hay unidad_id, cargar datos del vehículo
    if peritaje_data.unidad_id:
        result = await db.execute(select(Unidad).where(Unidad.id == peritaje_data.unidad_id))
        unidad = result.scalar_one_or_none()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")

        # Usar datos de la unidad
        vehiculo_data = {
            "vehiculo_marca": unidad.marca,
            "vehiculo_modelo": unidad.modelo,
            "vehiculo_version": unidad.version,
            "vehiculo_anio": unidad.anio,
            "vehiculo_dominio": unidad.dominio,
            "vehiculo_kilometraje": unidad.kilometraje,
            "vehiculo_color": unidad.color,
            "vehiculo_combustible": unidad.combustible
        }
    else:
        vehiculo_data = {
            "vehiculo_marca": peritaje_data.vehiculo_marca,
            "vehiculo_modelo": peritaje_data.vehiculo_modelo,
            "vehiculo_version": peritaje_data.vehiculo_version,
            "vehiculo_anio": peritaje_data.vehiculo_anio,
            "vehiculo_dominio": peritaje_data.vehiculo_dominio,
            "vehiculo_kilometraje": peritaje_data.vehiculo_kilometraje,
            "vehiculo_color": peritaje_data.vehiculo_color,
            "vehiculo_combustible": peritaje_data.vehiculo_combustible
        }

    # Crear peritaje
    peritaje = Peritaje(
        tipo=peritaje_data.tipo,
        unidad_id=peritaje_data.unidad_id,
        operacion_id=peritaje_data.operacion_id,
        observaciones_generales=peritaje_data.observaciones_generales,
        perito_id=token.user_id,
        **vehiculo_data
    )

    db.add(peritaje)
    await db.commit()
    await db.refresh(peritaje)

    # Crear items del checklist
    await crear_items_checklist(db, peritaje.id)

    # Re-fetch with all relationships loaded
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje.id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por)
        )
    )
    peritaje = result.scalar_one()

    return serializar_peritaje(peritaje)


@router.get("/{peritaje_id}", response_model=dict)
async def obtener_peritaje(
    peritaje_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtiene un peritaje con todos sus detalles"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    return serializar_peritaje(peritaje)


@router.put("/{peritaje_id}", response_model=dict)
async def actualizar_peritaje(
    peritaje_id: int,
    peritaje_update: PeritajeUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualiza los datos de un peritaje (solo en estado borrador)"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado != EstadoPeritaje.BORRADOR:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden editar peritajes en estado borrador"
        )

    # Actualizar campos proporcionados
    update_data = peritaje_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(peritaje, field, value)

    await db.commit()
    await db.refresh(peritaje)

    return serializar_peritaje(peritaje)


@router.delete("/{peritaje_id}")
async def eliminar_peritaje(
    peritaje_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Elimina un peritaje y todas sus fotos"""
    result = await db.execute(select(Peritaje).where(Peritaje.id == peritaje_id))
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    # Solo admin puede eliminar peritajes completados
    if peritaje.estado != EstadoPeritaje.BORRADOR and token.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden eliminar peritajes completados"
        )

    # Eliminar fotos de Cloudinary
    if is_cloudinary_configured():
        delete_fotos_peritaje(peritaje_id)

    await db.delete(peritaje)
    await db.commit()

    return {"message": "Peritaje eliminado correctamente", "success": True}


# ============== Items Endpoints ==============

@router.get("/{peritaje_id}/items/{sector}")
async def obtener_items_sector(
    peritaje_id: int,
    sector: SectorPeritaje,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtiene los items de un sector específico"""
    result = await db.execute(select(Peritaje).where(Peritaje.id == peritaje_id))
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    result = await db.execute(
        select(PeritajeItem)
        .where(
            PeritajeItem.peritaje_id == peritaje_id,
            PeritajeItem.sector == sector
        )
        .order_by(PeritajeItem.orden)
        .options(selectinload(PeritajeItem.fotos))
    )
    items = result.scalars().all()

    return [
        {
            "id": item.id,
            "peritaje_id": item.peritaje_id,
            "sector": item.sector,
            "codigo_item": item.codigo_item,
            "nombre_item": item.nombre_item,
            "orden": item.orden,
            "calificacion": item.calificacion,
            "observaciones": item.observaciones,
            "costo_reparacion_estimado": item.costo_reparacion_estimado or 0,
            "urgente": item.urgente,
            "fotos": [
                {
                    "id": f.id,
                    "url": f.url,
                    "thumbnail_url": f.thumbnail_url,
                    "tipo_foto": f.tipo_foto,
                    "descripcion": f.descripcion
                } for f in item.fotos
            ]
        }
        for item in items
    ]


@router.put("/{peritaje_id}/items/{item_id}")
async def calificar_item(
    peritaje_id: int,
    item_id: int,
    calificacion_data: CalificacionItemUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Califica un item individual del checklist"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(selectinload(Peritaje.items))
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado not in [EstadoPeritaje.BORRADOR, EstadoPeritaje.COMPLETADO]:
        raise HTTPException(
            status_code=400,
            detail="No se puede modificar un peritaje aprobado o rechazado"
        )

    result = await db.execute(
        select(PeritajeItem).where(
            PeritajeItem.id == item_id,
            PeritajeItem.peritaje_id == peritaje_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    # Actualizar calificación
    item.calificacion = calificacion_data.calificacion
    item.observaciones = calificacion_data.observaciones
    item.costo_reparacion_estimado = calificacion_data.costo_reparacion_estimado
    item.urgente = calificacion_data.urgente

    # Recalcular puntajes
    puntajes = calcular_puntajes(peritaje)
    peritaje.puntaje_mecanica = puntajes["puntaje_mecanica"]
    peritaje.puntaje_estetica = puntajes["puntaje_estetica"]
    peritaje.puntaje_documentacion = puntajes["puntaje_documentacion"]
    peritaje.puntaje_total = puntajes["puntaje_total"]
    peritaje.costo_reparaciones_estimado = puntajes["costo_reparaciones_estimado"]

    await db.commit()
    await db.refresh(item)

    return {
        "id": item.id,
        "calificacion": item.calificacion,
        "observaciones": item.observaciones,
        "costo_reparacion_estimado": item.costo_reparacion_estimado,
        "urgente": item.urgente,
        "puntaje_total": peritaje.puntaje_total
    }


@router.put("/{peritaje_id}/items/batch")
async def calificar_items_batch(
    peritaje_id: int,
    items_data: List[CalificacionItemBatch],
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Califica múltiples items de una vez (optimizado para mobile)"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(selectinload(Peritaje.items))
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado not in [EstadoPeritaje.BORRADOR, EstadoPeritaje.COMPLETADO]:
        raise HTTPException(
            status_code=400,
            detail="No se puede modificar un peritaje aprobado o rechazado"
        )

    updated_count = 0
    for item_data in items_data:
        result = await db.execute(
            select(PeritajeItem).where(
                PeritajeItem.id == item_data.item_id,
                PeritajeItem.peritaje_id == peritaje_id
            )
        )
        item = result.scalar_one_or_none()

        if item:
            item.calificacion = item_data.calificacion
            item.observaciones = item_data.observaciones
            item.costo_reparacion_estimado = item_data.costo_reparacion_estimado
            item.urgente = item_data.urgente
            updated_count += 1

    # Recalcular puntajes
    puntajes = calcular_puntajes(peritaje)
    peritaje.puntaje_mecanica = puntajes["puntaje_mecanica"]
    peritaje.puntaje_estetica = puntajes["puntaje_estetica"]
    peritaje.puntaje_documentacion = puntajes["puntaje_documentacion"]
    peritaje.puntaje_total = puntajes["puntaje_total"]
    peritaje.costo_reparaciones_estimado = puntajes["costo_reparaciones_estimado"]

    await db.commit()

    return {
        "message": f"{updated_count} items actualizados",
        "puntaje_total": peritaje.puntaje_total,
        "success": True
    }


# ============== Fotos Endpoints ==============

@router.post("/{peritaje_id}/fotos")
async def subir_foto(
    peritaje_id: int,
    sector: SectorPeritaje = Form(...),
    item_id: Optional[int] = Form(None),
    tipo_foto: str = Form("general"),
    descripcion: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Sube una foto al peritaje"""
    result = await db.execute(select(Peritaje).where(Peritaje.id == peritaje_id))
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado not in [EstadoPeritaje.BORRADOR, EstadoPeritaje.COMPLETADO]:
        raise HTTPException(
            status_code=400,
            detail="No se pueden agregar fotos a un peritaje aprobado o rechazado"
        )

    # Validar tipo de archivo
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    # Verificar configuración de Cloudinary
    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=500,
            detail="Cloudinary no está configurado. Configure las variables de entorno."
        )

    # Configurar Cloudinary
    configure_cloudinary()

    # Subir a Cloudinary
    try:
        result_upload = await upload_foto_peritaje(
            file=file,
            peritaje_id=peritaje_id,
            sector=sector.value,
            tipo_foto=tipo_foto
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Crear registro en DB
    foto = PeritajeFoto(
        peritaje_id=peritaje_id,
        peritaje_item_id=item_id,
        sector=sector,
        tipo_foto=tipo_foto,
        descripcion=descripcion,
        nombre_archivo=result_upload["original_filename"],
        url=result_upload["url"],
        public_id=result_upload["public_id"],
        mime_type=file.content_type,
        tamano_bytes=result_upload["bytes"],
        ancho=result_upload["width"],
        alto=result_upload["height"]
    )

    db.add(foto)
    await db.commit()
    await db.refresh(foto)

    return {
        "id": foto.id,
        "url": foto.url,
        "thumbnail_url": foto.thumbnail_url,
        "public_id": foto.public_id,
        "sector": foto.sector,
        "tipo_foto": foto.tipo_foto,
        "descripcion": foto.descripcion,
        "tamano_bytes": foto.tamano_bytes
    }


@router.delete("/{peritaje_id}/fotos/{foto_id}")
async def eliminar_foto(
    peritaje_id: int,
    foto_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Elimina una foto del peritaje"""
    result = await db.execute(
        select(PeritajeFoto).where(
            PeritajeFoto.id == foto_id,
            PeritajeFoto.peritaje_id == peritaje_id
        )
    )
    foto = result.scalar_one_or_none()

    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    result = await db.execute(select(Peritaje).where(Peritaje.id == peritaje_id))
    peritaje = result.scalar_one_or_none()
    if peritaje.estado not in [EstadoPeritaje.BORRADOR, EstadoPeritaje.COMPLETADO]:
        raise HTTPException(
            status_code=400,
            detail="No se pueden eliminar fotos de un peritaje aprobado o rechazado"
        )

    # Eliminar de Cloudinary
    if is_cloudinary_configured() and foto.public_id:
        configure_cloudinary()
        delete_foto(foto.public_id)

    await db.delete(foto)
    await db.commit()

    return {"message": "Foto eliminada correctamente", "success": True}


# ============== Acciones Endpoints ==============

@router.post("/{peritaje_id}/calcular-puntaje", response_model=PuntajeCalculadoResponse)
async def recalcular_puntaje(
    peritaje_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Recalcula los puntajes del peritaje"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items),
            selectinload(Peritaje.unidad)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    puntajes = calcular_puntajes(peritaje)

    peritaje.puntaje_mecanica = puntajes["puntaje_mecanica"]
    peritaje.puntaje_estetica = puntajes["puntaje_estetica"]
    peritaje.puntaje_documentacion = puntajes["puntaje_documentacion"]
    peritaje.puntaje_total = puntajes["puntaje_total"]
    peritaje.costo_reparaciones_estimado = puntajes["costo_reparaciones_estimado"]

    # Calcular ajuste de precio (usando precio de mercado si existe)
    precio_referencia = 0
    if peritaje.unidad and peritaje.unidad.valor_mercado:
        precio_referencia = peritaje.unidad.valor_mercado
    elif peritaje.unidad and peritaje.unidad.precio_publicado:
        precio_referencia = peritaje.unidad.precio_publicado

    peritaje.ajuste_precio_sugerido = calcular_ajuste_precio(
        peritaje.puntaje_total,
        precio_referencia
    )

    await db.commit()

    items_evaluados = len([i for i in peritaje.items if i.calificacion is not None])
    items_pendientes = len(peritaje.items) - items_evaluados

    return {
        "puntaje_mecanica": peritaje.puntaje_mecanica,
        "puntaje_estetica": peritaje.puntaje_estetica,
        "puntaje_documentacion": peritaje.puntaje_documentacion,
        "puntaje_total": peritaje.puntaje_total,
        "resumen_estado": peritaje.resumen_estado,
        "costo_reparaciones_estimado": peritaje.costo_reparaciones_estimado,
        "ajuste_precio_sugerido": peritaje.ajuste_precio_sugerido,
        "items_evaluados": items_evaluados,
        "items_pendientes": items_pendientes
    }


@router.post("/{peritaje_id}/completar")
async def completar_peritaje(
    peritaje_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Marca el peritaje como completado"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por),
            selectinload(Peritaje.unidad)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado != EstadoPeritaje.BORRADOR:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden completar peritajes en estado borrador"
        )

    # Verificar que todos los items estén calificados
    items_sin_calificar = [i for i in peritaje.items if i.calificacion is None]
    if items_sin_calificar:
        raise HTTPException(
            status_code=400,
            detail=f"Hay {len(items_sin_calificar)} items sin calificar"
        )

    # Recalcular puntajes finales
    puntajes = calcular_puntajes(peritaje)
    peritaje.puntaje_mecanica = puntajes["puntaje_mecanica"]
    peritaje.puntaje_estetica = puntajes["puntaje_estetica"]
    peritaje.puntaje_documentacion = puntajes["puntaje_documentacion"]
    peritaje.puntaje_total = puntajes["puntaje_total"]
    peritaje.costo_reparaciones_estimado = puntajes["costo_reparaciones_estimado"]

    # Calcular ajuste de precio
    precio_referencia = 0
    if peritaje.unidad and peritaje.unidad.valor_mercado:
        precio_referencia = peritaje.unidad.valor_mercado
    elif peritaje.unidad and peritaje.unidad.precio_publicado:
        precio_referencia = peritaje.unidad.precio_publicado

    peritaje.ajuste_precio_sugerido = calcular_ajuste_precio(
        peritaje.puntaje_total,
        precio_referencia
    )

    # Marcar como completado
    peritaje.estado = EstadoPeritaje.COMPLETADO
    peritaje.fecha_completado = datetime.now()

    # Actualizar unidad si existe
    if peritaje.unidad:
        peritaje.unidad.puntaje_ultimo_peritaje = peritaje.puntaje_total
        peritaje.unidad.fecha_ultimo_peritaje = datetime.now()

    await db.commit()
    await db.refresh(peritaje)

    return serializar_peritaje(peritaje)


@router.post("/{peritaje_id}/aprobar")
async def aprobar_peritaje(
    peritaje_id: int,
    aprobacion: AprobacionRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Aprueba o rechaza un peritaje (solo admin)"""
    if token.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden aprobar/rechazar peritajes"
        )

    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    if peritaje.estado != EstadoPeritaje.COMPLETADO:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden aprobar/rechazar peritajes completados"
        )

    peritaje.estado = EstadoPeritaje.APROBADO if aprobacion.aprobado else EstadoPeritaje.RECHAZADO
    peritaje.aprobado_por_id = token.user_id

    if aprobacion.observaciones:
        # Need to fetch the user name for the observation text
        from app.verticals.autos.models.usuario import Usuario
        result_user = await db.execute(select(Usuario).where(Usuario.id == token.user_id))
        current_user = result_user.scalar_one_or_none()
        nombre_completo = current_user.nombre_completo if current_user else "Admin"

        peritaje.observaciones_generales = (
            (peritaje.observaciones_generales or "") +
            f"\n\n[{datetime.now().strftime('%d/%m/%Y %H:%M')}] " +
            f"{'Aprobado' if aprobacion.aprobado else 'Rechazado'} por {nombre_completo}: " +
            aprobacion.observaciones
        )

    await db.commit()
    await db.refresh(peritaje)

    return serializar_peritaje(peritaje)


# ============== Integración Endpoints ==============

@router.get("/{peritaje_id}/puntaje-estado", response_model=PuntajeEstadoResponse)
async def obtener_puntaje_estado(
    peritaje_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Obtiene el puntaje de estado para integración con CalculadoraRetoma.
    Devuelve información resumida del estado del vehículo para ajustar el precio.
    """
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(selectinload(Peritaje.items))
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    # Obtener items urgentes
    items_urgentes = [
        item.nombre_item for item in peritaje.items
        if item.urgente and item.calificacion == CalificacionItem.MALO
    ]

    return {
        "peritaje_id": peritaje.id,
        "puntaje_estado": peritaje.puntaje_total,
        "resumen_estado": peritaje.resumen_estado,
        "ajuste_precio": peritaje.ajuste_precio_sugerido,
        "costo_reparaciones": peritaje.costo_reparaciones_estimado,
        "items_urgentes": items_urgentes,
        "recomendacion": obtener_recomendacion(
            peritaje.puntaje_total,
            peritaje.costo_reparaciones_estimado
        ),
        "puntaje_mecanica": peritaje.puntaje_mecanica,
        "puntaje_estetica": peritaje.puntaje_estetica,
        "puntaje_documentacion": peritaje.puntaje_documentacion
    }


# ============== PDF Endpoint ==============

@router.get("/{peritaje_id}/pdf")
async def generar_pdf(
    peritaje_id: int,
    incluir_fotos: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Genera un PDF del informe de peritaje"""
    result = await db.execute(
        select(Peritaje)
        .where(Peritaje.id == peritaje_id)
        .options(
            selectinload(Peritaje.items).selectinload(PeritajeItem.fotos),
            selectinload(Peritaje.fotos),
            selectinload(Peritaje.perito),
            selectinload(Peritaje.aprobado_por)
        )
    )
    peritaje = result.scalar_one_or_none()
    if not peritaje:
        raise HTTPException(status_code=404, detail="Peritaje no encontrado")

    try:
        from app.services.pdf_peritaje import generar_pdf_peritaje
        pdf_buffer = generar_pdf_peritaje(peritaje, incluir_fotos=incluir_fotos)

        filename = f"peritaje_{peritaje_id}_{peritaje.vehiculo_dominio or 'sin_dominio'}.pdf"

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="El servicio de generación de PDF no está disponible. Instale reportlab."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)}")
