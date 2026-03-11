"""
Rutas de autenticación: login, onboarding, /me, password reset/change.
"""
import json
import secrets
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, set_tenant_context
from app.core.email import send_welcome, send_password_reset
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_token,
    TokenContext,
)
from app.core.security.failed_login_tracker import (
    is_locked_out, record_failed_login, reset_failed_logins,
)
from app.core.security.refresh_tokens import (
    create_refresh_token, validate_refresh_token, revoke_refresh_token,
)
from app.platform.models.tenant import Tenant, PlanTier, VERTICAL
from app.platform.models.user import PlatformUser, RolUsuario, PERMISOS_POR_ROL
from app.platform.models.subscription import Subscription, SubscriptionStatus
from app.platform.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    OnboardingRequest,
    OnboardingResponse,
    UserProfile,
    PasswordResetRequest,
    PasswordResetConfirm,
    PasswordChangeRequest,
    MessageResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Login con email + password. Retorna JWT con contexto de tenant."""
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host

    # Check lockout BEFORE verifying credentials
    if await is_locked_out(client_ip, data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intente en 15 minutos.",
        )

    result = await db.execute(
        select(PlatformUser).where(
            PlatformUser.email == data.email,
            PlatformUser.activo == True,
        )
    )
    user = result.scalars().first()

    if not user or not verify_password(data.password, user.hashed_password):
        await record_failed_login(client_ip, data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    # Obtener tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not tenant.activa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agencia inactiva o suspendida",
        )

    # Success — reset lockout counter
    await reset_failed_logins(client_ip, data.email)

    # Set tenant context BEFORE any writes (RLS UPDATE policy requires it)
    await set_tenant_context(db, str(user.tenant_id))

    # Actualizar last_login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access = create_access_token(
        user_id=str(user.id),
        username=user.username,
        tenant_id=str(tenant.id),
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        rol=user.rol.value,
        plan=tenant.plan.value,
        permissions=user.permisos,
        is_platform_admin=user.is_platform_admin,
    )
    refresh = await create_refresh_token(str(user.id), str(tenant.id))

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        plan=tenant.plan.value,
        rol=user.rol.value,
    )


@router.post("/onboarding", response_model=OnboardingResponse)
async def onboarding(data: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    """Registrar nueva agencia: crea tenant + admin + trial en una transacción."""

    # Verificar que el email no esté registrado
    existing = await db.execute(
        select(PlatformUser).where(PlatformUser.email == data.admin_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese email",
        )

    # Verificar CUIT único si se proporcionó
    if data.cuit:
        existing_tenant = await db.execute(
            select(Tenant).where(Tenant.cuit == data.cuit)
        )
        if existing_tenant.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una agencia con ese CUIT",
            )

    trial_end = datetime.now(timezone.utc) + timedelta(days=settings.TRIAL_DAYS)

    # 1. Crear tenant (siempre vertical="autos" en Alfredo)
    tenant = Tenant(
        nombre=data.nombre_agencia,
        vertical=VERTICAL,
        email_contacto=data.email_contacto,
        telefono=data.telefono,
        cuit=data.cuit,
        plan=PlanTier.TRIAL,
        activa=True,
        trial_ends_at=trial_end,
        settings={
            "moneda_principal": "ARS",
            "timezone": "America/Argentina/Buenos_Aires",
        },
    )
    db.add(tenant)
    await db.flush()  # Genera el tenant.id

    # Set tenant context BEFORE inserting user/subscription (RLS requires it)
    await set_tenant_context(db, str(tenant.id))

    # 2. Crear usuario admin
    username = data.admin_email.split("@")[0]
    admin_user = PlatformUser(
        tenant_id=tenant.id,
        username=username,
        email=data.admin_email,
        hashed_password=get_password_hash(data.admin_password),
        nombre=data.admin_nombre,
        apellido=data.admin_apellido,
        rol=RolUsuario.ADMIN,
        activo=True,
    )
    db.add(admin_user)
    await db.flush()

    # 3. Crear suscripción trial
    subscription = Subscription(
        tenant_id=tenant.id,
        plan=PlanTier.TRIAL.value,
        status=SubscriptionStatus.TRIAL,
        trial_end=trial_end,
        amount=0,
        currency="ARS",
    )
    db.add(subscription)

    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin_user)

    # Generar token de acceso inmediato
    access = create_access_token(
        user_id=str(admin_user.id),
        username=admin_user.username,
        tenant_id=str(tenant.id),
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        rol=admin_user.rol.value,
        plan=tenant.plan.value,
        permissions=admin_user.permisos,
    )
    refresh = await create_refresh_token(str(admin_user.id), str(tenant.id))

    # Email de bienvenida (fire-and-forget, no bloquea el onboarding)
    await send_welcome(
        to=data.admin_email,
        nombre=data.admin_nombre,
        nombre_agencia=data.nombre_agencia,
        trial_days=settings.TRIAL_DAYS,
    )

    return OnboardingResponse(
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        plan=tenant.plan.value,
        trial_ends_at=trial_end,
        admin_user_id=admin_user.id,
        access_token=access,
        refresh_token=refresh,
    )


@router.get("/me", response_model=UserProfile)
async def get_me(
    token: TokenContext = Depends(get_current_token),
    db: AsyncSession = Depends(get_db),
):
    """Datos del usuario autenticado."""
    result = await db.execute(
        select(PlatformUser).where(PlatformUser.id == token.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return UserProfile(
        id=user.id,
        username=user.username,
        email=user.email,
        nombre=user.nombre,
        apellido=user.apellido,
        rol=user.rol.value,
        tenant_id=token.tenant_id,
        tenant_name=token.tenant_name,
        vertical=token.vertical,
        plan=token.plan,
        is_platform_admin=user.is_platform_admin,
    )


# ── Refresh Token ──

@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    The old refresh token is consumed (one-time use / rotation).
    """
    token_data = await validate_refresh_token(data.refresh_token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    # Fetch user (ensure still active)
    result = await db.execute(
        select(PlatformUser).where(
            PlatformUser.id == token_data["user_id"],
            PlatformUser.activo == True,
        )
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o eliminado",
        )

    # Fetch tenant (ensure still active)
    result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.activa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agencia inactiva o suspendida",
        )

    # Generate fresh token pair
    access = create_access_token(
        user_id=str(user.id),
        username=user.username,
        tenant_id=str(tenant.id),
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        rol=user.rol.value,
        plan=tenant.plan.value,
        permissions=user.permisos,
        is_platform_admin=user.is_platform_admin,
    )
    refresh = await create_refresh_token(str(user.id), str(tenant.id))

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        plan=tenant.plan.value,
        rol=user.rol.value,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: RefreshRequest,
):
    """Invalidar refresh token en logout explícito."""
    await revoke_refresh_token(data.refresh_token)
    return MessageResponse(message="Sesión cerrada exitosamente.")


