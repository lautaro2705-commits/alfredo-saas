# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 security layers to Alfredo's backend via a centralized middleware stack, making the platform production-ready against brute force, MIME spoofing, clickjacking, and weak passwords.

**Architecture:** Starlette middleware stack processes every request in order: SecurityHeaders → RateLimiter → AuditLogger. FailedLoginTracker integrates directly into the login endpoint. PasswordValidator is a Pydantic validator. FileValidator is a utility called from upload handlers.

**Tech Stack:** FastAPI/Starlette middleware, Redis (already available), Python `hashlib` for email hashing, `struct` for magic byte reading.

---

## Task 1: SecurityHeaders Middleware

**Files:**
- Create: `app/core/middleware/security_headers.py`
- Test: `tests/test_security_headers.py`
- Modify: `app/main.py` (add middleware registration)

**Step 1: Write the test file**

Create `tests/test_security_headers.py`:

```python
"""Tests for security headers middleware."""
import pytest
import httpx


class TestSecurityHeaders:
    """Every response must include hardening headers."""

    @pytest.mark.asyncio
    async def test_health_has_security_headers(self, client):
        """Even public endpoints get security headers."""
        resp = await client.get("/health")

        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert resp.headers["X-XSS-Protection"] == "1; mode=block"
        assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "max-age=" in resp.headers["Strict-Transport-Security"]
        assert "frame-ancestors" in resp.headers["Content-Security-Policy"]
        assert "camera=()" in resp.headers["Permissions-Policy"]

    @pytest.mark.asyncio
    async def test_api_endpoint_has_security_headers(self, client):
        """Authenticated endpoints also get headers (even on 401)."""
        resp = await client.get("/api/v1/auth/me")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"

    @pytest.mark.asyncio
    async def test_csp_blocks_framing(self, client):
        """CSP frame-ancestors prevents clickjacking."""
        resp = await client.get("/health")
        csp = resp.headers["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in csp

    @pytest.mark.asyncio
    async def test_hsts_includes_subdomains(self, client):
        """HSTS header enforces HTTPS on subdomains."""
        resp = await client.get("/health")
        hsts = resp.headers["Strict-Transport-Security"]
        assert "includeSubDomains" in hsts
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_security_headers.py -v`
Expected: FAIL — headers not present yet.

**Step 3: Implement the middleware**

Create `app/core/middleware/security_headers.py`:

```python
"""
Security headers middleware.
Adds OWASP-recommended headers to every HTTP response.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security headers into every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        return response
```

**Step 4: Register in main.py**

In `app/main.py`, after the CORS middleware block (after line 64), add:

```python
from app.core.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)
```

Important: Starlette processes middleware in **reverse registration order**. Register SecurityHeaders AFTER CORS so it runs BEFORE CORS (headers are added to the final response after CORS processes it). This means the final middleware stack is:

```
Request → SecurityHeaders → CORS → Handler → CORS → SecurityHeaders → Response
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_security_headers.py -v`
Expected: 4 PASSED

**Step 6: Run full test suite for regressions**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: 33 original + 4 new = 37 PASSED

**Step 7: Commit**

```bash
git add app/core/middleware/security_headers.py tests/test_security_headers.py app/main.py
git commit -m "feat(security): add SecurityHeaders middleware

Adds OWASP-recommended headers (HSTS, CSP, X-Frame-Options,
X-Content-Type-Options, X-XSS-Protection, Referrer-Policy,
Permissions-Policy) to every HTTP response."
```

---

## Task 2: PasswordValidator

**Files:**
- Create: `app/core/security/password_validator.py`
- Create: `tests/test_password_validator.py`
- Modify: `app/platform/schemas/auth.py` (integrate validator)

**Step 1: Write the test file**

Create `tests/test_password_validator.py`:

