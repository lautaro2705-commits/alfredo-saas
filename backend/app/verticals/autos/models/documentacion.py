from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, Text, ForeignKey, Float, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.verticals.autos.models.mixins import TenantMixin
import enum


class EstadoGestoria(str, enum.Enum):
    SIN_INICIAR = "sin_iniciar"
    EN_TRAMITE = "en_tramite"
    CON_OBSERVACIONES = "con_observaciones"
    FINALIZADO = "finalizado"


class ChecklistDocumentacion(TenantMixin, Base):
    """
    Checklist de documentación de cada unidad.
    Incluye: 08, VPA, Multas, etc.
    """
    __tablename__ = "checklist_documentacion"

    id = Column(Integer, primary_key=True, index=True)
    unidad_id = Column(Integer, ForeignKey("unidades.id"), unique=True, nullable=False)

    # Título (cédula verde/azul)
    titulo_tiene = Column(Boolean, default=False)
    titulo_nombre = Column(String(100))  # A nombre de quién está
    titulo_observaciones = Column(Text)

    # Formulario 08
    form_08_tiene = Column(Boolean, default=False)
    form_08_firmado = Column(Boolean, default=False)
    form_08_certificado = Column(Boolean, default=False)  # Certificación de firma
    form_08_fecha_vencimiento = Column(Date)

    # VPA (Verificación Policial Automotor)
    vpa_tiene = Column(Boolean, default=False)
    vpa_fecha = Column(Date)
    vpa_resultado = Column(String(50))  # Aprobado, Observado, Rechazado

    # VTV (Verificación Técnica Vehicular)
    vtv_tiene = Column(Boolean, default=False)
    vtv_fecha_vencimiento = Column(Date)
    vtv_oblea = Column(String(50))

    # Informe de dominio
    informe_dominio_tiene = Column(Boolean, default=False)
    informe_dominio_fecha = Column(Date)
    informe_dominio_estado = Column(String(50))  # Libre, Con gravamen, Con embargo

    # Multas
    multas_tiene = Column(Boolean, default=False)
    multas_monto_total = Column(Float, default=0)
    multas_detalle = Column(Text)

    # Patentes adeudadas
    patentes_deuda = Column(Boolean, default=False)
    patentes_monto = Column(Float, default=0)
    patentes_periodos = Column(String(100))  # Ej: "2023-01 a 2023-06"

    # Seguro
    seguro_compania = Column(String(100))
    seguro_poliza = Column(String(50))
    seguro_vencimiento = Column(Date)

    # Llaves
    llave_original = Column(Boolean, default=True)
    llave_copia = Column(Boolean, default=False)
    cantidad_llaves = Column(Integer, default=1)

    # Manual y service
    manual_usuario = Column(Boolean, default=False)
    libreta_service = Column(Boolean, default=False)

    # Notas generales
    observaciones = Column(Text)

    # Estado de Gestoria (tramite en registro)
    estado_gestoria = Column(String(50), default="sin_iniciar")
    gestor_nombre = Column(String(100))
    gestor_telefono = Column(String(50))
    fecha_inicio_tramite = Column(Date)
    fecha_finalizacion_tramite = Column(Date)
    notas_gestoria = Column(Text)

    # Auditoría
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("platform_users.id"))

    # Relaciones
    unidad = relationship("Unidad", back_populates="checklist_documentacion")

    @property
    def documentacion_completa(self) -> bool:
        """Verifica si tiene toda la documentación básica necesaria"""
        return all([
            self.titulo_tiene,
            self.form_08_tiene and self.form_08_firmado,
            self.vpa_tiene,
            not self.multas_tiene or self.multas_monto_total == 0,
            not self.patentes_deuda or self.patentes_monto == 0
        ])

    @property
    def items_pendientes(self) -> list:
        """Lista de items de documentación pendientes"""
        pendientes = []
        if not self.titulo_tiene:
            pendientes.append("Título/Cédula")
        if not self.form_08_tiene:
            pendientes.append("Formulario 08")
        elif not self.form_08_firmado:
            pendientes.append("Firma Form. 08")
        if not self.vpa_tiene:
            pendientes.append("VPA")
        if self.multas_tiene and self.multas_monto_total > 0:
            pendientes.append(f"Multas (${self.multas_monto_total})")
        if self.patentes_deuda and self.patentes_monto > 0:
            pendientes.append(f"Patentes (${self.patentes_monto})")
        return pendientes
