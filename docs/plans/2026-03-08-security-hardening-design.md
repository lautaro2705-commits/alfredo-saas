# Security Hardening — Alfredo

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Enfoque:** Middleware Stack centralizado

## Contexto

Alfredo es un SaaS multi-tenant para agencias de autos. Antes del launch necesitamos
máxima seguridad. La auditoría identificó estos gaps críticos:

- Rate limiting definido pero **no aplicado** a ninguna ruta
- Cero security headers (CSP, HSTS, X-Frame-Options)
- Password sin reglas de complejidad (solo min 8 chars)
- Sin tracking de login fallidos ni lockout
- Sin audit logging de requests/eventos de seguridad
- File uploads sin validación server-side de magic bytes

**Lo que ya funciona bien:** RLS en PostgreSQL, JWT con bcrypt, RBAC con 30+ permisos,
Pydantic validation, UUID-validated tenant context, secrets en env vars.

## Arquitectura

Middleware Stack — toda request pasa por el stack completo en orden.
Nuevo endpoint = ya protegido automáticamente.

```
Request → SecurityHeaders → RateLimiter → FailedLoginTracker → AuditLogger → TenantIsolation → Handler
```

Whitelist: `/health`, `/docs`, `/redoc`, `/openapi.json` solo pasan por SecurityHeaders.

## Componentes

### 1. SecurityHeaders Middleware

**Archivo:** `core/middleware/security_headers.py`

Agrega a toda response:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Sin estado, sin Redis. Solo headers.

### 2. RateLimiter Middleware (reescritura)

**Archivo:** `core/middleware/rate_limiting.py` (reemplaza el actual)

Tres niveles, todos Redis-backed con token bucket:

| Nivel    | Límite          | Aplica a                                   |
|----------|-----------------|-------------------------------------------|
| Global   | 100 req/min/IP  | Todas las rutas                            |
| Auth     | 5 req/min/IP    | `/login`, `/onboarding`, `/password-reset` |
| Upload   | 10 req/min/tenant | `/archivos/upload*`                      |

Respuesta al exceder: `429 Too Many Requests` con header `Retry-After`.
Key Redis: `rl:{nivel}:{identificador}` con TTL automático.

### 3. FailedLoginTracker

**Archivo:** `core/middleware/failed_login_tracker.py`

Trackea intentos fallidos de login (no requests totales):

- Key Redis: `failed_login:{ip}:{sha256(email)}`
- 5 intentos fallidos → lockout 15 minutos
- Login exitoso → reset contador
- Consulta ANTES de verificar credenciales
- Email hasheado en key (no PII en Redis)

### 4. AuditLogger Middleware

**Archivo:** `core/middleware/audit_logger.py`

Log estructurado JSON para toda request:

```json
{
  "timestamp": "ISO-8601",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/v1/autos/clientes/",
  "ip": "190.x.x.x",
  "user_id": "uuid-or-null",
  "tenant_id": "uuid-or-null",
  "status_code": 201,
  "duration_ms": 45,
  "user_agent": "Mozilla/5.0..."
}
```

Eventos de seguridad (login fallido, lockout, rate limit) agregan campo `security_event`.
No almacena body de request/response (privacy).

### 5. PasswordValidator

**Archivo:** `core/security/password_validator.py`

Reglas para passwords nuevos:

- Mínimo 12 caracteres
- Al menos 1 mayúscula
- Al menos 1 dígito
- Al menos 1 carácter especial
- No puede ser igual al email
- Retorna lista de errores específicos

Se integra como validador Pydantic en `OnboardingRequest` y `PasswordChangeRequest`.

### 6. FileValidator

**Archivo:** `core/security/file_validator.py`

Validación server-side por magic bytes:

| Tipo declarado    | Magic bytes esperados       |
|-------------------|-----------------------------|
| `image/jpeg`      | `FF D8 FF`                  |
| `image/png`       | `89 50 4E 47`               |
| `image/gif`       | `47 49 46 38`               |
| `image/webp`      | `52 49 46 46...57 45 42 50` |
| `application/pdf` | `25 50 44 46`               |

MIME type del cliente debe coincidir con magic bytes reales.
Mismatch → `400 Bad Request`.

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `main.py` | Registrar middleware stack en orden |
| `auth.py` | Integrar PasswordValidator + FailedLoginTracker |
| `archivos.py` | Integrar FileValidator en uploads |

## Testing

Cada componente tiene su propio test file:

- `test_security_headers.py` — verificar headers presentes en responses
- `test_rate_limiting.py` — verificar 429 al exceder límites
- `test_failed_login_tracker.py` — verificar lockout tras 5 fallos
- `test_audit_logger.py` — verificar logs estructurados emitidos
- `test_password_validator.py` — verificar reglas de complejidad
- `test_file_validator.py` — verificar rechazo de MIME spoofing

## Decisiones de diseño

1. **Middleware Stack vs Dependency Injection**: Middleware garantiza que todo endpoint
   nuevo está protegido sin acción del dev. Con dependencies es fácil olvidarse.

2. **FailedLoginTracker separado de RateLimiter**: Rate limiter cuenta requests totales
   (legítimas + maliciosas). FailedLoginTracker solo cuenta intentos FALLIDOS. Un usuario
   legítimo que hace login correcto a la primera nunca se bloquea por rate limit de auth.

3. **Email hasheado en Redis keys**: Evita almacenar PII. SHA-256 del email es suficiente
   para identificar el par IP+email sin exposición.

4. **No request/response body en audit logs**: Privacy by design. Solo metadata
   (path, status, duration, user_id). Suficiente para investigar incidentes.

5. **Magic bytes, no antivirus**: ClamAV requiere infra adicional. Magic bytes cubre
   el 90% del riesgo (MIME spoofing) sin dependencias externas.
