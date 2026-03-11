"""
Shim de compatibilidad: re-exporta PlatformUser como Usuario.

En el SaaS, los usuarios viven en platform_users (con tenant_id, UUID PK).
Este módulo permite que el código de la vertical Autos siga importando
'from ...models.usuario import Usuario, RolUsuario, ...' sin cambios.
"""
from app.platform.models.user import (
    PlatformUser as Usuario,
    RolUsuario,
    PERMISOS_DISPONIBLES,
    PERMISOS_POR_ROL,
)

__all__ = [
    "Usuario",
    "RolUsuario",
    "PERMISOS_DISPONIBLES",
    "PERMISOS_POR_ROL",
]