```python
"""Tests for password complexity validation."""
import pytest
from app.core.security.password_validator import validate_password_strength


class TestPasswordValidator:
    """Passwords must meet complexity requirements."""

    def test_valid_password(self):
        errors = validate_password_strength("MyStr0ng!Pass")
        assert errors == []

    def test_too_short(self):
        errors = validate_password_strength("Ab1!")
        assert any("12 caracteres" in e for e in errors)

    def test_no_uppercase(self):
        errors = validate_password_strength("mystr0ng!pass")
        assert any("mayúscula" in e for e in errors)

    def test_no_digit(self):
        errors = validate_password_strength("MyStrong!Pass")
        assert any("dígito" in e for e in errors)

    def test_no_special_char(self):
        errors = validate_password_strength("MyStr0ngPassw")
        assert any("especial" in e for e in errors)

    def test_equals_email(self):
        errors = validate_password_strength("MyStr0ng!Pass", email="MyStr0ng!Pass")
        assert any("email" in e for e in errors)

    def test_multiple_errors(self):
        errors = validate_password_strength("short")
        assert len(errors) >= 3  # too short + no uppercase + no digit + no special

    def test_exactly_12_chars_valid(self):
        errors = validate_password_strength("Abcdefghij1!")
        assert errors == []

    def test_all_special_chars_accepted(self):
        for char in "!@#$%^&*()_+-=[]{}|;:,.<>?":
            errors = validate_password_strength(f"MyStr0ngPass{char}")
            assert not any("especial" in e for e in errors)
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_password_validator.py -v`
Expected: FAIL — module not found.

**Step 3: Create the module directory**

```bash
mkdir -p app/core/security
touch app/core/security/__init__.py
```

**Step 4: Implement the validator**

Create `app/core/security/password_validator.py`:

```python
"""
Password complexity validator.
Returns a list of human-readable error messages (empty = valid).
"""
import re

SPECIAL_CHARS = r"[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/\\~`'\"]"
MIN_LENGTH = 12


def validate_password_strength(
    password: str, *, email: str | None = None
) -> list[str]:
    """Validate password complexity. Returns list of error messages."""
    errors: list[str] = []

    if len(password) < MIN_LENGTH:
        errors.append(f"La contraseña debe tener al menos {MIN_LENGTH} caracteres.")

    if not re.search(r"[A-Z]", password):
        errors.append("La contraseña debe contener al menos una letra mayúscula.")

    if not re.search(r"\d", password):
        errors.append("La contraseña debe contener al menos un dígito.")

    if not re.search(SPECIAL_CHARS, password):
        errors.append(
            "La contraseña debe contener al menos un carácter especial "
            "(!@#$%^&*()_+-=[]{}|;:,.<>?)."
        )

    if email and password == email:
        errors.append("La contraseña no puede ser igual al email.")

    return errors
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_password_validator.py -v`
Expected: 9 PASSED

**Step 6: Integrate into Pydantic schemas**

Modify `app/platform/schemas/auth.py`. Add this import at the top (after line 5):

```python
from app.core.security.password_validator import validate_password_strength
```

Replace the `OnboardingRequest` class (lines 25-37) with:

```python
class OnboardingRequest(BaseModel):
    """Una nueva agencia de autos se registra en Alfredo."""
    # Datos del tenant
    nombre_agencia: str = Field(..., min_length=2, max_length=255)
    email_contacto: EmailStr
    telefono: Optional[str] = None
    cuit: Optional[str] = None

    # Datos del admin (primer usuario)
    admin_nombre: str = Field(..., min_length=2, max_length=100)
    admin_apellido: str = Field(..., min_length=2, max_length=100)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=12)

    @field_validator("admin_password")
    @classmethod
    def password_strength(cls, v, info):
        email = info.data.get("admin_email")
        errors = validate_password_strength(v, email=email)
        if errors:
            raise ValueError("; ".join(errors))
        return v
```

Add `field_validator` to the pydantic import on line 5:

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
```

Also update `PasswordResetConfirm` (lines 74-76):

```python
class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=12)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v
```

And update `PasswordChangeRequest` (lines 79-81):

```python
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=12)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v
```

**Step 7: Write integration test for onboarding rejection**

Add to `tests/test_password_validator.py`:

