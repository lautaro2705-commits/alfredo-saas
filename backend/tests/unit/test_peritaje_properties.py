"""
Unit tests para propiedades calculadas de Peritaje y PeritajeItem.

El peritaje es la evaluación técnica/estética de un vehículo:
- resumen_estado: clasificación textual según puntaje (Excelente/Bueno/Regular/Malo)
- porcentaje_completado: % de items calificados vs total
- valor_puntaje: score numérico por calificación de item
"""


# ── Lógica extraída de los modelos ──

def resumen_estado(puntaje_total: float) -> str:
    if puntaje_total >= 80:
        return "Excelente"
    elif puntaje_total >= 60:
        return "Bueno"
    elif puntaje_total >= 40:
        return "Regular"
    return "Malo"


def porcentaje_completado(items_total: int, items_calificados: int) -> float:
    if items_total == 0:
        return 0
    return round((items_calificados / items_total) * 100, 1)


def valor_puntaje(calificacion: str):
    if calificacion == "bueno":
        return 100
    elif calificacion == "regular":
        return 50
    elif calificacion == "malo":
        return 0
    return None  # NA no cuenta en el cálculo


# ── Tests ──

class TestResumenEstado:
    """Clasifica el estado general del vehículo según su puntaje."""

    def test_excelente(self):
        assert resumen_estado(85) == "Excelente"

    def test_bueno(self):
        assert resumen_estado(65) == "Bueno"

    def test_regular(self):
        assert resumen_estado(45) == "Regular"

    def test_malo(self):
        assert resumen_estado(20) == "Malo"

    # Boundaries exactos
    def test_boundary_80_es_excelente(self):
        assert resumen_estado(80) == "Excelente"

    def test_boundary_79_es_bueno(self):
        assert resumen_estado(79) == "Bueno"

    def test_boundary_60_es_bueno(self):
        assert resumen_estado(60) == "Bueno"

    def test_boundary_59_es_regular(self):
        assert resumen_estado(59) == "Regular"

    def test_boundary_40_es_regular(self):
        assert resumen_estado(40) == "Regular"

    def test_boundary_39_es_malo(self):
        assert resumen_estado(39) == "Malo"

    def test_puntaje_cero(self):
        assert resumen_estado(0) == "Malo"

    def test_puntaje_100(self):
        assert resumen_estado(100) == "Excelente"


class TestPorcentajeCompletado:
    """Porcentaje de items del checklist que ya fueron evaluados."""

    def test_todos_calificados(self):
        assert porcentaje_completado(10, 10) == 100.0

    def test_parcial(self):
        assert porcentaje_completado(10, 3) == 30.0

    def test_sin_items(self):
        """Edge case: peritaje sin items → evita division by zero."""
        assert porcentaje_completado(0, 0) == 0

    def test_uno_de_tres(self):
        assert porcentaje_completado(3, 1) == 33.3

    def test_ninguno_calificado(self):
        assert porcentaje_completado(10, 0) == 0.0

    def test_redondeo(self):
        """Verifica redondeo a 1 decimal."""
        result = porcentaje_completado(7, 3)
        assert result == 42.9  # 3/7 * 100 = 42.857...


class TestValorPuntaje:
    """Score numérico asignado a cada calificación de item."""

    def test_bueno(self):
        assert valor_puntaje("bueno") == 100

    def test_regular(self):
        assert valor_puntaje("regular") == 50

    def test_malo(self):
        assert valor_puntaje("malo") == 0

    def test_na_retorna_none(self):
        """NA (no aplica) no cuenta en el cálculo — retorna None."""
        assert valor_puntaje("na") is None

    def test_valor_desconocido_retorna_none(self):
        assert valor_puntaje("otro") is None
