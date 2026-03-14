from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.verticals.autos.models.costo_directo import CostoDirecto, CategoriaCosto
from app.verticals.autos.models.unidad import Unidad
from app.verticals.autos.schemas.costo_directo import CostoDirectoCreate, CostoDirectoUpdate, CostoDirectoResponse
from app.verticals.autos.models.actividad import registrar_actividad, AccionActividad, EntidadActividad
from app.core.soft_delete import soft_delete

router = APIRouter(prefix="/autos/costos", tags=["autos-costos"])


@router.get("/", response_model=List[CostoDirectoResponse])
async def listar_costos(
    unidad_id: Optional[int] = None,
    categoria: Optional[CategoriaCosto] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar costos directos con filtros"""
    stmt = select(CostoDirecto).where(CostoDirecto.active())

    if unidad_id:
        stmt = stmt.where(CostoDirecto.unidad_id == unidad_id)
    if categoria:
        stmt = stmt.where(CostoDirecto.categoria == categoria)
    if fecha_desde:
        stmt = stmt.where(CostoDirecto.fecha >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(CostoDirecto.fecha <= fecha_hasta)

    stmt = stmt.order_by(CostoDirecto.fecha.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/categorias")
async def listar_categorias():
    """Listar categorías de costos disponibles"""
    return [
        {"value": c.value, "label": c.value.replace("_", " ").title()}
        for c in CategoriaCosto
    ]


@router.get("/{costo_id}", response_model=CostoDirectoResponse)
async def obtener_costo(
    costo_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un costo"""
    result = await db.execute(select(CostoDirecto).where(CostoDirecto.active(), CostoDirecto.id == costo_id))
    costo = result.scalar_one_or_none()
    if not costo:
        raise HTTPException(status_code=404, detail="Costo no encontrado")
    return costo


@router.post("/", response_model=CostoDirectoResponse)
async def crear_costo(
    costo: CostoDirectoCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Agregar costo directo a una unidad.
    Ideal para que mecánicos/vendedores carguen gastos desde móvil.
    """
    # Verificar que existe la unidad
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.id == costo.unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    db_costo = CostoDirecto(
        **costo.model_dump(),
        created_by=token.user_id
    )
    if not db_costo.fecha:
        db_costo.fecha = date.today()

    db.add(db_costo)
    await registrar_actividad(db, token.user_id, AccionActividad.CREAR, EntidadActividad.COSTO,
                        db_costo.id, f"Costo ${costo.monto:,.0f} ({costo.categoria}) en {unidad.marca} {unidad.modelo} ({unidad.dominio})")
    await db.commit()
    await db.refresh(db_costo)
    return db_costo


@router.post("/rapido")
async def crear_costo_rapido(
    dominio: str,
    categoria: CategoriaCosto,
    descripcion: str,
    monto: float,
    proveedor: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Endpoint simplificado para cargar costos rápidamente desde móvil.
    Solo requiere el dominio (patente) del auto.
    """
    # Buscar unidad por dominio
    result = await db.execute(select(Unidad).where(Unidad.active(), Unidad.dominio.ilike(dominio)))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail=f"No se encontró unidad con dominio {dominio}")

    db_costo = CostoDirecto(
        unidad_id=unidad.id,
        categoria=categoria,
        descripcion=descripcion,
        monto=monto,
        proveedor=proveedor,
        fecha=date.today(),
        created_by=token.user_id
    )

    db.add(db_costo)
    await db.commit()
    await db.refresh(db_costo)

    return {
        "mensaje": "Costo registrado correctamente",
        "costo_id": db_costo.id,
        "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
        "nuevo_costo_total": unidad.costo_total
    }


@router.put("/{costo_id}", response_model=CostoDirectoResponse)
async def actualizar_costo(
    costo_id: int,
    costo_update: CostoDirectoUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar un costo"""
    result = await db.execute(select(CostoDirecto).where(CostoDirecto.active(), CostoDirecto.id == costo_id))
    db_costo = result.scalar_one_or_none()
    if not db_costo:
        raise HTTPException(status_code=404, detail="Costo no encontrado")

    update_data = costo_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_costo, field, value)

    await db.commit()
    await db.refresh(db_costo)
    return db_costo


@router.delete("/{costo_id}")
async def eliminar_costo(
    costo_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un costo"""
    result = await db.execute(select(CostoDirecto).where(CostoDirecto.id == costo_id))
    db_costo = result.scalar_one_or_none()
    if not db_costo:
        raise HTTPException(status_code=404, detail="Costo no encontrado")

    await soft_delete(db, db_costo, deleted_by=token.user_id)
    return {"mensaje": "Costo eliminado correctamente"}


@router.get("/resumen/por-categoria")
async def resumen_por_categoria(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Resumen de costos agrupados por categoría"""
    stmt = select(
        CostoDirecto.categoria,
        func.sum(CostoDirecto.monto).label("total"),
        func.count(CostoDirecto.id).label("cantidad")
    ).where(CostoDirecto.active())

    if fecha_desde:
        stmt = stmt.where(CostoDirecto.fecha >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(CostoDirecto.fecha <= fecha_hasta)

    stmt = stmt.group_by(CostoDirecto.categoria)
    result = await db.execute(stmt)
    resultados = result.all()

    return [
        {
            "categoria": r.categoria.value,
            "total": r.total,
            "cantidad": r.cantidad
        }
        for r in resultados
    ]