# ── Password Reset (Redis-backed with TTL) ──
# Tokens stored in Redis with automatic expiration.
# Works correctly with multiple workers (gunicorn, uvicorn --workers N).

RESET_TOKEN_TTL = 3600  # 1 hour in seconds
RESET_TOKEN_PREFIX = "password_reset:"


async def _get_redis() -> aioredis.Redis:
    """Get Redis client for password reset tokens."""
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


@router.post("/password-reset/request", response_model=MessageResponse)
async def request_password_reset(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Solicitar reset de password. Genera un token temporal almacenado en Redis.
    En producción enviaría email; en dev retorna el token en respuesta.
    """
    result = await db.execute(
        select(PlatformUser).where(
            PlatformUser.email == data.email,
            PlatformUser.activo == True,
        )
    )
    user = result.scalars().first()

    # Siempre responder igual para evitar enumeración de emails
    if not user:
        return MessageResponse(
            message="Si el email existe, recibirás instrucciones para restablecer tu contraseña."
        )

    # Generar token de reset y guardar en Redis con TTL
    reset_token = secrets.token_urlsafe(32)
    r = await _get_redis()
    try:
        await r.setex(
            f"{RESET_TOKEN_PREFIX}{reset_token}",
            RESET_TOKEN_TTL,
            json.dumps({"user_id": str(user.id)}),
        )
    finally:
        await r.aclose()

    # Enviar email con link de reset
    await send_password_reset(to=user.email, reset_token=reset_token)

    msg = "Si el email existe, recibirás instrucciones para restablecer tu contraseña."
    if settings.DEBUG:
        msg += f" [DEBUG] Token: {reset_token}"

    return MessageResponse(message=msg)


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(
    data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    """Confirmar reset de password con token (validado contra Redis)."""
    r = await _get_redis()
    try:
        raw = await r.get(f"{RESET_TOKEN_PREFIX}{data.token}")
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token inválido o expirado",
            )

        token_data = json.loads(raw)

        result = await db.execute(
            select(PlatformUser).where(PlatformUser.id == token_data["user_id"])
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # Set tenant context BEFORE UPDATE (RLS requires it)
        await set_tenant_context(db, str(user.tenant_id))

        user.hashed_password = get_password_hash(data.new_password)
        await db.commit()

        # Invalidar token usado (one-time use)
        await r.delete(f"{RESET_TOKEN_PREFIX}{data.token}")
    finally:
        await r.aclose()

    return MessageResponse(message="Contraseña actualizada exitosamente.")


@router.post("/password-change", response_model=MessageResponse)
async def change_password(
    data: PasswordChangeRequest,
    token: TokenContext = Depends(get_current_token),
    db: AsyncSession = Depends(get_db),
):
    """Cambiar contraseña del usuario autenticado."""
    result = await db.execute(
        select(PlatformUser).where(PlatformUser.id == token.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta",
        )

    user.hashed_password = get_password_hash(data.new_password)
    await db.commit()

    return MessageResponse(message="Contraseña actualizada exitosamente.")
