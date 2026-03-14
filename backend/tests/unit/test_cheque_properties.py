"""
Unit tests para propiedades calculadas de ChequeRecibido y ChequeEmitido.

Los cheques son el instrumento financiero más sensible del sistema:
- dias_para_vencer: días hasta el vencimiento (negativo = vencido)
- vencido: True solo si venció Y está en cartera
- dias_para_debito: días hasta el débito de cheques emitidos
"""
from datetime import date, timedelta


# ── Lógica extraída de los modelos ──

def dias_para_vencer(fecha_vencimiento):
    if fecha_vencimiento:
        return (fecha_vencimiento - date.today()).days
    return 0


def vencido(fecha_vencimiento, estado):
    dias = dias_para_vencer(fecha_vencimiento)
    return dias < 0 and estado == "en_cartera"


def dias_para_debito(fecha_pago):
    if fecha_pago:
        return (fecha_pago - date.today()).days
    return 0


# ── Tests ──

class TestDiasParaVencer:
    """Calcula días hasta el vencimiento de un cheque recibido."""

    def test_vence_en_5_dias(self):
        fecha = date.today() + timedelta(days=5)
        assert dias_para_vencer(fecha) == 5

    def test_vence_hoy(self):
        assert dias_para_vencer(date.today()) == 0

    def test_vencio_hace_3_dias(self):
        fecha = date.today() - timedelta(days=3)
        assert dias_para_vencer(fecha) == -3

    def test_sin_fecha_vencimiento(self):
        assert dias_para_vencer(None) == 0

    def test_vence_en_30_dias(self):
        fecha = date.today() + timedelta(days=30)
        assert dias_para_vencer(fecha) == 30


class TestVencido:
    """Un cheque está vencido solo si: días < 0 AND estado == EN_CARTERA."""

    def test_vencido_en_cartera(self):
        fecha = date.today() - timedelta(days=1)
        assert vencido(fecha, "en_cartera") is True

    def test_no_vencido_depositado(self):
        """Un cheque vencido pero ya depositado no cuenta como 'vencido'."""
        fecha = date.today() - timedelta(days=1)
        assert vencido(fecha, "depositado") is False

    def test_no_vencido_cobrado(self):
        fecha = date.today() - timedelta(days=5)
        assert vencido(fecha, "cobrado") is False

    def test_no_vencido_endosado(self):
        fecha = date.today() - timedelta(days=5)
        assert vencido(fecha, "endosado") is False

    def test_no_vencido_futuro_en_cartera(self):
        """Aún no venció, aunque esté en cartera."""
        fecha = date.today() + timedelta(days=5)
        assert vencido(fecha, "en_cartera") is False

    def test_vence_hoy_no_vencido(self):
        """Boundary: vence hoy (dias == 0) → no vencido (< 0 requerido)."""
        assert vencido(date.today(), "en_cartera") is False

    def test_vencio_ayer_en_cartera(self):
        fecha = date.today() - timedelta(days=1)
        assert vencido(fecha, "en_cartera") is True


class TestDiasParaDebito:
    """Calcula días hasta el débito de un cheque emitido."""

    def test_debito_en_3_dias(self):
        fecha = date.today() + timedelta(days=3)
        assert dias_para_debito(fecha) == 3

    def test_debito_hoy(self):
        assert dias_para_debito(date.today()) == 0

    def test_ya_debitado_hace_2_dias(self):
        fecha = date.today() - timedelta(days=2)
        assert dias_para_debito(fecha) == -2

    def test_sin_fecha_pago(self):
        assert dias_para_debito(None) == 0
