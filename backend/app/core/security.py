"""
Sistema de autenticación — Alfredo.
Token unificado: user + tenant + rol + plan.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, set_tenant_context


# ── Password Hashing ──
# Explicitly set bcrypt rounds (default is 12, we use 13 for stronger hashing).
# Higher rounds = slower hash = harder brute-force, but also slower login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=13)
security_scheme = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── Token Context (lo que viaja en el JWT) ──
class TokenContext(BaseModel):
    """Datos extraídos del JWT: identifica user + tenant."""
    user_id: UUID
    username: str
    tenant_id: UUID
    tenant_name: str
    vertical: str  # "autos"
    rol: str
    plan: str
    permissions: list[str] = []
    is_platform_admin: bool = False

    class Config:
        frozen = True


# ── JWT Creation / Decoding ──
def create_access_token(
    user_id: str,
    username: str,
    tenant_id: str,
    tenant_name: str,
    vertical: str,
    rol: str,
    plan: str,
    permissions: list[str] = None,
    is_platform_admin: bool = False,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": username,
        "user_id": str(user_id),
        "tenant_id": str(tenant_id),
        "tenant_name": tenant_name,
        "vertical": vertical,
        "rol": rol,
        "plan": plan,
        "permissions": permissions or [],
        "is_platform_admin": is_platform_admin,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenContext:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return TokenContext(
            user_id=payload["user_id"],
            username=payload["sub"],
            tenant_id=payload["tenant_id"],
            tenant_name=payload["tenant_name"],
            vertical=payload["vertical"],
            rol=payload["rol"],
            plan=payload["plan"],
            permissions=payload.get("permissions", []),
            is_platform_admin=payload.get("is_platform_admin", False),
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
        )
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )


# ── FastAPI Dependencies ──
async def get_current_token(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> TokenContext:
    """Extrae y valida el token JWT."""
    return decode_token(credentials.credentials)


async def get_current_user_with_tenant(
    token: TokenContext = Depends(get_current_token),
    db: AsyncSession = Depends(get_db),
) -> TokenContext:
    """Extrae token Y setea contexto RLS en la DB."""
    await set_tenant_context(db, str(token.tenant_id))
    return token


def require_role(*roles: str):
    """Dependency factory: requiere uno de los roles especificados + setea RLS."""
    async def checker(token: TokenContext = Depends(get_current_user_with_tenant)):
        if token.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{token.rol}' no tiene permisos. Requiere: {', '.join(roles)}",
            )
        return token
    return checker


def require_permission(permission: str):
    """Dependency factory: requiere un permiso específico + setea RLS."""
    async def checker(token: TokenContext = Depends(get_current_user_with_tenant)):
        if permission not in token.permissions and not token.is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso '{permission}' requerido",
            )
        return token
    return checker


def require_platform_admin():
    """Dependency: solo super-admins de la plataforma."""
    async def checker(token: TokenContext = Depends(get_current_token)):
        if not token.is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido a administradores de la plataforma",
            )
        return token
    return checker
