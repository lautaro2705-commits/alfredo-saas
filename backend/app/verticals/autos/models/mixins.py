"""
Mixins para todos los modelos de la vertical Autos.

- TenantMixin: multi-tenant con RLS
- SoftDeleteMixin: borrado lógico (nunca se pierde data)
"""
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func


class TenantMixin:
    """Agrega tenant_id a cualquier modelo.

    RLS en PostgreSQL filtra automáticamente por tenant,
    pero la columna debe existir en cada tabla.

    RESTRICT: impide borrar un tenant si tiene datos asociados.
    Esto protege contra borrados accidentales en cascada.
    """
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class SoftDeleteMixin:
    """Borrado lógico: los registros nunca se eliminan físicamente.

    deleted_at = None  → registro activo
    deleted_at = timestamp → registro "eliminado" (oculto en queries normales)
    deleted_by = UUID del usuario que eliminó

    Uso en queries:
        select(Model).where(Model.active(), ...)
    """
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)

    @classmethod
    def active(cls):
        """Filtro para registros NO eliminados. Usar en WHERE."""
        return cls.deleted_at.is_(None)

    @classmethod
    def is_deleted(cls):
        """Filtro para registros eliminados. Usar en WHERE."""
        return cls.deleted_at.isnot(None)