```python
class TestPasswordValidatorIntegration:
    """Onboarding rejects weak passwords."""

    @pytest.mark.asyncio
    async def test_onboarding_rejects_weak_password(self, client):
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": "Test Agency",
            "email_contacto": "contact@test.com",
            "admin_nombre": "Test",
            "admin_apellido": "User",
            "admin_email": "weak@test.com",
            "admin_password": "short",
        })
        assert resp.status_code == 422
        assert "12 caracteres" in resp.text

    @pytest.mark.asyncio
    async def test_onboarding_accepts_strong_password(self, client):
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": "Str0ng Agency",
            "email_contacto": "contact@strong.com",
            "admin_nombre": "Test",
            "admin_apellido": "User",
            "admin_email": f"strong-pwd-test@test.com",
            "admin_password": "MyStr0ng!Password",
        })
        # 200 = created successfully (might be 409 if email exists, but not 422)
        assert resp.status_code != 422
```

**Step 8: Fix existing tests that use weak passwords**

Check existing tests for passwords shorter than 12 chars. The conftest.py uses `get_password_hash()` directly (bypasses Pydantic validation), so conftest fixtures should be fine. But `test_auth.py` might POST onboarding/password-change with short passwords — those will need updating to use 12+ char passwords with complexity.

Search for: any test that posts to `/onboarding`, `/password-reset/confirm`, or `/password-change` with passwords less than 12 chars, and update them.

Common fix: Replace `"password123"` with `"Password123!"` (or similar) in test payloads.

**Step 9: Run full test suite**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: All tests PASS (previous + 11 new)

**Step 10: Commit**

```bash
git add app/core/security/ tests/test_password_validator.py app/platform/schemas/auth.py
git commit -m "feat(security): add PasswordValidator with complexity rules

Requires min 12 chars, uppercase, digit, special char.
Integrated into OnboardingRequest, PasswordResetConfirm,
and PasswordChangeRequest via Pydantic field_validator."
```

---

## Task 3: RateLimiter Middleware (rewrite)

**Files:**
- Rewrite: `app/core/middleware/rate_limiting.py`
- Create: `tests/test_rate_limiting.py`
- Modify: `app/main.py` (register middleware)
- Modify: `app/core/config.py` (add auth rate limit settings)

**Step 1: Add config settings**

In `app/core/config.py`, after line 55 (`RATE_LIMIT_BURST`), add:

```python
    # ── Auth Rate Limiting (stricter) ──
    AUTH_RATE_LIMIT_REQUESTS: int = 5
    AUTH_RATE_LIMIT_WINDOW: int = 60  # 5 per minute
```

**Step 2: Write the test file**

Create `tests/test_rate_limiting.py`:

```python
"""Tests for rate limiting middleware."""
import pytest
import httpx


class TestGlobalRateLimit:
    """Global rate limiting protects all endpoints."""

    @pytest.mark.asyncio
    async def test_normal_request_passes(self, client):
        """Single request is never rate limited."""
        resp = await client.get("/health")
        assert resp.status_code != 429

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(self, client):
        """Exceeding global limit returns 429 with Retry-After."""
        # Hammer the health endpoint beyond global limit
        for i in range(105):
            resp = await client.get("/health")
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers

    @pytest.mark.asyncio
    async def test_429_response_body(self, client):
        """429 response includes helpful message."""
        for i in range(105):
            resp = await client.get("/health")
        data = resp.json()
        assert "detail" in data


class TestAuthRateLimit:
    """Auth endpoints have stricter limits."""

    @pytest.mark.asyncio
    async def test_login_rate_limited_after_5(self, client):
        """Login allows max 5 requests per minute."""
        for i in range(7):
            resp = await client.post("/api/v1/auth/login", json={
                "email": "fake@test.com",
                "password": "WrongPassword1!",
            })
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_onboarding_rate_limited(self, client):
        """Onboarding shares auth rate limit."""
        for i in range(7):
            resp = await client.post("/api/v1/auth/onboarding", json={
                "nombre_agencia": "Spam Agency",
                "email_contacto": "spam@test.com",
                "admin_nombre": "Spam",
                "admin_apellido": "User",
                "admin_email": f"spam{i}@test.com",
                "admin_password": "MyStr0ng!Password",
            })
        assert resp.status_code == 429
```

