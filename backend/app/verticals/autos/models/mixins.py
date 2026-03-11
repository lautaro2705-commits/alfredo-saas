"""
Mixin multi-tenant para todos los modelos de la vertical Autos.
Agrega tenant_id + configura RLS.
"""
from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID


class TenantMixin:
    """Agrega tenant_id a cualquier modelo.

    RLS en PostgreSQL filtra automáticamente por tenant,
    pero la columna debe existir en cada tabla.
    """
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
