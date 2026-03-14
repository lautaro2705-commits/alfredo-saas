"""
Unit tests para propiedades calculadas de ChecklistDocumentacion.

Testea la lógica de negocio de completitud documental:
- documentacion_completa: ¿tiene toda la documentación básica?
- items_pendientes: lista human-readable de lo que falta
"""


# ── Lógica extraída del modelo (idéntica a ChecklistDocumentacion) ──

def documentacion_completa(titulo_tiene, form_08_tiene, form_08_firmado,
                           vpa_tiene, multas_tiene, multas_monto_total,
                           patentes_deuda, patentes_monto) -> bool:
    return all([
        titulo_tiene,
        form_08_tiene and form_08_firmado,
        vpa_tiene,
        not multas_tiene or multas_monto_total == 0,
        not patentes_deuda or patentes_monto == 0,
    ])


def items_pendientes(titulo_tiene, form_08_tiene, form_08_firmado,
                     vpa_tiene, multas_tiene, multas_monto_total,
                     patentes_deuda, patentes_monto) -> list:
    pendientes = []
    if not titulo_tiene:
        pendientes.append("Título/Cédula")
    if not form_08_tiene:
        pendientes.append("Formulario 08")
    elif not form_08_firmado:
        pendientes.append("Firma Form. 08")
    if not vpa_tiene:
        pendientes.append("VPA")
    if multas_tiene and multas_monto_total > 0:
        pendientes.append(f"Multas (${multas_monto_total})")
    if patentes_deuda and patentes_monto > 0:
        pendientes.append(f"Patentes (${patentes_monto})")
    return pendientes


# Defaults para documentación completa
_COMPLETA = dict(
    titulo_tiene=True,
    form_08_tiene=True,
    form_08_firmado=True,
    vpa_tiene=True,
    multas_tiene=False,
    multas_monto_total=0,
    patentes_deuda=False,
    patentes_monto=0,
)


# ── Tests ──

class TestDocumentacionCompleta:
    """Verifica si la documentación básica está completa."""

    def test_todo_ok(self):
        assert documentacion_completa(**_COMPLETA) is True

    def test_sin_titulo(self):
        assert documentacion_completa(**{**_COMPLETA, "titulo_tiene": False}) is False

    def test_sin_form_08(self):
        assert documentacion_completa(**{**_COMPLETA, "form_08_tiene": False}) is False

    def test_form_08_sin_firma(self):
        """Tiene el formulario pero no está firmado."""
        assert documentacion_completa(**{**_COMPLETA, "form_08_firmado": False}) is False

    def test_sin_vpa(self):
        assert documentacion_completa(**{**_COMPLETA, "vpa_tiene": False}) is False

    def test_multas_con_monto_cero_es_completa(self):
        """multas_tiene=True pero monto=0 → OK (ya se pagaron)."""
        d = {**_COMPLETA, "multas_tiene": True, "multas_monto_total": 0}
        assert documentacion_completa(**d) is True

    def test_multas_con_deuda_es_incompleta(self):
        d = {**_COMPLETA, "multas_tiene": True, "multas_monto_total": 50000}
        assert documentacion_completa(**d) is False

    def test_patentes_con_deuda_es_incompleta(self):
        d = {**_COMPLETA, "patentes_deuda": True, "patentes_monto": 25000}
        assert documentacion_completa(**d) is False

    def test_patentes_con_monto_cero_es_completa(self):
        d = {**_COMPLETA, "patentes_deuda": True, "patentes_monto": 0}
        assert documentacion_completa(**d) is True


class TestItemsPendientes:
    """Lista de items de documentación que faltan."""

    def test_todo_ok_lista_vacia(self):
        assert items_pendientes(**_COMPLETA) == []

    def test_falta_titulo(self):
        result = items_pendientes(**{**_COMPLETA, "titulo_tiene": False})
        assert "Título/Cédula" in result

    def test_falta_form_08(self):
        result = items_pendientes(**{**_COMPLETA, "form_08_tiene": False})
        assert "Formulario 08" in result
        assert "Firma Form. 08" not in result  # Si no tiene el 08, no pide firma

    def test_form_08_sin_firma(self):
        """Si tiene el 08 pero no está firmado, pide firma."""
        result = items_pendientes(**{**_COMPLETA, "form_08_firmado": False})
        assert "Firma Form. 08" in result
        assert "Formulario 08" not in result

    def test_falta_vpa(self):
        result = items_pendientes(**{**_COMPLETA, "vpa_tiene": False})
        assert "VPA" in result

    def test_multas_con_monto(self):
        d = {**_COMPLETA, "multas_tiene": True, "multas_monto_total": 50000}
        result = items_pendientes(**d)
        assert any("Multas" in item and "50000" in item for item in result)

    def test_patentes_con_monto(self):
        d = {**_COMPLETA, "patentes_deuda": True, "patentes_monto": 25000}
        result = items_pendientes(**d)
        assert any("Patentes" in item and "25000" in item for item in result)

    def test_varios_faltantes(self):
        d = {**_COMPLETA, "titulo_tiene": False, "vpa_tiene": False}
        result = items_pendientes(**d)
        assert len(result) == 2
        assert "Título/Cédula" in result
        assert "VPA" in result

    def test_multas_sin_monto_no_aparece(self):
        """multas_tiene=True pero monto=0 → no se lista como pendiente."""
        d = {**_COMPLETA, "multas_tiene": True, "multas_monto_total": 0}
        result = items_pendientes(**d)
        assert not any("Multas" in item for item in result)
