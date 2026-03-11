"""
Modelo de usuario — Alfredo.
Multi-tenant con UUID PK. Cada usuario pertenece a un tenant.
"""
import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RolUsuario(str, enum.Enum):
    """Roles del sistema — heredados de Alfredo + platform_admin."""
    ADMIN = "admin"
    VENDEDOR = "vendedor"
    GESTOR = "gestor"
    ADMINISTRATIVO = "administrativo"


# Catálogo completo de permisos (de Alfredo)
PERMISOS_DISPONIBLES = {
    # Stock
    "ver_stock": "Ver listado de stock",
    "crear_unidad": "Crear nuevas unidades",
    "editar_unidad": "Editar unidades existentes",
    "eliminar_unidad": "Eliminar unidades",
    "ver_costos": "Ver costos y precios de compra",
    "editar_precios": "Modificar precios",
    "ver_valorizacion": "Ver valorización del stock",
    # Clientes
    "ver_clientes": "Ver listado de clientes",
    "crear_cliente": "Crear clientes",
    "editar_cliente": "Editar clientes",
    # Operaciones/Ventas
    "ver_operaciones": "Ver operaciones",
    "ver_todas_operaciones": "Ver operaciones de todos los vendedores",
    "crear_operacion": "Crear operaciones de venta",
    "completar_operacion": "Completar/finalizar ventas",
    "cancelar_operacion": "Cancelar operaciones",
    "eliminar_operacion": "Eliminar operaciones",
    # Caja
    "ver_caja": "Ver movimientos de caja",
    "crear_movimiento_caja": "Crear movimientos de caja",
    "eliminar_movimiento_caja": "Eliminar movimientos",
    "ver_cierres": "Ver cierres de caja",
    "crear_cierre": "Crear cierres de caja",
    # Cheques
    "ver_cheques": "Ver cheques",
    "gestionar_cheques": "Crear/editar/depositar cheques",
    # Documentación
    "ver_documentacion": "Ver documentación de unidades",
    "editar_documentacion": "Editar documentación",
    "gestionar_gestoria": "Gestionar trámites de gestoría",
    # Reportes
    "ver_reportes": "Ver reportes",
    "ver_inteligencia": "Ver inteligencia de negocio",
    "editar_configuracion": "Editar configuración del sistema",
    # Usuarios
    "ver_usuarios": "Ver listado de usuarios",
    "gestionar_usuarios": "Crear/editar usuarios",
    # CRM
    "ver_interesados": "Ver lista de interesados",
    "gestionar_interesados": "Crear/editar interesados",
}

PERMISOS_POR_ROL = {
    "admin": list(PERMISOS_DISPONIBLES.keys()),
    "vendedor": [
        "ver_stock", "ver_clientes", "crear_cliente", "editar_cliente",
        "ver_operaciones", "crear_operacion",
        "ver_interesados", "gestionar_interesados",
        "ver_documentacion",
    ],
    "gestor": [
        "ver_stock", "ver_documentacion", "editar_documentacion",
        "gestionar_gestoria", "ver_clientes",
    ],
    "administrativo": [
        "ver_stock", "ver_costos", "ver_clientes",
        "ver_operaciones", "ver_todas_operaciones",
        "ver_caja", "crear_movimiento_caja", "ver_cierres",
        "ver_cheques", "gestionar_cheques",
        "ver_reportes", "ver_documentacion",
    ],
}


class PlatformUser(Base):
    __tablename__ = "platform_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relación con tenant
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Credenciales
    username = Column(String(50), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Datos personales
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    telefono = Column(String(50))

    # Rol y permisos
    rol = Column(Enum(RolUsuario), default=RolUsuario.VENDEDOR)
    permisos_custom = Column(JSONB, nullable=True)  # null = usar defaults del rol
    activo = Column(Boolean, default=True)

    # Super-admin de la plataforma (solo para nosotros)
    is_platform_admin = Column(Boolean, default=False)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))

    # Relationships
    tenant = relationship("Tenant", backref="usuarios")

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"

    @property
    def permisos(self) -> list:
        """Permisos efectivos: custom si existen, sino defaults del rol."""
        if self.permisos_custom:
            return self.permisos_custom
        return PERMISOS_POR_ROL.get(self.rol.value, [])

    def tiene_permiso(self, permiso: str) -> bool:
        if self.is_platform_admin or self.rol == RolUsuario.ADMIN:
            return True
        return permiso in self.permisos

    def __repr__(self):
        return f"<PlatformUser {self.username} @ tenant={self.tenant_id}>"
