-- ============================================================
-- Alfredo: Completar RLS en tablas faltantes
-- ============================================================
-- Estado previo: 22 de 24 tablas con tenant_id ya tienen RLS.
-- Faltaban: platform_users y subscriptions.
--
-- NOTA: platform_users y subscriptions necesitan políticas
-- granulares porque el endpoint /login hace SELECT antes de
-- conocer el tenant_id (current_tenant_id() = NULL).
--
-- Ejecutar como superuser (postgres):
--   psql -U postgres -d saas_platform -f scripts/enable_rls_remaining.sql
-- ============================================================

BEGIN;

-- ══════════════════════════════════════════════
-- platform_users
-- ══════════════════════════════════════════════
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users FORCE ROW LEVEL SECURITY;

-- SELECT: permitir sin tenant context (login) o con tenant propio
CREATE POLICY tenant_select ON platform_users
  FOR SELECT TO public
  USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- INSERT/UPDATE/DELETE: solo con tenant context
CREATE POLICY tenant_insert ON platform_users
  FOR INSERT TO public
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_update ON platform_users
  FOR UPDATE TO public
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_delete ON platform_users
  FOR DELETE TO public
  USING (tenant_id = current_tenant_id());

-- ══════════════════════════════════════════════
-- subscriptions (misma lógica que platform_users)
-- ══════════════════════════════════════════════
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON subscriptions
  FOR SELECT TO public
  USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

CREATE POLICY tenant_insert ON subscriptions
  FOR INSERT TO public
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_update ON subscriptions
  FOR UPDATE TO public
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_delete ON subscriptions
  FOR DELETE TO public
  USING (tenant_id = current_tenant_id());

-- ══════════════════════════════════════════════
-- payment_records: agregar FORCE (ya tiene policy)
-- ══════════════════════════════════════════════
ALTER TABLE payment_records FORCE ROW LEVEL SECURITY;

COMMIT;

-- Verificación
SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE tablename IN ('platform_users', 'subscriptions', 'payment_records')
ORDER BY tablename, policyname;
