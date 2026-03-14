"""
Unit tests para propiedades calculadas del modelo Operacion.

Testea cálculos financieros críticos que se muestran al usuario
y se usan en reportes de rentabilidad:
- utilidad_bruta: precio_venta - costo_total_unidad
- monto_neto_recibido: precio_venta - retoma_valor
"""
from types import SimpleNamespace


# ── Lógica extraída del modelo ──

def utilidad_bruta(precio_venta: float, unidad_vendida=None) -> float:
    if unidad_vendida:
        return precio_venta - unidad_vendida.costo_total
    return 0


def monto_neto_recibido(precio_venta: float, retoma_valor=None) -> float:
    return precio_venta - (retoma_valor or 0)


# ── Tests ──

class TestUtilidadBruta:
    """Utilidad bruta = precio de venta - costo total de la unidad."""

    def test_utilidad_positiva(self):
        unidad = SimpleNamespace(costo_total=5_000_000)
        assert utilidad_bruta(8_000_000, unidad) == 3_000_000

    def test_utilidad_negativa_vendida_a_perdida(self):
        """Cuando se vende por debajo del costo, la utilidad es negativa."""
        unidad = SimpleNamespace(costo_total=5_000_000)
        assert utilidad_bruta(4_000_000, unidad) == -1_000_000

    def test_utilidad_cero(self):
        unidad = SimpleNamespace(costo_total=5_000_000)
        assert utilidad_bruta(5_000_000, unidad) == 0

    def test_sin_unidad_asociada(self):
        """Operación sin unidad vendida retorna 0 (edge case)."""
        assert utilidad_bruta(8_000_000, None) == 0

    def test_utilidad_con_costos_directos_altos(self):
        """Costo total incluye costos directos (reparaciones, etc)."""
        unidad = SimpleNamespace(costo_total=7_500_000)  # compra + reparaciones
        assert utilidad_bruta(8_000_000, unidad) == 500_000


class TestMontoNetoRecibido:
    """Monto neto = precio de venta - valor de retoma (si hay)."""

    def test_con_retoma(self):
        assert monto_neto_recibido(8_000_000, 3_000_000) == 5_000_000

    def test_sin_retoma(self):
        """Sin retoma, el neto es todo el precio de venta."""
        assert monto_neto_recibido(8_000_000, None) == 8_000_000

    def test_retoma_cero(self):
        assert monto_neto_recibido(8_000_000, 0) == 8_000_000

    def test_retoma_mayor_que_venta(self):
        """Edge case: retoma vale más que la venta (neto negativo)."""
        assert monto_neto_recibido(5_000_000, 6_000_000) == -1_000_000

    def test_retoma_igual_a_venta(self):
        """Operación solo de canje — neto = 0."""
        assert monto_neto_recibido(5_000_000, 5_000_000) == 0
