from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin


class MercadoLibreCredentials(TenantMixin, Base):
    """
    Almacena las credenciales OAuth de MercadoLibre por usuario.
    Cada vendedor puede conectar su propia cuenta de MercadoLibre.
    """
    __tablename__ = "mercadolibre_credentials"

    id = Column(Integer, primary_key=True, index=True)

    # Relación con usuario (1 cuenta ML por usuario)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"), unique=True, nullable=False)

    # Datos del usuario en MercadoLibre
    ml_user_id = Column(String(50), nullable=False)  # ID numérico en ML
    ml_nickname = Column(String(100))  # Nombre de usuario en ML

    # Tokens OAuth (se recomienda encriptar en producción)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)

    # Expiración del access_token
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relación
    usuario = relationship("PlatformUser")
