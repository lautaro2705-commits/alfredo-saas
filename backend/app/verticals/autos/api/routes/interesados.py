from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, update
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.interesado import Interesado, NotificacionMatch
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.schemas.interesado import (
    InteresadoCreate,
    InteresadoUpdate,
    InteresadoResponse,
    InteresadoListResponse,
    NotificacionMatchCreate,
    NotificacionMatchUpdate,
    NotificacionMatchResponse
)

router = APIRouter(prefix="/autos/interesados", tags=["autos-interesados"])


# ==================== CRUD INTERESADOS ====================

@router.get("/", response_model=List[InteresadoListResponse])
async def listar_interesados(
    activos: Optional[bool] = True,
    marca: Optional[str] = None,
    modelo: Optional[str] = None,
    buscar: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar interesados (lista de espera) con filtros"""
    stmt = select(Interesado)

    if activos is not None:
        stmt = stmt.where(Interesado.activo == activos)
    if marca:
        stmt = stmt.where(Interesado.marca_buscada.ilike(f"%{marca}%"))
    if modelo:
        stmt = stmt.where(Interesado.modelo_buscado.ilike(f"%{modelo}%"))
    if buscar:
        stmt = stmt.where(
            or_(
                Interesado.nombre.ilike(f"%{buscar}%"),
                Interesado.apellido.ilike(f"%{buscar}%"),
                Interesado.telefono.ilike(f"%{buscar}%"),
                Interesado.marca_buscada.ilike(f"%{buscar}%"),
                Interesado.modelo_buscado.ilike(f"%{buscar}%")
            )
        )

    stmt = stmt.order_by(Interesado.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    interesados = result.scalars().all()

    # Convertir a response con nombre_completo
    return [
        InteresadoListResponse(
            id=i.id,
            nombre_completo=i.nombre_completo,
            telefono=i.telefono,
            marca_buscada=i.marca_buscada,
            modelo_buscado=i.modelo_buscado,
            precio_maximo=i.precio_maximo,
            activo=i.activo,
            created_at=i.created_at
        )
        for i in interesados
    ]


@router.get("/{interesado_id}", response_model=InteresadoResponse)
async def obtener_interesado(
    interesado_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un interesado"""
    result = await db.execute(select(Interesado).where(Interesado.id == interesado_id))
    interesado = result.scalar_one_or_none()
    if not interesado:
        raise HTTPException(status_code=404, detail="Interesado no encontrado")
    return interesado


@router.post("/", response_model=InteresadoResponse)
async def crear_interesado(
    interesado: InteresadoCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Crear nuevo interesado en la lista de espera"""
    db_interesado = Interesado(
        **interesado.model_dump(),
        created_by=token.user_id
    )
    db.add(db_interesado)
    await db.commit()
    await db.refresh(db_interesado)

    # Buscar matches inmediatos con stock actual
    await buscar_matches_para_interesado(db, db_interesado, token.user_id)

    return db_interesado


@router.put("/{interesado_id}", response_model=InteresadoResponse)
async def actualizar_interesado(
    interesado_id: int,
    interesado_update: InteresadoUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar interesado"""
    result = await db.execute(select(Interesado).where(Interesado.id == interesado_id))
    db_interesado = result.scalar_one_or_none()
    if not db_interesado:
        raise HTTPException(status_code=404, detail="Interesado no encontrado")

    update_data = interesado_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_interesado, field, value)

    await db.commit()
    await db.refresh(db_interesado)
    return db_interesado


@router.delete("/{interesado_id}")
async def eliminar_interesado(
    interesado_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar interesado de la lista"""
    result = await db.execute(select(Interesado).where(Interesado.id == interesado_id))
    db_interesado = result.scalar_one_or_none()
    if not db_interesado:
        raise HTTPException(status_code=404, detail="Interesado no encontrado")

    await db.delete(db_interesado)
    await db.commit()
    return {"mensaje": "Interesado eliminado"}


@router.post("/{interesado_id}/desactivar")
async def desactivar_interesado(
    interesado_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Desactivar interesado (ya no busca)"""
    result = await db.execute(select(Interesado).where(Interesado.id == interesado_id))
    db_interesado = result.scalar_one_or_none()
    if not db_interesado:
        raise HTTPException(status_code=404, detail="Interesado no encontrado")

    db_interesado.activo = False
    await db.commit()
    return {"mensaje": "Interesado desactivado"}


# ==================== MATCH AUTOMATICO ====================

async def buscar_matches_para_interesado(db: AsyncSession, interesado: Interesado, user_id):
    """Buscar unidades disponibles que coincidan con lo que busca el interesado"""
    if not interesado.activo:
        return []

    result = await db.execute(
        select(Unidad).where(
            Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO])
        )
    )
    unidades = result.scalars().all()

    matches = []
    for unidad in unidades:
        score = interesado.match_score(unidad)
        if score >= 50:  # Umbral minimo de 50%
            # Verificar que no exista notificacion previa
            result = await db.execute(
                select(NotificacionMatch).where(
                    NotificacionMatch.interesado_id == interesado.id,
                    NotificacionMatch.unidad_id == unidad.id
                )
            )
            existente = result.scalar_one_or_none()

            if not existente:
                notif = NotificacionMatch(
                    interesado_id=interesado.id,
                    unidad_id=unidad.id,
                    score_match=score,
                    created_by=user_id
                )
                db.add(notif)
                matches.append(notif)

    if matches:
        await db.commit()
    return matches


