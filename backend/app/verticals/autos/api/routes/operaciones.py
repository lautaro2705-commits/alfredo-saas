from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.operacion import Operacion, TipoOperacion, EstadoOperacion
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad, OrigenUnidad
from app.verticals.autos.models.cliente import Cliente
from app.verticals.autos.models.caja_diaria import CajaDiaria, TipoMovimiento, CategoriaGasto
from app.verticals.autos.models.usuario import Usuario
from app.verticals.autos.schemas.operacion import (
    OperacionCreate,
    OperacionUpdate,
    OperacionResponse,
    CompletarOperacionRequest,
    BoletoCompraVentaResponse
)
from app.verticals.autos.models.actividad import registrar_actividad, AccionActividad, EntidadActividad

router = APIRouter(prefix="/autos/operaciones", tags=["autos-operaciones"])


@router.get("/", response_model=List[OperacionResponse])
async def listar_operaciones(
    estado: Optional[EstadoOperacion] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    cliente_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar operaciones con filtros"""
    stmt = select(Operacion)

    if estado:
        stmt = stmt.where(Operacion.estado == estado)
    if fecha_desde:
        stmt = stmt.where(Operacion.fecha_operacion >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(Operacion.fecha_operacion <= fecha_hasta)
    if cliente_id:
        stmt = stmt.where(Operacion.cliente_id == cliente_id)

    stmt = stmt.order_by(Operacion.fecha_operacion.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ==================== RUTAS ADMIN (deben estar ANTES de /{operacion_id}) ====================

@router.get("/admin/diagnostico")
async def diagnostico_operaciones(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Diagnostico de operaciones vs unidades vendidas.
    Solo admin.
    """
    # Contar unidades vendidas
    result = await db.execute(
        select(Unidad).where(Unidad.estado == EstadoUnidad.VENDIDO)
    )
    unidades_vendidas = result.scalars().all()

    # Contar operaciones completadas
    result = await db.execute(
        select(Operacion).where(Operacion.estado == EstadoOperacion.COMPLETADA)
    )
    operaciones_completadas = result.scalars().all()

    # Buscar unidades vendidas sin operacion
    ids_unidades_con_operacion = [op.unidad_id for op in operaciones_completadas]
    unidades_sin_operacion = [u for u in unidades_vendidas if u.id not in ids_unidades_con_operacion]

    return {
        "total_unidades_vendidas": len(unidades_vendidas),
        "total_operaciones_completadas": len(operaciones_completadas),
        "unidades_sin_operacion": len(unidades_sin_operacion),
        "detalle_unidades_sin_operacion": [
            {
                "id": u.id,
                "marca": u.marca,
                "modelo": u.modelo,
                "dominio": u.dominio,
                "fecha_venta": u.fecha_venta,
                "precio_compra": u.precio_compra,
                "precio_publicado": u.precio_publicado
            }
            for u in unidades_sin_operacion
        ]
    }


@router.post("/admin/recuperar-operaciones")
async def recuperar_operaciones_faltantes(
    cliente_id_default: int = Query(..., description="ID del cliente para asignar a operaciones recuperadas"),
    precio_venta_factor: float = Query(1.15, description="Factor sobre precio_publicado para estimar precio_venta"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Recuperar operaciones faltantes para unidades vendidas.
    Crea operaciones de venta para unidades en estado VENDIDO que no tienen operacion.
    Solo admin.
    """
    # Verificar que el cliente existe
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id_default))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Buscar unidades vendidas
    result = await db.execute(
        select(Unidad).where(Unidad.estado == EstadoUnidad.VENDIDO)
    )
    unidades_vendidas = result.scalars().all()

    # Obtener IDs de unidades que ya tienen operacion
    result = await db.execute(
        select(Operacion).where(
            Operacion.estado.in_([EstadoOperacion.COMPLETADA, EstadoOperacion.EN_PROCESO])
        )
    )
    operaciones_existentes = result.scalars().all()
    ids_con_operacion = set(op.unidad_id for op in operaciones_existentes)

    # Filtrar unidades sin operacion
    unidades_sin_operacion = [u for u in unidades_vendidas if u.id not in ids_con_operacion]

    if not unidades_sin_operacion:
        return {
            "mensaje": "No hay unidades vendidas sin operacion",
            "operaciones_creadas": 0
        }

    operaciones_creadas = []

    for unidad in unidades_sin_operacion:
        # Estimar precio de venta
        precio_venta = unidad.precio_publicado or (unidad.precio_compra * precio_venta_factor)

        # Crear operacion
        nueva_operacion = Operacion(
            tipo=TipoOperacion.VENTA,
            estado=EstadoOperacion.COMPLETADA,
            unidad_id=unidad.id,
            cliente_id=cliente_id_default,
            fecha_operacion=unidad.fecha_venta or date.today(),
            fecha_entrega=unidad.fecha_venta,
            precio_venta=precio_venta,
            forma_pago="contado",
            monto_contado=precio_venta,
            monto_financiado=0,
            tiene_retoma=False,
            retoma_valor=0,
            vendedor_id=token.user_id,
            comision=0,
            boleto_compraventa=False,
            form_08_firmado=False,
            transferencia_realizada=True,
            observaciones=f"Operacion recuperada automaticamente. Unidad {unidad.dominio}"
        )

        db.add(nueva_operacion)
        operaciones_creadas.append({
            "unidad_id": unidad.id,
            "unidad": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
            "precio_venta": precio_venta,
            "fecha": str(unidad.fecha_venta or date.today())
        })

    await db.commit()

    return {
        "mensaje": f"Se crearon {len(operaciones_creadas)} operaciones",
        "operaciones_creadas": len(operaciones_creadas),
        "detalle": operaciones_creadas
    }


@router.post("/admin/corregir-fechas-caja")
async def corregir_fechas_caja(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Corregir fechas de movimientos de caja de ventas.
    Actualiza la fecha del movimiento para que coincida con la fecha de la operacion.
    Solo admin.
    """
    # Buscar movimientos de caja vinculados a operaciones
    result = await db.execute(
        select(CajaDiaria).where(CajaDiaria.operacion_id.isnot(None))
    )
    movimientos = result.scalars().all()

    corregidos = []

    for mov in movimientos:
        result = await db.execute(select(Operacion).where(Operacion.id == mov.operacion_id))
        operacion = result.scalar_one_or_none()
        if operacion and mov.fecha != operacion.fecha_operacion:
            fecha_anterior = mov.fecha
            mov.fecha = operacion.fecha_operacion
            corregidos.append({
                "movimiento_id": mov.id,
                "operacion_id": operacion.id,
                "descripcion": mov.descripcion,
                "fecha_anterior": str(fecha_anterior),
                "fecha_corregida": str(operacion.fecha_operacion)
            })

    await db.commit()

    return {
        "mensaje": f"Se corrigieron {len(corregidos)} movimientos de caja",
        "corregidos": len(corregidos),
        "detalle": corregidos
    }


# ==================== RUTAS CON PARAMETROS ====================

@router.get("/{operacion_id}", response_model=OperacionResponse)
async def obtener_operacion(
    operacion_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de una operacion"""
    result = await db.execute(select(Operacion).where(Operacion.id == operacion_id))
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")
    return operacion


@router.post("/", response_model=OperacionResponse)
async def crear_operacion(
    operacion: OperacionCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Crear nueva operacion de venta.
    Puede incluir retoma (auto que entra como parte de pago).
    """
    # Verificar unidad
    result = await db.execute(select(Unidad).where(Unidad.id == operacion.unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    if unidad.estado == EstadoUnidad.VENDIDO:
        raise HTTPException(status_code=400, detail="La unidad ya fue vendida")

    # Verificar cliente
    result = await db.execute(select(Cliente).where(Cliente.id == operacion.cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Determinar tipo de operacion
    tiene_retoma = operacion.retoma is not None
    tipo = TipoOperacion.VENTA_CON_RETOMA if tiene_retoma else TipoOperacion.VENTA

    # Crear operacion
    db_operacion = Operacion(
        tipo=tipo,
        estado=EstadoOperacion.EN_PROCESO,
        unidad_id=operacion.unidad_id,
        cliente_id=operacion.cliente_id,
        fecha_operacion=operacion.fecha_operacion or date.today(),
        fecha_entrega=operacion.fecha_entrega,
        precio_venta=operacion.precio_venta,
        forma_pago=operacion.forma_pago,
        monto_contado=operacion.monto_contado or 0,
        monto_financiado=operacion.monto_financiado or 0,
        entidad_financiera=operacion.entidad_financiera,
        tiene_retoma=tiene_retoma,
        vendedor_id=operacion.vendedor_id or token.user_id,
        comision=operacion.comision or 0,
        observaciones=operacion.observaciones
    )

    # Si hay retoma, guardar datos y crear nueva unidad
    if tiene_retoma:
        retoma = operacion.retoma
        db_operacion.retoma_marca = retoma.marca
        db_operacion.retoma_modelo = retoma.modelo
        db_operacion.retoma_anio = retoma.anio
        db_operacion.retoma_dominio = retoma.dominio
        db_operacion.retoma_valor = retoma.valor

        # Crear unidad a partir de la retoma
        unidad_retoma = Unidad(
            marca=retoma.marca,
            modelo=retoma.modelo,
            anio=retoma.anio,
            dominio=retoma.dominio,
            kilometraje=retoma.kilometraje,
            color=retoma.color,
            estado=EstadoUnidad.RETOMA_PENDIENTE,
            origen=OrigenUnidad.RETOMA,
            precio_compra=retoma.valor,
            fecha_ingreso=date.today()
        )
        db.add(unidad_retoma)
        await db.flush()  # Para obtener el ID
        db_operacion.unidad_retoma_id = unidad_retoma.id

    # Actualizar estado de la unidad vendida
    unidad.estado = EstadoUnidad.RESERVADO

    db.add(db_operacion)
    await registrar_actividad(db, token.user_id, AccionActividad.CREAR, EntidadActividad.OPERACION,
                        db_operacion.id, f"Operacion de venta: {unidad.marca} {unidad.modelo} ({unidad.dominio}) a {cliente.nombre} {cliente.apellido} por ${operacion.precio_venta:,.0f}")  # TODO: make registrar_actividad async
    await db.commit()
    await db.refresh(db_operacion)
    return db_operacion


@router.put("/{operacion_id}", response_model=OperacionResponse)
async def actualizar_operacion(
    operacion_id: int,
    operacion_update: OperacionUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar una operacion"""
    result = await db.execute(select(Operacion).where(Operacion.id == operacion_id))
    db_operacion = result.scalar_one_or_none()
    if not db_operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    update_data = operacion_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_operacion, field, value)

    await db.commit()
    await db.refresh(db_operacion)
    return db_operacion


@router.post("/{operacion_id}/completar", response_model=OperacionResponse)
async def completar_operacion(
    operacion_id: int,
    datos: CompletarOperacionRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Completar una operacion de venta.
    - Requiere km_entrega para el boleto de compra-venta
    - Calcula garantia (3 meses o 2000 km)
    - Marca la unidad como vendida
    - Registra el ingreso en caja
    - Si hay retoma, marca la unidad de retoma como disponible
    """
    result = await db.execute(
        select(Operacion)
        .where(Operacion.id == operacion_id)
        .options(joinedload(Operacion.unidad_vendida))
    )
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado == EstadoOperacion.COMPLETADA:
        raise HTTPException(status_code=400, detail="La operacion ya esta completada")

    # Guardar datos del boleto
    operacion.km_entrega = datos.km_entrega
    operacion.costo_transferencia_venta = datos.costo_transferencia_venta or 0

    # Calcular limites de garantia
    fecha_entrega = operacion.fecha_entrega or date.today()
    operacion.garantia_km_limite = datos.km_entrega + 2000
    operacion.garantia_fecha_limite = fecha_entrega + relativedelta(months=3)

    # Marcar unidad como vendida
    unidad = operacion.unidad_vendida
    unidad.estado = EstadoUnidad.VENDIDO
    # Usar fecha de operacion, no fecha actual
    unidad.fecha_venta = operacion.fecha_operacion or date.today()

    # Registrar ingreso en caja con fecha de la operacion
    ingreso_caja = CajaDiaria(
        tipo=TipoMovimiento.INGRESO,
        categoria=CategoriaGasto.VENTA_UNIDAD,
        descripcion=f"Venta {unidad.marca} {unidad.modelo} ({unidad.dominio})",
        monto=operacion.monto_neto_recibido,
        fecha=operacion.fecha_operacion or date.today(),
        operacion_id=operacion.id,
        created_by=token.user_id
    )
    db.add(ingreso_caja)

    # Si hay retoma, marcar como disponible
    if operacion.tiene_retoma and operacion.unidad_retoma_id:
        result = await db.execute(select(Unidad).where(Unidad.id == operacion.unidad_retoma_id))
        unidad_retoma = result.scalar_one_or_none()
        if unidad_retoma:
            unidad_retoma.estado = EstadoUnidad.DISPONIBLE

    # Marcar operacion como completada
    operacion.estado = EstadoOperacion.COMPLETADA
    operacion.transferencia_realizada = True

    await registrar_actividad(db, token.user_id, AccionActividad.VENDER, EntidadActividad.OPERACION,
                        operacion.id, f"Venta completada: {unidad.marca} {unidad.modelo} ({unidad.dominio}) por ${operacion.precio_venta:,.0f}")  # TODO: make registrar_actividad async

    await db.commit()
    await db.refresh(operacion)

    return operacion


@router.get("/{operacion_id}/boleto", response_model=BoletoCompraVentaResponse)
async def obtener_boleto_compraventa(
    operacion_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Obtener datos para generar el boleto de compra-venta.
    Solo disponible para operaciones completadas con km_entrega registrado.
    """
    result = await db.execute(
        select(Operacion)
        .where(Operacion.id == operacion_id)
        .options(
            joinedload(Operacion.unidad_vendida),
            joinedload(Operacion.cliente)
        )
    )
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado != EstadoOperacion.COMPLETADA:
        raise HTTPException(status_code=400, detail="El boleto solo esta disponible para operaciones completadas")

    if not operacion.km_entrega:
        raise HTTPException(status_code=400, detail="La operacion no tiene km_entrega registrado")

    unidad = operacion.unidad_vendida
    cliente = operacion.cliente

    # Calcular precio sin transferencia
    precio_sin_transferencia = operacion.precio_venta - (operacion.costo_transferencia_venta or 0)

    return BoletoCompraVentaResponse(
        operacion_id=operacion.id,
        fecha_operacion=operacion.fecha_operacion,
        fecha_entrega=operacion.fecha_entrega,

        vehiculo_marca=unidad.marca,
        vehiculo_modelo=unidad.modelo,
        vehiculo_version=unidad.version,
        vehiculo_anio=unidad.anio,
        vehiculo_dominio=unidad.dominio,
        vehiculo_chasis=unidad.numero_chasis,
        vehiculo_motor=unidad.numero_motor,
        vehiculo_color=unidad.color,
        vehiculo_combustible=unidad.combustible,

        cliente_nombre=cliente.nombre,
        cliente_apellido=cliente.apellido,
        cliente_dni=cliente.dni_cuit,
        cliente_direccion=cliente.direccion,
        cliente_localidad=cliente.localidad,
        cliente_provincia=cliente.provincia,
        cliente_telefono=cliente.telefono,

        precio_venta=operacion.precio_venta,
        costo_transferencia=operacion.costo_transferencia_venta or 0,
        precio_sin_transferencia=precio_sin_transferencia,
        forma_pago=operacion.forma_pago.value,

        km_entrega=operacion.km_entrega,
        garantia_km_limite=operacion.garantia_km_limite,
        garantia_fecha_limite=operacion.garantia_fecha_limite,

        agencia_nombre=token.tenant_name
    )


@router.post("/{operacion_id}/boleto/impreso")
async def marcar_boleto_impreso(
    operacion_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Marcar que el boleto fue impreso (para tracking).
    """
    result = await db.execute(select(Operacion).where(Operacion.id == operacion_id))
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    operacion.boleto_impreso = True
    operacion.fecha_boleto = datetime.now()
    operacion.boleto_compraventa = True

    await db.commit()

    return {
        "mensaje": "Boleto marcado como impreso",
        "fecha_boleto": operacion.fecha_boleto
    }


@router.post("/{operacion_id}/boleto/cargar-datos", response_model=OperacionResponse)
async def cargar_datos_boleto(
    operacion_id: int,
    datos: CompletarOperacionRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Cargar datos del boleto para operaciones ya completadas que no tienen km_entrega.
    Permite generar boletos para ventas antiguas.
    """
    result = await db.execute(select(Operacion).where(Operacion.id == operacion_id))
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado != EstadoOperacion.COMPLETADA:
        raise HTTPException(status_code=400, detail="Solo se pueden cargar datos de boleto para operaciones completadas")

    # Guardar datos del boleto
    operacion.km_entrega = datos.km_entrega
    operacion.costo_transferencia_venta = datos.costo_transferencia_venta or 0

    # Calcular limites de garantia basados en la fecha de entrega o fecha de operacion
    fecha_base = operacion.fecha_entrega or operacion.fecha_operacion or date.today()
    operacion.garantia_km_limite = datos.km_entrega + 2000
    operacion.garantia_fecha_limite = fecha_base + relativedelta(months=3)

    await db.commit()
    await db.refresh(operacion)

    return operacion


@router.post("/{operacion_id}/cancelar", response_model=OperacionResponse)
async def cancelar_operacion(
    operacion_id: int,
    motivo: str = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Cancelar una operacion"""
    result = await db.execute(
        select(Operacion)
        .where(Operacion.id == operacion_id)
        .options(joinedload(Operacion.unidad_vendida))
    )
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado == EstadoOperacion.COMPLETADA:
        raise HTTPException(status_code=400, detail="No se puede cancelar una operacion completada")

    # Devolver unidad a disponible
    unidad = operacion.unidad_vendida
    unidad.estado = EstadoUnidad.DISPONIBLE

    # Si habia retoma, eliminar la unidad creada
    if operacion.tiene_retoma and operacion.unidad_retoma_id:
        result = await db.execute(select(Unidad).where(Unidad.id == operacion.unidad_retoma_id))
        unidad_retoma = result.scalar_one_or_none()
        if unidad_retoma:
            await db.delete(unidad_retoma)

    operacion.estado = EstadoOperacion.CANCELADA
    if motivo:
        operacion.observaciones = f"{operacion.observaciones or ''}\nCANCELADO: {motivo}"

    await registrar_actividad(db, token.user_id, AccionActividad.CANCELAR, EntidadActividad.OPERACION,
                        operacion.id, f"Operacion cancelada: {unidad.marca} {unidad.modelo} ({unidad.dominio})")  # TODO: make registrar_actividad async

    await db.commit()
    await db.refresh(operacion)
    return operacion


@router.delete("/{operacion_id}")
async def eliminar_operacion(
    operacion_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(require_role("admin"))
):
    """
    Eliminar una operacion (solo Admin).
    - Solo se pueden eliminar operaciones completadas o canceladas
    - Si estaba completada, revierte la unidad a DISPONIBLE
    - Elimina el movimiento de caja asociado si existe
    """
    result = await db.execute(
        select(Operacion)
        .where(Operacion.id == operacion_id)
        .options(joinedload(Operacion.unidad_vendida))
    )
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado == EstadoOperacion.EN_PROCESO:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una operacion en proceso. Cancelela primero."
        )

    # Si la operacion estaba completada, revertir el estado de la unidad
    if operacion.estado == EstadoOperacion.COMPLETADA:
        unidad = operacion.unidad_vendida
        if unidad:
            unidad.estado = EstadoUnidad.DISPONIBLE
            unidad.fecha_venta = None

    # Eliminar movimientos de caja asociados
    await db.execute(delete(CajaDiaria).where(CajaDiaria.operacion_id == operacion_id))

    # Eliminar la operacion
    await db.delete(operacion)
    await db.commit()

    return {"mensaje": "Operacion eliminada y unidad devuelta a stock"}


@router.patch("/{operacion_id}/documentacion")
async def actualizar_documentacion_operacion(
    operacion_id: int,
    boleto_compraventa: Optional[bool] = None,
    form_08_firmado: Optional[bool] = None,
    transferencia_realizada: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar estado de documentacion de una operacion en proceso"""
    result = await db.execute(select(Operacion).where(Operacion.id == operacion_id))
    operacion = result.scalar_one_or_none()
    if not operacion:
        raise HTTPException(status_code=404, detail="Operacion no encontrada")

    if operacion.estado != EstadoOperacion.EN_PROCESO:
        raise HTTPException(status_code=400, detail="Solo se puede actualizar documentacion de operaciones en proceso")

    if boleto_compraventa is not None:
        operacion.boleto_compraventa = boleto_compraventa
    if form_08_firmado is not None:
        operacion.form_08_firmado = form_08_firmado
    if transferencia_realizada is not None:
        operacion.transferencia_realizada = transferencia_realizada

    await db.commit()
    await db.refresh(operacion)

    return {
        "mensaje": "Documentacion actualizada",
        "boleto_compraventa": operacion.boleto_compraventa,
        "form_08_firmado": operacion.form_08_firmado,
        "transferencia_realizada": operacion.transferencia_realizada
    }
