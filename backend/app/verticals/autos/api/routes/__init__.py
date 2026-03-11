"""
Autos vertical — all routers collected for easy mounting.

Usage in main.py:
    from app.verticals.autos.api.routes import autos_routers
    for r in autos_routers:
        app.include_router(r, prefix="/api/v1")
"""
from app.verticals.autos.api.routes.unidades import router as unidades_router
from app.verticals.autos.api.routes.clientes import router as clientes_router
from app.verticals.autos.api.routes.operaciones import router as operaciones_router
from app.verticals.autos.api.routes.caja_diaria import router as caja_router
from app.verticals.autos.api.routes.cheques import router as cheques_router
from app.verticals.autos.api.routes.reportes import router as reportes_router
from app.verticals.autos.api.routes.interesados import router as interesados_router
from app.verticals.autos.api.routes.inteligencia_negocio import router as inteligencia_router
from app.verticals.autos.api.routes.seguimientos import router as seguimientos_router
from app.verticals.autos.api.routes.actividades import router as actividades_router
from app.verticals.autos.api.routes.precios_mercado import router as precios_router
from app.verticals.autos.api.routes.marketing import router as marketing_router
from app.verticals.autos.api.routes.usuarios import router as usuarios_router
from app.verticals.autos.api.routes.costos_directos import router as costos_router
from app.verticals.autos.api.routes.documentacion import router as documentacion_router
from app.verticals.autos.api.routes.peritajes import router as peritajes_router
from app.verticals.autos.api.routes.proveedores import router as proveedores_router
from app.verticals.autos.api.routes.archivos import router as archivos_router
from app.verticals.autos.api.routes.mercadolibre import router as mercadolibre_router
from app.verticals.autos.api.routes.dashboard import router as dashboard_router
from app.verticals.autos.api.routes.gastos_mensuales import router as gastos_router
from app.verticals.autos.api.routes.busqueda import router as busqueda_router

# All routers — each already has its own prefix (/autos/*)
autos_routers = [
    unidades_router,
    clientes_router,
    operaciones_router,
    caja_router,
    cheques_router,
    reportes_router,
    interesados_router,
    inteligencia_router,
    seguimientos_router,
    actividades_router,
    precios_router,
    marketing_router,
    usuarios_router,
    costos_router,
    documentacion_router,
    peritajes_router,
    proveedores_router,
    archivos_router,
    mercadolibre_router,
    dashboard_router,
    gastos_router,
    busqueda_router,
]
