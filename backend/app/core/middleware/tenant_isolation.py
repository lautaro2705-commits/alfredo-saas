"""
Middleware de aislamiento de tenants via PostgreSQL RLS.
"""
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from sqlalchemy import text


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Setea el tenant_id en PostgreSQL para RLS en cada request.
    CRITICO: Debe ejecutarse antes de cualquier query a la DB.
    """

    EXCLUDED_PATHS = {"/health", "/api/docs", "/api/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        tenant_id: Optional[str] = getattr(request.state, "tenant_id", None)

        if tenant_id:
            db = getattr(request.state, "db", None)
            if db:
                from uuid import UUID
                validated = str(UUID(str(tenant_id)))
                await db.execute(
                    text(f"SET LOCAL app.current_tenant_id = '{validated}'")
                )
                request.state.validated_tenant_id = validated

        response = await call_next(request)
        return response
