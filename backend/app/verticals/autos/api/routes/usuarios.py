from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID
from datetime import date, timedelta
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, get_password_hash, TokenContext
from app.verticals.autos.models.usuario import Usuario, RolUsuario, PERMISOS_DISPONIBLES, PERMISOS_POR_ROL
from app.verticals.autos.models.operacion import Operacion, EstadoOperacion
from app.verticals.autos.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse

router = APIRouter(prefix="/autos/usuarios", tags=["autos-usuarios"])


async def _get_tenant_user(db: AsyncSession, usuario_id: UUID, tenant_id) -> Usuario:
    """Fetch a user ensuring it belongs to the given tenant. Raises 404 if not found."""
    result = await db.execute(
        select(Usuario).where(Usuario.id == usuario_id, Usuario.tenant_id == tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.get("/permisos-disponibles")
async def listar_permisos_disponibles(
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar todos los permisos disponibles en el sistema"""
    return {
        "permisos": [
            {"clave": k, "descripcion": v}
            for k, v in PERMISOS_DISPONIBLES.items()
        ],
        "permisos_por_rol": PERMISOS_POR_ROL
    }


@router.get("/", response_model=List[UsuarioResponse])
async def listar_usuarios(
    activo: Optional[bool] = None,
    rol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Listar usuarios del tenant actual (solo Admin)"""
    stmt = select(Usuario).where(Usuario.tenant_id == token.tenant_id)

    if activo is not None:
        stmt = stmt.where(Usuario.activo == activo)
    if rol:
        stmt = stmt.where(Usuario.rol == rol)

    stmt = stmt.order_by(Usuario.nombre)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/vendedores")
async def listar_vendedores(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar usuarios activos que pueden realizar ventas (para selects)"""
    # Incluir vendedores y admins (todos los que pueden vender) del tenant actual
    result = await db.execute(
        select(Usuario).where(
            Usuario.tenant_id == token.tenant_id,
            Usuario.activo == True
        ).order_by(Usuario.nombre)
    )
    usuarios = result.scalars().all()

    return [
        {
            "id": u.id,
            "nombre": u.nombre,
            "apellido": u.apellido,
            "nombre_completo": u.nombre_completo,
            "email": u.email,
            "rol": u.rol.value
        }
        for u in usuarios
    ]


@router.get("/mi-perfil")
async def mi_perfil(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener perfil del usuario actual con estadisticas"""
    # Obtener el usuario actual desde la DB
    result = await db.execute(select(Usuario).where(Usuario.id == token.user_id))
    current_user = result.scalar_one_or_none()
    if not current_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Estadisticas del vendedor
    fecha_mes = date.today().replace(day=1)
    fecha_trimestre = date.today() - timedelta(days=90)

    # Operaciones del mes
    result = await db.execute(
        select(Operacion).where(
            Operacion.vendedor_id == token.user_id,
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_mes
        )
    )
    ops_mes = result.scalars().all()

    # Operaciones del trimestre
    result = await db.execute(
        select(Operacion).where(
            Operacion.vendedor_id == token.user_id,
            Operacion.estado == EstadoOperacion.COMPLETADA,
            Operacion.fecha_operacion >= fecha_trimestre
        )
    )
    ops_trimestre = result.scalars().all()

    # Calcular totales
    ventas_mes = len(ops_mes)
    monto_mes = sum(op.precio_venta for op in ops_mes)
    ventas_trimestre = len(ops_trimestre)
    monto_trimestre = sum(op.precio_venta for op in ops_trimestre)

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "nombre": current_user.nombre,
        "apellido": current_user.apellido,
        "nombre_completo": current_user.nombre_completo,
        "telefono": current_user.telefono,
        "rol": current_user.rol.value,
        "activo": current_user.activo,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "estadisticas": {
            "ventas_mes": ventas_mes,
            "monto_mes": monto_mes,
            "ventas_trimestre": ventas_trimestre,
            "monto_trimestre": monto_trimestre
        }
    }


@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obtener_usuario(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Obtener detalle de un usuario del tenant actual (solo Admin)"""
    return await _get_tenant_user(db, usuario_id, token.tenant_id)


@router.post("/", response_model=UsuarioResponse)
async def crear_usuario(
    usuario: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Crear nuevo usuario en el tenant actual (solo Admin)"""
    # Verificar si ya existe en este tenant
    result = await db.execute(
        select(Usuario).where(Usuario.email == usuario.email, Usuario.tenant_id == token.tenant_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    db_user = Usuario(
        tenant_id=token.tenant_id,
        username=usuario.username,
        email=usuario.email,
        hashed_password=get_password_hash(usuario.password),
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        rol=usuario.rol
    )

    # Si se especificaron permisos personalizados, asignarlos
    if usuario.permisos is not None:
        db_user.permisos = usuario.permisos

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def actualizar_usuario(
    usuario_id: UUID,
    usuario: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Actualizar usuario del tenant actual (solo Admin)"""
    db_user = await _get_tenant_user(db, usuario_id, token.tenant_id)

    # No permitir que un admin se desactive a si mismo
    if usuario_id == token.user_id and usuario.activo == False:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")

    # Actualizar campos
    update_data = usuario.model_dump(exclude_unset=True)

    # Si hay password, hashearlo
    if 'password' in update_data and update_data['password']:
        update_data['hashed_password'] = get_password_hash(update_data['password'])
        del update_data['password']
    elif 'password' in update_data:
        del update_data['password']

    # Manejar permisos por separado
    if 'permisos' in update_data:
        db_user.permisos = update_data['permisos']
        del update_data['permisos']

    for field, value in update_data.items():
        setattr(db_user, field, value)

    await db.commit()
    await db.refresh(db_user)
    return db_user


@router.put("/{usuario_id}/permisos")
async def actualizar_permisos(
    usuario_id: UUID,
    permisos: List[str],
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Actualizar solo los permisos de un usuario del tenant actual (solo Admin)"""
    db_user = await _get_tenant_user(db, usuario_id, token.tenant_id)

    # Validar que todos los permisos existan
    permisos_validos = list(PERMISOS_DISPONIBLES.keys())
    for p in permisos:
        if p not in permisos_validos:
            raise HTTPException(status_code=400, detail=f"Permiso '{p}' no valido")

    db_user.permisos = permisos
    await db.commit()

    return {
        "mensaje": "Permisos actualizados",
        "usuario_id": usuario_id,
        "permisos": db_user.permisos
    }


@router.post("/{usuario_id}/restablecer-permisos")
async def restablecer_permisos_rol(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Restablecer permisos a los valores por defecto del rol (solo Admin)"""
    db_user = await _get_tenant_user(db, usuario_id, token.tenant_id)

    db_user.permisos = None  # Esto hace que use los permisos del rol
    await db.commit()

    return {
        "mensaje": "Permisos restablecidos a los del rol",
        "usuario_id": usuario_id,
        "rol": db_user.rol.value,
        "permisos": db_user.permisos
    }


@router.delete("/{usuario_id}")
async def eliminar_usuario(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Desactivar usuario del tenant actual (solo Admin). No elimina, solo desactiva."""
    if usuario_id == token.user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    db_user = await _get_tenant_user(db, usuario_id, token.tenant_id)

    # En lugar de eliminar, desactivamos
    db_user.activo = False
    await db.commit()

    return {"mensaje": "Usuario desactivado correctamente"}


@router.post("/{usuario_id}/reactivar")
async def reactivar_usuario(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Reactivar usuario desactivado del tenant actual (solo Admin)"""
    db_user = await _get_tenant_user(db, usuario_id, token.tenant_id)

    db_user.activo = True
    await db.commit()

    return {"mensaje": "Usuario reactivado correctamente"}


@router.get("/{usuario_id}/estadisticas")
async def estadisticas_vendedor(
    usuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """Obtener estadisticas de un vendedor del tenant actual (solo Admin)"""
    vendedor = await _get_tenant_user(db, usuario_id, token.tenant_id)

    # Fechas de referencia
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)
    inicio_trimestre = hoy - timedelta(days=90)
    inicio_anio = hoy.replace(month=1, day=1)

    # Operaciones totales
    result = await db.execute(
        select(Operacion).where(
            Operacion.vendedor_id == usuario_id,
            Operacion.estado == EstadoOperacion.COMPLETADA
        )
    )
    total_ops = result.scalars().all()

    # Operaciones por periodo
    ops_mes = [op for op in total_ops if op.fecha_operacion >= inicio_mes]
    ops_trimestre = [op for op in total_ops if op.fecha_operacion >= inicio_trimestre]
    ops_anio = [op for op in total_ops if op.fecha_operacion >= inicio_anio]

    def calcular_estadisticas(operaciones):
        if not operaciones:
            return {"ventas": 0, "monto_total": 0, "ticket_promedio": 0}
        monto = sum(op.precio_venta for op in operaciones)
        return {
            "ventas": len(operaciones),
            "monto_total": monto,
            "ticket_promedio": round(monto / len(operaciones), 2)
        }

    return {
        "vendedor": {
            "id": vendedor.id,
            "nombre_completo": vendedor.nombre_completo,
            "email": vendedor.email,
            "activo": vendedor.activo,
            "created_at": vendedor.created_at,
            "last_login": vendedor.last_login
        },
        "mes_actual": calcular_estadisticas(ops_mes),
        "trimestre": calcular_estadisticas(ops_trimestre),
        "anio": calcular_estadisticas(ops_anio),
        "historico": calcular_estadisticas(total_ops)
    }
