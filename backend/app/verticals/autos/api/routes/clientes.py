from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.cliente import Cliente
from app.verticals.autos.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse
from app.core.soft_delete import soft_delete

router = APIRouter(prefix="/autos/clientes", tags=["autos-clientes"])


@router.get("/", response_model=List[ClienteResponse])
async def listar_clientes(
    buscar: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar clientes con búsqueda opcional"""
    stmt = select(Cliente).where(Cliente.active())

    if buscar:
        stmt = stmt.where(
            or_(
                Cliente.nombre.ilike(f"%{buscar}%"),
                Cliente.apellido.ilike(f"%{buscar}%"),
                Cliente.dni_cuit.ilike(f"%{buscar}%"),
                Cliente.telefono.ilike(f"%{buscar}%")
            )
        )

    stmt = stmt.order_by(Cliente.apellido, Cliente.nombre).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{cliente_id}", response_model=ClienteResponse)
async def obtener_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un cliente"""
    result = await db.execute(select(Cliente).where(Cliente.active(), Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.post("/", response_model=ClienteResponse)
async def crear_cliente(
    cliente: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Crear nuevo cliente"""
    # Verificar DNI/CUIT único
    result = await db.execute(select(Cliente).where(Cliente.active(), Cliente.dni_cuit == cliente.dni_cuit))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese DNI/CUIT")

    db_cliente = Cliente(**cliente.model_dump())
    db.add(db_cliente)
    await db.commit()
    await db.refresh(db_cliente)
    return db_cliente


@router.put("/{cliente_id}", response_model=ClienteResponse)
async def actualizar_cliente(
    cliente_id: int,
    cliente_update: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar un cliente"""
    result = await db.execute(select(Cliente).where(Cliente.active(), Cliente.id == cliente_id))
    db_cliente = result.scalar_one_or_none()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    update_data = cliente_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_cliente, field, value)

    await db.commit()
    await db.refresh(db_cliente)
    return db_cliente


@router.delete("/{cliente_id}")
async def eliminar_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un cliente (solo si no tiene operaciones)"""
    result = await db.execute(
        select(Cliente).options(selectinload(Cliente.operaciones)).where(Cliente.id == cliente_id)
    )
    db_cliente = result.scalar_one_or_none()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if db_cliente.operaciones:
        raise HTTPException(status_code=400, detail="No se puede eliminar un cliente con operaciones")

    await soft_delete(db, db_cliente, deleted_by=token.user_id)
    return {"mensaje": "Cliente eliminado correctamente"}


@router.get("/{cliente_id}/operaciones")
async def operaciones_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener historial de operaciones de un cliente"""
    from app.verticals.autos.models.operacion import Operacion
    result = await db.execute(
        select(Cliente)
        .options(selectinload(Cliente.operaciones).selectinload(Operacion.unidad_vendida))
        .where(Cliente.active(), Cliente.id == cliente_id)
    )
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return {
        "cliente": cliente.nombre_completo,
        "total_operaciones": len(cliente.operaciones),
        "operaciones": [
            {
                "id": op.id,
                "fecha": op.fecha_operacion,
                "tipo": op.tipo.value,
                "estado": op.estado.value,
                "unidad": f"{op.unidad_vendida.marca} {op.unidad_vendida.modelo}",
                "precio_venta": op.precio_venta
            }
            for op in cliente.operaciones
        ]
    }
