"""
Super-admin routes — platform-wide management.

All endpoints require is_platform_admin=True in the JWT.

Endpoints:
  - GET    /admin/metrics            — platform KPIs
  - GET    /admin/tenants            — list all tenants
  - GET    /admin/tenants/{id}       — tenant detail + users + subscription
  - PUT    /admin/tenants/{id}       — update tenant (activate/deactivate, plan)
  - POST   /admin/tenants/{id}/impersonate — get token as tenant admin
  - POST   /admin/gift              — regalar acceso a una agencia
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.security import (
    TokenContext, require_platform_admin, create_access_token,
    get_password_hash,
)
from app.platform.models import (
    Tenant, PlanTier, PlatformUser,
    Subscription, SubscriptionStatus, PaymentRecord, PaymentStatus,
)
from app.platform.models.user import RolUsuario, PERMISOS_POR_ROL
from app.platform.schemas.admin import (
    TenantSummary, TenantListResponse, TenantDetail,
    TenantUserInfo, TenantSubscriptionInfo, TenantUpdate,
    PlatformMetrics, ImpersonateResponse,
    GiftRequest, GiftResponse,
)
from app.platform.services.plans import get_plan_config, UNLIMITED

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# All routes require platform admin
platform_admin = Depends(require_platform_admin())


# ── Platform metrics ──

@router.get("/metrics", response_model=PlatformMetrics)
async def get_metrics(
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide KPIs for the super-admin dashboard."""

    # Total / active tenants
    total_q = await db.execute(select(func.count(Tenant.id)))
    total_tenants = total_q.scalar() or 0

    active_q = await db.execute(
        select(func.count(Tenant.id)).where(Tenant.activa == True)
    )
    active_tenants = active_q.scalar() or 0

    # Tenants by plan
    plan_q = await db.execute(
        select(Tenant.plan, func.count(Tenant.id))
        .group_by(Tenant.plan)
    )
    tenants_by_plan = {row[0].value: row[1] for row in plan_q.all()}

    trial_tenants = tenants_by_plan.get("trial", 0)
    paying_tenants = sum(
        v for k, v in tenants_by_plan.items() if k != "trial"
    )

    # Tenants by vertical (Alfredo = single vertical)
    tenants_by_vertical = {"autos": active_tenants}

    # Total users
    users_q = await db.execute(select(func.count(PlatformUser.id)))
    total_users = users_q.scalar() or 0

    # Revenue: sum of approved payments
    rev_q = await db.execute(
        select(func.coalesce(func.sum(PaymentRecord.amount), 0))
        .where(PaymentRecord.status == PaymentStatus.APPROVED)
    )
    total_revenue = float(rev_q.scalar() or 0)

    # Recent signups (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_q = await db.execute(
        select(func.count(Tenant.id))
        .where(Tenant.created_at >= seven_days_ago)
    )
    recent_signups = recent_q.scalar() or 0

    return PlatformMetrics(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        trial_tenants=trial_tenants,
        paying_tenants=paying_tenants,
        tenants_by_vertical=tenants_by_vertical,
        tenants_by_plan=tenants_by_plan,
        total_users=total_users,
        total_revenue_ars=total_revenue,
        recent_signups=recent_signups,
    )


# ── List tenants ──

