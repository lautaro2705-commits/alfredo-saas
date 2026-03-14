from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import date, timedelta
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, require_role, TokenContext
from app.verticals.autos.models.cheque import ChequeRecibido, ChequeEmitido, EstadoChequeRecibido, EstadoChequeEmitido
from app.verticals.autos.models.caja_diaria import CajaDiaria, TipoMovimiento, CategoriaGasto
from app.core.soft_delete import soft_delete
from app.verticals.autos.schemas.cheque import (
    ChequeRecibidoCreate, ChequeRecibidoUpdate, ChequeRecibidoResponse,
    DepositarChequeRequest, EndosarChequeRequest, RechazarChequeRequest,
    ChequeEmitidoCreate, ChequeEmitidoUpdate, ChequeEmitidoResponse,
    PagarChequeRequest, AnularChequeRequest,
    ResumenCartera, ResumenChequesEmitidos, CalendarioVencimientos
)

router = APIRouter(prefix="/autos/cheques", tags=["autos-cheques"])


# ==================== CHEQUES RECIBIDOS ====================

@router.get("/recibidos/", response_model=List[ChequeRecibidoResponse])
async def listar_cheques_recibidos(
    estado: Optional[EstadoChequeRecibido] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar cheques recibidos con filtros"""
    stmt = select(ChequeRecibido).where(ChequeRecibido.active())

    if estado:
        stmt = stmt.where(ChequeRecibido.estado == estado)
    if fecha_desde:
        stmt = stmt.where(ChequeRecibido.fecha_vencimiento >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(ChequeRecibido.fecha_vencimiento <= fecha_hasta)

    stmt = stmt.order_by(ChequeRecibido.fecha_vencimiento).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/recibidos/cartera", response_model=List[ChequeRecibidoResponse])
async def cheques_en_cartera(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar cheques actualmente en cartera"""
    result = await db.execute(
        select(ChequeRecibido).where(
            ChequeRecibido.active(),
            ChequeRecibido.estado == EstadoChequeRecibido.EN_CARTERA
        ).order_by(ChequeRecibido.fecha_vencimiento)
    )
    return result.scalars().all()


@router.get("/recibidos/resumen", response_model=ResumenCartera)
async def resumen_cartera(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Resumen de la cartera de cheques recibidos"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active()))
    cheques = result.scalars().all()

    en_cartera = [c for c in cheques if c.estado == EstadoChequeRecibido.EN_CARTERA]
    depositados = [c for c in cheques if c.estado == EstadoChequeRecibido.DEPOSITADO]
    endosados = [c for c in cheques if c.estado == EstadoChequeRecibido.ENDOSADO]
    rechazados = [c for c in cheques if c.estado == EstadoChequeRecibido.RECHAZADO]

    fecha_limite = date.today() + timedelta(days=7)
    por_vencer = [c for c in en_cartera if c.fecha_vencimiento <= fecha_limite]

    return ResumenCartera(
        total_en_cartera=sum(c.monto for c in en_cartera),
        cantidad_en_cartera=len(en_cartera),
        total_depositados=sum(c.monto for c in depositados),
        cantidad_depositados=len(depositados),
        total_endosados=sum(c.monto for c in endosados),
        cantidad_endosados=len(endosados),
        total_rechazados=sum(c.monto for c in rechazados),
        cantidad_rechazados=len(rechazados),
        cheques_por_vencer_7_dias=por_vencer
    )


@router.get("/recibidos/{cheque_id}", response_model=ChequeRecibidoResponse)
async def obtener_cheque_recibido(
    cheque_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Obtener detalle de un cheque recibido"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")
    return cheque


@router.post("/recibidos/", response_model=ChequeRecibidoResponse)
async def crear_cheque_recibido(
    cheque: ChequeRecibidoCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Registrar un nuevo cheque recibido"""
    db_cheque = ChequeRecibido(
        **cheque.model_dump(),
        estado=EstadoChequeRecibido.EN_CARTERA,
        created_by=token.user_id
    )
    if not db_cheque.fecha_recepcion:
        db_cheque.fecha_recepcion = date.today()

    db.add(db_cheque)
    await db.commit()
    await db.refresh(db_cheque)
    return db_cheque


@router.delete("/recibidos/{cheque_id}")
async def eliminar_cheque_recibido(
    cheque_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un cheque recibido (solo si está en cartera)"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado != EstadoChequeRecibido.EN_CARTERA:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar cheques en cartera")

    await soft_delete(db, cheque, deleted_by=token.user_id)
    return {"mensaje": "Cheque eliminado correctamente"}


@router.put("/recibidos/{cheque_id}", response_model=ChequeRecibidoResponse)
async def actualizar_cheque_recibido(
    cheque_id: int,
    cheque_update: ChequeRecibidoUpdate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Actualizar datos de un cheque recibido"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    db_cheque = result.scalar_one_or_none()
    if not db_cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if db_cheque.estado != EstadoChequeRecibido.EN_CARTERA:
        raise HTTPException(status_code=400, detail="Solo se pueden editar cheques en cartera")

    update_data = cheque_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_cheque, field, value)

    await db.commit()
    await db.refresh(db_cheque)
    return db_cheque


@router.post("/recibidos/{cheque_id}/depositar", response_model=ChequeRecibidoResponse)
async def depositar_cheque(
    cheque_id: int,
    data: DepositarChequeRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Marcar cheque como depositado en un banco"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado != EstadoChequeRecibido.EN_CARTERA:
        raise HTTPException(status_code=400, detail="El cheque no está en cartera")

    cheque.estado = EstadoChequeRecibido.DEPOSITADO
    cheque.banco_deposito = data.banco_deposito
    cheque.fecha_deposito = data.fecha_deposito or date.today()

    await db.commit()
    await db.refresh(cheque)
    return cheque


@router.post("/recibidos/{cheque_id}/cobrar", response_model=ChequeRecibidoResponse)
async def cobrar_cheque(
    cheque_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Marcar cheque como cobrado.
    Registra automáticamente el ingreso en caja.
    """
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado not in [EstadoChequeRecibido.EN_CARTERA, EstadoChequeRecibido.DEPOSITADO]:
        raise HTTPException(status_code=400, detail="El cheque no puede ser cobrado")

    cheque.estado = EstadoChequeRecibido.COBRADO
    cheque.fecha_cobro = date.today()

    # Registrar ingreso en caja
    ingreso = CajaDiaria(
        tipo=TipoMovimiento.INGRESO,
        categoria=CategoriaGasto.OTROS_INGRESOS,
        descripcion=f"Cobro cheque #{cheque.numero_cheque} - {cheque.emisor_nombre}",
        monto=cheque.monto,
        fecha=date.today(),
        medio_pago="Cheque",
        created_by=token.user_id
    )
    db.add(ingreso)

    await db.commit()
    await db.refresh(cheque)
    return cheque


@router.post("/recibidos/{cheque_id}/endosar", response_model=ChequeRecibidoResponse)
async def endosar_cheque(
    cheque_id: int,
    data: EndosarChequeRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Endosar cheque a un tercero.
    Se usa para pagar proveedores o comprar otros autos.
    """
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado != EstadoChequeRecibido.EN_CARTERA:
        raise HTTPException(status_code=400, detail="El cheque no está en cartera")

    cheque.estado = EstadoChequeRecibido.ENDOSADO
    cheque.endosado_a = data.endosado_a
    cheque.endosado_cuit = data.endosado_cuit
    cheque.motivo_endoso = data.motivo_endoso
    cheque.unidad_compra_id = data.unidad_compra_id
    cheque.fecha_endoso = data.fecha_endoso or date.today()

    await db.commit()
    await db.refresh(cheque)
    return cheque


@router.post("/recibidos/{cheque_id}/rechazar", response_model=ChequeRecibidoResponse)
async def rechazar_cheque(
    cheque_id: int,
    data: RechazarChequeRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Marcar cheque como rechazado"""
    result = await db.execute(select(ChequeRecibido).where(ChequeRecibido.active(), ChequeRecibido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado == EstadoChequeRecibido.COBRADO:
        raise HTTPException(status_code=400, detail="El cheque ya fue cobrado")

    cheque.estado = EstadoChequeRecibido.RECHAZADO
    cheque.motivo_rechazo = data.motivo_rechazo
    cheque.fecha_rechazo = data.fecha_rechazo or date.today()

    await db.commit()
    await db.refresh(cheque)
    return cheque


# ==================== CHEQUES EMITIDOS ====================

@router.get("/emitidos/", response_model=List[ChequeEmitidoResponse])
async def listar_cheques_emitidos(
    estado: Optional[EstadoChequeEmitido] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar cheques emitidos con filtros"""
    stmt = select(ChequeEmitido).where(ChequeEmitido.active())

    if estado:
        stmt = stmt.where(ChequeEmitido.estado == estado)
    if fecha_desde:
        stmt = stmt.where(ChequeEmitido.fecha_pago >= fecha_desde)
    if fecha_hasta:
        stmt = stmt.where(ChequeEmitido.fecha_pago <= fecha_hasta)

    stmt = stmt.order_by(ChequeEmitido.fecha_pago).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/emitidos/pendientes", response_model=List[ChequeEmitidoResponse])
async def cheques_pendientes(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Listar cheques emitidos pendientes de débito"""
    result = await db.execute(
        select(ChequeEmitido).where(
            ChequeEmitido.active(),
            ChequeEmitido.estado == EstadoChequeEmitido.PENDIENTE
        ).order_by(ChequeEmitido.fecha_pago)
    )
    return result.scalars().all()


@router.get("/emitidos/resumen", response_model=ResumenChequesEmitidos)
async def resumen_cheques_emitidos(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Resumen de cheques emitidos"""
    result = await db.execute(select(ChequeEmitido).where(ChequeEmitido.active()))
    cheques = result.scalars().all()

    pendientes = [c for c in cheques if c.estado == EstadoChequeEmitido.PENDIENTE]
    pagados = [c for c in cheques if c.estado == EstadoChequeEmitido.PAGADO]
    anulados = [c for c in cheques if c.estado == EstadoChequeEmitido.ANULADO]

    fecha_limite = date.today() + timedelta(days=7)
    por_debitar = [c for c in pendientes if c.fecha_pago <= fecha_limite]

    return ResumenChequesEmitidos(
        total_pendientes=sum(c.monto for c in pendientes),
        cantidad_pendientes=len(pendientes),
        total_pagados=sum(c.monto for c in pagados),
        cantidad_pagados=len(pagados),
        total_anulados=sum(c.monto for c in anulados),
        cantidad_anulados=len(anulados),
        cheques_por_debitar_7_dias=por_debitar
    )


@router.post("/emitidos/", response_model=ChequeEmitidoResponse)
async def crear_cheque_emitido(
    cheque: ChequeEmitidoCreate,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Registrar un nuevo cheque emitido"""
    db_cheque = ChequeEmitido(
        **cheque.model_dump(),
        estado=EstadoChequeEmitido.PENDIENTE,
        created_by=token.user_id
    )
    if not db_cheque.fecha_emision:
        db_cheque.fecha_emision = date.today()

    db.add(db_cheque)
    await db.commit()
    await db.refresh(db_cheque)
    return db_cheque


@router.delete("/emitidos/{cheque_id}")
async def eliminar_cheque_emitido(
    cheque_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Eliminar un cheque emitido (solo si está pendiente)"""
    result = await db.execute(select(ChequeEmitido).where(ChequeEmitido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado != EstadoChequeEmitido.PENDIENTE:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar cheques pendientes")

    await soft_delete(db, cheque, deleted_by=token.user_id)
    return {"mensaje": "Cheque eliminado correctamente"}


@router.post("/emitidos/{cheque_id}/pagar", response_model=ChequeEmitidoResponse)
async def marcar_cheque_pagado(
    cheque_id: int,
    data: PagarChequeRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Marcar cheque emitido como pagado (debitado).
    Registra automáticamente el egreso en caja.
    """
    result = await db.execute(select(ChequeEmitido).where(ChequeEmitido.active(), ChequeEmitido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado != EstadoChequeEmitido.PENDIENTE:
        raise HTTPException(status_code=400, detail="El cheque no está pendiente")

    cheque.estado = EstadoChequeEmitido.PAGADO
    cheque.fecha_debito = data.fecha_debito or date.today()

    # Registrar egreso en caja
    egreso = CajaDiaria(
        tipo=TipoMovimiento.EGRESO,
        categoria=CategoriaGasto.OTROS_EGRESOS,
        descripcion=f"Débito cheque #{cheque.numero_cheque} a {cheque.beneficiario}",
        monto=cheque.monto,
        fecha=date.today(),
        medio_pago="Cheque",
        created_by=token.user_id
    )
    db.add(egreso)

    await db.commit()
    await db.refresh(cheque)
    return cheque


@router.post("/emitidos/{cheque_id}/anular", response_model=ChequeEmitidoResponse)
async def anular_cheque(
    cheque_id: int,
    data: AnularChequeRequest,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Anular un cheque emitido"""
    result = await db.execute(select(ChequeEmitido).where(ChequeEmitido.active(), ChequeEmitido.id == cheque_id))
    cheque = result.scalar_one_or_none()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")

    if cheque.estado == EstadoChequeEmitido.PAGADO:
        raise HTTPException(status_code=400, detail="No se puede anular un cheque ya pagado")

    cheque.estado = EstadoChequeEmitido.ANULADO
    cheque.motivo_anulacion = data.motivo_anulacion
    cheque.fecha_anulacion = data.fecha_anulacion or date.today()

    await db.commit()
    await db.refresh(cheque)
    return cheque


# ==================== CALENDARIO Y ALERTAS ====================

@router.get("/calendario")
async def calendario_vencimientos(
    dias: int = Query(default=30, description="Días hacia adelante"),
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Calendario de vencimientos de cheques.
    Muestra cheques a cobrar y a pagar en los próximos N días.
    """
    fecha_limite = date.today() + timedelta(days=dias)

    # Cheques a cobrar
    result = await db.execute(
        select(ChequeRecibido).where(
            ChequeRecibido.active(),
            ChequeRecibido.estado.in_([EstadoChequeRecibido.EN_CARTERA, EstadoChequeRecibido.DEPOSITADO]),
            ChequeRecibido.fecha_vencimiento <= fecha_limite,
            ChequeRecibido.fecha_vencimiento >= date.today()
        ).order_by(ChequeRecibido.fecha_vencimiento)
    )
    a_cobrar = result.scalars().all()

    # Cheques a pagar
    result = await db.execute(
        select(ChequeEmitido).where(
            ChequeEmitido.active(),
            ChequeEmitido.estado == EstadoChequeEmitido.PENDIENTE,
            ChequeEmitido.fecha_pago <= fecha_limite,
            ChequeEmitido.fecha_pago >= date.today()
        ).order_by(ChequeEmitido.fecha_pago)
    )
    a_pagar = result.scalars().all()

    return {
        "periodo": f"Próximos {dias} días",
        "cheques_a_cobrar": [
            {
                "id": c.id,
                "fecha": c.fecha_vencimiento,
                "banco": c.banco,
                "numero": c.numero_cheque,
                "emisor": c.emisor_nombre,
                "monto": c.monto,
                "estado": c.estado.value,
                "dias_restantes": c.dias_para_vencer
            }
            for c in a_cobrar
        ],
        "cheques_a_pagar": [
            {
                "id": c.id,
                "fecha": c.fecha_pago,
                "banco": c.banco,
                "numero": c.numero_cheque,
                "beneficiario": c.beneficiario,
                "monto": c.monto,
                "dias_restantes": c.dias_para_debito
            }
            for c in a_pagar
        ],
        "totales": {
            "total_a_cobrar": sum(c.monto for c in a_cobrar),
            "total_a_pagar": sum(c.monto for c in a_pagar),
            "saldo_proyectado": sum(c.monto for c in a_cobrar) - sum(c.monto for c in a_pagar)
        }
    }


@router.get("/alertas")
async def alertas_cheques(
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """Alertas de cheques próximos a vencer (7 días)"""
    fecha_limite = date.today() + timedelta(days=7)

    alertas = []

    # Cheques recibidos por vencer
    result = await db.execute(
        select(ChequeRecibido).where(
            ChequeRecibido.active(),
            ChequeRecibido.estado == EstadoChequeRecibido.EN_CARTERA,
            ChequeRecibido.fecha_vencimiento <= fecha_limite
        )
    )
    cheques_vencen = result.scalars().all()

    for c in cheques_vencen:
        prioridad = "alta" if c.dias_para_vencer <= 2 else "media"
        if c.vencido:
            alertas.append({
                "tipo": "cheque_vencido",
                "prioridad": "alta",
                "mensaje": f"Cheque VENCIDO #{c.numero_cheque} de {c.emisor_nombre}",
                "monto": c.monto,
                "cheque_id": c.id
            })
        else:
            alertas.append({
                "tipo": "cheque_por_vencer",
                "prioridad": prioridad,
                "mensaje": f"Cheque vence en {c.dias_para_vencer} días - #{c.numero_cheque}",
                "monto": c.monto,
                "cheque_id": c.id
            })

    # Cheques emitidos por debitar
    result = await db.execute(
        select(ChequeEmitido).where(
            ChequeEmitido.active(),
            ChequeEmitido.estado == EstadoChequeEmitido.PENDIENTE,
            ChequeEmitido.fecha_pago <= fecha_limite
        )
    )
    cheques_debitan = result.scalars().all()

    for c in cheques_debitan:
        prioridad = "alta" if c.dias_para_debito <= 2 else "media"
        alertas.append({
            "tipo": "cheque_por_debitar",
            "prioridad": prioridad,
            "mensaje": f"Cheque se debita en {c.dias_para_debito} días - #{c.numero_cheque}",
            "monto": c.monto,
            "cheque_id": c.id
        })

    return sorted(alertas, key=lambda x: 0 if x["prioridad"] == "alta" else 1)
