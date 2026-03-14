-- =============================================================================
-- Migration: Soft Delete + FK Hardening
-- Date: 2026-03-12
-- Description:
--   1. Add deleted_at + deleted_by columns to all business tables (17 tables)
--   2. Create indexes on deleted_at for query performance
--   3. Change tenant_id FK from CASCADE to RESTRICT on all tables
--   4. Change peritaje cascade FKs to RESTRICT
--   5. Apply FORCE ROW LEVEL SECURITY to sensitive tables
--
-- Run as superuser (postgres):
--   psql -U postgres -d saas_platform -f scripts/add_soft_delete_columns.sql
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Agregar columnas deleted_at y deleted_by a las 17 tablas de negocio
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'unidades', 'operaciones', 'clientes', 'costos_directos',
        'cheques_recibidos', 'cheques_emitidos',
        'peritajes', 'peritaje_items', 'peritaje_fotos',
        'caja_diaria', 'cierres_caja',
        'seguimientos', 'interesados', 'notificaciones_match',
        'archivos_unidad', 'checklist_documentacion', 'proveedores'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- deleted_at: timestamp del borrado lógico (NULL = activo)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'deleted_at'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL', t
            );
            RAISE NOTICE 'Added deleted_at to %', t;
        ELSE
            RAISE NOTICE 'deleted_at already exists on %', t;
        END IF;

        -- deleted_by: UUID del usuario que eliminó
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'deleted_by'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN deleted_by UUID DEFAULT NULL', t
            );
            RAISE NOTICE 'Added deleted_by to %', t;
        ELSE
            RAISE NOTICE 'deleted_by already exists on %', t;
        END IF;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Crear índices en deleted_at para rendimiento de queries
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'unidades', 'operaciones', 'clientes', 'costos_directos',
        'cheques_recibidos', 'cheques_emitidos',
        'peritajes', 'peritaje_items', 'peritaje_fotos',
        'caja_diaria', 'cierres_caja',
        'seguimientos', 'interesados', 'notificaciones_match',
        'archivos_unidad', 'checklist_documentacion', 'proveedores'
    ];
    t TEXT;
    idx_name TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        idx_name := 'ix_' || t || '_deleted_at';
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = idx_name
        ) THEN
            EXECUTE format(
                'CREATE INDEX %I ON %I (deleted_at)', idx_name, t
            );
            RAISE NOTICE 'Created index % on %', idx_name, t;
        ELSE
            RAISE NOTICE 'Index % already exists', idx_name;
        END IF;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Cambiar FK tenant_id de CASCADE a RESTRICT en todas las tablas
-- Esto impide que al borrar un tenant se pierdan todos sus datos.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'tenant_id'
          AND tc.table_schema = 'public'
    LOOP
        -- Check if already RESTRICT
        IF EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conname = r.constraint_name
              AND n.nspname = 'public'
              AND c.confdeltype = 'r'  -- 'r' = RESTRICT
        ) THEN
            RAISE NOTICE 'FK % on % already RESTRICT, skipping', r.constraint_name, r.table_name;
            CONTINUE;
        END IF;

        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name
        );
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT',
            r.table_name, r.constraint_name
        );
        RAISE NOTICE 'Changed FK % on % to RESTRICT', r.constraint_name, r.table_name;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Cambiar FK peritaje_id en items y fotos de CASCADE a RESTRICT
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'peritaje_id'
          AND tc.table_name IN ('peritaje_items', 'peritaje_fotos')
          AND tc.table_schema = 'public'
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conname = r.constraint_name
              AND n.nspname = 'public'
              AND c.confdeltype = 'r'
        ) THEN
            RAISE NOTICE 'FK % on % already RESTRICT, skipping', r.constraint_name, r.table_name;
            CONTINUE;
        END IF;

        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name
        );
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (peritaje_id) REFERENCES peritajes(id) ON DELETE RESTRICT',
            r.table_name, r.constraint_name
        );
        RAISE NOTICE 'Changed FK % on % to RESTRICT', r.constraint_name, r.table_name;
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5: FORCE ROW LEVEL SECURITY en tablas sensibles
-- Esto asegura que incluso el owner de la tabla (si no es superuser)
-- respete las políticas RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE platform_users FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_records FORCE ROW LEVEL SECURITY;
ALTER TABLE unidades FORCE ROW LEVEL SECURITY;
ALTER TABLE operaciones FORCE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 6: Verificación
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'unidades', 'operaciones', 'clientes', 'costos_directos',
        'cheques_recibidos', 'cheques_emitidos',
        'peritajes', 'peritaje_items', 'peritaje_fotos',
        'caja_diaria', 'cierres_caja',
        'seguimientos', 'interesados', 'notificaciones_match',
        'archivos_unidad', 'checklist_documentacion', 'proveedores'
    ];
    t TEXT;
    col_count INT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        SELECT count(*) INTO col_count
        FROM information_schema.columns
        WHERE table_name = t
          AND column_name IN ('deleted_at', 'deleted_by');

        IF col_count = 2 THEN
            RAISE NOTICE '✓ % has both soft delete columns', t;
        ELSE
            RAISE WARNING '✗ % is MISSING soft delete columns (found %)', t, col_count;
        END IF;
    END LOOP;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-CHECK: Run these queries manually to verify
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Check all tenant_id FKs are RESTRICT:
--   SELECT tc.table_name, tc.constraint_name, rc.delete_rule
--   FROM information_schema.table_constraints tc
--   JOIN information_schema.referential_constraints rc
--     ON tc.constraint_name = rc.constraint_name
--   JOIN information_schema.key_column_usage kcu
--     ON tc.constraint_name = kcu.constraint_name
--   WHERE kcu.column_name = 'tenant_id' AND tc.table_schema = 'public';
--
-- Check FORCE RLS:
--   SELECT relname, relforcerowsecurity
--   FROM pg_class
--   WHERE relname IN ('platform_users', 'subscriptions', 'payment_records',
--                     'unidades', 'operaciones', 'clientes');
