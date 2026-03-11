"""Búsqueda global en unidades, clientes y operaciones."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.cliente import Cliente
from app.verticals.autos.models.operacion import Operacion

router = APIRouter(prefix="/autos/busqueda", tags=["autos-busqueda"])


@router.get("/global")
async def busqueda_global(
    q: str = Query(..., min_length=2, description="Termino de busqueda"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant),
):
    """
    Búsqueda global en unidades, clientes y operaciones.
    Retorna resultados agrupados por categoría.
    """
    termino = f"%{q.lower()}%"
    resultados = []

    # Buscar en Unidades
    result = await db.execute(
        select(Unidad)
        .where(
            or_(
                Unidad.marca.ilike(termino),
                Unidad.modelo.ilike(termino),
                Unidad.dominio.ilike(termino),
                Unidad.version.ilike(termino),
                Unidad.color.ilike(termino),
            )
        )
        .limit(5)
    )
    unidades = result.scalars().all()

    for u in unidades:
        estado_label = {
            "disponible": "Disponible",
            "reservado": "Reservado",
            "vendido": "Vendido",
            "en_reparacion": "En reparacion",
        }.get(u.estado.value, u.estado.value)

        resultados.append({
            "tipo": "unidad",
            "id": u.id,
            "titulo": f"{u.marca} {u.modelo} {u.anio}",
            "subtitulo": f"{u.dominio} - {estado_label}",
            "link": f"/unidades/{u.id}",
            "icono": "car",
        })

    # Buscar en Clientes
    result = await db.execute(
        select(Cliente)
        .where(
            or_(
                Cliente.nombre.ilike(termino),
                Cliente.apellido.ilike(termino),
                Cliente.dni.ilike(termino),
                Cliente.telefono.ilike(termino),
                Cliente.email.ilike(termino),
            )
        )
        .limit(5)
    )
    clientes = result.scalars().all()

    for c in clientes:
        resultados.append({
            "tipo": "cliente",
            "id": c.id,
            "titulo": c.nombre_completo,
            "subtitulo": f"DNI: {c.dni}" if c.dni else (c.telefono or c.email or ""),
            "link": f"/clientes/{c.id}",
            "icono": "user",
        })

    # Buscar en Operaciones (por cliente o unidad)
    result = await db.execute(
        select(Operacion)
        .options(
            selectinload(Operacion.unidad_vendida),
            selectinload(Operacion.cliente),
        )
        .join(Cliente, Operacion.cliente_id == Cliente.id, isouter=True)
        .join(Unidad, Operacion.unidad_id == Unidad.id, isouter=True)
        .where(
            or_(
                Cliente.nombre.ilike(termino),
                Cliente.apellido.ilike(termino),
                Unidad.marca.ilike(termino),
                Unidad.modelo.ilike(termino),
                Unidad.dominio.ilike(termino),
            )
        )
        .limit(5)
    )
    operaciones = result.scalars().all()

    for op in operaciones:
        unidad_str = f"{op.unidad_vendida.marca} {op.unidad_vendida.modelo}" if op.unidad_vendida else "Sin unidad"
        cliente_str = op.cliente.nombre_completo if op.cliente else "Sin cliente"
        estado_label = {
            "en_proceso": "En proceso",
            "completada": "Completada",
            "cancelada": "Cancelada",
        }.get(op.estado.value, op.estado.value)

        resultados.append({
            "tipo": "operacion",
            "id": op.id,
            "titulo": f"Operacion #{op.id} - {unidad_str}",
            "subtitulo": f"{cliente_str} - {estado_label}",
            "link": "/operaciones",
            "icono": "shopping-cart",
        })

    return {
        "query": q,
        "total": len(resultados),
        "resultados": resultados,
    }
