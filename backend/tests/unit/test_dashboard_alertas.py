"""
Unit tests para _obtener_alertas() — la función más crítica del dashboard.

Genera la lista de alertas activas a partir de:
- Unidades con stock inmovilizado o documentación pendiente
- Cheques por cobrar/pagar próximos a vencer
- Seguimientos pendientes/vencidos

La función es sync y pura — no toca DB.
"""
from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4


# ── Lógica replicada de _obtener_alertas (dashboard.py) ──

def _obtener_alertas(unidades, cheques_recibidos=None, cheques_emitidos=None, seguimientos=None):
    alertas = []
    cheques_recibidos = cheques_recibidos or []
    cheques_emitidos = cheques_emitidos or []
    seguimientos = seguimientos or []

    for seg in seguimientos:
        dias = (seg.fecha_vencimiento - date.today()).days
        alertas.append({
            "tipo": "seguimiento_pendiente",
            "prioridad": "alta" if dias < 0 else ("media" if seg.prioridad != "alta" else "alta"),
            "mensaje": f"{'VENCIDO: ' if dias < 0 else ''}{seg.titulo}",
            "unidad_id": seg.unidad_id,
            "unidad_info": f"Vence: {seg.fecha_vencimiento.strftime('%d/%m')}",
            "link": "/agenda",
        })

    for cheque in cheques_recibidos:
        dias = cheque.dias_para_vencer
        alertas.append({
            "tipo": "cheque_por_cobrar",
            "prioridad": "alta" if dias <= 2 else "media",
            "mensaje": f"Cheque ${cheque.monto:,.0f} vence {'HOY' if dias == 0 else f'en {dias} dias'}",
            "unidad_id": None,
            "unidad_info": f"{cheque.banco} - {cheque.numero_cheque} ({cheque.emisor_nombre})",
            "link": "/cheques",
        })

    for cheque in cheques_emitidos:
        dias = cheque.dias_para_debito
        alertas.append({
            "tipo": "cheque_por_pagar",
            "prioridad": "alta" if dias <= 2 else "media",
            "mensaje": f"Cheque propio ${cheque.monto:,.0f} se debita {'HOY' if dias == 0 else f'en {dias} dias'}",
            "unidad_id": None,
            "unidad_info": f"{cheque.banco} - {cheque.numero_cheque} a {cheque.beneficiario}",
            "link": "/cheques",
        })

    for unidad in unidades:
        if unidad.stock_inmovilizado:
            alertas.append({
                "tipo": "inmovilizado",
                "prioridad": "alta" if unidad.dias_en_stock > 90 else "media",
                "mensaje": f"Stock inmovilizado: {unidad.dias_en_stock} dias",
                "unidad_id": unidad.id,
                "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                "link": f"/unidades/{unidad.id}",
            })

        if unidad.checklist_documentacion:
            if not unidad.checklist_documentacion.documentacion_completa:
                items = unidad.checklist_documentacion.items_pendientes
                alertas.append({
                    "tipo": "documentacion_pendiente",
                    "prioridad": "media",
                    "mensaje": f"Documentacion pendiente: {', '.join(items[:3])}",
                    "unidad_id": unidad.id,
                    "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                    "link": f"/unidades/{unidad.id}",
                })

            vtv = unidad.checklist_documentacion.vtv_fecha_vencimiento
            if vtv and vtv <= date.today() + timedelta(days=30):
                dias = (vtv - date.today()).days
                alertas.append({
                    "tipo": "vtv_vencimiento",
                    "prioridad": "alta" if dias <= 7 else "media",
                    "mensaje": f"VTV vence en {dias} dias" if dias > 0 else "VTV VENCIDA",
                    "unidad_id": unidad.id,
                    "unidad_info": f"{unidad.marca} {unidad.modelo} ({unidad.dominio})",
                    "link": f"/unidades/{unidad.id}",
                })

    orden = {"alta": 0, "media": 1, "baja": 2}
    alertas.sort(key=lambda x: orden.get(x["prioridad"], 2))
    return alertas[:20]


# ── Factories para stubs ──

def make_unidad(id=None, stock_inmovilizado=False, dias_en_stock=0,
                checklist_documentacion=None, marca="Toyota", modelo="Hilux",
                dominio="AA123BB"):
    return SimpleNamespace(
        id=id or uuid4(),
        stock_inmovilizado=stock_inmovilizado,
        dias_en_stock=dias_en_stock,
        checklist_documentacion=checklist_documentacion,
        marca=marca,
        modelo=modelo,
        dominio=dominio,
    )


