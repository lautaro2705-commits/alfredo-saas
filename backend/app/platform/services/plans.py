"""
Plan definitions and pricing tiers — Alfredo (autos).
"""
from dataclasses import dataclass, field
from typing import Optional

UNLIMITED = 999_999


@dataclass(frozen=True)
class PlanConfig:
    name: str
    display_name: str
    price_ars: int  # monthly price in ARS (regular / list price)
    max_usuarios: int
    max_items: int  # vehicles
    features: list[str] = field(default_factory=list)
    # ── Promo / discount fields ──
    promo_price_ars: Optional[int] = None       # discounted monthly price
    promo_label: Optional[str] = None           # e.g. "Primeros 6 meses"
    annual_price_ars: Optional[int] = None      # monthly price if paid yearly
    annual_label: Optional[str] = None          # e.g. "Pago anual"


# ── Plans de Alfredo ──
PLANS: dict[str, PlanConfig] = {
    "trial": PlanConfig(
        name="trial",
        display_name="Trial (14 dias)",
        price_ars=0,
        max_usuarios=UNLIMITED,
        max_items=UNLIMITED,
        features=[
            "stock", "clientes", "operaciones", "caja", "reportes_basicos",
            "cheques", "mercadolibre", "peritajes", "reportes_avanzados",
            "inteligencia", "api", "soporte_prioritario",
        ],
    ),
    "basico": PlanConfig(
        name="basico",
        display_name="Basico",
        price_ars=70_000,
        max_usuarios=2,
        max_items=30,
        features=["stock", "clientes", "operaciones", "caja", "reportes_basicos"],
        promo_price_ars=49_000,
        promo_label="Primeros 6 meses",
    ),
    "profesional": PlanConfig(
        name="profesional",
        display_name="Profesional",
        price_ars=90_000,
        max_usuarios=5,
        max_items=100,
        features=[
            "stock", "clientes", "operaciones", "caja", "reportes_basicos",
            "cheques", "mercadolibre", "peritajes", "reportes_avanzados",
        ],
        promo_price_ars=69_000,
        promo_label="Primeros 6 meses",
    ),
    "premium": PlanConfig(
        name="premium",
        display_name="Premium",
        price_ars=200_000,
        max_usuarios=UNLIMITED,
        max_items=UNLIMITED,
        features=[
            "stock", "clientes", "operaciones", "caja", "reportes_basicos",
            "cheques", "mercadolibre", "peritajes", "reportes_avanzados",
            "inteligencia", "api", "soporte_prioritario",
        ],
        promo_price_ars=170_000,
        promo_label="Primer ano (pago mensual)",
        annual_price_ars=140_000,
        annual_label="Pago anual anticipado",
    ),
}


def get_plan_config(plan: str) -> PlanConfig:
    """Get plan config by plan name."""
    config = PLANS.get(plan)
    if not config:
        raise ValueError(f"Plan '{plan}' no existe")
    return config


def get_available_plans() -> list[dict]:
    """Return list of plans for frontend display."""
    result = []
    for p in PLANS.values():
        if p.name == "trial":
            continue
        entry = {
            "name": p.name,
            "display_name": p.display_name,
            "price_ars": p.price_ars,
            "max_usuarios": p.max_usuarios if p.max_usuarios < UNLIMITED else "unlimited",
            "max_items": p.max_items if p.max_items < UNLIMITED else "unlimited",
            "features": p.features,
        }
        if p.promo_price_ars is not None:
            entry["promo_price_ars"] = p.promo_price_ars
            entry["promo_label"] = p.promo_label
        if p.annual_price_ars is not None:
            entry["annual_price_ars"] = p.annual_price_ars
            entry["annual_label"] = p.annual_label
        result.append(entry)
    return result
