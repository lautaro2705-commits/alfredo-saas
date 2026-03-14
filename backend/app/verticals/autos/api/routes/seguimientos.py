"""
CRUD de Seguimientos / Agenda.
Vendedores ven solo los propios, admin ve todos.
"""
import logging
from datetime import date, datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.seguimiento import Seguimiento, EstadoSeguimiento
from app.core.soft_delete import soft_delete
from app.verticals.autos.schemas.seguimiento import (
    SeguimientoCreate,
    SeguimientoUpdate,
    SeguimientoCompletarRequest,
    SeguimientoResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/autos/seguimientos", tags=["autos-seguimientos"])


def _to_response(s: Seguimiento) -> dict:
    """Convierte un Seguimiento ORM a dict de respuesta con nombres resueltos."""
    return {
        "id": s.id,
        "titulo": s.titulo,
        "descripcion": s.descripcion,
        "tipo": s.tipo,
        "prioridad": s.prioridad,
        "estado": s.estado,
        "fecha_vencimiento": s.fecha_vencimiento,
        "hora": s.hora,
        "cliente_id": s.cliente_id,
        "cliente_nombre": s.cliente.nombre_completo if s.cliente else None,
        "interesado_id": s.interesado_id,
        "interesado_nombre": (
            f"{s.interesado.nombre} {s.interesado.apellido}" if s.interesado else None
        ),
        "unidad_id": s.unidad_id,
        "unidad_info": (
            f"{s.unidad.marca} {s.unidad.modelo} ({s.unidad.dominio})" if s.unidad else None
        ),
        "operacion_id": s.operacion_id,
        "asignado_a": s.asignado_a,
        "asignado_nombre": (
            f"{s.asignado.nombre} {s.asignado.apellido}" if s.asignado else None
        ),
        "created_by": s.created_by,
        "creador_nombre": (
            f"{s.creador.nombre} {s.creador.apellido}" if s.creador else None
        ),
        "completado_at": s.completado_at,
        "observaciones_cierre": s.observaciones_cierre,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
        "vencido": s.vencido,
        "vence_hoy": s.vence_hoy,
    }


def _base_stmt():
    """Select base con joins eagerly loaded."""
    return select(Seguimiento).where(Seguimiento.active()).options(
        selectinload(Seguimiento.cliente),
        selectinload(Seguimiento.interesado),
        selectinload(Seguimiento.unidad),
        selectinload(Seguimiento.asignado),
        selectinload(Seguimiento.creador),
    )


@router.get("/", response_model=List[SeguimientoResponse])
async def listar_seguimientos(
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    asignado_a: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Listar seguimientos. Vendedores solo ven los propios."""
    stmt = _base_stmt()

    # Restricción por rol
    if token.rol != "admin":
        stmt = stmt.where(Seguimiento.asignado_a == token.user_id)
    elif asignado_a:
        stmt = stmt.where(Seguimiento.asignado_a == asignado_a)

    if estado:
        stmt = stmt.where(Seguimiento.estado == estado)
    if tipo:
        stmt = stmt.where(Seguimiento.tipo == tipo)
    if fecha_desde:
        stmt = stmt.where(Seguimiento.fecha_vencimiento >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(Seguimiento.fecha_vencimiento <= fecha_hasta)

    stmt = (
        stmt.order_by(Seguimiento.fecha_vencimiento.asc(), Seguimiento.prioridad.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    seguimientos = result.scalars().all()

    return [_to_response(s) for s in seguimientos]


@router.get("/mis-pendientes", response_model=List[SeguimientoResponse])
async def mis_pendientes(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Seguimientos pendientes del usuario logueado (hoy + vencidos)."""
    hoy = date.today()
    stmt = (
        _base_stmt()
        .where(
            Seguimiento.asignado_a == token.user_id,
            Seguimiento.estado == EstadoSeguimiento.PENDIENTE,
            Seguimiento.fecha_vencimiento <= hoy,
        )
        .order_by(Seguimiento.fecha_vencimiento.asc())
    )

    result = await db.execute(stmt)
    seguimientos = result.scalars().all()
    return [_to_response(s) for s in seguimientos]


@router.post("/", response_model=SeguimientoResponse)
async def crear_seguimiento(
    data: SeguimientoCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Crear un nuevo seguimiento."""
    # Si no se especifica asignado, se asigna al creador
    asignado = data.asignado_a or token.user_id

    # Vendedores solo pueden asignar a sí mismos
    if token.rol != "admin" and asignado != token.user_id:
        raise HTTPException(status_code=403, detail="Solo puede asignar seguimientos a sí mismo")

    seguimiento = Seguimiento(
        titulo=data.titulo,
        descripcion=data.descripcion,
        tipo=data.tipo,
        prioridad=data.prioridad,
        fecha_vencimiento=data.fecha_vencimiento,
        hora=data.hora,
        cliente_id=data.cliente_id,
        interesado_id=data.interesado_id,
        unidad_id=data.unidad_id,
        operacion_id=data.operacion_id,
        asignado_a=asignado,
        created_by=token.user_id,
    )
    db.add(seguimiento)
    await db.commit()
    await db.refresh(seguimiento)

    # Recargar con joins
    result = await db.execute(_base_stmt().where(Seguimiento.id == seguimiento.id))
    seguimiento = result.scalar_one_or_none()
    return _to_response(seguimiento)


@router.put("/{seguimiento_id}", response_model=SeguimientoResponse)
async def actualizar_seguimiento(
    seguimiento_id: int,
    data: SeguimientoUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Editar un seguimiento."""
    result = await db.execute(select(Seguimiento).where(Seguimiento.active(), Seguimiento.id == seguimiento_id))
    seguimiento = result.scalar_one_or_none()
    if not seguimiento:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    # Verificar permisos
    if token.rol != "admin" and seguimiento.asignado_a != token.user_id:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar este seguimiento")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(seguimiento, key, value)

    await db.commit()
    await db.refresh(seguimiento)

    result = await db.execute(_base_stmt().where(Seguimiento.id == seguimiento.id))
    seguimiento = result.scalar_one_or_none()
    return _to_response(seguimiento)


@router.post("/{seguimiento_id}/completar", response_model=SeguimientoResponse)
async def completar_seguimiento(
    seguimiento_id: int,
    data: SeguimientoCompletarRequest = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Marcar seguimiento como completado."""
    result = await db.execute(select(Seguimiento).where(Seguimiento.active(), Seguimiento.id == seguimiento_id))
    seguimiento = result.scalar_one_or_none()
    if not seguimiento:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    if token.rol != "admin" and seguimiento.asignado_a != token.user_id:
        raise HTTPException(status_code=403, detail="No tiene permisos")

    seguimiento.estado = EstadoSeguimiento.COMPLETADO
    seguimiento.completado_at = datetime.now(timezone.utc)
    if data and data.observaciones_cierre:
        seguimiento.observaciones_cierre = data.observaciones_cierre

    await db.commit()
    await db.refresh(seguimiento)

    result = await db.execute(_base_stmt().where(Seguimiento.id == seguimiento.id))
    seguimiento = result.scalar_one_or_none()
    return _to_response(seguimiento)


@router.post("/{seguimiento_id}/cancelar", response_model=SeguimientoResponse)
async def cancelar_seguimiento(
    seguimiento_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """Cancelar un seguimiento."""
    result = await db.execute(select(Seguimiento).where(Seguimiento.active(), Seguimiento.id == seguimiento_id))
    seguimiento = result.scalar_one_or_none()
    if not seguimiento:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    if token.rol != "admin" and seguimiento.asignado_a != token.user_id:
        raise HTTPException(status_code=403, detail="No tiene permisos")

    seguimiento.estado = EstadoSeguimiento.CANCELADO
    await db.commit()
    await db.refresh(seguimiento)

    result = await db.execute(_base_stmt().where(Seguimiento.id == seguimiento.id))
    seguimiento = result.scalar_one_or_none()
    return _to_response(seguimiento)


@router.delete("/{seguimiento_id}")
async def eliminar_seguimiento(
    seguimiento_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin")),
):
    """Eliminar un seguimiento. Solo admin."""
    result = await db.execute(select(Seguimiento).where(Seguimiento.id == seguimiento_id))
    seguimiento = result.scalar_one_or_none()
    if not seguimiento:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    await soft_delete(db, seguimiento, deleted_by=token.user_id)
    return {"ok": True, "mensaje": "Seguimiento eliminado"}