**Step 3: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_rate_limiting.py -v`
Expected: FAIL — no rate limiting active.

**Step 4: Rewrite the rate limiter as middleware**

Rewrite `app/core/middleware/rate_limiting.py`:

```python
"""
Rate Limiting Middleware using Redis Token Bucket.

Three tiers:
- Global: 100 req/min per IP (all routes)
- Auth:   5 req/min per IP (/login, /onboarding, /password-reset)
- Upload: 10 req/min per tenant (/archivos/upload)
"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger("app.security")

# Routes with stricter auth rate limits
AUTH_PATHS = {"/api/v1/auth/login", "/api/v1/auth/onboarding",
              "/api/v1/auth/password-reset/request",
              "/api/v1/auth/password-reset/confirm"}

# Routes excluded from rate limiting
EXCLUDED_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


async def _check_bucket(
    redis_client: aioredis.Redis,
    key: str,
    max_tokens: int,
    window: int,
) -> tuple[bool, int]:
    """Token bucket check. Returns (allowed, retry_after_seconds)."""
    now = time.time()
    raw = await redis_client.get(key)

    if raw:
        tokens, last_update = map(float, raw.decode().split(":"))
    else:
        tokens = float(max_tokens)
        last_update = now

    elapsed = now - last_update
    refill_rate = max_tokens / window
    tokens = min(tokens + elapsed * refill_rate, float(max_tokens))

    if tokens >= 1.0:
        tokens -= 1.0
        await redis_client.set(key, f"{tokens}:{now}", ex=window * 2)
        return True, 0
    else:
        retry_after = int((1.0 - tokens) / refill_rate) + 1
        await redis_client.set(key, f"{tokens}:{now}", ex=window * 2)
        return False, retry_after


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies tiered rate limiting to all requests."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in EXCLUDED_PATHS:
            return await call_next(request)

        try:
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
        except Exception:
            # If Redis is down, allow request (fail open for availability)
            return await call_next(request)

        try:
            client_ip = _get_client_ip(request)

            # Check auth rate limit first (stricter)
            if path in AUTH_PATHS:
                allowed, retry_after = await _check_bucket(
                    r,
                    f"rl:auth:{client_ip}",
                    settings.AUTH_RATE_LIMIT_REQUESTS,
                    settings.AUTH_RATE_LIMIT_WINDOW,
                )
                if not allowed:
                    logger.warning(
                        "Auth rate limit exceeded",
                        extra={"ip": client_ip, "path": path},
                    )
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Demasiados intentos. Intente más tarde."},
                        headers={"Retry-After": str(retry_after)},
                    )

            # Check global rate limit
            allowed, retry_after = await _check_bucket(
                r,
                f"rl:global:{client_ip}",
                settings.RATE_LIMIT_REQUESTS,
                settings.RATE_LIMIT_WINDOW,
            )
            if not allowed:
                logger.warning(
                    "Global rate limit exceeded",
                    extra={"ip": client_ip, "path": path},
                )
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Demasiadas solicitudes. Intente más tarde."},
                    headers={"Retry-After": str(retry_after)},
                )

            return await call_next(request)
        finally:
            await r.aclose()
```

**Step 5: Register in main.py**

In `app/main.py`, add after the SecurityHeaders middleware registration:

```python
from app.core.middleware.rate_limiting import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)
```

Registration order in main.py (bottom to top = execution order):
1. `CORSMiddleware` (first registered)
2. `SecurityHeadersMiddleware` (second)
3. `RateLimitMiddleware` (third — registered last, so executes first)

Execution: Request → RateLimit → SecurityHeaders → CORS → Handler

**Step 6: Flush Redis between rate limit tests**

Add a fixture to `tests/test_rate_limiting.py` at the top:

```python
@pytest.fixture(autouse=True)
async def flush_rate_limits():
    """Clear rate limit keys before each test."""
    import redis.asyncio as aioredis
    from app.core.config import settings
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    # Delete only rate limit keys (not other Redis data)
    keys = await r.keys("rl:*")
    if keys:
        await r.delete(*keys)
    await r.aclose()
    yield
```

**Step 7: Run tests**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_rate_limiting.py -v`
Expected: 5 PASSED

Then full suite:
Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: All PASSED

**Step 8: Commit**

```bash
git add app/core/middleware/rate_limiting.py tests/test_rate_limiting.py app/main.py app/core/config.py
git commit -m "feat(security): rewrite RateLimiter as middleware with tiered limits

Global: 100 req/min/IP. Auth endpoints: 5 req/min/IP.
Redis token bucket algorithm. Returns 429 with Retry-After header."
```

---

## Task 4: FailedLoginTracker

**Files:**
- Create: `app/core/security/failed_login_tracker.py`
- Create: `tests/test_failed_login_tracker.py`
- Modify: `app/platform/routes/auth.py` (integrate into login)

**Step 1: Write the test file**

Create `tests/test_failed_login_tracker.py`:

```python
"""Tests for failed login tracking and account lockout."""
import pytest
import httpx
import redis.asyncio as aioredis
from app.core.config import settings


@pytest.fixture(autouse=True)
async def flush_login_tracker():
    """Clear login tracker keys before each test."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    keys = await r.keys("failed_login:*")
    if keys:
        await r.delete(*keys)
    # Also clear rate limit keys so rate limiter doesn't interfere
    rl_keys = await r.keys("rl:*")
    if rl_keys:
        await r.delete(*rl_keys)
    await r.aclose()
    yield


