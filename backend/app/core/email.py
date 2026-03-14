"""
Servicio de email transaccional (Resend).

Provider-agnostic interface: si en el futuro migrás a SES/SendGrid,
solo cambiás la implementación de _send(), el resto queda igual.
"""
from __future__ import annotations

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
    if days_left <= 0:
        titulo = "Tu prueba gratuita venció hoy"
        subtitulo = "Tu periodo de prueba ha finalizado."
        subject = "Tu prueba gratuita venció — Alfredo"
    else:
        titulo = "Tu prueba gratuita vence pronto"
        subtitulo = f"Te quedan <strong>{days_left} días</strong> de prueba gratuita."
        subject = f"Tu prueba gratuita vence en {days_left} días — Alfredo"

    html = _base_layout(f"""
        <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">{titulo}</h2>
        <p style="color:#4b5563;line-height:1.6;">
          Hola {nombre}, {subtitulo}
          Para seguir usando Alfredo sin interrupciones, elegí un plan.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/billing"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver planes
          </a>
        </div>
    """)
    return await _send(to, subject, html)


# ── Digest emails (scheduled jobs) ──

async def send_stock_inmovilizado_digest(
    to: str,
    nombre: str,
    nombre_agencia: str,
    unidades: list[dict],
    threshold_days: int,
) -> bool:
    """Digest diario de unidades con stock inmovilizado."""
    filas = ""
    for u in unidades:
        precio = f"${u['precio_publicado']:,.0f}" if u.get("precio_publicado") else "—"
        color_dias = "#dc2626" if u["dias_en_stock"] > 90 else "#d97706"
        filas += f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{u['descripcion']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{u['dominio']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:{color_dias};font-weight:600;">{u['dias_en_stock']} días</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{precio}</td>
        </tr>"""

    html = _base_layout(f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Stock inmovilizado — {nombre_agencia}</h2>
        <p style="color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Hola {nombre}, hay <strong>{len(unidades)} unidad(es)</strong> con más de
          <strong>{threshold_days} días</strong> en stock sin venderse:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;color:#6b7280;">Vehículo</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;color:#6b7280;">Dominio</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;color:#6b7280;">Días</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;color:#6b7280;">Precio</th>
            </tr>
          </thead>
          <tbody>{filas}</tbody>
        </table>
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/unidades"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver stock completo
          </a>
        </div>
    """)
    return await _send(
        to,
        f"{len(unidades)} unidades inmovilizadas (>{threshold_days} días) — Alfredo",
        html,
    )


async def send_cheques_digest(
    to: str,
    nombre: str,
    nombre_agencia: str,
    cheques_recibidos: list[dict],
    cheques_emitidos: list[dict],
) -> bool:
    """Digest diario de cheques por vencer (recibidos y emitidos)."""
    secciones = ""

    if cheques_recibidos:
        filas = ""
        for c in cheques_recibidos:
            badge = f'<span style="color:#dc2626;font-weight:600;">HOY</span>' if c["dias"] == 0 else f'{c["dias"]}d'
            filas += f"""
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{c['banco']} #{c['numero']}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${c['monto']:,.0f}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{c['emisor']}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{badge}</td>
            </tr>"""
        secciones += f"""
        <h3 style="margin:20px 0 8px;color:#059669;font-size:16px;">Cheques a cobrar ({len(cheques_recibidos)})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f0fdf4;">
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Cheque</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Monto</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Emisor</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Vence</th>
          </tr></thead>
          <tbody>{filas}</tbody>
        </table>"""

    if cheques_emitidos:
        filas = ""
        for c in cheques_emitidos:
            badge = f'<span style="color:#dc2626;font-weight:600;">HOY</span>' if c["dias"] == 0 else f'{c["dias"]}d'
            filas += f"""
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{c['banco']} #{c['numero']}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${c['monto']:,.0f}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{c['beneficiario']}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">{badge}</td>
            </tr>"""
        secciones += f"""
        <h3 style="margin:20px 0 8px;color:#dc2626;font-size:16px;">Cheques a pagar ({len(cheques_emitidos)})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#fef2f2;">
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Cheque</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Monto</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Beneficiario</th>
            <th style="padding:6px 10px;text-align:left;color:#6b7280;">Debita</th>
          </tr></thead>
          <tbody>{filas}</tbody>
        </table>"""

    total = len(cheques_recibidos) + len(cheques_emitidos)
    html = _base_layout(f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Cheques por vencer — {nombre_agencia}</h2>
        <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
          Hola {nombre}, hay <strong>{total} cheque(s)</strong> que vencen en los próximos 3 días:
        </p>
        {secciones}
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/cheques"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver cheques
          </a>
        </div>
    """)
    return await _send(to, f"{total} cheques por vencer — Alfredo", html)


async def send_documentacion_digest(
    to: str,
    nombre: str,
    nombre_agencia: str,
    docs_pendientes: list[dict],
    vtv_alertas: list[dict],
) -> bool:
    """Digest semanal de documentación pendiente y VTV por vencer."""
    secciones = ""

    if docs_pendientes:
        items_html = ""
        for d in docs_pendientes:
            pendientes = ", ".join(d["items"]) if d["items"] else "Documentación incompleta"
            items_html += f"""
            <div style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <strong style="color:#111827;">{d['unidad']}</strong>
              <div style="color:#d97706;font-size:13px;margin-top:2px;">Falta: {pendientes}</div>
            </div>"""
        secciones += f"""
        <h3 style="margin:20px 0 8px;color:#d97706;font-size:16px;">Documentación pendiente ({len(docs_pendientes)})</h3>
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">{items_html}</div>"""

    if vtv_alertas:
        items_html = ""
        for v in vtv_alertas:
            if v["vencida"]:
                estado = f'<span style="color:#dc2626;font-weight:600;">VENCIDA ({abs(v["dias"])}d)</span>'
            else:
                estado = f'Vence en {v["dias"]} días ({v["fecha_vtv"]})'
            items_html += f"""
            <div style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
              <strong style="color:#111827;">{v['unidad']}</strong>
              <div style="font-size:13px;margin-top:2px;">{estado}</div>
            </div>"""
        secciones += f"""
        <h3 style="margin:20px 0 8px;color:#dc2626;font-size:16px;">VTV por vencer ({len(vtv_alertas)})</h3>
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">{items_html}</div>"""

    total = len(docs_pendientes) + len(vtv_alertas)
    html = _base_layout(f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Documentación y VTV — {nombre_agencia}</h2>
        <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
          Hola {nombre}, resumen semanal con <strong>{total} alerta(s)</strong>:
        </p>
        {secciones}
        <div style="margin:24px 0;text-align:center;">
          <a href="{settings.FRONTEND_URL}/unidades"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
            Ver unidades
          </a>
        </div>
    """)
    return await _send(to, f"Documentación y VTV — Resumen semanal — Alfredo", html)
