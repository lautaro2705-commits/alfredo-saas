from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user_with_tenant, TokenContext
from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
from app.verticals.autos.models.archivo import ArchivoUnidad, TipoDocumentoArchivo

router = APIRouter(prefix="/autos/marketing", tags=["autos-marketing"])


def format_currency(value: float) -> str:
    """Formatear valor como moneda argentina"""
    if not value:
        return "Consultar"
    return f"${value:,.0f}".replace(",", ".")


def format_km(value: int) -> str:
    """Formatear kilometraje"""
    if not value:
        return "0 km"
    return f"{value:,} km".replace(",", ".")


@router.get("/ficha-venta/{unidad_id}")
async def generar_ficha_venta(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Generar datos para ficha de venta compartible.
    Retorna JSON con toda la informacion formateada.
    """
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Obtener fotos de la unidad
    result = await db.execute(
        select(ArchivoUnidad).where(
            ArchivoUnidad.unidad_id == unidad_id,
            ArchivoUnidad.tipo_documento.in_([
                TipoDocumentoArchivo.FOTO_FRENTE,
                TipoDocumentoArchivo.FOTO_LATERAL,
                TipoDocumentoArchivo.FOTO_INTERIOR,
                TipoDocumentoArchivo.FOTO_MOTOR
            ])
        )
    )
    fotos = result.scalars().all()

    # Construir especificaciones
    specs = []
    if unidad.anio:
        specs.append(f"Año {unidad.anio}")
    if unidad.kilometraje is not None:
        specs.append(format_km(unidad.kilometraje))
    if unidad.combustible:
        specs.append(unidad.combustible)
    if unidad.transmision:
        specs.append(unidad.transmision)
    if unidad.color:
        specs.append(f"Color {unidad.color}")

    return {
        "unidad": {
            "id": unidad.id,
            "titulo": f"{unidad.marca} {unidad.modelo}",
            "subtitulo": unidad.version or "",
            "anio": unidad.anio,
            "precio": format_currency(unidad.precio_publicado),
            "precio_valor": unidad.precio_publicado,
            "specs": specs,
            "specs_texto": " | ".join(specs),
            "dominio": unidad.dominio,
            "kilometraje": format_km(unidad.kilometraje) if unidad.kilometraje else None,
            "combustible": unidad.combustible,
            "transmision": unidad.transmision,
            "color": unidad.color,
            "ubicacion": unidad.ubicacion or "Consultar",
            "observaciones": unidad.observaciones
        },
        "fotos": [
            {
                "id": f.id,
                "tipo": f.tipo_documento.value,
                "url": f"/api/v1/archivos/{f.id}/download"
            }
            for f in fotos
        ],
        "whatsapp_texto": generar_texto_whatsapp(unidad),
        "instagram_caption": generar_caption_instagram(unidad)
    }


def generar_texto_whatsapp(unidad: Unidad) -> str:
    """Generar texto optimizado para WhatsApp"""
    lines = [
        f"🚗 *{unidad.marca} {unidad.modelo}*",
        f"📅 Año {unidad.anio}",
    ]

    if unidad.kilometraje is not None:
        lines.append(f"📍 {format_km(unidad.kilometraje)}")

    if unidad.combustible:
        lines.append(f"⛽ {unidad.combustible}")

    if unidad.transmision:
        lines.append(f"🔧 {unidad.transmision}")

    if unidad.color:
        lines.append(f"🎨 {unidad.color}")

    lines.append("")
    lines.append(f"💰 *{format_currency(unidad.precio_publicado)}*")
    lines.append("")
    lines.append("📲 Consultanos por más info!")

    return "\n".join(lines)


def generar_caption_instagram(unidad: Unidad) -> str:
    """Generar caption optimizado para Instagram"""
    specs = []
    if unidad.anio:
        specs.append(str(unidad.anio))
    if unidad.kilometraje is not None:
        specs.append(format_km(unidad.kilometraje))
    if unidad.combustible:
        specs.append(unidad.combustible)

    caption = f"🚗 {unidad.marca} {unidad.modelo}"
    if unidad.version:
        caption += f" {unidad.version}"

    caption += f"\n\n📋 {' • '.join(specs)}"
    caption += f"\n\n💰 {format_currency(unidad.precio_publicado)}"
    caption += "\n\n📲 Link en bio para más info"
    caption += "\n\n#autos #autosusados #"
    caption += unidad.marca.lower().replace(" ", "")
    caption += f" #{unidad.modelo.lower().replace(' ', '')}"
    caption += " #venta #oportunidad"

    return caption


@router.get("/ficha-venta/{unidad_id}/html", response_class=HTMLResponse)
async def generar_ficha_venta_html(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Generar ficha de venta como HTML para compartir o imprimir.
    Vista limpia y diseñada para compartir.
    """
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    # Obtener foto principal
    result = await db.execute(
        select(ArchivoUnidad).where(
            ArchivoUnidad.unidad_id == unidad_id,
            ArchivoUnidad.tipo_documento == TipoDocumentoArchivo.FOTO_FRENTE
        )
    )
    foto = result.scalar_one_or_none()

    foto_url = f"/api/v1/archivos/{foto.id}/download" if foto else ""

    specs_html = ""
    if unidad.kilometraje is not None:
        specs_html += f'<div class="spec"><span>📍</span> {format_km(unidad.kilometraje)}</div>'
    if unidad.combustible:
        specs_html += f'<div class="spec"><span>⛽</span> {unidad.combustible}</div>'
    if unidad.transmision:
        specs_html += f'<div class="spec"><span>🔧</span> {unidad.transmision}</div>'
    if unidad.color:
        specs_html += f'<div class="spec"><span>🎨</span> {unidad.color}</div>'

    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{unidad.marca} {unidad.modelo} - Ficha de Venta</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }}
            .card {{
                max-width: 400px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }}
            .photo {{
                width: 100%;
                height: 250px;
                background: #f0f0f0;
                background-image: url('{foto_url}');
                background-size: cover;
                background-position: center;
                position: relative;
            }}
            .badge {{
                position: absolute;
                top: 15px;
                right: 15px;
                background: #10b981;
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }}
            .content {{
                padding: 25px;
            }}
            .title {{
                font-size: 24px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 5px;
            }}
            .subtitle {{
                font-size: 14px;
                color: #6b7280;
                margin-bottom: 15px;
            }}
            .year {{
                display: inline-block;
                background: #e5e7eb;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 13px;
                color: #374151;
                margin-bottom: 15px;
            }}
            .specs {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            }}
            .spec {{
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: #4b5563;
            }}
            .spec span {{
                font-size: 16px;
            }}
            .price {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 12px;
                text-align: center;
                margin-bottom: 15px;
            }}
            .price-label {{
                font-size: 12px;
                opacity: 0.9;
                margin-bottom: 5px;
            }}
            .price-value {{
                font-size: 28px;
                font-weight: 700;
            }}
            .contact {{
                text-align: center;
                padding-top: 15px;
                border-top: 1px solid #e5e7eb;
            }}
            .contact-text {{
                font-size: 14px;
                color: #6b7280;
                margin-bottom: 10px;
            }}
            .whatsapp-btn {{
                display: inline-block;
                background: #25D366;
                color: white;
                padding: 12px 30px;
                border-radius: 25px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
            }}
            .footer {{
                text-align: center;
                padding: 15px;
                background: #f9fafb;
                font-size: 11px;
                color: #9ca3af;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="photo">
                <div class="badge">Disponible</div>
            </div>
            <div class="content">
                <h1 class="title">{unidad.marca} {unidad.modelo}</h1>
                <p class="subtitle">{unidad.version or ''}</p>
                <span class="year">Año {unidad.anio}</span>

                <div class="specs">
                    {specs_html}
                </div>

                <div class="price">
                    <div class="price-label">Precio</div>
                    <div class="price-value">{format_currency(unidad.precio_publicado)}</div>
                </div>

                <div class="contact">
                    <p class="contact-text">¿Te interesa? ¡Consultanos!</p>
                    <a href="#" class="whatsapp-btn">📲 WhatsApp</a>
                </div>
            </div>
            <div class="footer">
                Patente: {unidad.dominio}
            </div>
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html)


@router.get("/compartir/{unidad_id}")
async def datos_compartir(
    unidad_id: int,
    db: AsyncSession = Depends(get_db),
    token: TokenContext = Depends(get_current_user_with_tenant)
):
    """
    Obtener URLs y textos para compartir en diferentes plataformas.
    """
    result = await db.execute(select(Unidad).where(Unidad.id == unidad_id))
    unidad = result.scalar_one_or_none()
    if not unidad:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    texto_whatsapp = generar_texto_whatsapp(unidad)
    texto_instagram = generar_caption_instagram(unidad)

    # URL base (se deberia configurar en produccion)
    base_url = "https://tuagencia.com"

    return {
        "titulo": f"{unidad.marca} {unidad.modelo} {unidad.anio}",
        "precio": format_currency(unidad.precio_publicado),
        "whatsapp": {
            "texto": texto_whatsapp,
            "url_encoded": texto_whatsapp.replace("\n", "%0A").replace(" ", "%20")
        },
        "instagram": {
            "caption": texto_instagram
        },
        "facebook": {
            "texto": f"🚗 {unidad.marca} {unidad.modelo} {unidad.anio}\n💰 {format_currency(unidad.precio_publicado)}\n📲 Consultanos!"
        },
        "ficha_html_url": f"/api/v1/marketing/ficha-venta/{unidad_id}/html",
        "ficha_json_url": f"/api/v1/marketing/ficha-venta/{unidad_id}"
    }