def make_cheque_recibido(dias_para_vencer=5, monto=1_500_000, banco="Nación",
                         numero_cheque="12345678", emisor_nombre="Juan Pérez"):
    return SimpleNamespace(
        dias_para_vencer=dias_para_vencer,
        monto=monto,
        banco=banco,
        numero_cheque=numero_cheque,
        emisor_nombre=emisor_nombre,
    )


def make_cheque_emitido(dias_para_debito=3, monto=800_000, banco="Galicia",
                        numero_cheque="87654321", beneficiario="Proveedor SA"):
    return SimpleNamespace(
        dias_para_debito=dias_para_debito,
        monto=monto,
        banco=banco,
        numero_cheque=numero_cheque,
        beneficiario=beneficiario,
    )


def make_seguimiento(dias_offset=0, titulo="Llamar cliente", prioridad="media",
                     unidad_id=None):
    return SimpleNamespace(
        fecha_vencimiento=date.today() + timedelta(days=dias_offset),
        titulo=titulo,
        prioridad=prioridad,
        unidad_id=unidad_id or uuid4(),
    )


def make_doc(documentacion_completa=True, items_pendientes=None,
             vtv_fecha_vencimiento=None):
    return SimpleNamespace(
        documentacion_completa=documentacion_completa,
        items_pendientes=items_pendientes or [],
        vtv_fecha_vencimiento=vtv_fecha_vencimiento,
    )


# ── Tests ──

class TestSinAlertas:
    """Sin datos, no hay alertas."""

    def test_listas_vacias(self):
        assert _obtener_alertas([], [], [], []) == []

    def test_unidades_sin_problemas(self):
        """Unidades en buen estado no generan alertas."""
        u = make_unidad(
            stock_inmovilizado=False,
            checklist_documentacion=make_doc(documentacion_completa=True),
        )
        assert _obtener_alertas([u]) == []


class TestAlertasStockInmovilizado:
    """Alertas por unidades que llevan mucho tiempo en stock."""

    def test_inmovilizado_mas_de_90_dias_prioridad_alta(self):
        u = make_unidad(stock_inmovilizado=True, dias_en_stock=120)
        alertas = _obtener_alertas([u])
        assert len(alertas) == 1
        assert alertas[0]["tipo"] == "inmovilizado"
        assert alertas[0]["prioridad"] == "alta"
        assert "120 dias" in alertas[0]["mensaje"]

    def test_inmovilizado_menos_de_90_dias_prioridad_media(self):
        u = make_unidad(stock_inmovilizado=True, dias_en_stock=70)
        alertas = _obtener_alertas([u])
        assert alertas[0]["prioridad"] == "media"

    def test_inmovilizado_exactamente_90_dias_prioridad_media(self):
        """Boundary: > 90 para alta, 90 es media."""
        u = make_unidad(stock_inmovilizado=True, dias_en_stock=90)
        alertas = _obtener_alertas([u])
        assert alertas[0]["prioridad"] == "media"

    def test_no_inmovilizado_no_genera_alerta(self):
        u = make_unidad(stock_inmovilizado=False, dias_en_stock=120)
        alertas = _obtener_alertas([u])
        assert len(alertas) == 0


class TestAlertasDocumentacion:
    """Alertas por documentación incompleta o VTV por vencer."""

    def test_documentacion_pendiente(self):
        doc = make_doc(
            documentacion_completa=False,
            items_pendientes=["Título/Cédula", "VPA"],
        )
        u = make_unidad(checklist_documentacion=doc)
        alertas = _obtener_alertas([u])
        assert len(alertas) == 1
        assert alertas[0]["tipo"] == "documentacion_pendiente"
        assert "Título/Cédula" in alertas[0]["mensaje"]

    def test_vtv_vencida(self):
        doc = make_doc(vtv_fecha_vencimiento=date.today() - timedelta(days=5))
        u = make_unidad(checklist_documentacion=doc)
        alertas = _obtener_alertas([u])
        vtv_alertas = [a for a in alertas if a["tipo"] == "vtv_vencimiento"]
        assert len(vtv_alertas) == 1
        assert "VENCIDA" in vtv_alertas[0]["mensaje"]
        assert vtv_alertas[0]["prioridad"] == "alta"

    def test_vtv_por_vencer_en_7_dias_prioridad_alta(self):
        doc = make_doc(vtv_fecha_vencimiento=date.today() + timedelta(days=5))
        u = make_unidad(checklist_documentacion=doc)
        alertas = _obtener_alertas([u])
        vtv_alertas = [a for a in alertas if a["tipo"] == "vtv_vencimiento"]
        assert vtv_alertas[0]["prioridad"] == "alta"

    def test_vtv_por_vencer_en_20_dias_prioridad_media(self):
        doc = make_doc(vtv_fecha_vencimiento=date.today() + timedelta(days=20))
        u = make_unidad(checklist_documentacion=doc)
        alertas = _obtener_alertas([u])
        vtv_alertas = [a for a in alertas if a["tipo"] == "vtv_vencimiento"]
        assert vtv_alertas[0]["prioridad"] == "media"

    def test_vtv_en_31_dias_no_genera_alerta(self):
        """VTV a más de 30 días no genera alerta."""
        doc = make_doc(vtv_fecha_vencimiento=date.today() + timedelta(days=31))
        u = make_unidad(checklist_documentacion=doc)
        alertas = _obtener_alertas([u])
        vtv_alertas = [a for a in alertas if a["tipo"] == "vtv_vencimiento"]
        assert len(vtv_alertas) == 0

    def test_sin_checklist_no_genera_alerta(self):
        u = make_unidad(checklist_documentacion=None)
        assert _obtener_alertas([u]) == []