@router.get("/tenants", response_model=TenantListResponse)
async def list_tenants(
    vertical: str = None,
    plan: str = None,
    activa: bool = None,
    search: str = None,
    page: int = 1,
    page_size: int = 50,
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """List all tenants with filters, pagination, and aggregated counts (no N+1)."""
    from app.verticals.autos.models.unidad import Unidad
    import math

    # Clamp pagination params
    page = max(1, page)
    page_size = max(1, min(page_size, 200))

    # Subqueries for counts (eliminates N+1)
    user_count_sq = (
        select(
            PlatformUser.tenant_id,
            func.count(PlatformUser.id).label("user_count"),
        )
        .group_by(PlatformUser.tenant_id)
        .subquery()
    )
    item_count_sq = (
        select(
            Unidad.tenant_id,
            func.count(Unidad.id).label("item_count"),
        )
        .group_by(Unidad.tenant_id)
        .subquery()
    )

    # Base query with LEFT JOINs for counts
    query = (
        select(
            Tenant,
            func.coalesce(user_count_sq.c.user_count, 0).label("user_count"),
            func.coalesce(item_count_sq.c.item_count, 0).label("item_count"),
        )
        .outerjoin(user_count_sq, Tenant.id == user_count_sq.c.tenant_id)
        .outerjoin(item_count_sq, Tenant.id == item_count_sq.c.tenant_id)
        .order_by(Tenant.created_at.desc())
    )

    # Filters
    if vertical:
        query = query.where(Tenant.vertical == vertical)
    if plan:
        query = query.where(Tenant.plan == PlanTier(plan))
    if activa is not None:
        query = query.where(Tenant.activa == activa)
    if search:
        query = query.where(
            Tenant.nombre.ilike(f"%{search}%")
            | Tenant.email_contacto.ilike(f"%{search}%")
            | Tenant.cuit.ilike(f"%{search}%")
        )

    # Count total (before pagination)
    count_query = select(func.count()).select_from(
        query.with_only_columns(Tenant.id).subquery()
    )
    total = (await db.execute(count_query)).scalar() or 0
    total_pages = max(1, math.ceil(total / page_size))

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    summaries = [
        TenantSummary(
            id=t.id,
            nombre=t.nombre,
            vertical=t.vertical if isinstance(t.vertical, str) else t.vertical.value,
            plan=t.plan.value,
            activa=t.activa,
            email_contacto=t.email_contacto,
            cuit=t.cuit,
            created_at=t.created_at,
            trial_ends_at=t.trial_ends_at,
            user_count=user_count,
            item_count=item_count,
        )
        for t, user_count, item_count in rows
    ]

    return TenantListResponse(
        tenants=summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── Tenant detail ──

@router.get("/tenants/{tenant_id}", response_model=TenantDetail)
async def get_tenant(
    tenant_id: UUID,
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """Detailed view of a specific tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    # Users
    users_result = await db.execute(
        select(PlatformUser)
        .where(PlatformUser.tenant_id == tenant_id)
        .order_by(PlatformUser.created_at.desc())
    )
    users = [
        TenantUserInfo(
            id=u.id,
            username=u.username,
            email=u.email,
            nombre=u.nombre,
            apellido=u.apellido,
            rol=u.rol.value,
            activo=u.activo,
            last_login=u.last_login,
            created_at=u.created_at,
        )
        for u in users_result.scalars().all()
    ]

    # Active subscription
    sub_result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    sub = sub_result.scalar_one_or_none()
    sub_info = None
    if sub:
        sub_info = TenantSubscriptionInfo(
            id=sub.id,
            plan=sub.plan,
            status=sub.status.value,
            amount=float(sub.amount) if sub.amount else None,
            currency=sub.currency or "ARS",
            mp_preapproval_id=sub.mp_preapproval_id,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            created_at=sub.created_at,
        )

    # Item count (vehículos)
    item_count = 0
    try:
        from app.verticals.autos.models.unidad import Unidad
        ic = await db.execute(
            select(func.count(Unidad.id))
            .where(Unidad.tenant_id == tenant_id)
        )
        item_count = ic.scalar() or 0
    except Exception:
        pass

    return TenantDetail(
        id=tenant.id,
        nombre=tenant.nombre,
        razon_social=tenant.razon_social,
        cuit=tenant.cuit,
        email_contacto=tenant.email_contacto,
        telefono=tenant.telefono,
        vertical=tenant.vertical if isinstance(tenant.vertical, str) else tenant.vertical.value,
        plan=tenant.plan.value,
        activa=tenant.activa,
        max_usuarios=tenant.max_usuarios or "2",
        max_items=tenant.max_items or "30",
        settings=tenant.settings,
        created_at=tenant.created_at,
        trial_ends_at=tenant.trial_ends_at,
        users=users,
        subscription=sub_info,
        item_count=item_count,
    )


# ── Update tenant ──

@router.put("/tenants/{tenant_id}", response_model=TenantDetail)
async def update_tenant(
    tenant_id: UUID,
    body: TenantUpdate,
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """Update tenant: activate/deactivate, change plan, adjust limits."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if body.activa is not None:
        tenant.activa = body.activa
    if body.plan is not None:
        tenant.plan = PlanTier(body.plan)
    if body.max_usuarios is not None:
        tenant.max_usuarios = body.max_usuarios
    if body.max_items is not None:
        tenant.max_items = body.max_items

    await db.commit()
    await db.refresh(tenant)

    logger.info(
        "Tenant %s updated by platform admin %s: %s",
        tenant_id, token.username, body.model_dump(exclude_none=True),
    )

    # Re-fetch full detail
    return await get_tenant(tenant_id, token, db)


# ── Impersonate tenant ──

@router.post("/tenants/{tenant_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate_tenant(
    tenant_id: UUID,
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a token as the tenant's admin user.
    Lets platform admins debug issues from the tenant's perspective.
    """
    # Get tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if not tenant.activa:
        raise HTTPException(status_code=400, detail="Tenant desactivado")

    # Find the tenant's admin user
    admin_result = await db.execute(
        select(PlatformUser)
        .where(
            PlatformUser.tenant_id == tenant_id,
            PlatformUser.rol == "admin",
            PlatformUser.activo == True,
        )
        .order_by(PlatformUser.created_at.asc())
        .limit(1)
    )
    admin_user = admin_result.scalar_one_or_none()
    if not admin_user:
        raise HTTPException(
            status_code=404,
            detail="No hay usuario admin activo en este tenant",
        )

    # Generate impersonation token (short-lived: 1 hour)
    imp_token = create_access_token(
        user_id=str(admin_user.id),
        username=admin_user.username,
        tenant_id=str(tenant.id),
        tenant_name=tenant.nombre,
        vertical="autos",
        rol="admin",
        plan=tenant.plan.value,
        permissions=PERMISOS_POR_ROL.get("admin", []),
        is_platform_admin=True,  # keep admin powers
        expires_delta=timedelta(hours=1),
    )

    logger.warning(
        "Platform admin %s impersonating tenant %s (%s)",
        token.username, tenant.nombre, tenant_id,
    )

    return ImpersonateResponse(
        access_token=imp_token,
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        vertical="autos",
        plan=tenant.plan.value,
        message=f"Impersonando {tenant.nombre} por 1 hora",
    )


# ── Resolve gift limits ──

def resolve_gift_limits(plan: str, dias: int) -> Optional[dict]:
    """
    Regalo = acceso premium completo sin restricciones.
    Solo accesible vía superadmin, no hay forma pública de obtener esto.
    """
    try:
        plan_tier = PlanTier(plan)
    except ValueError:
        return None

    # Regalos siempre van con todo: unlimited users, unlimited items, status ACTIVE.
    # El plan del tenant refleja lo que se regaló (para métricas/reportes),
    # pero los límites son siempre los máximos.
    return {
        "max_usuarios": "unlimited",
        "max_items": "unlimited",
        "plan_tier": plan_tier,
        "sub_status": SubscriptionStatus.ACTIVE,
    }


# ── Gift access ──

@router.post("/gift", response_model=GiftResponse, status_code=status.HTTP_201_CREATED)
async def gift_access(
    body: GiftRequest,
    token: TokenContext = platform_admin,
    db: AsyncSession = Depends(get_db),
):
    """Regalar acceso a una nueva agencia — crea tenant + admin + suscripción."""

    # Validar email único
    existing = await db.execute(
        select(PlatformUser).where(PlatformUser.email == body.admin_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una cuenta con el email {body.admin_email}",
        )

    # Resolver límites según plan regalado
    gift = resolve_gift_limits(body.plan, body.dias)
    if gift is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plan '{body.plan}' no válido. Opciones: trial, basico, profesional, premium",
        )

    acceso_hasta = datetime.now(timezone.utc) + timedelta(days=body.dias)

    # 1. Crear tenant
    tenant = Tenant(
        nombre=body.nombre_agencia,
        vertical="autos",
        email_contacto=body.email_contacto,
        telefono=body.telefono,
        plan=gift["plan_tier"],
        activa=True,
        trial_ends_at=acceso_hasta,
        max_usuarios=gift["max_usuarios"],
        max_items=gift["max_items"],
        settings={
            "moneda_principal": "ARS",
            "timezone": "America/Argentina/Buenos_Aires",
            "gift_from": token.username,
            "gift_motivo": body.motivo,
            "gift_dias": body.dias,
        },
    )
    db.add(tenant)
    await db.flush()

    # Set RLS context
    await set_tenant_context(db, str(tenant.id))

    # 2. Crear usuario admin
    username = body.admin_email.split("@")[0]
    admin_user = PlatformUser(
        tenant_id=tenant.id,
        username=username,
        email=body.admin_email,
        hashed_password=get_password_hash(body.admin_password),
        nombre=body.admin_nombre,
        apellido=body.admin_apellido,
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db.add(admin_user)
    await db.flush()

    # 3. Crear suscripción
    subscription = Subscription(
        tenant_id=tenant.id,
        plan=body.plan,
        status=gift["sub_status"],
        trial_end=acceso_hasta,
        current_period_start=datetime.now(timezone.utc),
        current_period_end=acceso_hasta,
        amount=0,
        currency="ARS",
    )
    db.add(subscription)

    await db.commit()

    logger.info(
        "🎁 Gift: %s regaló plan '%s' (%d días) a '%s' (%s) — motivo: %s",
        token.username, body.plan, body.dias,
        body.nombre_agencia, body.admin_email, body.motivo,
    )

    return GiftResponse(
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        plan=body.plan,
        acceso_hasta=acceso_hasta,
        admin_email=body.admin_email,
        message=f"Acceso '{body.plan}' regalado a {body.nombre_agencia} por {body.dias} días",
    )
