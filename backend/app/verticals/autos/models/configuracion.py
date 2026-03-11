from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin


class ConfiguracionNegocio(TenantMixin, Base):
    """Configuraciones del sistema para parametros de negocio (key-value)."""
    __tablename__ = "configuracion_negocio"
    __table_args__ = (
        UniqueConstraint("tenant_id", "clave", name="uq_config_tenant_clave"),
    )

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(100), nullable=False, index=True)  # unique per-tenant, not global
    valor = Column(String(255), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(50), default="string")  # string, number, boolean

    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=True)

    @classmethod
    async def get_valor(cls, db, clave: str, default=None):
        """Obtener valor de configuracion por clave (async)."""
        result = await db.execute(
            select(cls).where(cls.clave == clave)
        )
        config = result.scalar_one_or_none()
        if not config:
            return default
        if config.tipo == "number":
            return float(config.valor)
        if config.tipo == "boolean":
            return config.valor.lower() in ("true", "1", "yes")
        return config.valor

    @classmethod
    async def set_valor(cls, db, clave: str, valor, user_id=None):
        """Establecer valor de configuracion — crea si no existe (async)."""
        result = await db.execute(
            select(cls).where(cls.clave == clave)
        )
        config = result.scalar_one_or_none()
        if config:
            config.valor = str(valor)
            config.updated_by = user_id
        else:
            tipo = "number" if isinstance(valor, (int, float)) or str(valor).replace('.', '').isdigit() else "string"
            config = cls(
                clave=clave,
                valor=str(valor),
                tipo=tipo,
                updated_by=user_id,
            )
            db.add(config)
        await db.commit()
        await db.refresh(config)
        return config
