"""
Plan limit enforcement — FastAPI dependencies.

Usage in route handlers:
    from app.core.middleware.plan_limits import require_active_plan, require_feature, check_item_limit

    # Require an active (non-expired) plan
    @router.post("/unidades")
    async def create_unidad(
        token: TokenContext = Depends(require_active_plan),
        ...
    ):

    # Require a specific feature (e.g., only Profesional+ has "cheques")
    @router.get("/cheques")
    async def list_cheques(
        token: TokenContext = Depends(require_feature("cheques")),
        ...
    ):

    # Check item count limit before creating
    @router.post("/unidades")
    async def create_unidad(
        _limit_ok = Depends(check_item_limit),
        ...
    ):
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.platform.models import Tenant, PlatformUser
from app.platform.services.plans import get_plan_config, UNLIMITED


async def require_active_plan(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
) -> TokenContext:
    """
    Verify the tenant has an active (non-expired) plan.
    Blocks access if trial has expired and no paid plan is active.
    """
    if token.is_platform_admin:
        return token

    if token.plan == "trial":
        result = await db.execute(
            select(Tenant.trial_ends_at).where(Tenant.id == token.tenant_id)
        )
        trial_end = result.scalar_one_or_none()

        if trial_end and trial_end < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "trial_expired",
                    "message": "Tu periodo de prueba ha expirado. Suscribite para continuar.",
                    "trial_ended_at": trial_end.isoformat(),
                },
            )

    return token


def require_feature(feature: str):
    """Dependency factory: require a specific plan feature."""
    async def checker(
        token: TokenContext = Depends(get_current_user_with_tenant),
    ) -> TokenContext:
        if token.is_platform_admin:
            return token

        try:
            plan_config = get_plan_config(token.plan)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Plan '{token.plan}' no reconocido",
            )

        if feature not in plan_config.features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "feature_not_available",
                    "message": f"La funcion '{feature}' no esta disponible en tu plan ({plan_config.display_name}).",
                    "required_plans": _plans_with_feature(feature),
                    "upgrade_url": "/billing",
                },
            )

        return token
    return checker


async def check_item_limit(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Check if the tenant has reached the item limit for their plan.
    Items = vehicles (unidades).
    Call this as a dependency on creation endpoints.
    """
    if token.is_platform_admin:
        return

    try:
        plan_config = get_plan_config(token.plan)
    except ValueError:
        return

    if plan_config.max_items >= UNLIMITED:
        return

    # Count current items (vehículos)
    from app.verticals.autos.models.unidad import Unidad
    result = await db.execute(
        select(func.count(Unidad.id))
        .where(Unidad.tenant_id == token.tenant_id)
    )
    current_count = result.scalar() or 0

    if current_count >= plan_config.max_items:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "item_limit_reached",
                "message": f"Alcanzaste el limite de {plan_config.max_items} items en tu plan ({plan_config.display_name}).",
                "current": current_count,
                "max": plan_config.max_items,
                "upgrade_url": "/billing",
            },
        )


async def check_user_limit(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Check if the tenant can add more users.
    Call this on user creation endpoints.
    """
    if token.is_platform_admin:
        return

    try:
        plan_config = get_plan_config(token.plan)
    except ValueError:
        return

    if plan_config.max_usuarios >= UNLIMITED:
        return

    result = await db.execute(
        select(func.count(PlatformUser.id))
        .where(
            PlatformUser.tenant_id == token.tenant_id,
            PlatformUser.activo == True,
        )
    )
    current_count = result.scalar() or 0

    if current_count >= plan_config.max_usuarios:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "user_limit_reached",
                "message": f"Alcanzaste el limite de {plan_config.max_usuarios} usuarios en tu plan ({plan_config.display_name}).",
                "current": current_count,
                "max": plan_config.max_usuarios,
                "upgrade_url": "/billing",
            },
        )


def _plans_with_feature(feature: str) -> list[str]:
    """Return names of plans that include a given feature."""
    from app.platform.services.plans import PLANS
    return [
        p.display_name for p in PLANS.values()
        if feature in p.features and p.name != "trial"
    ]
