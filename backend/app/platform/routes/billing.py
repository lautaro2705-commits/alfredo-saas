"""
Billing routes — Alfredo — plans, subscriptions, webhooks, usage.

Public endpoints:
  - GET /billing/plans — list available plans

Authenticated endpoints:
  - GET  /billing/overview   — current plan + usage + subscription
  - POST /billing/subscribe  — create MP subscription
  - POST /billing/cancel     — cancel active subscription
  - GET  /billing/payments   — payment history

Webhook (unauthenticated, verified by MP HMAC signature):
  - POST /billing/webhook    — MercadoPago notifications
"""
import hashlib
import hmac
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext, require_role
from app.platform.models import (
    Subscription, SubscriptionStatus, PaymentRecord, Tenant,
)
from app.platform.schemas.billing import (
    PlansResponse, PlanInfo, SubscribeRequest, SubscribeResponse,
    CancelSubscriptionResponse, BillingOverview, UsageInfo,
    SubscriptionInfo, PaymentHistoryResponse, PaymentInfo,
)
from app.platform.services.plans import get_available_plans, get_plan_config, UNLIMITED
from app.platform.services.billing import billing_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Public: list plans ──

@router.get("/plans", response_model=PlansResponse)
async def list_plans():
    """List available plans."""
    plans_data = get_available_plans()
    return PlansResponse(
        vertical="autos",
        plans=[PlanInfo(**p) for p in plans_data],
    )


# ── Billing overview ──

@router.get("/overview", response_model=BillingOverview)
async def billing_overview(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Current plan, usage, and subscription info."""
    plan_config = get_plan_config(token.plan)

    # Get usage
    usage_data = await billing_service.get_usage(db, token.tenant_id)

    usage = UsageInfo(
        usuarios_activos=usage_data["usuarios_activos"],
        max_usuarios=plan_config.max_usuarios if plan_config.max_usuarios < UNLIMITED else "unlimited",
        items_count=usage_data["items_count"],
        max_items=plan_config.max_items if plan_config.max_items < UNLIMITED else "unlimited",
        items_label=usage_data["items_label"],
    )

    # Get active subscription
    sub_result = await db.execute(
        select(Subscription)
        .where(
            Subscription.tenant_id == token.tenant_id,
            Subscription.status.in_([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIAL,
                SubscriptionStatus.PAST_DUE,
            ]),
        )
        .order_by(Subscription.created_at.desc())
    )
    sub = sub_result.scalar_one_or_none()

    # Get trial end from tenant
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == token.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    return BillingOverview(
        tenant_name=token.tenant_name,
        vertical=token.vertical,
        plan=token.plan,
        plan_display_name=plan_config.display_name,
        status=sub.status.value if sub else token.plan,
        trial_end=tenant.trial_ends_at if tenant else None,
        usage=usage,
        subscription=SubscriptionInfo.model_validate(sub) if sub else None,
    )


# ── Subscribe ──

@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe(
    req: SubscribeRequest,
    token: TokenContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new MercadoPago subscription. Admin only."""
    if req.plan not in ("basico", "profesional", "premium"):
        raise HTTPException(status_code=400, detail="Plan invalido")

    try:
        result = await billing_service.create_subscription(
            db=db,
            tenant_id=token.tenant_id,
            plan=req.plan,
            payer_email=req.payer_email,
        )
        return SubscribeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Cancel ──

@router.post("/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    token: TokenContext = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the active subscription. Admin only."""
    try:
        result = await billing_service.cancel_subscription(db, token.tenant_id)
        return CancelSubscriptionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Payment history ──

@router.get("/payments", response_model=PaymentHistoryResponse)
async def payment_history(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get payment history for the current tenant."""
    result = await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.tenant_id == token.tenant_id)
        .order_by(PaymentRecord.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()

    return PaymentHistoryResponse(
        payments=[PaymentInfo.model_validate(p) for p in payments],
        total=len(payments),
    )


# ── Trial status ──

@router.get("/trial-status")
async def trial_status(
    token: TokenContext = Depends(get_current_user_with_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Check if trial has expired."""
    return await billing_service.check_trial_status(db, token.tenant_id)


# ── MercadoPago Webhook ──

def _verify_mp_signature(request: Request, data_id: str) -> bool:
    """
    Verify MercadoPago HMAC-SHA256 webhook signature.

    MP sends header: x-signature: ts=<timestamp>,v1=<hash>
    The hash is HMAC-SHA256 of the template string:
      id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
    using MERCADOPAGO_WEBHOOK_SECRET as the key.

    Returns True if valid, False if invalid.
    Skips verification if MERCADOPAGO_WEBHOOK_SECRET is not configured.
    """
    from app.core.config import settings as app_settings

    webhook_secret = app_settings.MERCADOPAGO_WEBHOOK_SECRET
    if not webhook_secret:
        if app_settings.ENVIRONMENT == "production":
            logger.error("MP webhook secret not configured in PRODUCTION — rejecting")
            return False
        logger.warning("MP webhook secret not configured — skipping verification (dev only)")
        return True

    x_signature = request.headers.get("x-signature", "")
    x_request_id = request.headers.get("x-request-id", "")

    if not x_signature:
        logger.warning("MP webhook missing x-signature header")
        return False

    # Parse ts and v1 from "ts=...,v1=..."
    parts = {}
    for part in x_signature.split(","):
        if "=" in part:
            key, value = part.split("=", 1)
            parts[key.strip()] = value.strip()

    ts = parts.get("ts", "")
    received_hash = parts.get("v1", "")

    if not ts or not received_hash:
        logger.warning("MP webhook x-signature malformed: %s", x_signature)
        return False

    # Build the manifest string per MP docs
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"

    # Compute expected HMAC-SHA256
    expected_hash = hmac.new(
        webhook_secret.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        logger.warning("MP webhook HMAC mismatch for data_id=%s", data_id)
        return False

    return True


@router.post("/webhook", status_code=200)
async def mercadopago_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive MercadoPago notifications.
    Verifies HMAC signature before processing.
    MP sends: { "type": "payment", "data": { "id": "123" } }
    or query params: ?type=payment&data.id=123
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    # MP can send via body or query params
    notification_type = body.get("type") or request.query_params.get("type", "")
    data = body.get("data", {})
    data_id = str(data.get("id", "")) or request.query_params.get("data.id", "")

    if not notification_type or not data_id:
        return {"status": "ignored"}

    # Verify HMAC signature
    if not _verify_mp_signature(request, data_id):
        logger.warning("MP webhook rejected: invalid signature for id=%s", data_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook signature",
        )

    logger.info("MP webhook verified: type=%s id=%s", notification_type, data_id)

    try:
        await billing_service.process_webhook(db, notification_type, data_id)
    except Exception as e:
        logger.error("Webhook processing error: %s", e, exc_info=True)
        # Always return 200 to MP to avoid retries — don't expose error details
        return {"status": "error"}

    return {"status": "ok"}