class TestFailedLoginTracker:
    """Account lockout after repeated failed logins."""

    @pytest.mark.asyncio
    async def test_first_failed_login_returns_401(self, client):
        """First failure returns normal 401, not lockout."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "anyone@test.com",
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_lockout_after_5_failures(self, client):
        """6th attempt returns 429 lockout."""
        email = "lockout-test@test.com"
        for i in range(5):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })

        # 6th attempt — should be locked
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 429
        assert "bloqueada" in resp.json()["detail"].lower() or "lockout" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_successful_login_resets_counter(self, client, user_a_admin, token_a):
        """Successful login resets the failure counter."""
        email = user_a_admin.email
        # Fail 3 times
        for i in range(3):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })

        # Succeed (use correct password — "password123" is the default in conftest)
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "password123",
        })
        assert resp.status_code == 200

        # Counter reset — 3 more failures should NOT lock out
        for i in range(3):
            await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        # 4th failure after reset — not yet locked (need 5)
        assert resp.status_code == 401
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_failed_login_tracker.py -v`
Expected: FAIL

**Step 3: Implement the tracker**

Create `app/core/security/failed_login_tracker.py`:

```python
"""
Failed login tracker — brute-force protection.
Locks accounts after MAX_ATTEMPTS failures within LOCKOUT_WINDOW.
Uses Redis with hashed email keys (no PII stored).
"""
import hashlib
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("app.security")

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 900  # 15 minutes


def _make_key(ip: str, email: str) -> str:
    """Create Redis key from IP + hashed email (no PII in Redis)."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()[:16]
    return f"failed_login:{ip}:{email_hash}"


async def is_locked_out(ip: str, email: str) -> bool:
    """Check if this IP+email pair is currently locked out."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _make_key(ip, email)
        count = await r.get(key)
        return count is not None and int(count) >= MAX_ATTEMPTS
    finally:
        await r.aclose()


async def record_failed_login(ip: str, email: str) -> int:
    """Record a failed attempt. Returns the new count."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        key = _make_key(ip, email)
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        results = await pipe.execute()
        count = results[0]
        if count >= MAX_ATTEMPTS:
            logger.warning(
                "Account locked out after %d failed attempts",
                count,
                extra={"ip": ip, "email_hash": key.split(":")[-1]},
            )
        return count
    finally:
        await r.aclose()


