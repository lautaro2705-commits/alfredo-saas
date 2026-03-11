"""
Seed data script — Alfredo.

Uso:
    cd backend
    python -m scripts.seed_tenant

Crea:
  - Tenant demo (agencia de autos)
  - Admin user
  - Trial subscription
  - Datos de ejemplo: unidades, clientes, configuración
"""
import asyncio
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.core.database import admin_session_maker, admin_engine, Base
from app.core.security import get_password_hash
from app.platform.models.tenant import Tenant, PlanTier, VERTICAL
from app.platform.models.user import PlatformUser, RolUsuario
from app.platform.models.subscription import Subscription, SubscriptionStatus

# Import ALL vertical models BEFORE create_tables() so Base.metadata knows about them
try:
    from app.verticals.autos.models.unidad import Unidad, EstadoUnidad  # noqa: F401
    from app.verticals.autos.models.cliente import Cliente  # noqa: F401
    from app.verticals.autos.models.configuracion import ConfiguracionNegocio  # noqa: F401
    from app.verticals.autos.models.operacion import Operacion  # noqa: F401
    from app.verticals.autos.models.caja_diaria import CajaDiaria, CierreCaja  # noqa: F401
    from app.verticals.autos.models.cheque import ChequeRecibido, ChequeEmitido  # noqa: F401
    from app.verticals.autos.models.proveedor import Proveedor  # noqa: F401
    from app.verticals.autos.models.interesado import Interesado, NotificacionMatch  # noqa: F401
    from app.verticals.autos.models.seguimiento import Seguimiento  # noqa: F401
    from app.verticals.autos.models.actividad import Actividad  # noqa: F401
    from app.verticals.autos.models.peritaje import Peritaje, PeritajeItem, PeritajeFoto  # noqa: F401
    from app.verticals.autos.models.costo_directo import CostoDirecto  # noqa: F401
    from app.verticals.autos.models.documentacion import ChecklistDocumentacion  # noqa: F401
    from app.verticals.autos.models.mercadolibre import MercadoLibreCredentials  # noqa: F401
    from app.verticals.autos.models.archivo import ArchivoUnidad  # noqa: F401
    HAS_AUTOS = True
except ImportError as e:
    print(f"  [WARN] Modelos de Autos no disponibles: {e}")
    HAS_AUTOS = False


async def create_tables():
    """Crear todas las tablas si no existen."""
    async with admin_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_demo_tenant(
    nombre: str = "Demo Automotores",
    admin_email: str = "admin@demo.com",
    admin_password: str = "demo1234",
):
    """Crear tenant de demo con datos iniciales."""
    async with admin_session_maker() as db:
        # Check if already exists
        result = await db.execute(
            select(PlatformUser).where(PlatformUser.email == admin_email)
        )
        if result.scalar_one_or_none():
            print(f"  Ya existe usuario con email {admin_email}. Saltando.")
            return

        trial_end = datetime.utcnow() + timedelta(days=14)

        # 1. Tenant (siempre autos en Alfredo)
        tenant = Tenant(
            nombre=nombre,
            vertical=VERTICAL,
            email_contacto=admin_email,
            telefono="+54 11 5555-0001",
            plan=PlanTier.TRIAL,
            activa=True,
            trial_ends_at=trial_end,
            settings={
                "moneda_principal": "ARS",
                "timezone": "America/Argentina/Buenos_Aires",
            },
        )
        db.add(tenant)
        await db.flush()
        print(f"  Tenant creado: {tenant.nombre} (id={tenant.id})")

        # 2. Admin user
        admin = PlatformUser(
            tenant_id=tenant.id,
            username=admin_email.split("@")[0],
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            nombre="Admin",
            apellido="Demo",
            rol=RolUsuario.ADMIN,
            activo=True,
        )
        db.add(admin)
        await db.flush()
        print(f"  Admin creado: {admin.email} (pass: {admin_password})")

        # 3. Vendedor user
        vendedor = PlatformUser(
            tenant_id=tenant.id,
            username="vendedor",
            email="vendedor@demo.com",
            hashed_password=get_password_hash("demo1234"),
            nombre="Carlos",
            apellido="Vendedor",
            rol=RolUsuario.VENDEDOR,
            activo=True,
        )
        db.add(vendedor)
        await db.flush()
        print(f"  Vendedor creado: {vendedor.email}")

        # 4. Subscription
        sub = Subscription(
            tenant_id=tenant.id,
            plan=PlanTier.TRIAL.value,
            status=SubscriptionStatus.TRIAL,
            trial_end=trial_end,
            amount=0,
            currency="ARS",
        )
        db.add(sub)

        # 5. Seed data
        await _seed_autos_data(db, tenant.id)

        await db.commit()
        print(f"\n  Seed completado para '{nombre}'")
        print(f"  Login: {admin_email} / {admin_password}")
        print(f"  Trial hasta: {trial_end.strftime('%Y-%m-%d')}")


