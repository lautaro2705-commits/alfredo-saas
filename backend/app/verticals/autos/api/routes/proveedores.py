from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func, or_
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.proveedor import Proveedor
from app.verticals.autos.models.costo_directo import CostoDirecto
from app.verticals.autos.schemas.proveedor import ProveedorCreate, ProveedorUpdate, ProveedorResponse

router = APIRouter(prefix="/autos/proveedores", tags=["autos-proveedores"])


async def _enrich_proveedor(db: AsyncSession, proveedor: Proveedor) -> dict:
    """Agrega estadísticas al proveedor"""
    # Buscar costos que matcheen por nombre de proveedor (campo texto existente)
    result = await db.execute(
        select(
            sql_func.count(CostoDirecto.id).label("cantidad"),
            sql_func.coalesce(sql_func.sum(CostoDirecto.monto), 0).label("total")
        ).where(
            CostoDirecto.active(),
            CostoDirecto.proveedor.ilike(proveedor.nombre)
        )
    )
    stats = result.one()

    return {
        "id": proveedor.id,
        "nombre": proveedor.nombre,
        "tipo": proveedor.tipo,
        "telefono": proveedor.telefono,
        "email": proveedor.email,
        "direccion": proveedor.direccion,
        "cuit": proveedor.cuit,
        "notas": proveedor.notas,
        "activo": proveedor.activo,
        "created_at": proveedor.created_at,
        "updated_at": proveedor.updated_at,
        "total_gastado": float(stats.total) if stats else 0,
        "cantidad_trabajos": stats.cantidad if stats else 0,
    }


@router.get("/", response_model=List[ProveedorResponse])
async def listar_proveedores(
    activos: Optional[bool] = True,
    buscar: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar proveedores con filtros"""
    stmt = select(Proveedor).where(Proveedor.active())

    if activos is not None:
        stmt = stmt.where(Proveedor.activo == activos)
    if buscar:
        stmt = stmt.where(
            or_(
                Proveedor.nombre.ilike(f"%{buscar}%"),
                Proveedor.tipo.ilike(f"%{buscar}%")
            )
        )

    stmt = stmt.order_by(Proveedor.nombre).offset(skip).limit(limit)
    result = await db.execute(stmt)
    proveedores = result.scalars().all()
    return [await _enrich_proveedor(db, p) for p in proveedores]


@router.get("/estadisticas")
async def estadisticas_proveedores(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Ranking de proveedores por gasto"""
    result = await db.execute(
        select(Proveedor).where(Proveedor.active(), Proveedor.activo == True)
    )
    proveedores = result.scalars().all()
    ranking = []
    for p in proveedores:
        result = await db.execute(
            select(
                sql_func.count(CostoDirecto.id).label("cantidad"),
                sql_func.coalesce(sql_func.sum(CostoDirecto.monto), 0).label("total")
            ).where(
                CostoDirecto.active(),
                CostoDirecto.proveedor.ilike(p.nombre)
            )
        )
        stats = result.one()
        if stats and stats.cantidad > 0:
            ranking.append({
                "id": p.id,
                "nombre": p.nombre,
                "tipo": p.tipo,
                "cantidad_trabajos": stats.cantidad,
                "total_gastado": float(stats.total),
            })

    ranking.sort(key=lambda x: x["total_gastado"], reverse=True)
    total_general = sum(r["total_gastado"] for r in ranking)

    return {
        "total_proveedores": len(proveedores),
        "total_gastado": total_general,
        "ranking": ranking
    }


@router.get("/{proveedor_id}", response_model=ProveedorResponse)
async def obtener_proveedor(
    proveedor_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un proveedor"""
    result = await db.execute(select(Proveedor).where(Proveedor.active(), Proveedor.id == proveedor_id))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return await _enrich_proveedor(db, proveedor)


@router.get("/{proveedor_id}/costos")
async def costos_proveedor(
    proveedor_id: int,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Historial de costos de un proveedor"""
    result = await db.execute(select(Proveedor).where(Proveedor.active(), Proveedor.id == proveedor_id))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CostoDirecto)
        .where(CostoDirecto.active(), CostoDirecto.proveedor.ilike(proveedor.nombre))
        .order_by(CostoDirecto.fecha.desc())
        .limit(limit)
        .options(selectinload(CostoDirecto.unidad))
    )
    costos = result.scalars().all()

    return [
        {
            "id": c.id,
            "fecha": c.fecha.isoformat() if c.fecha else None,
            "categoria": c.categoria.value if c.categoria else None,
            "descripcion": c.descripcion,
            "monto": c.monto,
            "unidad_id": c.unidad_id,
            "unidad_info": f"{c.unidad.marca} {c.unidad.modelo} ({c.unidad.dominio})" if c.unidad else None,
        }
        for c in costos
    ]


@router.post("/", response_model=ProveedorResponse)
async def crear_proveedor(
    proveedor: ProveedorCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Crear nuevo proveedor"""
    db_proveedor = Proveedor(**proveedor.model_dump())
    db.add(db_proveedor)
    await db.commit()
    await db.refresh(db_proveedor)
    return await _enrich_proveedor(db, db_proveedor)


@router.put("/{proveedor_id}", response_model=ProveedorResponse)
async def actualizar_proveedor(
    proveedor_id: int,
    proveedor_update: ProveedorUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar proveedor"""
    result = await db.execute(select(Proveedor).where(Proveedor.active(), Proveedor.id == proveedor_id))
    db_proveedor = result.scalar_one_or_none()
    if not db_proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    update_data = proveedor_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_proveedor, field, value)

    await db.commit()
    await db.refresh(db_proveedor)
    return await _enrich_proveedor(db, db_proveedor)


@router.delete("/{proveedor_id}")
async def eliminar_proveedor(
    proveedor_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Desactivar proveedor (soft delete)"""
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    db_proveedor = result.scalar_one_or_none()
    if not db_proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    db_proveedor.activo = False
    await db.commit()
    return {"mensaje": "Proveedor desactivado"}
