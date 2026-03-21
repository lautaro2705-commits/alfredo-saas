"""Initial schema baseline - stamps existing database state.

This migration represents the existing database schema as of 2026-03-20.
It does NOT create tables (they already exist). It serves as the starting
point for all future migrations.

To baseline an existing database:  alembic stamp 001_initial
To apply to a fresh database:      alembic upgrade head (will create all tables)

Revision ID: 001_initial
Revises: -
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Idempotency check ──
    # If the database already has tables (existing deployment), skip DDL.
    # Run `alembic stamp 001_initial` to mark the DB at this revision.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'tenants' in existing_tables:
        # Database already has tables — nothing to do.
        # This is the expected path for existing deployments.
        return

    # ── Fresh install: create all tables ──

    # ------------------------------------------------------------------
    # PLATFORM TABLES
    # ------------------------------------------------------------------

    # 1. tenants
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nombre', sa.String(255), nullable=False),
        sa.Column('razon_social', sa.String(255), nullable=True),
        sa.Column('cuit', sa.String(13), unique=True, index=True, nullable=True),
        sa.Column('email_contacto', sa.String(255), nullable=False),
        sa.Column('telefono', sa.String(50), nullable=True),
        sa.Column('direccion', sa.Text(), nullable=True),
        sa.Column('vertical', sa.String(20), nullable=False, server_default='autos'),
        sa.Column('plan', sa.Enum('trial', 'basico', 'profesional', 'premium', name='plantier'), server_default='trial'),
        sa.Column('activa', sa.Boolean(), server_default='true'),
        sa.Column('settings', postgresql.JSONB(), server_default='{}'),
        sa.Column('max_usuarios', sa.String(10), server_default='2'),
        sa.Column('max_items', sa.String(10), server_default='30'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 2. platform_users
    op.create_table(
        'platform_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('username', sa.String(50), nullable=False, index=True),
        sa.Column('email', sa.String(255), nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('apellido', sa.String(100), nullable=False),
        sa.Column('telefono', sa.String(50), nullable=True),
        sa.Column('rol', sa.Enum('admin', 'vendedor', 'gestor', 'administrativo', name='rolusuario'),
                   server_default='vendedor'),
        sa.Column('permisos_custom', postgresql.JSONB(), nullable=True),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('is_platform_admin', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
    )

    # 3. password_history
    op.create_table(
        'password_history',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 4. subscriptions
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('plan', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('trial', 'active', 'past_due', 'cancelled', 'expired',
                                     name='subscriptionstatus'), server_default='trial'),
        sa.Column('mp_preapproval_id', sa.String(255), unique=True, nullable=True),
        sa.Column('mp_payer_email', sa.String(255), nullable=True),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trial_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('currency', sa.String(3), server_default='ARS'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 5. payment_records
    op.create_table(
        'payment_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('subscriptions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('mp_payment_id', sa.String(255), unique=True, nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='ARS'),
        sa.Column('status', sa.Enum('pending', 'approved', 'rejected', 'refunded',
                                     name='paymentstatus'), server_default='pending'),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('mp_response', postgresql.JSONB(), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # VERTICAL: AUTOS — CORE TABLES
    # ------------------------------------------------------------------

    # 6. clientes
    op.create_table(
        'clientes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('apellido', sa.String(100), nullable=False),
        sa.Column('dni_cuit', sa.String(20), nullable=False, index=True),
        sa.Column('telefono', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('direccion', sa.String(200), nullable=True),
        sa.Column('localidad', sa.String(100), nullable=True),
        sa.Column('provincia', sa.String(100), nullable=True),
        sa.Column('codigo_postal', sa.String(20), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'dni_cuit', name='uq_cliente_tenant_dni'),
    )

    # 7. cierres_caja (must come before caja_diaria due to FK)
    op.create_table(
        'cierres_caja',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('mes', sa.Integer(), nullable=False),
        sa.Column('anio', sa.Integer(), nullable=False),
        sa.Column('total_ingresos', sa.Float(), server_default='0'),
        sa.Column('total_egresos', sa.Float(), server_default='0'),
        sa.Column('total_costos_directos', sa.Float(), server_default='0'),
        sa.Column('utilidad_bruta', sa.Float(), server_default='0'),
        sa.Column('utilidad_neta', sa.Float(), server_default='0'),
        sa.Column('cerrado', sa.Boolean(), server_default='false'),
        sa.Column('fecha_cierre', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('cerrado_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 8. interesados (must come before seguimientos due to FK)
    op.create_table(
        'interesados',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('apellido', sa.String(100), nullable=False),
        sa.Column('telefono', sa.String(50), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('marca_buscada', sa.String(100), nullable=True, index=True),
        sa.Column('modelo_buscado', sa.String(100), nullable=True, index=True),
        sa.Column('anio_desde', sa.Integer(), nullable=True),
        sa.Column('anio_hasta', sa.Integer(), nullable=True),
        sa.Column('precio_maximo', sa.Float(), nullable=True),
        sa.Column('combustible', sa.String(50), nullable=True),
        sa.Column('transmision', sa.String(50), nullable=True),
        sa.Column('otras_preferencias', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), server_default='true', index=True),
        sa.Column('fecha_contacto', sa.Date(), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 9. unidades
    op.create_table(
        'unidades',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('marca', sa.String(100), nullable=False, index=True),
        sa.Column('modelo', sa.String(100), nullable=False, index=True),
        sa.Column('version', sa.String(100), nullable=True),
        sa.Column('anio', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(50), nullable=True),
        sa.Column('kilometraje', sa.Integer(), nullable=True),
        sa.Column('combustible', sa.String(50), nullable=True),
        sa.Column('transmision', sa.String(50), nullable=True),
        sa.Column('dominio', sa.String(20), nullable=False, index=True),
        sa.Column('numero_chasis', sa.String(50), nullable=True),
        sa.Column('numero_motor', sa.String(50), nullable=True),
        sa.Column('estado', sa.Enum('disponible', 'reservado', 'vendido', 'en_reparacion',
                                     'retoma_pendiente', name='estadounidad'),
                   server_default='disponible'),
        sa.Column('origen', sa.Enum('compra_directa', 'retoma', 'consignacion',
                                     name='origenunidad'), server_default='compra_directa'),
        sa.Column('precio_compra', sa.Float(), nullable=False, server_default='0'),
        sa.Column('gastos_transferencia', sa.Float(), server_default='0'),
        sa.Column('precio_publicado', sa.Float(), nullable=True),
        sa.Column('precio_minimo', sa.Float(), nullable=True),
        sa.Column('fecha_ingreso', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('fecha_venta', sa.Date(), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('ubicacion', sa.String(100), nullable=True),
        sa.Column('fotos', sa.Text(), nullable=True),
        sa.Column('valor_mercado', sa.Float(), nullable=True),
        sa.Column('valor_mercado_min', sa.Float(), nullable=True),
        sa.Column('valor_mercado_max', sa.Float(), nullable=True),
        sa.Column('valor_mercado_cantidad', sa.Integer(), nullable=True),
        sa.Column('fecha_ultima_consulta_mercado', sa.DateTime(timezone=True), nullable=True),
        sa.Column('puntaje_ultimo_peritaje', sa.Float(), nullable=True),
        sa.Column('fecha_ultimo_peritaje', sa.DateTime(timezone=True), nullable=True),
        sa.Column('mercadolibre_id', sa.String(50), unique=True, nullable=True),
        sa.Column('mercadolibre_status', sa.String(20), nullable=True),
        sa.Column('mercadolibre_url', sa.String(255), nullable=True),
        sa.Column('mercadolibre_published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('operacion_retoma_id', sa.Integer(), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'dominio', name='uq_unidad_tenant_dominio'),
        sa.UniqueConstraint('tenant_id', 'numero_chasis', name='uq_unidad_tenant_chasis'),
    )

    # 10. operaciones (depends on unidades, clientes, platform_users)
    op.create_table(
        'operaciones',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('tipo', sa.Enum('venta', 'venta_con_retoma', name='tipooperacion'), nullable=False),
        sa.Column('estado', sa.Enum('reserva', 'en_proceso', 'completada', 'cancelada',
                                     name='estadooperacion'), server_default='en_proceso'),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=False),
        sa.Column('cliente_id', sa.Integer(), sa.ForeignKey('clientes.id'), nullable=False),
        sa.Column('fecha_operacion', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('fecha_entrega', sa.Date(), nullable=True),
        sa.Column('precio_venta', sa.Float(), nullable=False),
        sa.Column('forma_pago', sa.Enum('contado', 'financiado', 'mixto', name='formapago'),
                   server_default='contado'),
        sa.Column('monto_contado', sa.Float(), server_default='0'),
        sa.Column('monto_financiado', sa.Float(), server_default='0'),
        sa.Column('entidad_financiera', sa.String(100), nullable=True),
        sa.Column('tiene_retoma', sa.Boolean(), server_default='false'),
        sa.Column('retoma_marca', sa.String(100), nullable=True),
        sa.Column('retoma_modelo', sa.String(100), nullable=True),
        sa.Column('retoma_anio', sa.Integer(), nullable=True),
        sa.Column('retoma_dominio', sa.String(20), nullable=True),
        sa.Column('retoma_valor', sa.Float(), server_default='0'),
        sa.Column('unidad_retoma_id', sa.Integer(), nullable=True),
        sa.Column('vendedor_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        sa.Column('comision', sa.Float(), server_default='0'),
        sa.Column('boleto_compraventa', sa.Boolean(), server_default='false'),
        sa.Column('form_08_firmado', sa.Boolean(), server_default='false'),
        sa.Column('transferencia_realizada', sa.Boolean(), server_default='false'),
        sa.Column('km_entrega', sa.Integer(), nullable=True),
        sa.Column('costo_transferencia_venta', sa.Float(), server_default='0'),
        sa.Column('garantia_km_limite', sa.Integer(), nullable=True),
        sa.Column('garantia_fecha_limite', sa.Date(), nullable=True),
        sa.Column('boleto_impreso', sa.Boolean(), server_default='false'),
        sa.Column('fecha_boleto', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Add FK from unidades.operacion_retoma_id -> operaciones.id (circular dep)
    op.create_foreign_key(
        'fk_unidades_operacion_retoma',
        'unidades', 'operaciones',
        ['operacion_retoma_id'], ['id'],
    )

    # 11. costos_directos
    op.create_table(
        'costos_directos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=False, index=True),
        sa.Column('categoria', sa.Enum('mecanica', 'electricidad', 'chapa_pintura', 'tapiceria',
                                        'neumaticos', 'cristales', 'gestoria', 'lavado',
                                        'combustible', 'grua', 'vtv', 'otros',
                                        name='categoriacosto'), nullable=False),
        sa.Column('descripcion', sa.String(255), nullable=False),
        sa.Column('monto', sa.Float(), nullable=False),
        sa.Column('proveedor', sa.String(100), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('numero_comprobante', sa.String(50), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 12. caja_diaria
    op.create_table(
        'caja_diaria',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('tipo', sa.Enum('ingreso', 'egreso', name='tipomovimiento'), nullable=False),
        sa.Column('categoria', sa.Enum(
            'alquiler', 'servicios', 'sueldos', 'impuestos', 'seguros',
            'publicidad', 'mantenimiento_local', 'contador', 'seguridad',
            'venta_unidad', 'comision', 'financiacion', 'otros_ingresos',
            'otros_egresos', 'retiro_socio', name='categoriagasto'), nullable=False),
        sa.Column('descripcion', sa.String(255), nullable=False),
        sa.Column('monto', sa.Float(), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False, server_default=sa.func.current_date(), index=True),
        sa.Column('medio_pago', sa.String(50), nullable=True),
        sa.Column('numero_comprobante', sa.String(50), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('operacion_id', sa.Integer(), sa.ForeignKey('operaciones.id'), nullable=True),
        sa.Column('cierre_caja_id', sa.Integer(), sa.ForeignKey('cierres_caja.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 13. cheques_recibidos
    op.create_table(
        'cheques_recibidos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('banco', sa.String(100), nullable=False),
        sa.Column('numero_cheque', sa.String(50), nullable=False),
        sa.Column('monto', sa.Float(), nullable=False),
        sa.Column('emisor_nombre', sa.String(100), nullable=False),
        sa.Column('emisor_cuit', sa.String(20), nullable=True),
        sa.Column('fecha_recepcion', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False),
        sa.Column('estado', sa.Enum('en_cartera', 'depositado', 'cobrado', 'endosado', 'rechazado',
                                     name='estadochequerecibido'), server_default='en_cartera'),
        sa.Column('operacion_id', sa.Integer(), sa.ForeignKey('operaciones.id'), nullable=True),
        sa.Column('fecha_deposito', sa.Date(), nullable=True),
        sa.Column('banco_deposito', sa.String(100), nullable=True),
        sa.Column('fecha_cobro', sa.Date(), nullable=True),
        sa.Column('endosado_a', sa.String(100), nullable=True),
        sa.Column('endosado_cuit', sa.String(20), nullable=True),
        sa.Column('fecha_endoso', sa.Date(), nullable=True),
        sa.Column('motivo_endoso', sa.String(255), nullable=True),
        sa.Column('unidad_compra_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=True),
        sa.Column('fecha_rechazo', sa.Date(), nullable=True),
        sa.Column('motivo_rechazo', sa.String(255), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 14. cheques_emitidos
    op.create_table(
        'cheques_emitidos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('banco', sa.String(100), nullable=False),
        sa.Column('numero_cheque', sa.String(50), nullable=False),
        sa.Column('monto', sa.Float(), nullable=False),
        sa.Column('beneficiario', sa.String(100), nullable=False),
        sa.Column('beneficiario_cuit', sa.String(20), nullable=True),
        sa.Column('fecha_emision', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('fecha_pago', sa.Date(), nullable=False),
        sa.Column('estado', sa.Enum('pendiente', 'pagado', 'anulado',
                                     name='estadochequeemitido'), server_default='pendiente'),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=True),
        sa.Column('caja_diaria_id', sa.Integer(), sa.ForeignKey('caja_diaria.id'), nullable=True),
        sa.Column('fecha_debito', sa.Date(), nullable=True),
        sa.Column('fecha_anulacion', sa.Date(), nullable=True),
        sa.Column('motivo_anulacion', sa.String(255), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 15. checklist_documentacion
    op.create_table(
        'checklist_documentacion',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), unique=True, nullable=False),
        sa.Column('titulo_tiene', sa.Boolean(), server_default='false'),
        sa.Column('titulo_nombre', sa.String(100), nullable=True),
        sa.Column('titulo_observaciones', sa.Text(), nullable=True),
        sa.Column('form_08_tiene', sa.Boolean(), server_default='false'),
        sa.Column('form_08_firmado', sa.Boolean(), server_default='false'),
        sa.Column('form_08_certificado', sa.Boolean(), server_default='false'),
        sa.Column('form_08_fecha_vencimiento', sa.Date(), nullable=True),
        sa.Column('vpa_tiene', sa.Boolean(), server_default='false'),
        sa.Column('vpa_fecha', sa.Date(), nullable=True),
        sa.Column('vpa_resultado', sa.String(50), nullable=True),
        sa.Column('vtv_tiene', sa.Boolean(), server_default='false'),
        sa.Column('vtv_fecha_vencimiento', sa.Date(), nullable=True),
        sa.Column('vtv_oblea', sa.String(50), nullable=True),
        sa.Column('informe_dominio_tiene', sa.Boolean(), server_default='false'),
        sa.Column('informe_dominio_fecha', sa.Date(), nullable=True),
        sa.Column('informe_dominio_estado', sa.String(50), nullable=True),
        sa.Column('multas_tiene', sa.Boolean(), server_default='false'),
        sa.Column('multas_monto_total', sa.Float(), server_default='0'),
        sa.Column('multas_detalle', sa.Text(), nullable=True),
        sa.Column('patentes_deuda', sa.Boolean(), server_default='false'),
        sa.Column('patentes_monto', sa.Float(), server_default='0'),
        sa.Column('patentes_periodos', sa.String(100), nullable=True),
        sa.Column('seguro_compania', sa.String(100), nullable=True),
        sa.Column('seguro_poliza', sa.String(50), nullable=True),
        sa.Column('seguro_vencimiento', sa.Date(), nullable=True),
        sa.Column('llave_original', sa.Boolean(), server_default='true'),
        sa.Column('llave_copia', sa.Boolean(), server_default='false'),
        sa.Column('cantidad_llaves', sa.Integer(), server_default='1'),
        sa.Column('manual_usuario', sa.Boolean(), server_default='false'),
        sa.Column('libreta_service', sa.Boolean(), server_default='false'),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('estado_gestoria', sa.String(50), server_default='sin_iniciar'),
        sa.Column('gestor_nombre', sa.String(100), nullable=True),
        sa.Column('gestor_telefono', sa.String(50), nullable=True),
        sa.Column('fecha_inicio_tramite', sa.Date(), nullable=True),
        sa.Column('fecha_finalizacion_tramite', sa.Date(), nullable=True),
        sa.Column('notas_gestoria', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 16. peritajes
    op.create_table(
        'peritajes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=True, index=True),
        sa.Column('operacion_id', sa.Integer(), sa.ForeignKey('operaciones.id'), nullable=True, index=True),
        sa.Column('vehiculo_marca', sa.String(100), nullable=True),
        sa.Column('vehiculo_modelo', sa.String(100), nullable=True),
        sa.Column('vehiculo_version', sa.String(100), nullable=True),
        sa.Column('vehiculo_anio', sa.Integer(), nullable=True),
        sa.Column('vehiculo_dominio', sa.String(20), nullable=True),
        sa.Column('vehiculo_kilometraje', sa.Integer(), nullable=True),
        sa.Column('vehiculo_color', sa.String(50), nullable=True),
        sa.Column('vehiculo_combustible', sa.String(50), nullable=True),
        sa.Column('tipo', sa.Enum('tasacion', 'ingreso_stock', 'retoma', 'periodico',
                                   name='tipoperitaje'), nullable=False, server_default='tasacion'),
        sa.Column('estado', sa.Enum('borrador', 'completado', 'aprobado', 'rechazado',
                                     name='estadoperitaje'), nullable=False, server_default='borrador'),
        sa.Column('puntaje_mecanica', sa.Float(), server_default='0'),
        sa.Column('puntaje_estetica', sa.Float(), server_default='0'),
        sa.Column('puntaje_documentacion', sa.Float(), server_default='0'),
        sa.Column('puntaje_total', sa.Float(), server_default='0'),
        sa.Column('peso_mecanica', sa.Float(), server_default='40'),
        sa.Column('peso_estetica', sa.Float(), server_default='35'),
        sa.Column('peso_documentacion', sa.Float(), server_default='25'),
        sa.Column('costo_reparaciones_estimado', sa.Float(), server_default='0'),
        sa.Column('ajuste_precio_sugerido', sa.Float(), server_default='0'),
        sa.Column('fecha_peritaje', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('fecha_completado', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observaciones_generales', sa.Text(), nullable=True),
        sa.Column('perito_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=False),
        sa.Column('aprobado_por_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 17. peritaje_items
    op.create_table(
        'peritaje_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('peritaje_id', sa.Integer(),
                   sa.ForeignKey('peritajes.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('sector', sa.Enum('mecanica', 'estetica', 'documentacion',
                                     name='sectorperitaje'), nullable=False, index=True),
        sa.Column('codigo_item', sa.String(50), nullable=False),
        sa.Column('nombre_item', sa.String(200), nullable=False),
        sa.Column('orden', sa.Integer(), server_default='0'),
        sa.Column('calificacion', sa.Enum('bueno', 'regular', 'malo', 'na',
                                           name='calificacionitem'), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('costo_reparacion_estimado', sa.Float(), server_default='0'),
        sa.Column('urgente', sa.Boolean(), server_default='false'),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 18. peritaje_fotos
    op.create_table(
        'peritaje_fotos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('peritaje_id', sa.Integer(),
                   sa.ForeignKey('peritajes.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('peritaje_item_id', sa.Integer(),
                   sa.ForeignKey('peritaje_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sector', sa.Enum('mecanica', 'estetica', 'documentacion',
                                     name='sectorperitaje', create_type=False), nullable=False),
        sa.Column('tipo_foto', sa.String(50), server_default='general'),
        sa.Column('descripcion', sa.String(255), nullable=True),
        sa.Column('nombre_archivo', sa.String(255), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('public_id', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('tamano_bytes', sa.Integer(), nullable=True),
        sa.Column('ancho', sa.Integer(), nullable=True),
        sa.Column('alto', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 19. mercadolibre_credentials
    op.create_table(
        'mercadolibre_credentials',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), unique=True, nullable=False),
        sa.Column('ml_user_id', sa.String(50), nullable=False),
        sa.Column('ml_nickname', sa.String(100), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 20. seguimientos
    op.create_table(
        'seguimientos',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('titulo', sa.String(200), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('tipo', sa.String(50), nullable=False, server_default='general'),
        sa.Column('prioridad', sa.String(20), nullable=False, server_default='media'),
        sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente', index=True),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False, index=True),
        sa.Column('hora', sa.Time(), nullable=True),
        sa.Column('cliente_id', sa.Integer(),
                   sa.ForeignKey('clientes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('interesado_id', sa.Integer(),
                   sa.ForeignKey('interesados.id', ondelete='SET NULL'), nullable=True),
        sa.Column('unidad_id', sa.Integer(),
                   sa.ForeignKey('unidades.id', ondelete='SET NULL'), nullable=True),
        sa.Column('operacion_id', sa.Integer(),
                   sa.ForeignKey('operaciones.id', ondelete='SET NULL'), nullable=True),
        sa.Column('asignado_a', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=False, index=True),
        sa.Column('completado_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observaciones_cierre', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 21. actividades
    op.create_table(
        'actividades',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('accion', sa.Enum('crear', 'editar', 'eliminar', 'vender', 'completar',
                                     'cancelar', 'ingresar', 'reservar',
                                     name='accionactividad'), nullable=False, index=True),
        sa.Column('entidad', sa.Enum('unidad', 'operacion', 'cliente', 'caja', 'costo',
                                      'cheque', 'seguimiento', 'interesado',
                                      name='entidadactividad'), nullable=False, index=True),
        sa.Column('entidad_id', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.String(500), nullable=False),
        sa.Column('datos_extra', sa.Text(), nullable=True),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    # 22. proveedores
    op.create_table(
        'proveedores',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('nombre', sa.String(200), nullable=False, index=True),
        sa.Column('tipo', sa.String(100), nullable=True),
        sa.Column('telefono', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('direccion', sa.String(300), nullable=True),
        sa.Column('cuit', sa.String(20), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), server_default='true', index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 23. archivos_unidad
    op.create_table(
        'archivos_unidad',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=False, index=True),
        sa.Column('tipo_documento', sa.Enum(
            'titulo', 'form_08', 'vpa', 'vtv', 'informe_dominio', 'cedula',
            'factura_compra', 'boleto_compraventa', 'foto_frente', 'foto_lateral',
            'foto_interior', 'foto_motor', 'foto_documento', 'otro',
            name='tipodocumentoarchivo'), nullable=False, index=True),
        sa.Column('nombre_archivo', sa.String(255), nullable=False),
        sa.Column('ruta_archivo', sa.String(500), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('tamano_bytes', sa.Integer(), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        # SoftDeleteMixin
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 24. configuracion_negocio
    op.create_table(
        'configuracion_negocio',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('clave', sa.String(100), nullable=False, index=True),
        sa.Column('valor', sa.String(255), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('tipo', sa.String(50), server_default='string'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'clave', name='uq_config_tenant_clave'),
    )

    # 25. notificaciones_match
    op.create_table(
        'notificaciones_match',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('interesado_id', sa.Integer(), sa.ForeignKey('interesados.id'), nullable=False, index=True),
        sa.Column('unidad_id', sa.Integer(), sa.ForeignKey('unidades.id'), nullable=False, index=True),
        sa.Column('score_match', sa.Float(), nullable=True),
        sa.Column('leida', sa.Boolean(), server_default='false', index=True),
        sa.Column('contactado', sa.Boolean(), server_default='false'),
        sa.Column('fecha_contacto', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resultado_contacto', sa.String(50), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                   sa.ForeignKey('platform_users.id'), nullable=True),
    )


def downgrade() -> None:
    # Drop tables in reverse order to respect foreign key dependencies.
    # WARNING: This will destroy ALL data. Use only in development.
    op.drop_table('notificaciones_match')
    op.drop_table('configuracion_negocio')
    op.drop_table('archivos_unidad')
    op.drop_table('proveedores')
    op.drop_table('actividades')
    op.drop_table('seguimientos')
    op.drop_table('mercadolibre_credentials')
    op.drop_table('peritaje_fotos')
    op.drop_table('peritaje_items')
    op.drop_table('peritajes')
    op.drop_table('checklist_documentacion')
    op.drop_table('cheques_emitidos')
    op.drop_table('cheques_recibidos')
    op.drop_table('caja_diaria')
    op.drop_table('costos_directos')
    # Drop FK before dropping operaciones
    op.drop_constraint('fk_unidades_operacion_retoma', 'unidades', type_='foreignkey')
    op.drop_table('operaciones')
    op.drop_table('unidades')
    op.drop_table('interesados')
    op.drop_table('cierres_caja')
    op.drop_table('clientes')
    op.drop_table('payment_records')
    op.drop_table('subscriptions')
    op.drop_table('password_history')
    op.drop_table('platform_users')
    op.drop_table('tenants')

    # Drop enum types
    for enum_name in [
        'plantier', 'rolusuario', 'subscriptionstatus', 'paymentstatus',
        'estadounidad', 'origenunidad', 'tipooperacion', 'estadooperacion',
        'formapago', 'categoriacosto', 'tipomovimiento', 'categoriagasto',
        'estadochequerecibido', 'estadochequeemitido',
        'tipoperitaje', 'estadoperitaje', 'sectorperitaje', 'calificacionitem',
        'accionactividad', 'entidadactividad', 'tipodocumentoarchivo',
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