async def _seed_autos_data(db, tenant_id):
    """Datos de ejemplo para vertical Autos."""
    try:
        from app.verticals.autos.models.unidad import Unidad, EstadoUnidad
        from app.verticals.autos.models.cliente import Cliente
        from app.verticals.autos.models.configuracion import ConfiguracionNegocio
    except ImportError as e:
        print(f"  [WARN] No se pudieron importar modelos de Autos: {e}")
        return

    # Configuración de negocio (modelo key-value: clave/valor)
    configs = [
        # Datos de la agencia
        ("nombre_agencia", "Demo Automotores", "Nombre de la agencia", "string"),
        ("cuit", "20-12345678-9", "CUIT de la empresa", "string"),
        ("direccion", "Av. Corrientes 1234, CABA", "Dirección fiscal", "string"),
        ("telefono", "+54 11 5555-0001", "Teléfono principal", "string"),
        ("email", "info@demoautomotores.com", "Email de contacto", "string"),
        ("moneda", "ARS", "Moneda principal", "string"),
        # Parámetros de inteligencia de negocio
        ("tasa_costo_oportunidad_anual", "30", "Tasa anual costo oportunidad (%)", "number"),
        ("dias_alerta_repricing", "45", "Días para alerta de repricing", "number"),
        ("dias_stock_inmovilizado", "60", "Días para considerar stock inmovilizado", "number"),
        ("cache_precios_mercado_horas", "48", "Horas de validez del cache de precios", "number"),
        # Boleto compra-venta
        ("garantia_km", "2000", "Km de garantía en boleto", "number"),
        ("garantia_dias", "90", "Días de garantía en boleto", "number"),
    ]
    for clave, valor, desc, tipo in configs:
        db.add(ConfiguracionNegocio(
            tenant_id=tenant_id,
            clave=clave,
            valor=valor,
            descripcion=desc,
            tipo=tipo,
        ))
    print(f"  {len(configs)} configuraciones de negocio creadas")

    # Unidades de ejemplo
    unidades_data = [
        {"marca": "Toyota", "modelo": "Corolla", "anio": 2023, "version": "XEi CVT",
         "color": "Blanco", "dominio": "AB123CD", "kilometraje": 15000,
         "precio_compra": 18000000, "precio_publicado": 22000000, "precio_minimo": 20000000,
         "estado": EstadoUnidad.DISPONIBLE},
        {"marca": "Volkswagen", "modelo": "Amarok", "anio": 2022, "version": "Highline 4x4",
         "color": "Negro", "dominio": "AC456EF", "kilometraje": 35000,
         "precio_compra": 28000000, "precio_publicado": 33000000, "precio_minimo": 30000000,
         "estado": EstadoUnidad.DISPONIBLE},
        {"marca": "Ford", "modelo": "Ranger", "anio": 2024, "version": "Limited 3.0",
         "color": "Gris", "dominio": "AD789GH", "kilometraje": 5000,
         "precio_compra": 35000000, "precio_publicado": 42000000, "precio_minimo": 39000000,
         "estado": EstadoUnidad.RESERVADO},
        {"marca": "Fiat", "modelo": "Cronos", "anio": 2023, "version": "Drive 1.3",
         "color": "Rojo", "dominio": "AE012IJ", "kilometraje": 20000,
         "precio_compra": 12000000, "precio_publicado": 15000000, "precio_minimo": 13500000,
         "estado": EstadoUnidad.DISPONIBLE},
        {"marca": "Chevrolet", "modelo": "Cruze", "anio": 2022, "version": "LTZ AT",
         "color": "Azul", "dominio": "AF345KL", "kilometraje": 42000,
         "precio_compra": 16000000, "precio_publicado": 19500000, "precio_minimo": 17500000,
         "estado": EstadoUnidad.DISPONIBLE},
    ]

    for data in unidades_data:
        u = Unidad(tenant_id=tenant_id, **data)
        db.add(u)

    print(f"  {len(unidades_data)} unidades de ejemplo creadas")

    # Clientes de ejemplo
    clientes_data = [
        {"nombre": "Juan", "apellido": "Perez", "dni_cuit": "30123456",
         "telefono": "+54 11 5555-1001", "email": "juan.perez@email.com"},
        {"nombre": "Maria", "apellido": "Garcia", "dni_cuit": "28456789",
         "telefono": "+54 11 5555-1002", "email": "maria.garcia@email.com"},
        {"nombre": "Carlos", "apellido": "Lopez", "dni_cuit": "35789012",
         "telefono": "+54 11 5555-1003", "email": "carlos.lopez@email.com"},
    ]

    for data in clientes_data:
        c = Cliente(tenant_id=tenant_id, **data)
        db.add(c)

    print(f"  {len(clientes_data)} clientes de ejemplo creados")


async def seed_platform_admin():
    """Crear super-admin de la plataforma (sin tenant)."""
    async with admin_session_maker() as db:
        result = await db.execute(
            select(PlatformUser).where(PlatformUser.email == "superadmin@saas.com")
        )
        if result.scalar_one_or_none():
            print("  Super-admin ya existe. Saltando.")
            return

        # Create a platform tenant for admin
        platform_tenant = Tenant(
            nombre="Alfredo Platform",
            vertical=VERTICAL,
            email_contacto="superadmin@saas.com",
            plan=PlanTier.PREMIUM,
            activa=True,
            settings={"role": "platform"},
        )
        db.add(platform_tenant)
        await db.flush()

        admin = PlatformUser(
            tenant_id=platform_tenant.id,
            username="superadmin",
            email="superadmin@saas.com",
            hashed_password=get_password_hash("SuperAdmin2024!"),
            nombre="Super",
            apellido="Admin",
            rol=RolUsuario.ADMIN,
            is_platform_admin=True,
            activo=True,
        )
        db.add(admin)
        await db.commit()
        print("  Super-admin creado: superadmin@saas.com / SuperAdmin2024!")


async def main():
    print("=== Alfredo — Seed Data ===\n")

    print("1. Creando tablas...")
    await create_tables()
    print("   OK\n")

    print("2. Creando super-admin de plataforma...")
    await seed_platform_admin()
    print()

    print("3. Creando tenant demo (Autos)...")
    await seed_demo_tenant(
        nombre="Demo Automotores",
        admin_email="admin@demo.com",
        admin_password="demo1234",
    )
    print()

    print("=== Seed completado ===")
    await admin_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
