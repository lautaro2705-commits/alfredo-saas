"""
Tests de autenticación: login, onboarding, JWT, password reset.
Verifica el flujo completo de auth incluyendo edge cases.
"""
import uuid
import pytest
import httpx

from tests.conftest import auth_header


# ═══════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════

class TestLogin:
    """Tests del endpoint POST /api/v1/auth/login."""

    async def test_login_success(self, client: httpx.AsyncClient, user_a_admin, tenant_a):
        """Login exitoso retorna JWT con datos correctos."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a_admin.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["tenant_name"] == "Test Motors A"
        assert data["vertical"] == "autos"
        assert data["rol"] == "admin"

    async def test_login_wrong_password(self, client: httpx.AsyncClient, user_a_admin):
        """Contraseña incorrecta retorna 401."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_a_admin.email,
            "password": "WrongPassword",
        })
        assert resp.status_code == 401
        assert "incorrectos" in resp.json()["detail"]

    async def test_login_nonexistent_email(self, client: httpx.AsyncClient):
        """Email que no existe retorna 401 (sin revelar si el email existe)."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": "noexiste@test.com",
            "password": "whatever",
        })
        assert resp.status_code == 401

    async def test_login_inactive_user(self, client: httpx.AsyncClient, user_inactive):
        """Usuario inactivo no puede loguearse."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_inactive.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 401

    async def test_login_inactive_tenant(
        self, client: httpx.AsyncClient, user_inactive_tenant, tenant_inactive
    ):
        """Usuario de tenant inactivo retorna 403."""
        resp = await client.post("/api/v1/auth/login", json={
            "email": user_inactive_tenant.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 403
        assert "inactiva" in resp.json()["detail"].lower()


# ═══════════════════════════════════════════════
# JWT VALIDATION
# ═══════════════════════════════════════════════

class TestJWT:
    """Tests de validación de tokens JWT."""

    async def test_valid_token_accesses_me(self, client: httpx.AsyncClient, token_a):
        """Token válido puede acceder a /me."""
        resp = await client.get(
            "/api/v1/auth/me",
            headers=auth_header(token_a),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_name"] == "Test Motors A"

    async def test_expired_token_returns_401(self, client: httpx.AsyncClient, expired_token):
        """Token expirado retorna 401."""
        resp = await client.get(
            "/api/v1/auth/me",
            headers=auth_header(expired_token),
        )
        assert resp.status_code == 401
        assert "expirado" in resp.json()["detail"].lower()

    async def test_invalid_token_returns_401(self, client: httpx.AsyncClient):
        """Token inválido/malformado retorna 401."""
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    async def test_no_token_returns_403(self, client: httpx.AsyncClient):
        """Sin token retorna 403 (HTTPBearer)."""
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 403


# ═══════════════════════════════════════════════
# ONBOARDING
# ═══════════════════════════════════════════════

class TestOnboarding:
    """Tests del endpoint POST /api/v1/auth/onboarding."""

    async def test_onboarding_creates_tenant_user_subscription(
        self, client: httpx.AsyncClient, db_admin
    ):
        """Onboarding exitoso crea tenant + user + subscription + retorna token."""
        unique = uuid.uuid4().hex[:8]
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": f"Onboard Test {unique}",

            "admin_email": f"onboard_{unique}@test.com",
            "admin_password": "SecurePass123!",
            "admin_nombre": "Test",
            "admin_apellido": "Onboard",
            "email_contacto": f"contact_{unique}@test.com",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["plan"] == "trial"
        assert data["vertical"] == "autos"
        assert data["tenant_name"] == f"Onboard Test {unique}"

        # Cleanup: delete created tenant (cascade deletes user + subscription)
        from sqlalchemy import text
        await db_admin.execute(
            text(f"DELETE FROM tenants WHERE nombre = 'Onboard Test {unique}'")
        )
        await db_admin.commit()

    async def test_onboarding_duplicate_email(
        self, client: httpx.AsyncClient, user_a_admin
    ):
        """No se puede registrar con email ya existente."""
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": "Duplicate Test",

            "admin_email": user_a_admin.email,
            "admin_password": "SecurePass123!",
            "admin_nombre": "Dup",
            "admin_apellido": "Test",
            "email_contacto": "dup@test.com",
        })
        assert resp.status_code == 409
        assert "email" in resp.json()["detail"].lower()

    async def test_onboarding_duplicate_cuit(
        self, client: httpx.AsyncClient, db_admin
    ):
        """No se puede registrar con CUIT duplicado."""
        from sqlalchemy import text

        unique = uuid.uuid4().hex[:8]
        cuit = "20-99999999-0"

        # First onboarding with CUIT
        resp1 = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": f"CUIT Test 1 {unique}",

            "admin_email": f"cuit1_{unique}@test.com",
            "admin_password": "SecurePass123!",
            "admin_nombre": "Test1",
            "admin_apellido": "CUIT",
            "email_contacto": f"cuit1_c_{unique}@test.com",
            "cuit": cuit,
        })
        assert resp1.status_code == 200

        # Second onboarding with same CUIT
        resp2 = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": f"CUIT Test 2 {unique}",

            "admin_email": f"cuit2_{unique}@test.com",
            "admin_password": "SecurePass123!",
            "admin_nombre": "Test2",
            "admin_apellido": "CUIT",
            "email_contacto": f"cuit2_c_{unique}@test.com",
            "cuit": cuit,
        })
        assert resp2.status_code == 409
        assert "CUIT" in resp2.json()["detail"]

        # Cleanup
        await db_admin.execute(
            text(f"DELETE FROM tenants WHERE nombre LIKE 'CUIT Test%{unique}'")
        )
        await db_admin.commit()


# ═══════════════════════════════════════════════
# ADMIN AUTH
# ═══════════════════════════════════════════════

class TestAdminAuth:
    """Tests de protección de endpoints admin."""

    async def test_admin_metrics_requires_platform_admin(
        self, client: httpx.AsyncClient, token_a
    ):
        """Endpoints admin requieren is_platform_admin."""
        resp = await client.get(
            "/api/v1/admin/metrics",
            headers=auth_header(token_a),  # Regular admin, not platform admin
        )
        assert resp.status_code == 403
        assert "plataforma" in resp.json()["detail"].lower()

    async def test_admin_metrics_accessible_by_platform_admin(
        self, client: httpx.AsyncClient, platform_admin_token
    ):
        """Platform admin puede acceder a métricas."""
        resp = await client.get(
            "/api/v1/admin/metrics",
            headers=auth_header(platform_admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_tenants" in data

    async def test_admin_tenants_requires_platform_admin(
        self, client: httpx.AsyncClient, token_b
    ):
        """Non-admin no puede listar tenants."""
        resp = await client.get(
            "/api/v1/admin/tenants",
            headers=auth_header(token_b),
        )
        assert resp.status_code == 403

    async def test_impersonate_requires_platform_admin(
        self, client: httpx.AsyncClient, token_a, tenant_b
    ):
        """Non-platform-admin no puede impersonar."""
        resp = await client.post(
            f"/api/v1/admin/tenants/{tenant_b.id}/impersonate",
            headers=auth_header(token_a),
        )
        assert resp.status_code == 403

    async def test_impersonate_success(
        self, client: httpx.AsyncClient, platform_admin_token, tenant_a
    ):
        """Platform admin puede impersonar un tenant."""
        resp = await client.post(
            f"/api/v1/admin/tenants/{tenant_a.id}/impersonate",
            headers=auth_header(platform_admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["tenant_name"] == "Test Motors A"
