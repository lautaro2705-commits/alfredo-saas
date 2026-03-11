"""
Configuración del checklist de peritaje predefinido.
Define los items a evaluar en cada sector del vehículo.
"""
from typing import Dict, List, TypedDict


class ChecklistItem(TypedDict):
    codigo: str
    nombre: str
    orden: int


# Checklist predefinido por sector
CHECKLIST_ITEMS: Dict[str, List[ChecklistItem]] = {
    "mecanica": [
        {"codigo": "MEC_MOTOR_01", "nombre": "Estado general del motor", "orden": 1},
        {"codigo": "MEC_MOTOR_02", "nombre": "Nivel y estado de aceite", "orden": 2},
        {"codigo": "MEC_MOTOR_03", "nombre": "Nivel de refrigerante", "orden": 3},
        {"codigo": "MEC_MOTOR_04", "nombre": "Correas y mangueras", "orden": 4},
        {"codigo": "MEC_TRANS_01", "nombre": "Caja de cambios", "orden": 5},
        {"codigo": "MEC_TRANS_02", "nombre": "Embrague (si aplica)", "orden": 6},
        {"codigo": "MEC_FRENOS_01", "nombre": "Sistema de frenos delanteros", "orden": 7},
        {"codigo": "MEC_FRENOS_02", "nombre": "Sistema de frenos traseros", "orden": 8},
        {"codigo": "MEC_FRENOS_03", "nombre": "Freno de mano", "orden": 9},
        {"codigo": "MEC_SUSP_01", "nombre": "Suspensión delantera", "orden": 10},
        {"codigo": "MEC_SUSP_02", "nombre": "Suspensión trasera", "orden": 11},
        {"codigo": "MEC_DIR_01", "nombre": "Dirección y tren delantero", "orden": 12},
        {"codigo": "MEC_ELEC_01", "nombre": "Batería", "orden": 13},
        {"codigo": "MEC_ELEC_02", "nombre": "Sistema de arranque", "orden": 14},
        {"codigo": "MEC_ELEC_03", "nombre": "Alternador/carga", "orden": 15},
        {"codigo": "MEC_AIRE_01", "nombre": "Aire acondicionado", "orden": 16},
        {"codigo": "MEC_ESCAPE_01", "nombre": "Sistema de escape", "orden": 17},
        {"codigo": "MEC_NEUM_01", "nombre": "Estado de neumáticos", "orden": 18},
        {"codigo": "MEC_NEUM_02", "nombre": "Neumático de auxilio", "orden": 19},
    ],
    "estetica": [
        {"codigo": "EST_EXT_01", "nombre": "Pintura exterior general", "orden": 1},
        {"codigo": "EST_EXT_02", "nombre": "Carrocería (abolladuras/golpes)", "orden": 2},
        {"codigo": "EST_EXT_03", "nombre": "Parabrisas delantero", "orden": 3},
        {"codigo": "EST_EXT_04", "nombre": "Luneta trasera", "orden": 4},
        {"codigo": "EST_EXT_05", "nombre": "Vidrios laterales", "orden": 5},
        {"codigo": "EST_EXT_06", "nombre": "Ópticas delanteras", "orden": 6},
        {"codigo": "EST_EXT_07", "nombre": "Ópticas traseras", "orden": 7},
        {"codigo": "EST_EXT_08", "nombre": "Espejos retrovisores", "orden": 8},
        {"codigo": "EST_EXT_09", "nombre": "Paragolpes delantero", "orden": 9},
        {"codigo": "EST_EXT_10", "nombre": "Paragolpes trasero", "orden": 10},
        {"codigo": "EST_LLANTAS_01", "nombre": "Estado de llantas", "orden": 11},
        {"codigo": "EST_INT_01", "nombre": "Tablero/instrumentos", "orden": 12},
        {"codigo": "EST_INT_02", "nombre": "Asientos delanteros", "orden": 13},
        {"codigo": "EST_INT_03", "nombre": "Asientos traseros", "orden": 14},
        {"codigo": "EST_INT_04", "nombre": "Tapizado/alfombras", "orden": 15},
        {"codigo": "EST_INT_05", "nombre": "Volante", "orden": 16},
        {"codigo": "EST_INT_06", "nombre": "Consola central", "orden": 17},
        {"codigo": "EST_INT_07", "nombre": "Techo interior", "orden": 18},
        {"codigo": "EST_INT_08", "nombre": "Baúl/maletero", "orden": 19},
    ],
    "documentacion": [
        {"codigo": "DOC_TIT_01", "nombre": "Título automotor presente", "orden": 1},
        {"codigo": "DOC_TIT_02", "nombre": "Titular coincide con vendedor", "orden": 2},
        {"codigo": "DOC_TIT_03", "nombre": "Sin prendas ni embargos", "orden": 3},
        {"codigo": "DOC_VPA_01", "nombre": "Verificación Policial (VPA) vigente", "orden": 4},
        {"codigo": "DOC_VTV_01", "nombre": "VTV/RTO vigente", "orden": 5},
        {"codigo": "DOC_DOM_01", "nombre": "Informe de dominio limpio", "orden": 6},
        {"codigo": "DOC_MUL_01", "nombre": "Sin multas pendientes", "orden": 7},
        {"codigo": "DOC_PAT_01", "nombre": "Patentes al día", "orden": 8},
        {"codigo": "DOC_SEG_01", "nombre": "Póliza de seguro vigente", "orden": 9},
        {"codigo": "DOC_LLAVE_01", "nombre": "Llaves originales completas", "orden": 10},
        {"codigo": "DOC_LLAVE_02", "nombre": "Llave de auxilio/copia", "orden": 11},
        {"codigo": "DOC_MAN_01", "nombre": "Manual de usuario", "orden": 12},
        {"codigo": "DOC_SERV_01", "nombre": "Libreta/historial de service", "orden": 13},
    ]
}


