"""
Tests de aislamiento de tenants via PostgreSQL RLS.
CRITICO: Estos tests verifican que un tenant NO puede ver datos de otro.
Si alguno falla, hay un problema de seguridad grave.
"""
import uuid
import pytest
import httpx
from sqlalchemy import text

from tests.conftest import auth_header


class TestTenantIsolation:
    """Verify Row Level Security isolates tenant data completely."""

    async def test_tenant_a_cannot_read_tenant_b_unidades(
        self,
        client: httpx.AsyncClient,
        db_admin,
        token_a,
        token_b,
        tenant_a,
        tenant_b,
    ):
        """
        Tenant A no debe ver unidades de Tenant B.
        Crea una unidad en cada tenant y verifica aislamiento.
        """
        # Insert vehicles via superuser (bypassing RLS).
        # unidades.id is Integer (autoincrement), so we omit it and use RETURNING.
        result_a = await db_admin.execute(text(
            "INSERT INTO unidades (tenant_id, marca, modelo, anio, precio_publicado, "
            "precio_compra, dominio, fecha_ingreso, estado) "
            f"VALUES ('{tenant_a.id}', 'Toyota', 'Corolla', 2024, 5000000, "
            f"1000000, 'TEST-{uuid.uuid4().hex[:6]}', CURRENT_DATE, 'DISPONIBLE') "
            "RETURNING id"
        ))
        unidad_a_id = result_a.scalar_one()

        result_b = await db_admin.execute(text(
            "INSERT INTO unidades (tenant_id, marca, modelo, anio, precio_publicado, "
            "precio_compra, dominio, fecha_ingreso, estado) "
            f"VALUES ('{tenant_b.id}', 'Honda', 'Civic', 2024, 6000000, "
            f"1200000, 'TEST-{uuid.uuid4().hex[:6]}', CURRENT_DATE, 'DISPONIBLE') "
            "RETURNING id"
        ))
        unidad_b_id = result_b.scalar_one()
        await db_admin.commit()

        try:
            # Tenant A should only see their own vehicle
            resp_a = await client.get(
                "/api/v1/autos/unidades/",
                headers=auth_header(token_a),
            )
            assert resp_a.status_code == 200
            body_a = resp_a.json()

            # Handle both list and paginated response formats
            items_a = body_a if isinstance(body_a, list) else body_a.get("items", body_a.get("data", []))
            marcas_a = [u.get("marca") for u in items_a]

            assert "Honda" not in marcas_a, "SECURITY BREACH: Tenant A can see Tenant B's data!"

            # Tenant B should only see their own vehicle
            resp_b = await client.get(
                "/api/v1/autos/unidades/",
                headers=auth_header(token_b),
            )
            assert resp_b.status_code == 200
            body_b = resp_b.json()
            items_b = body_b if isinstance(body_b, list) else body_b.get("items", body_b.get("data", []))
            marcas_b = [u.get("marca") for u in items_b]

            assert "Toyota" not in marcas_b, "SECURITY BREACH: Tenant B can see Tenant A's data!"

        finally:
            await db_admin.execute(text(f"DELETE FROM unidades WHERE id = {unidad_a_id}"))
            await db_admin.execute(text(f"DELETE FROM unidades WHERE id = {unidad_b_id}"))
            await db_admin.commit()

    async def test_tenant_a_cannot_access_tenant_b_unidad_by_id(
        self,
        client: httpx.AsyncClient,
        db_admin,
        token_a,
        tenant_b,
    ):
        """
        Tenant A no debe poder acceder a una unidad de Tenant B por ID directo.
        Incluso si conoce el ID, RLS debe bloquearlo.
        """
        result = await db_admin.execute(text(
            "INSERT INTO unidades (tenant_id, marca, modelo, anio, precio_publicado, "
            "precio_compra, dominio, fecha_ingreso, estado) "
            f"VALUES ('{tenant_b.id}', 'Ford', 'Focus', 2024, 4000000, "
            f"800000, 'TEST-{uuid.uuid4().hex[:6]}', CURRENT_DATE, 'DISPONIBLE') "
            "RETURNING id"
        ))
        unidad_b_id = result.scalar_one()
        await db_admin.commit()

        try:
            # Tenant A tries to access Tenant B's vehicle by ID
            resp = await client.get(
                f"/api/v1/autos/unidades/{unidad_b_id}",
                headers=auth_header(token_a),
            )
            # Should get 404 (RLS hides the record) not 200
            assert resp.status_code == 404, \
                f"SECURITY BREACH: Tenant A got status {resp.status_code} for Tenant B's vehicle!"
        finally:
            await db_admin.execute(text(f"DELETE FROM unidades WHERE id = {unidad_b_id}"))
            await db_admin.commit()

    async def test_rls_blocks_cross_tenant_operations(
        self,
        client: httpx.AsyncClient,
        db_admin,
        token_a,
        tenant_a,
        tenant_b,
    ):
        """
        Tenant A no puede crear clientes en Tenant B.
        El tenant_id en los datos creados siempre debe ser del tenant autenticado.
        """
        # Create a client via Tenant A's token
        resp = await client.post(
            "/api/v1/autos/clientes/",
            headers=auth_header(token_a),
            json={
                "nombre": "Test RLS Client",
                "apellido": "Isolation",
                "tipo_documento": "DNI",
                "numero_documento": f"TEST-{uuid.uuid4().hex[:8]}",
            },
        )

        if resp.status_code in (200, 201):
            data = resp.json()
            # The created record MUST belong to Tenant A, regardless of what was sent
            client_id = data.get("id")

            if client_id:
                # Verify via superuser that it's in Tenant A
                result = await db_admin.execute(text(
                    f"SELECT tenant_id FROM clientes WHERE id = '{client_id}'"
                ))
                row = result.fetchone()
                assert row is not None
                assert str(row[0]) == str(tenant_a.id), \
                    "SECURITY BREACH: Record created with wrong tenant_id!"

                # Cleanup
                await db_admin.execute(text(f"DELETE FROM clientes WHERE id = '{client_id}'"))
                await db_admin.commit()

    async def test_admin_impersonation_respects_rls(
        self,
        client: httpx.AsyncClient,
        db_admin,
        platform_admin_token,
        tenant_a,
        tenant_b,
    ):
        """
        When platform admin impersonates Tenant A,
        they should only see Tenant A's data (RLS applies to impersonation token).
        """
        # Create vehicles for both tenants (integer IDs, auto-generated)
        result_a = await db_admin.execute(text(
            "INSERT INTO unidades (tenant_id, marca, modelo, anio, precio_publicado, "
            "precio_compra, dominio, fecha_ingreso, estado) "
            f"VALUES ('{tenant_a.id}', 'VW', 'Golf', 2024, 7000000, "
            f"1500000, 'TEST-{uuid.uuid4().hex[:6]}', CURRENT_DATE, 'DISPONIBLE') "
            "RETURNING id"
        ))
        unidad_a_id = result_a.scalar_one()

        result_b = await db_admin.execute(text(
            "INSERT INTO unidades (tenant_id, marca, modelo, anio, precio_publicado, "
            "precio_compra, dominio, fecha_ingreso, estado) "
            f"VALUES ('{tenant_b.id}', 'BMW', 'X1', 2024, 15000000, "
            f"3000000, 'TEST-{uuid.uuid4().hex[:6]}', CURRENT_DATE, 'DISPONIBLE') "
            "RETURNING id"
        ))
        unidad_b_id = result_b.scalar_one()
        await db_admin.commit()

        try:
            # Impersonate Tenant A
            imp_resp = await client.post(
                f"/api/v1/admin/tenants/{tenant_a.id}/impersonate",
                headers=auth_header(platform_admin_token),
            )
            assert imp_resp.status_code == 200
            imp_token = imp_resp.json()["access_token"]

            # List vehicles with impersonation token — should only see Tenant A's
            resp = await client.get(
                "/api/v1/autos/unidades/",
                headers=auth_header(imp_token),
            )
            assert resp.status_code == 200

            # Verify no BMW (Tenant B's vehicle) in results
            body = resp.json()
            items = body if isinstance(body, list) else body.get("items", body.get("data", []))
            marcas = [u.get("marca") for u in items]
            assert "BMW" not in marcas, \
                "SECURITY BREACH: Impersonation token leaks cross-tenant data!"

        finally:
            await db_admin.execute(text(f"DELETE FROM unidades WHERE id = {unidad_a_id}"))
            await db_admin.execute(text(f"DELETE FROM unidades WHERE id = {unidad_b_id}"))
            await db_admin.commit()
