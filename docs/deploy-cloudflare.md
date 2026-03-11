# Deploy con Cloudflare (DNS + SSL + CDN)

## Paso 1: Registrar dominio

Comprar dominio en Namecheap, Google Domains, NIC.ar, o cualquier registrador.
Ejemplo: `alfredo.app` o `gestionaautos.com`

## Paso 2: Crear cuenta en Cloudflare (gratis)

1. Ir a [cloudflare.com](https://cloudflare.com) → Create Account
2. Add Site → ingresar tu dominio
3. Elegir plan **Free**
4. Cloudflare te dará 2 nameservers (ej: `ada.ns.cloudflare.com`)
5. En tu registrador de dominio, cambiar los nameservers a los de Cloudflare
6. Esperar propagación DNS (~5-30 min)

## Paso 3: Configurar DNS records

En el dashboard de Cloudflare → DNS → Records:

| Tipo | Nombre | Contenido | Proxy |
|------|--------|-----------|-------|
| A    | @      | IP_DE_TU_SERVIDOR | ☁️ Proxied |
| A    | www    | IP_DE_TU_SERVIDOR | ☁️ Proxied |

> **IMPORTANTE**: El ícono naranja (☁️ Proxied) activa SSL + CDN + DDoS protection.

## Paso 4: Configurar SSL

En Cloudflare → SSL/TLS:
- Mode: **Full (strict)** — cifra tanto browser→CF como CF→servidor
- Edge Certificates: activar **Always Use HTTPS**
- Activar **HSTS** (Header Strict-Transport-Security)
- Activar **Automatic HTTPS Rewrites**

## Paso 5: Configurar Caché

En Cloudflare → Caching:
- Browser Cache TTL: **Respect Existing Headers** (nginx ya configura esto)
- Always Online: **On** (sirve caché si tu servidor se cae)

## Paso 6: Variables de entorno en producción

Actualizar `.env` del servidor:

```bash
# Dominio
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
FRONTEND_URL=https://tudominio.com

# Email (dominio verificado en Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Alfredo <no-reply@tudominio.com>
```

## Paso 7: Verificar dominio en Resend

1. Ir a [resend.com/domains](https://resend.com/domains)
2. Add Domain → ingresar tu dominio
3. Agregar los registros DNS que Resend te da:
   - **TXT** record para SPF
   - **CNAME** records para DKIM
   - **TXT** record para DMARC (opcional pero recomendado)
4. Verificar en Resend → esperar propagación

## Paso 8: Deploy

```bash
# En tu servidor
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Verificar
curl -I https://tudominio.com
# Debería mostrar: HTTP/2 200, cf-ray header
```

## Checklist post-deploy

- [ ] `https://tudominio.com` carga la app
- [ ] `https://tudominio.com/api/v1/auth/login` retorna 422 (sin body = esperado)
- [ ] `https://tudominio.com/health` retorna `{"status": "ok"}`
- [ ] SSL Labs test A+ → https://www.ssllabs.com/ssltest/
- [ ] Email de password reset llega correctamente
- [ ] PWA se puede instalar desde Chrome mobile

## Costos

| Servicio | Costo |
|----------|-------|
| Cloudflare Free | $0/mes |
| Resend Free | $0/mes (hasta 3,000 emails) |
| Dominio .com | ~$12/año |
| VPS (mínimo) | ~$5-10/mes (DigitalOcean, Hetzner, Contabo) |