def get_checklist_items(sector: str) -> List[ChecklistItem]:
    return CHECKLIST_ITEMS.get(sector, [])


def get_all_checklist_items() -> Dict[str, List[ChecklistItem]]:
    return CHECKLIST_ITEMS


def get_total_items_count() -> int:
    return sum(len(items) for items in CHECKLIST_ITEMS.values())


def get_sector_items_count(sector: str) -> int:
    return len(CHECKLIST_ITEMS.get(sector, []))


# Constantes de configuración
PUNTAJE_BUENO = 100
PUNTAJE_REGULAR = 50
PUNTAJE_MALO = 0

PESO_MECANICA_DEFAULT = 40
PESO_ESTETICA_DEFAULT = 35
PESO_DOCUMENTACION_DEFAULT = 25

UMBRAL_EXCELENTE = 80
UMBRAL_BUENO = 60
UMBRAL_REGULAR = 40

FACTOR_AJUSTE_PRECIO = 0.15


def calcular_ajuste_precio(puntaje_total: float, precio_mercado: float) -> float:
    if puntaje_total >= 100:
        return 0
    factor_descuento = (100 - puntaje_total) / 100
    ajuste = -factor_descuento * precio_mercado * FACTOR_AJUSTE_PRECIO
    return round(ajuste, 2)


def obtener_resumen_estado(puntaje_total: float) -> str:
    if puntaje_total >= UMBRAL_EXCELENTE:
        return "Excelente"
    elif puntaje_total >= UMBRAL_BUENO:
        return "Bueno"
    elif puntaje_total >= UMBRAL_REGULAR:
        return "Regular"
    return "Malo"


def obtener_recomendacion(puntaje_total: float, costo_reparaciones: float) -> str:
    if puntaje_total >= UMBRAL_EXCELENTE:
        return "Vehículo en excelente estado. Recomendado para compra/retoma con mínimo descuento."
    elif puntaje_total >= UMBRAL_BUENO:
        if costo_reparaciones > 0:
            return f"Vehículo en buen estado con reparaciones menores estimadas en ${costo_reparaciones:,.0f}. Considerar en el precio."
        return "Vehículo en buen estado general. Apto para compra/retoma."
    elif puntaje_total >= UMBRAL_REGULAR:
        return f"Vehículo en estado regular. Reparaciones estimadas: ${costo_reparaciones:,.0f}. Negociar precio considerando inversión necesaria."
    else:
        return f"Vehículo en mal estado. Requiere inversión significativa (~${costo_reparaciones:,.0f}). Evaluar si conviene la operación."
