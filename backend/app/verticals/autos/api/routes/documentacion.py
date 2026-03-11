from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.verticals.autos.models.documentacion import ChecklistDocumentacion
from app.verticals.autos.models.unidad import Unidad
from app.verticals.autos.schemas.documentacion import (
    ChecklistDocumentacionCreate,
    ChecklistDocumentacionUpdate,
    ChecklistDocumentacionResponse
)

router = APIRouter(prefix="/autos/documentacion", tags=["autos-documentacion"])


@router.get("/unidad/{unidad_id}", response_model=ChecklistDocumentacionResponse)
async def obtener_checklist(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener checklist de documentación de una unidad"""
    result = await db.execute(
        select(ChecklistDocumentacion).where(
            ChecklistDocumentacion.unidad_id == unidad_id
        )
    )
    checklist = result.scalar_one_or_none()

    if not checklist:
        # Verificar que existe la unidad
        result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
        unidad = result.scalar_one_or_none()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")

        # Crear checklist vacío
        checklist = ChecklistDocumentacion(unidad_id=unidad_id)
        db.add(checklist)
        await db.commit()
        await db.refresh(checklist)

    return checklist


@router.post("/", response_model=ChecklistDocumentacionResponse)
async def crear_checklist(
    checklist: ChecklistDocumentacionCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Crear checklist de documentación para una unidad"""
    # Verificar que no existe
    result = await db.execute(
        select(ChecklistDocumentacion).where(
            ChecklistDocumentacion.unidad_id == checklist.unidad_id
        )
    )
    existente = result.scalar_one_or_none()

    if existente:
        raise HTTPException(status_code=400, detail="Ya existe checklist para esta unidad")

    # Verificar que existe la unidad
    result = await db.execute(select(Unidad).where(Unidad.id == checklist.unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    db_checklist = ChecklistDocumentacion(
        **checklist.model_dump(),
        updated_by=token.user_id
    )
    db.add(db_checklist)
    await db.commit()
    await db.refresh(db_checklist)
    return db_checklist


@router.put("/unidad/{unidad_id}", response_model=ChecklistDocumentacionResponse)
async def actualizar_checklist(
    unidad_id: int,
    checklist_update: ChecklistDocumentacionUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar checklist de documentación"""
    result = await db.execute(
        select(ChecklistDocumentacion).where(
            ChecklistDocumentacion.unidad_id == unidad_id
        )
    )
    checklist = result.scalar_one_or_none()

    if not checklist:
        # Crear si no existe
        result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
        unidad = result.scalar_one_or_none()
        if not unidad:
            raise HTTPException(status_code=404, detail="Unidad no encontrada")

        checklist = ChecklistDocumentacion(unidad_id=unidad_id)
        db.add(checklist)

    update_data = checklist_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(checklist, field, value)

    checklist.updated_by = token.user_id

    await db.commit()
    await db.refresh(checklist)
    return checklist


@router.get("/pendientes")
async def listar_pendientes(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar unidades con documentación pendiente"""
    from app.verticals.autos.models.unidad import EstadoUnidad

    # Obtener unidades disponibles
    result = await db.execute(
        select(Unidad).where(
            Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO])
        )
    )
    unidades = result.scalars().all()

    pendientes = []
    for unidad in unidades:
        result = await db.execute(
            select(ChecklistDocumentacion).where(
                ChecklistDocumentacion.unidad_id == unidad.id
            )
        )
        checklist = result.scalar_one_or_none()

        if not checklist:
            pendientes.append({
                "unidad_id": unidad.id,
                "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                "items_pendientes": ["Sin checklist creado"],
                "documentacion_completa": False
            })
        elif not checklist.documentacion_completa:
            pendientes.append({
                "unidad_id": unidad.id,
                "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                "items_pendientes": checklist.items_pendientes,
                "documentacion_completa": False
            })

    return pendientes


@router.get("/alertas-vencimiento")
async def alertas_vencimiento(
    dias_anticipacion: int = 30,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar documentos próximos a vencer"""
    from datetime import timedelta
    from app.verticals.autos.models.unidad import EstadoUnidad
    from sqlalchemy.orm import selectinload

    fecha_limite = date.today() + timedelta(days=dias_anticipacion)
    alertas = []

    result = await db.execute(
        select(ChecklistDocumentacion)
        .join(Unidad)
        .where(Unidad.estado.in_([EstadoUnidad.DISPONIBLE, EstadoUnidad.RESERVADO]))
        .options(selectinload(ChecklistDocumentacion.unidad))
    )
    checklists = result.scalars().all()

    for cl in checklists:
        unidad_info = f"{cl.unidad.marca} {cl.unidad.modelo} ({cl.unidad.dominio})"

        # VTV
        if cl.vtv_fecha_vencimiento and cl.vtv_fecha_vencimiento <= fecha_limite:
            alertas.append({
                "tipo": "VTV",
                "unidad_id": cl.unidad_id,
                "unidad": unidad_info,
                "fecha_vencimiento": cl.vtv_fecha_vencimiento,
                "dias_restantes": (cl.vtv_fecha_vencimiento - date.today()).days
            })

        # Form 08
        if cl.form_08_fecha_vencimiento and cl.form_08_fecha_vencimiento <= fecha_limite:
            alertas.append({
                "tipo": "Formulario 08",
                "unidad_id": cl.unidad_id,
                "unidad": unidad_info,
                "fecha_vencimiento": cl.form_08_fecha_vencimiento,
                "dias_restantes": (cl.form_08_fecha_vencimiento - date.today()).days
            })

        # Seguro
        if cl.seguro_vencimiento and cl.seguro_vencimiento <= fecha_limite:
            alertas.append({
                "tipo": "Seguro",
                "unidad_id": cl.unidad_id,
                "unidad": unidad_info,
                "fecha_vencimiento": cl.seguro_vencimiento,
                "dias_restantes": (cl.seguro_vencimiento - date.today()).days
            })

    return sorted(alertas, key=lambda x: x["fecha_vencimiento"])
