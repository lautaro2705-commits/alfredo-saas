from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.actividad import Actividad, EntidadActividad

router = APIRouter(prefix="/autos/actividades", tags=["autos-actividades"])


@router.get("/", response_model=List[dict])
async def listar_actividades(
    entidad: Optional[EntidadActividad] = None,
    usuario_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Listar actividades con filtros (solo admin)"""
    stmt = select(Actividad).options(selectinload(Actividad.usuario))

    if entidad:
        stmt = stmt.where(Actividad.entidad == entidad)
    if usuario_id:
        stmt = stmt.where(Actividad.usuario_id == usuario_id)
    if fecha_desde:
        stmt = stmt.where(Actividad.created_at >= fecha_desde)
    if fecha_hasta:
        from datetime import datetime, timedelta
        stmt = stmt.where(Actividad.created_at < datetime.combine(fecha_hasta + timedelta(days=1), datetime.min.time()))

    stmt = stmt.order_by(Actividad.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    actividades = result.scalars().all()

    return [
        {
            "id": a.id,
            "accion": a.accion.value if a.accion else None,
            "entidad": a.entidad.value if a.entidad else None,
            "entidad_id": a.entidad_id,
            "descripcion": a.descripcion,
            "datos_extra": a.datos_extra,
            "usuario_id": a.usuario_id,
            "usuario_nombre": f"{a.usuario.nombre} {a.usuario.apellido}" if a.usuario else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in actividades
    ]


@router.get("/recientes", response_model=List[dict])
async def actividades_recientes(
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Últimas actividades para widget dashboard"""
    stmt = select(Actividad).options(
        selectinload(Actividad.usuario)
    ).order_by(
        Actividad.created_at.desc()
    ).limit(limit)

    result = await db.execute(stmt)
    actividades = result.scalars().all()

    return [
        {
            "id": a.id,
            "accion": a.accion.value if a.accion else None,
            "entidad": a.entidad.value if a.entidad else None,
            "entidad_id": a.entidad_id,
            "descripcion": a.descripcion,
            "usuario_nombre": f"{a.usuario.nombre} {a.usuario.apellido}" if a.usuario else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in actividades
    ]
