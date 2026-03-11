"""
Base de datos async con soporte para Row Level Security (RLS).

IMPORTANTE:
- La app conecta como saas_app (no-superuser) → RLS aplica.
- Cada request abre una transacción donde SET LOCAL fija el tenant_id.
- SET LOCAL solo vive dentro de la transacción actual (seguridad).
- Para seed/migraciones usar ADMIN_DATABASE_URL (postgres superuser).
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import text
from app.core.config import settings

# ── Engine principal (saas_app, respeta RLS) ──
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# ── Engine admin (postgres superuser, para seed/migraciones) ──
admin_engine = create_async_engine(
    settings.ADMIN_DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=2,
    max_overflow=5,
)

async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Session maker para tareas admin (seed, migraciones)
admin_session_maker = sessionmaker(
    admin_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    Dependency para obtener sesión de base de datos.

    Usa autobegin de SQLAlchemy 2.0: la primera operación
    (normalmente set_tenant_context) abre una transacción implícita.
    SET LOCAL persiste dentro de esa transacción.
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def set_tenant_context(session: AsyncSession, tenant_id: str):
    """
    Setea el tenant_id en PostgreSQL para Row Level Security.

    CRITICO: Debe ejecutarse antes de CUALQUIER query en el request.
    Funciona porque:
    1. La app conecta como saas_app (no-superuser) → RLS aplica
    2. SET LOCAL vive dentro de la transacción autobegin de SQLAlchemy
    3. Al cerrar la sesión, la transacción termina y el SET LOCAL desaparece
    """
    from uuid import UUID
    # Validar UUID estricto para prevenir SQL injection
    validated = str(UUID(str(tenant_id)))
    await session.execute(
        text(f"SET LOCAL app.current_tenant_id = '{validated}'")
    )
