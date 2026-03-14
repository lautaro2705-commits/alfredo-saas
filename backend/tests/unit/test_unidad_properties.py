"""
Unit tests para propiedades calculadas del modelo Unidad.

Testea la lógica de negocio pura sin depender de DB:
- dias_en_stock: cuántos días lleva una unidad en stock
- costo_total: costo compra + transferencia + costos directos
- stock_inmovilizado: si la unidad supera el umbral de días
- competitividad_precio: si el precio publicado es competitivo vs mercado
- cache_mercado_vigente: si el cache de precios de mercado es válido (48h)
"""
from datetime import date, datetime, timedelta
from types import SimpleNamespace


# ── Funciones extraídas del modelo (lógica idéntica a Unidad properties) ──

def dias_en_stock(fecha_ingreso: date, fecha_venta: date = None) -> int:
    if fecha_venta:
        return (fecha_venta - fecha_ingreso).days
    return (date.today() - fecha_ingreso).days


def costo_total(precio_compra: float, gastos_transferencia: float = None,
                costos_directos: list = None) -> float:
    costos = sum(c.monto for c in costos_directos) if costos_directos else 0
    return precio_compra + (gastos_transferencia or 0) + costos


def stock_inmovilizado(dias: int, estado: str, umbral: int = 60) -> bool:
    return dias > umbral and estado == "disponible"


def competitividad_precio(valor_mercado, precio_publicado):
    if not valor_mercado or not precio_publicado:
        return None
    if precio_publicado <= valor_mercado:
        return "competitivo"
    return "desfasado"


def cache_mercado_vigente(fecha_ultima_consulta):
    if not fecha_ultima_consulta:
        return False
    horas_cache = 48
    fecha_consulta = fecha_ultima_consulta
    if hasattr(fecha_consulta, 'tzinfo') and fecha_consulta.tzinfo:
        ahora = datetime.now(fecha_consulta.tzinfo)
    else:
        ahora = datetime.now()
        if hasattr(fecha_consulta, 'replace'):
            fecha_consulta = fecha_consulta.replace(tzinfo=None)
    return ahora - fecha_consulta < timedelta(hours=horas_cache)


# ── Tests ──

class TestDiasEnStock:
    """Calcula cuántos días lleva una unidad en el inventario."""

    def test_unidad_disponible_45_dias(self):
        ingreso = date.today() - timedelta(days=45)
        assert dias_en_stock(ingreso) == 45

    def test_unidad_vendida_usa_fecha_venta(self):
        ingreso = date(2026, 1, 1)
        venta = date(2026, 1, 15)
        assert dias_en_stock(ingreso, venta) == 14

    def test_ingreso_hoy_da_cero(self):
        assert dias_en_stock(date.today()) == 0

    def test_ingreso_ayer(self):
        assert dias_en_stock(date.today() - timedelta(days=1)) == 1


class TestCostoTotal:
    """Costo total = precio compra + gastos transferencia + sum(costos directos)."""

    def test_solo_precio_compra(self):
        assert costo_total(5_000_000) == 5_000_000

    def test_con_gastos_transferencia(self):
        assert costo_total(5_000_000, 200_000) == 5_200_000

    def test_con_costos_directos(self):
        costos = [
            SimpleNamespace(monto=50_000),
            SimpleNamespace(monto=30_000),
        ]
        assert costo_total(5_000_000, 200_000, costos) == 5_280_000

    def test_gastos_transferencia_none(self):
        costos = [SimpleNamespace(monto=100_000)]
        assert costo_total(5_000_000, None, costos) == 5_100_000

    def test_sin_costos_directos_lista_vacia(self):
        assert costo_total(5_000_000, 200_000, []) == 5_200_000


class TestStockInmovilizado:
    """Una unidad está inmovilizada si supera el umbral de días Y está disponible."""

    def test_inmovilizado_true(self):
        assert stock_inmovilizado(120, "disponible", umbral=60) is True

    def test_inmovilizado_false_vendido(self):
        """Aunque tenga muchos días, si fue vendida no cuenta."""
        assert stock_inmovilizado(120, "vendido", umbral=60) is False

    def test_inmovilizado_false_pocos_dias(self):
        assert stock_inmovilizado(30, "disponible", umbral=60) is False

    def test_exactamente_en_el_umbral_no_es_inmovilizado(self):
        """Boundary: > umbral, no >="""
        assert stock_inmovilizado(60, "disponible", umbral=60) is False

    def test_un_dia_sobre_umbral(self):
        assert stock_inmovilizado(61, "disponible", umbral=60) is True

    def test_reservado_no_es_inmovilizado(self):
        assert stock_inmovilizado(120, "reservado", umbral=60) is False


class TestCompetitividadPrecio:
    """Compara precio publicado vs valor de mercado."""

    def test_competitivo(self):
        assert competitividad_precio(10_000_000, 9_500_000) == "competitivo"

    def test_competitivo_precio_igual(self):
        """Publicado == mercado es competitivo (<=)."""
        assert competitividad_precio(10_000_000, 10_000_000) == "competitivo"

    def test_desfasado(self):
        assert competitividad_precio(10_000_000, 11_000_000) == "desfasado"

    def test_sin_valor_mercado(self):
        assert competitividad_precio(None, 10_000_000) is None

    def test_sin_precio_publicado(self):
        assert competitividad_precio(10_000_000, None) is None

    def test_ambos_none(self):
        assert competitividad_precio(None, None) is None


class TestCacheMercadoVigente:
    """Cache de precios de mercado válido por 48 horas."""

    def test_consulta_reciente_vigente(self):
        consulta = datetime.now() - timedelta(hours=1)
        assert cache_mercado_vigente(consulta) is True

    def test_consulta_vieja_no_vigente(self):
        consulta = datetime.now() - timedelta(hours=49)
        assert cache_mercado_vigente(consulta) is False

    def test_sin_consulta_previa(self):
        assert cache_mercado_vigente(None) is False

    def test_exactamente_48_horas_no_vigente(self):
        """Boundary: < 48h, no <="""
        consulta = datetime.now() - timedelta(hours=48)
        assert cache_mercado_vigente(consulta) is False