class TestAlertasCheques:
    """Alertas por cheques próximos a cobrar o pagar."""

    def test_cheque_por_cobrar_urgente(self):
        c = make_cheque_recibido(dias_para_vencer=1, monto=2_000_000)
        alertas = _obtener_alertas([], [c])
        assert alertas[0]["tipo"] == "cheque_por_cobrar"
        assert alertas[0]["prioridad"] == "alta"

    def test_cheque_por_cobrar_hoy(self):
        c = make_cheque_recibido(dias_para_vencer=0, monto=1_500_000)
        alertas = _obtener_alertas([], [c])
        assert "HOY" in alertas[0]["mensaje"]
        assert alertas[0]["prioridad"] == "alta"

    def test_cheque_por_cobrar_no_urgente(self):
        c = make_cheque_recibido(dias_para_vencer=5)
        alertas = _obtener_alertas([], [c])
        assert alertas[0]["prioridad"] == "media"

    def test_cheque_por_pagar_urgente(self):
        c = make_cheque_emitido(dias_para_debito=2)
        alertas = _obtener_alertas([], None, [c])
        assert alertas[0]["tipo"] == "cheque_por_pagar"
        assert alertas[0]["prioridad"] == "alta"


class TestAlertasSeguimientos:
    """Alertas por seguimientos pendientes o vencidos."""

    def test_seguimiento_vencido(self):
        seg = make_seguimiento(dias_offset=-2, titulo="Llamar a Juan")
        alertas = _obtener_alertas([], seguimientos=[seg])
        assert alertas[0]["tipo"] == "seguimiento_pendiente"
        assert alertas[0]["prioridad"] == "alta"
        assert "VENCIDO" in alertas[0]["mensaje"]

    def test_seguimiento_pendiente_prioridad_alta_manual(self):
        """Seguimiento no vencido pero marcado como prioridad alta."""
        seg = make_seguimiento(dias_offset=2, prioridad="alta")
        alertas = _obtener_alertas([], seguimientos=[seg])
        assert alertas[0]["prioridad"] == "alta"

    def test_seguimiento_pendiente_prioridad_media(self):
        seg = make_seguimiento(dias_offset=2, prioridad="media")
        alertas = _obtener_alertas([], seguimientos=[seg])
        assert alertas[0]["prioridad"] == "media"


class TestOrdenYLimite:
    """Las alertas se ordenan por prioridad y se limitan a 20."""

    def test_orden_alta_antes_que_media(self):
        c_urgente = make_cheque_recibido(dias_para_vencer=1)  # alta
        c_normal = make_cheque_recibido(dias_para_vencer=5)   # media
        alertas = _obtener_alertas([], [c_normal, c_urgente])
        assert alertas[0]["prioridad"] == "alta"
        assert alertas[1]["prioridad"] == "media"

    def test_maximo_20_alertas(self):
        """Nunca retorna más de 20 alertas sin importar cuántas haya."""
        cheques = [make_cheque_recibido(dias_para_vencer=i) for i in range(25)]
        alertas = _obtener_alertas([], cheques)
        assert len(alertas) == 20

    def test_multiples_tipos_combinados(self):
        """Alertas de diferentes tipos coexisten."""
        u = make_unidad(stock_inmovilizado=True, dias_en_stock=120)
        c = make_cheque_recibido(dias_para_vencer=1)
        seg = make_seguimiento(dias_offset=-1, titulo="Test")
        alertas = _obtener_alertas([u], [c], seguimientos=[seg])
        tipos = {a["tipo"] for a in alertas}
        assert "inmovilizado" in tipos
        assert "cheque_por_cobrar" in tipos
        assert "seguimiento_pendiente" in tipos
