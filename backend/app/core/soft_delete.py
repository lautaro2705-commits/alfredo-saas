"""
Utilidades de borrado lógico (soft delete).

Nunca se elimina data físicamente — se marca con deleted_at.
"""
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession


async def soft_delete(
    db: AsyncSession,
    obj,
    deleted_by: Optional[UUID] = None,
    *,
    commit: bool = True,
):
    """Marca un objeto como eliminado (soft delete).

    Args:
        db: Sesión de base de datos
        obj: Objeto SQLAlchemy con SoftDeleteMixin
        deleted_by: UUID del usuario que elimina
        commit: Si hacer commit automáticamente
    """
    obj.deleted_at = datetime.now(timezone.utc)
    if deleted_by:
        obj.deleted_by = deleted_by
    if commit:
        await db.commit()


async def soft_delete_many(
    db: AsyncSession,
    objects: list,
    deleted_by: Optional[UUID] = None,
):
    """Marca múltiples objetos como eliminados en una sola transacción."""
    now = datetime.now(timezone.utc)
    for obj in objects:
        obj.deleted_at = now
        if deleted_by:
            obj.deleted_by = deleted_by
    await db.commit()


async def restore(db: AsyncSession, obj, *, commit: bool = True):
    """Restaura un objeto soft-deleted."""
    obj.deleted_at = None
    obj.deleted_by = None
    if commit:
        await db.commit()
