"""
Unit tests para la lógica de deduplicación de jobs.

dedup_key() genera claves únicas para evitar enviar el mismo email
dos veces en el mismo día. La clave incluye: job_id + tenant_id + fecha + extra.
"""
from datetime import date
from uuid import uuid4


# ── Lógica extraída de jobs/base.py ──

def dedup_key(job_id: str, tenant_id, extra: str = "") -> str:
    today = date.today().isoformat()
    parts = [job_id, str(tenant_id), today]
    if extra:
        parts.append(extra)
    return ":".join(parts)


# ── Tests ──

class TestDedupKey:
    """Generación de claves de deduplicación para email de jobs."""

    def test_formato_basico(self):
        key = dedup_key("stock_inmovilizado", "tenant-abc")
        today = date.today().isoformat()
        assert key == f"stock_inmovilizado:tenant-abc:{today}"

    def test_con_extra(self):
        key = dedup_key("trial_expiring", "tenant-abc", extra="3")
        today = date.today().isoformat()
        assert key == f"trial_expiring:tenant-abc:{today}:3"

    def test_sin_extra_no_tiene_trailing_colon(self):
        key = dedup_key("job1", "t1")
        assert not key.endswith(":")
        assert key.count(":") == 2  # job:tenant:date

    def test_con_extra_tiene_4_partes(self):
        key = dedup_key("job1", "t1", extra="5")
        assert key.count(":") == 3  # job:tenant:date:extra

    def test_con_uuid_como_tenant(self):
        tenant_id = uuid4()
        key = dedup_key("job1", tenant_id)
        assert str(tenant_id) in key

    def test_keys_distintos_por_job(self):
        k1 = dedup_key("stock_inmovilizado", "t1")
        k2 = dedup_key("cheques_por_vencer", "t1")
        assert k1 != k2

    def test_keys_distintos_por_tenant(self):
        k1 = dedup_key("job1", "tenant-a")
        k2 = dedup_key("job1", "tenant-b")
        assert k1 != k2

    def test_extra_vacio_no_se_agrega(self):
        """Empty string extra is treated as no extra."""
        k1 = dedup_key("job1", "t1", extra="")
        k2 = dedup_key("job1", "t1")
        assert k1 == k2

    def test_contiene_fecha_hoy(self):
        key = dedup_key("job1", "t1")
        assert date.today().isoformat() in key