async def reset_failed_logins(ip: str, email: str) -> None:
    """Clear failed login counter after successful login."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await r.delete(_make_key(ip, email))
    finally:
        await r.aclose()
```

**Step 4: Integrate into login endpoint**

In `app/platform/routes/auth.py`, add import at the top (after line 9):

```python
from app.core.security.failed_login_tracker import (
    is_locked_out, record_failed_login, reset_failed_logins,
)
```

Replace the login function (lines 40-95) with:

```python
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

    # Actualizar last_login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token(
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

    return TokenResponse(
        access_token=token,
        tenant_id=tenant.id,
        tenant_name=tenant.nombre,
        vertical=VERTICAL,
        plan=tenant.plan.value,
        rol=user.rol.value,
    )
```

Also add `Request` to FastAPI imports on line 9:

```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
```

**Step 5: Run tests**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_failed_login_tracker.py -v`
Expected: 3 PASSED

Full suite:
Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: All PASSED

**Step 6: Commit**

```bash
git add app/core/security/failed_login_tracker.py tests/test_failed_login_tracker.py app/platform/routes/auth.py
git commit -m "feat(security): add FailedLoginTracker with lockout

5 failed attempts locks IP+email pair for 15 minutes.
Email hashed in Redis keys (no PII). Counter resets on success."
```

---

## Task 5: AuditLogger Middleware

**Files:**
- Create: `app/core/middleware/audit_logger.py`
- Create: `tests/test_audit_logger.py`
- Modify: `app/main.py` (register middleware)

**Step 1: Write the test file**

Create `tests/test_audit_logger.py`:

```python
"""Tests for audit logging middleware."""
import logging
import pytest
import httpx


class TestAuditLogger:
    """Every request is logged with structured metadata."""

    @pytest.mark.asyncio
    async def test_request_is_logged(self, client, caplog):
        """Health check request produces an audit log entry."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        assert any("GET /health" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_log_includes_status_code(self, client, caplog):
        """Audit log includes HTTP status code."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "status_code")
        assert record.status_code == 200

    @pytest.mark.asyncio
    async def test_log_includes_duration(self, client, caplog):
        """Audit log includes request duration."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "duration_ms")
        assert record.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_log_includes_request_id(self, client, caplog):
        """Each request gets a unique request ID."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/health")
        record = [r for r in caplog.records if "GET /health" in r.message][0]
        assert hasattr(record, "request_id")
        assert len(record.request_id) > 0

    @pytest.mark.asyncio
    async def test_failed_request_logged(self, client, caplog):
        """401 responses are also logged."""
        with caplog.at_level(logging.INFO, logger="app.audit"):
            await client.get("/api/v1/auth/me")
        records = [r for r in caplog.records if "/auth/me" in r.message]
        assert len(records) >= 1
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_audit_logger.py -v`
Expected: FAIL

**Step 3: Implement the middleware**

Create `app/core/middleware/audit_logger.py`:

```python
"""
Audit Logger Middleware.
Logs every HTTP request with structured metadata.
Does NOT log request/response bodies (privacy by design).
"""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.audit")


class AuditLoggerMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, status, duration, IP."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not client_ip and request.client:
            client_ip = request.client.host

        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(
                "%s %s 500 (unhandled exception)",
                request.method,
                request.url.path,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "ip": client_ip,
                    "user_agent": request.headers.get("user-agent", ""),
                },
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        status_code = response.status_code

        log_level = logging.WARNING if status_code >= 400 else logging.INFO

        logger.log(
            log_level,
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            status_code,
            duration_ms,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "ip": client_ip,
                "user_agent": request.headers.get("user-agent", ""),
            },
        )

        response.headers["X-Request-ID"] = request_id
        return response
```

**Step 4: Register in main.py**

In `app/main.py`, add after the RateLimitMiddleware registration:

```python
from app.core.middleware.audit_logger import AuditLoggerMiddleware
app.add_middleware(AuditLoggerMiddleware)
```

Final middleware registration order in main.py:
```python
# 1. CORS (first registered — runs last)
app.add_middleware(CORSMiddleware, ...)
# 2. SecurityHeaders
app.add_middleware(SecurityHeadersMiddleware)
# 3. RateLimit
app.add_middleware(RateLimitMiddleware)
# 4. AuditLogger (last registered — runs first)
app.add_middleware(AuditLoggerMiddleware)
```

Execution order: AuditLogger → RateLimit → SecurityHeaders → CORS → Handler

**Step 5: Run tests**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_audit_logger.py -v`
Expected: 5 PASSED

Full suite:
Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: All PASSED

**Step 6: Commit**

```bash
git add app/core/middleware/audit_logger.py tests/test_audit_logger.py app/main.py
git commit -m "feat(security): add AuditLogger middleware

Logs every request with method, path, status_code, duration_ms,
IP, user_agent, and request_id. Adds X-Request-ID response header.
Privacy by design: no body logging."
```

---

## Task 6: FileValidator (magic bytes)

**Files:**
- Create: `app/core/security/file_validator.py`
- Create: `tests/test_file_validator.py`
- Modify: `app/verticals/autos/api/routes/archivos.py` (integrate)

**Step 1: Write the test file**

Create `tests/test_file_validator.py`:

```python
"""Tests for file upload magic byte validation."""
import pytest
from app.core.security.file_validator import validate_file_content


class TestFileValidator:
    """Server-side file content validation via magic bytes."""

    def test_valid_jpeg(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        assert validate_file_content(content, "image/jpeg") is True

    def test_valid_png(self):
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        assert validate_file_content(content, "image/png") is True

    def test_valid_gif(self):
        content = b"GIF89a" + b"\x00" * 100
        assert validate_file_content(content, "image/gif") is True

    def test_valid_pdf(self):
        content = b"%PDF-1.4" + b"\x00" * 100
        assert validate_file_content(content, "application/pdf") is True

    def test_valid_webp(self):
        content = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 100
        assert validate_file_content(content, "image/webp") is True

    def test_spoofed_jpeg(self):
        """Executable disguised as JPEG is rejected."""
        content = b"MZ" + b"\x00" * 100  # PE executable header
        assert validate_file_content(content, "image/jpeg") is False

    def test_spoofed_png(self):
        """Non-PNG bytes with PNG MIME type rejected."""
        content = b"\xff\xd8\xff" + b"\x00" * 100  # JPEG bytes, not PNG
        assert validate_file_content(content, "image/png") is False

    def test_unknown_mime_type_rejected(self):
        """Unsupported MIME types are rejected."""
        content = b"\x00" * 100
        assert validate_file_content(content, "application/x-executable") is False

    def test_empty_content_rejected(self):
        """Empty files are rejected."""
        assert validate_file_content(b"", "image/jpeg") is False

    def test_word_doc_accepted(self):
        """Word .docx (ZIP-based) passes validation."""
        content = b"PK\x03\x04" + b"\x00" * 100  # ZIP magic bytes
        assert validate_file_content(content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document") is True

    def test_word_doc_old_format(self):
        """Word .doc (OLE2) passes validation."""
        content = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 100
        assert validate_file_content(content, "application/msword") is True
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_file_validator.py -v`
Expected: FAIL — module not found.

**Step 3: Implement the validator**

Create `app/core/security/file_validator.py`:

```python
"""
File content validator via magic bytes.
Verifies that file content matches the declared MIME type.
"""

# Magic byte signatures for allowed file types
MAGIC_BYTES: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],  # + check for WEBP at offset 8
    "application/pdf": [b"%PDF"],
    # Word .docx is ZIP-based
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        b"PK\x03\x04",
    ],
    # Word .doc is OLE2
    "application/msword": [
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
    ],
}


def validate_file_content(content: bytes, declared_mime: str) -> bool:
    """Check if file content matches the declared MIME type.

    Returns True if valid, False if spoofed or unsupported.
    """
    if not content:
        return False

    signatures = MAGIC_BYTES.get(declared_mime)
    if signatures is None:
        return False  # Unsupported MIME type

    for sig in signatures:
        if content[: len(sig)] == sig:
            # Extra check for WebP: bytes 8-12 must be "WEBP"
            if declared_mime == "image/webp":
                if len(content) >= 12 and content[8:12] == b"WEBP":
                    return True
                continue
            return True

    return False
```

**Step 4: Run tests**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest tests/test_file_validator.py -v`
Expected: 11 PASSED

**Step 5: Integrate into archivos.py upload**

In `app/verticals/autos/api/routes/archivos.py`, add import at the top:

```python
from app.core.security.file_validator import validate_file_content
```

In the `subir_archivo` function, after `file_content = await file.read()` (line 132) and before the size check, add:

```python
    # Validate magic bytes match declared MIME type
    if not validate_file_content(file_content, file.content_type):
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no coincide con el tipo declarado."
        )
```

Apply the same validation in `upload_multiple` endpoint if it exists.

**Step 6: Run full test suite**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: All PASSED

**Step 7: Commit**

```bash
git add app/core/security/file_validator.py tests/test_file_validator.py app/verticals/autos/api/routes/archivos.py
git commit -m "feat(security): add FileValidator with magic byte verification

Validates JPEG, PNG, GIF, WebP, PDF, DOC, DOCX uploads by checking
file content against expected magic bytes. Rejects MIME type spoofing."
```

---

## Task 7: Final Integration & Smoke Test

**Files:**
- Verify: `app/main.py` (correct middleware order)
- Create: `tests/test_security_integration.py`

**Step 1: Verify main.py middleware order**

Confirm `app/main.py` has this middleware registration block (after CORS):

```python
# ── Security middleware stack ──
# Registration order is REVERSE of execution order in Starlette.
# Execution: AuditLogger → RateLimit → SecurityHeaders → CORS → Handler
from app.core.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

from app.core.middleware.rate_limiting import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

from app.core.middleware.audit_logger import AuditLoggerMiddleware
app.add_middleware(AuditLoggerMiddleware)
```

**Step 2: Write integration smoke test**

Create `tests/test_security_integration.py`:

```python
"""Integration smoke tests — verify all security layers work together."""
import pytest
import httpx
import redis.asyncio as aioredis
from app.core.config import settings


@pytest.fixture(autouse=True)
async def clean_redis():
    """Clear all security-related Redis keys."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    for prefix in ["rl:", "failed_login:"]:
        keys = await r.keys(f"{prefix}*")
        if keys:
            await r.delete(*keys)
    await r.aclose()
    yield


