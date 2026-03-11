-- ============================================================
-- RLS Auth Policies: permite login y onboarding sin tenant context
--
-- Problema: login/onboarding necesitan leer/escribir platform_users
-- y tenants ANTES de conocer el tenant_id.
--
-- Solución: Para tablas de plataforma (auth), permitir operaciones
-- cuando current_tenant_id() IS NULL. Las tablas de datos (unidades,
-- clientes, etc.) mantienen aislamiento estricto.
--
-- Políticas RLS se evalúan con OR: si CUALQUIER policy permite
-- la operación, procede.
-- ============================================================

-- ── platform_users: necesario para login (SELECT) y onboarding (INSERT) ──
DROP POLICY IF EXISTS tenant_isolation ON platform_users;
CREATE POLICY tenant_isolation ON platform_users
    USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
    WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- ── tenants: necesario para login (SELECT) y onboarding (INSERT) ──
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
    USING (current_tenant_id() IS NULL OR id = current_tenant_id())
    WITH CHECK (current_tenant_id() IS NULL OR id = current_tenant_id());

-- ── subscriptions: onboarding crea suscripción sin tenant context aún ──
DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
CREATE POLICY tenant_isolation ON subscriptions
    USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
    WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- ── payment_records: mismo patrón por consistencia ──
DROP POLICY IF EXISTS tenant_isolation ON payment_records;
CREATE POLICY tenant_isolation ON payment_records
    USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
    WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- NOTA: Las tablas de datos (unidades, clientes, operaciones, etc.)
-- mantienen la policy estricta: tenant_id = current_tenant_id()
-- Sin tenant context → 0 rows visibles. Esto es lo correcto.
