"""
MercadoPago billing service.
Handles subscription creation, webhook processing, and payment tracking.

Uses MP Preapproval API for recurring subscriptions:
  - POST /preapproval → create subscription
  - GET  /preapproval/{id} → check status
  - PUT  /preapproval/{id} → update/cancel

Webhook flow:
  1. MP sends notification to /billing/webhook
  2. We verify the payment via MP API
  3. Update Subscription + create PaymentRecord
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import send_subscription_confirmed
from app.platform.models import (
    Tenant, PlanTier, Subscription, SubscriptionStatus,
    PaymentRecord, PaymentStatus, PlatformUser,
)
from app.platform.services.plans import get_plan_config, UNLIMITED

logger = logging.getLogger(__name__)

MP_API_BASE = "https://api.mercadopago.com"


class BillingService:
    """Handles all billing operations with MercadoPago."""

    def __init__(self):
        self.access_token = settings.MERCADOPAGO_ACCESS_TOKEN

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token)

    # ── Create subscription ──

    async def create_subscription(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        plan: str,
        payer_email: str,
    ) -> dict:
        """Create a MercadoPago preapproval (recurring subscription)."""
        # Get tenant
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant no encontrado")

        plan_config = get_plan_config(plan)

        if not self.is_configured:
            raise ValueError(
                "MercadoPago no configurado. "
                "Setear MERCADOPAGO_ACCESS_TOKEN en .env"
            )

        # Build preapproval request
        back_url = f"{settings.FRONTEND_URL}/billing"
        preapproval_data = {
            "reason": f"{plan_config.display_name} - {tenant.nombre}",
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": float(plan_config.price_ars),
                "currency_id": "ARS",
            },
            "back_url": back_url,
            "payer_email": payer_email,
            "external_reference": str(tenant_id),
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MP_API_BASE}/preapproval",
                json=preapproval_data,
                headers=self._headers,
            )

        if resp.status_code not in (200, 201):
            logger.error("MP preapproval error: %s %s", resp.status_code, resp.text)
            raise ValueError(f"Error al crear suscripcion en MercadoPago: {resp.text}")

        mp_data = resp.json()

        # Create or update subscription record
        sub = Subscription(
            tenant_id=tenant_id,
            plan=plan,
            status=SubscriptionStatus.ACTIVE,
            mp_preapproval_id=mp_data["id"],
            mp_payer_email=payer_email,
            amount=plan_config.price_ars,
            currency="ARS",
            current_period_start=datetime.now(timezone.utc),
            current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(sub)

        # Update tenant plan
        tenant.plan = PlanTier(plan)
        tenant.max_usuarios = str(plan_config.max_usuarios) if plan_config.max_usuarios < UNLIMITED else "unlimited"
        tenant.max_items = str(plan_config.max_items) if plan_config.max_items < UNLIMITED else "unlimited"

        await db.commit()

        return {
            "subscription_id": sub.id,
            "mp_init_point": mp_data.get("init_point", ""),
            "plan": plan,
            "amount": float(plan_config.price_ars),
        }

    # ── Cancel subscription ──

    async def cancel_subscription(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> dict:
        """Cancel the active subscription for a tenant."""
        result = await db.execute(
            select(Subscription)
            .where(
                Subscription.tenant_id == tenant_id,
                Subscription.status.in_([
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.TRIAL,
                ]),
            )
            .order_by(Subscription.created_at.desc())
        )
        sub = result.scalar_one_or_none()

        if not sub:
            raise ValueError("No hay suscripcion activa")

        # Cancel in MercadoPago if we have an ID
        if sub.mp_preapproval_id and self.is_configured:
            async with httpx.AsyncClient() as client:
                resp = await client.put(
                    f"{MP_API_BASE}/preapproval/{sub.mp_preapproval_id}",
                    json={"status": "cancelled"},
                    headers=self._headers,
                )
                if resp.status_code not in (200, 201):
                    logger.warning("MP cancel warning: %s", resp.text)

        sub.status = SubscriptionStatus.CANCELLED
        sub.cancelled_at = datetime.now(timezone.utc)

        # Downgrade tenant to trial/expired
        tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            tenant.plan = PlanTier.TRIAL

        await db.commit()

        return {"message": "Suscripcion cancelada", "status": "cancelled"}

    # ── Process webhook ──

    async def process_webhook(
        self,
        db: AsyncSession,
        notification_type: str,
        data_id: str,
    ) -> None:
        """Process MercadoPago webhook notification."""
        if notification_type == "payment":
            await self._process_payment_notification(db, data_id)
        elif notification_type == "subscription_preapproval":
            await self._process_preapproval_notification(db, data_id)
        else:
            logger.info("Ignored webhook type: %s", notification_type)

    async def _process_payment_notification(
        self,
        db: AsyncSession,
        payment_id: str,
    ) -> None:
        """Fetch payment from MP and record it."""
        if not self.is_configured:
            return

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MP_API_BASE}/v1/payments/{payment_id}",
                headers=self._headers,
            )

        if resp.status_code != 200:
            logger.error("MP payment fetch error: %s", resp.text)
            return

        payment_data = resp.json()
        external_ref = payment_data.get("external_reference")

        if not external_ref:
            return

        # Find subscription by tenant
        try:
            tenant_id = UUID(external_ref)
        except (ValueError, TypeError):
            logger.warning("Invalid external_reference: %s", external_ref)
            return

        result = await db.execute(
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id)
            .order_by(Subscription.created_at.desc())
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return

        # Map MP status
        mp_status = payment_data.get("status", "")
        status_map = {
            "approved": PaymentStatus.APPROVED,
            "pending": PaymentStatus.PENDING,
            "rejected": PaymentStatus.REJECTED,
            "refunded": PaymentStatus.REFUNDED,
        }

        record = PaymentRecord(
            subscription_id=sub.id,
            tenant_id=tenant_id,
            mp_payment_id=str(payment_id),
            amount=payment_data.get("transaction_amount", 0),
            currency=payment_data.get("currency_id", "ARS"),
            status=status_map.get(mp_status, PaymentStatus.PENDING),
            description=payment_data.get("description", ""),
            mp_response=payment_data,
            paid_at=datetime.now(timezone.utc) if mp_status == "approved" else None,
        )
        db.add(record)

        # If payment approved, ensure subscription stays active + notify
        if mp_status == "approved":
            sub.status = SubscriptionStatus.ACTIVE
            sub.current_period_start = datetime.now(timezone.utc)
            sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)

            # Send confirmation email to admin user
            admin_result = await db.execute(
                select(PlatformUser)
                .where(PlatformUser.tenant_id == tenant_id, PlatformUser.activo == True)
                .order_by(PlatformUser.created_at.asc())
            )
            admin = admin_result.scalars().first()
            if admin:
                await send_subscription_confirmed(
                    to=admin.email,
                    nombre=admin.nombre or admin.username,
                    plan_name=sub.plan,
                    amount=f"${record.amount:,.0f} {record.currency}",
                )

        # If rejected, mark as past_due
        elif mp_status == "rejected":
            sub.status = SubscriptionStatus.PAST_DUE

        await db.commit()

    async def _process_preapproval_notification(
        self,
        db: AsyncSession,
        preapproval_id: str,
    ) -> None:
        """Handle preapproval status changes."""
        if not self.is_configured:
            return

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MP_API_BASE}/preapproval/{preapproval_id}",
                headers=self._headers,
            )

        if resp.status_code != 200:
            return

        mp_data = resp.json()
        mp_status = mp_data.get("status", "")

        result = await db.execute(
            select(Subscription)
            .where(Subscription.mp_preapproval_id == preapproval_id)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return

        # Map preapproval status
        if mp_status == "authorized":
            sub.status = SubscriptionStatus.ACTIVE
        elif mp_status == "paused":
            sub.status = SubscriptionStatus.PAST_DUE
        elif mp_status in ("cancelled", "pending"):
            sub.status = SubscriptionStatus.CANCELLED

        await db.commit()

    # ── Usage tracking ──

    async def get_usage(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> dict:
        """Get current usage for a tenant."""
        # Count active users
        user_count_result = await db.execute(
            select(func.count(PlatformUser.id))
            .where(PlatformUser.tenant_id == tenant_id, PlatformUser.activo == True)
        )
        user_count = user_count_result.scalar() or 0

        # Count vehículos
        from app.verticals.autos.models.unidad import Unidad
        count_result = await db.execute(
            select(func.count(Unidad.id))
            .where(Unidad.tenant_id == tenant_id)
        )
        item_count = count_result.scalar() or 0

        return {
            "usuarios_activos": user_count,
            "items_count": item_count,
            "items_label": "vehiculos",
        }

    # ── Check trial expiry ──

    async def check_trial_status(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> dict:
        """Check if a tenant's trial has expired."""
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            return {"expired": True}

        if tenant.plan != PlanTier.TRIAL:
            return {"expired": False, "plan": tenant.plan.value}

        if tenant.trial_ends_at and tenant.trial_ends_at < datetime.now(timezone.utc):
            return {
                "expired": True,
                "trial_ended_at": tenant.trial_ends_at.isoformat(),
            }

        return {
            "expired": False,
            "plan": "trial",
            "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        }


# Singleton
billing_service = BillingService()