class TestSecurityStack:
    """All security layers work in concert."""

    @pytest.mark.asyncio
    async def test_healthy_request_gets_all_protections(self, client):
        """A normal request passes through all layers."""
        resp = await client.get("/health")
        assert resp.status_code == 200
        # SecurityHeaders
        assert resp.headers["X-Frame-Options"] == "DENY"
        # AuditLogger
        assert "X-Request-ID" in resp.headers

    @pytest.mark.asyncio
    async def test_login_with_strong_password_works(self, client, user_a_admin):
        """Login with valid credentials succeeds through all layers."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a_admin.email,
            "password": "password123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    @pytest.mark.asyncio
    async def test_brute_force_triggers_lockout_not_rate_limit(self, client):
        """5 wrong passwords trigger lockout (429) before global rate limit."""
        email = "bruteforce@test.com"
        for i in range(5):
            resp = await client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "WrongPassword1!",
            })
            assert resp.status_code == 401

        # 6th: lockout
        resp = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 429
        assert "bloqueada" in resp.json()["detail"].lower() or "intentos" in resp.json()["detail"].lower()
```

**Step 3: Run full test suite**

Run: `cd /Users/macbook/mis-proyectos/saas-platform/alfredo/backend && python -m pytest -v`
Expected: ALL PASSED (33 original + ~35 new security tests)

**Step 4: Final commit**

```bash
git add tests/test_security_integration.py
git commit -m "test(security): add integration smoke tests

Verifies all security layers (headers, rate limiting, lockout,
audit logging) work together on a single request flow."
```

---

## Summary of deliverables

| Component | Files created | Tests |
|-----------|--------------|-------|
| SecurityHeaders | `middleware/security_headers.py` | 4 tests |
| PasswordValidator | `security/password_validator.py` | 11 tests |
| RateLimiter | `middleware/rate_limiting.py` (rewrite) | 5 tests |
| FailedLoginTracker | `security/failed_login_tracker.py` | 3 tests |
| AuditLogger | `middleware/audit_logger.py` | 5 tests |
| FileValidator | `security/file_validator.py` | 11 tests |
| Integration | `test_security_integration.py` | 3 tests |
| **TOTAL** | **6 new + 3 modified** | **~42 new tests** |

Expected final count: **33 original + ~42 new = ~75 tests all green.**