async def buscar_matches_para_unidad(db: AsyncSession, unidad: Unidad, user_id):
    """Buscar interesados que coincidan con una unidad nueva"""
    result = await db.execute(select(Interesado).where(Interesado.activo == True))
    interesados = result.scalars().all()

    matches = []
    for interesado in interesados:
        score = interesado.match_score(unidad)
        if score >= 50:  # Umbral minimo de 50%
            # Verificar que no exista notificacion previa
            result = await db.execute(
                select(NotificacionMatch).where(
                    NotificacionMatch.interesado_id == interesado.id,
                    NotificacionMatch.unidad_id == unidad.id
                )
            )
            existente = result.scalar_one_or_none()

            if not existente:
                notif = NotificacionMatch(
                    interesado_id=interesado.id,
                    unidad_id=unidad.id,
                    score_match=score,
                    created_by=user_id
                )
                db.add(notif)
                matches.append(notif)

    if matches:
        await db.commit()
    return matches


@router.post("/buscar-matches/{interesado_id}")
async def buscar_matches_interesado(
    interesado_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Buscar matches manualmente para un interesado"""
    result = await db.execute(select(Interesado).where(Interesado.id == interesado_id))
    interesado = result.scalar_one_or_none()
    if not interesado:
        raise HTTPException(status_code=404, detail="Interesado no encontrado")

    matches = await buscar_matches_para_interesado(db, interesado, token.user_id)
    return {"mensaje": f"Se encontraron {len(matches)} coincidencias nuevas"}


# ==================== NOTIFICACIONES ====================

@router.get("/notificaciones/pendientes", response_model=List[NotificacionMatchResponse])
async def notificaciones_pendientes(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar notificaciones de match no leidas"""
    result = await db.execute(
        select(NotificacionMatch).where(
            NotificacionMatch.leida == False
        ).order_by(NotificacionMatch.score_match.desc())
    )
    return result.scalars().all()


@router.get("/notificaciones/todas", response_model=List[NotificacionMatchResponse])
async def todas_notificaciones(
    solo_pendientes: bool = False,
    interesado_id: Optional[int] = None,
    unidad_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar todas las notificaciones de match con filtros"""
    stmt = select(NotificacionMatch)

    if solo_pendientes:
        stmt = stmt.where(NotificacionMatch.leida == False)
    if interesado_id:
        stmt = stmt.where(NotificacionMatch.interesado_id == interesado_id)
    if unidad_id:
        stmt = stmt.where(NotificacionMatch.unidad_id == unidad_id)

    stmt = stmt.order_by(NotificacionMatch.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/notificaciones/{notif_id}", response_model=NotificacionMatchResponse)
async def actualizar_notificacion(
    notif_id: int,
    notif_update: NotificacionMatchUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar estado de notificacion (marcar como leida, contactado, etc)"""
    result = await db.execute(select(NotificacionMatch).where(NotificacionMatch.id == notif_id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificacion no encontrada")

    update_data = notif_update.model_dump(exclude_unset=True)

    # Si se marca como contactado, registrar fecha
    if "contactado" in update_data and update_data["contactado"]:
        update_data["fecha_contacto"] = datetime.now()

    for field, value in update_data.items():
        setattr(notif, field, value)

    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/notificaciones/{notif_id}/marcar-leida")
async def marcar_notificacion_leida(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Marcar notificacion como leida"""
    result = await db.execute(select(NotificacionMatch).where(NotificacionMatch.id == notif_id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificacion no encontrada")

    notif.leida = True
    await db.commit()
    return {"mensaje": "Notificacion marcada como leida"}


@router.post("/notificaciones/marcar-todas-leidas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Marcar todas las notificaciones como leidas"""
    await db.execute(
        update(NotificacionMatch).where(
            NotificacionMatch.leida == False
        ).values(leida=True)
    )
    await db.commit()
    return {"mensaje": "Todas las notificaciones marcadas como leidas"}


# ==================== ESTADISTICAS ====================

@router.get("/estadisticas")
async def estadisticas_interesados(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Estadisticas de la lista de espera"""
    result = await db.execute(select(func.count(Interesado.id)))
    total = result.scalar()

    result = await db.execute(select(func.count(Interesado.id)).where(Interesado.activo == True))
    activos = result.scalar()

    result = await db.execute(select(func.count(NotificacionMatch.id)).where(NotificacionMatch.leida == False))
    notifs_pendientes = result.scalar()

    # Marcas mas buscadas
    result = await db.execute(
        select(
            Interesado.marca_buscada,
            func.count(Interesado.id).label('cantidad')
        ).where(
            Interesado.activo == True,
            Interesado.marca_buscada != None
        ).group_by(Interesado.marca_buscada).order_by(func.count(Interesado.id).desc()).limit(5)
    )
    marcas = result.all()

    return {
        "total_interesados": total,
        "interesados_activos": activos,
        "notificaciones_pendientes": notifs_pendientes,
        "marcas_mas_buscadas": [{"marca": m[0], "cantidad": m[1]} for m in marcas]
    }
