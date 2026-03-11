"""
Servicio de email transaccional (Resend).

Provider-agnostic interface: si en el futuro migrás a SES/SendGrid,
solo cambiás la implementación de _send(), el resto queda igual.
"""
import logging
from typing import Optional

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Resend SDK init ──
_initialized = False


def _ensure_init():
    global _initialized
    if not _initialized and settings.RESEND_API_KEY:
        resend.api_key = settings.RESEND_API_KEY
        _initialized = True


async def _send(
    to: str,
    subject: str,
    html: str,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Enviar un email vía Resend.
    Retorna True si se envió, False si falló (no lanza excepción).
    En desarrollo sin API key, loguea en consola.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not set — email NOT sent. to=%s subject=%s", to, subject
        )
        if settings.DEBUG:
            logger.info("Email preview:\n  To: %s\n  Subject: %s\n  Body: %s", to, subject, html[:200])
        return False

    _ensure_init()

    try:
        params = {
            "from_": settings.EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            params["reply_to"] = reply_to

        resend.Emails.send(params)
        logger.info("Email sent: to=%s subject=%s", to, subject)
        return True
    except Exception as exc:
        logger.error("Email send failed: to=%s error=%s", to, str(exc))
        return False


# ── Template helpers ──

def _base_layout(content: str) -> str:
    """Wrapper HTML con estilo consistente para todos los emails."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:#2563eb;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">Alfredo</h1>
        </div>
        <div style="padding:32px;">
          {content}
        </div>
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            Alfredo — Gestión de Automotores<br>
            Este email fue enviado automáticamente, no respondas a este mensaje.
          </p>
        </div>
      </div>
    </body>
    </html>
    """


# ── Public email functions ──

async def send_welcome(
    to: str,
    nombre: str,
    nombre_agencia: str,
    trial_days: int,
) -> bool:
    """Email de bienvenida al registrarse (onboarding)."""
    html = _base_layout(f"""
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">¡Bienvenido a Alfredo, {nombre}!</h2>
        <p style="color:#4b5563;line-height:1.6;">
          Tu agencia <strong>{nombre_agencia}</strong> ya está activa.
          Tenés <strong>{trial_days} días de prueba gratuita</strong> con acceso completo a todas las funcionalidades.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/login"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ingresar a Alfredo
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px;">
          Si tenés dudas, respondé a este email o contactanos por WhatsApp.
        </p>
    """)
    return await _send(to, f"¡Bienvenido a Alfredo, {nombre}!", html)


async def send_password_reset(
    to: str,
    reset_token: str,
) -> bool:
    """Email con link para resetear password."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    html = _base_layout(f"""
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Restablecer contraseña</h2>
        <p style="color:#4b5563;line-height:1.6;">
          Recibimos una solicitud para restablecer tu contraseña.
          Si no la pediste vos, ignorá este email.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="{reset_url}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Restablecer contraseña
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px;">
          Este link expira en 1 hora. Si no funciona, copiá y pegá esta URL en tu navegador:
        </p>
        <p style="color:#6b7280;font-size:12px;word-break:break-all;">{reset_url}</p>
    """)
    return await _send(to, "Restablecer contraseña — Alfredo", html)


async def send_subscription_confirmed(
    to: str,
    nombre: str,
    plan_name: str,
    amount: str,
) -> bool:
    """Email de confirmación de suscripción/pago."""
    html = _base_layout(f"""
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">¡Suscripción activada!</h2>
        <p style="color:#4b5563;line-height:1.6;">
          Hola {nombre}, tu plan <strong>{plan_name}</strong> está activo.
        </p>
        <div style="margin:20px 0;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
          <p style="margin:0;color:#166534;font-size:14px;">
            ✅ Plan: <strong>{plan_name}</strong><br>
            💰 Monto: <strong>{amount}</strong>/mes
          </p>
        </div>
        <p style="color:#6b7280;font-size:14px;">
          Tu factura estará disponible en la sección de facturación dentro de Alfredo.
        </p>
    """)
    return await _send(to, f"Suscripción {plan_name} activada — Alfredo", html)


async def send_trial_expiring(
    to: str,
    nombre: str,
    days_left: int,
) -> bool:
    """Aviso de que el trial está por vencer."""
    html = _base_layout(f"""
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Tu prueba gratuita vence pronto</h2>
        <p style="color:#4b5563;line-height:1.6;">
          Hola {nombre}, te quedan <strong>{days_left} días</strong> de prueba gratuita.
          Para seguir usando Alfredo sin interrupciones, elegí un plan.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/billing"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver planes
          </a>
        </div>
    """)
    return await _send(to, f"Tu prueba gratuita vence en {days_left} días — Alfredo", html)
