/**
 * Páginas legales (T&C + Privacy Policy).
 * Compartidas entre rutas públicas: /terminos y /privacidad
 */
import { Link, useLocation } from 'react-router-dom'
import { Shield, FileText, ArrowLeft } from 'lucide-react'

const COMPANY = 'Alfredo'
const COMPANY_FULL = 'Alfredo — Gestión de Automotores'
const CONTACT_EMAIL = 'soporte@alfredo.app'
const LAST_UPDATED = '11 de marzo de 2026'

// ── Términos y Condiciones ──

function TerminosContent() {
  return (
    <>
      <LegalHeader
        icon={FileText}
        title="Términos y Condiciones"
        subtitle={`Última actualización: ${LAST_UPDATED}`}
      />

      <Section title="1. Aceptación de los Términos">
        Al acceder o utilizar la plataforma {COMPANY} ("{COMPANY_FULL}"), aceptás estos
        Términos y Condiciones. Si no estás de acuerdo, no uses el servicio. El uso
        continuado implica aceptación de cualquier modificación que publiquemos.
      </Section>

      <Section title="2. Descripción del Servicio">
        {COMPANY} es una plataforma SaaS de gestión para agencias de automotores que incluye:
        <ul className="mt-2 ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li>Gestión de inventario de vehículos</li>
          <li>Registro de operaciones de compra y venta</li>
          <li>Administración de clientes e interesados</li>
          <li>Caja diaria y movimientos financieros</li>
          <li>Reportes y análisis de rentabilidad</li>
          <li>Peritajes y gestión documental</li>
        </ul>
      </Section>

      <Section title="3. Registro y Cuentas">
        Para usar {COMPANY} debés crear una cuenta proporcionando información veraz.
        Sos responsable de mantener la confidencialidad de tus credenciales y de todas
        las actividades realizadas bajo tu cuenta. Cada agencia (tenant) tiene un
        espacio aislado; no podés acceder a datos de otras agencias.
      </Section>

      <Section title="4. Planes y Pagos">
        {COMPANY} ofrece un período de prueba gratuito de 14 días. Al finalizar, podés
        elegir un plan pago. Los pagos se procesan a través de MercadoPago. Los precios
        pueden actualizarse con 30 días de aviso previo. Las suscripciones se renuevan
        automáticamente y pueden cancelarse en cualquier momento desde la sección de
        facturación.
      </Section>

      <Section title="5. Uso Aceptable">
        No podés usar {COMPANY} para:
        <ul className="mt-2 ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li>Actividades ilegales o fraudulentas</li>
          <li>Cargar contenido malicioso o que infrinja derechos de terceros</li>
          <li>Intentar acceder a datos de otros tenants/agencias</li>
          <li>Sobrecargar intencionalmente la infraestructura del servicio</li>
          <li>Revender o sublicenciar el acceso sin autorización</li>
        </ul>
      </Section>

      <Section title="6. Propiedad Intelectual">
        El software, diseño, marca y documentación de {COMPANY} son propiedad
        exclusiva del proveedor. Los datos que cargues en la plataforma son de tu
        propiedad; {COMPANY} solo los procesa para brindarte el servicio.
      </Section>

      <Section title="7. Limitación de Responsabilidad">
        {COMPANY} se proporciona "tal cual" sin garantías implícitas. No somos
        responsables por daños indirectos, pérdida de datos por causas fuera de
        nuestro control, ni por decisiones comerciales basadas en los reportes del
        sistema. Nuestras copias de seguridad se realizan diariamente, pero
        recomendamos mantener respaldos propios de información crítica.
      </Section>

      <Section title="8. Suspensión y Terminación">
        Podemos suspender o cancelar tu cuenta si violás estos términos, si tu
        suscripción queda impaga por más de 30 días, o si detectamos actividad
        abusiva. En caso de cancelación, tendrás 30 días para exportar tus datos.
      </Section>

      <Section title="9. Modificaciones">
        Podemos actualizar estos términos. Te notificaremos por email con al menos
        15 días de anticipación. El uso continuado después de la notificación implica
        aceptación.
      </Section>

      <Section title="10. Contacto">
        Para consultas sobre estos términos: <EmailLink />
      </Section>
    </>
  )
}

// ── Política de Privacidad ──

function PrivacidadContent() {
  return (
    <>
      <LegalHeader
        icon={Shield}
        title="Política de Privacidad"
        subtitle={`Última actualización: ${LAST_UPDATED}`}
      />

      <Section title="1. Información que Recopilamos">
        <strong>Datos de cuenta:</strong> nombre, email, teléfono, CUIT de la agencia.
        <br />
        <strong>Datos de uso:</strong> vehículos, clientes, operaciones, movimientos de
        caja y demás información que cargues en la plataforma.
        <br />
        <strong>Datos técnicos:</strong> dirección IP, tipo de navegador, dispositivo,
        y datos de uso anónimos para mejorar el servicio.
      </Section>

      <Section title="2. Cómo Usamos tu Información">
        <ul className="ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li>Proporcionar y mantener el servicio de gestión</li>
          <li>Procesar pagos y gestionar suscripciones</li>
          <li>Enviar notificaciones del servicio (transaccionales)</li>
          <li>Mejorar la plataforma basándonos en patrones de uso anónimos</li>
          <li>Responder a consultas de soporte</li>
        </ul>
      </Section>

      <Section title="3. Aislamiento de Datos (Multi-tenant)">
        Cada agencia tiene sus datos completamente aislados mediante seguridad a nivel
        de base de datos (Row Level Security). Ninguna agencia puede ver, modificar o
        acceder a los datos de otra. Este aislamiento es forzado por la base de datos,
        no por la aplicación, lo que brinda una capa adicional de seguridad.
      </Section>

      <Section title="4. Compartición de Datos">
        <strong>No vendemos tus datos.</strong> Solo compartimos información con:
        <ul className="mt-2 ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li><strong>MercadoPago:</strong> datos de pago para procesar suscripciones</li>
          <li><strong>Proveedores de infraestructura:</strong> hosting y base de datos (tus
          datos están cifrados en tránsito y en reposo)</li>
          <li><strong>Autoridades legales:</strong> solo cuando sea requerido por ley</li>
        </ul>
      </Section>

      <Section title="5. Seguridad">
        Implementamos medidas de seguridad que incluyen:
        <ul className="mt-2 ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li>Cifrado SSL/TLS en todas las comunicaciones</li>
          <li>Contraseñas almacenadas con hash bcrypt</li>
          <li>Tokens de acceso con expiración corta (15 minutos)</li>
          <li>Protección contra fuerza bruta con bloqueo temporal</li>
          <li>Limitación de velocidad de requests (rate limiting)</li>
          <li>Headers de seguridad OWASP</li>
          <li>Auditoría de accesos con registro de cada request</li>
        </ul>
      </Section>

      <Section title="6. Retención de Datos">
        Conservamos tus datos mientras tu cuenta esté activa. Si cancelás tu cuenta,
        tus datos se eliminan dentro de los 90 días posteriores, excepto la información
        que debamos retener por obligaciones legales o fiscales.
      </Section>

      <Section title="7. Tus Derechos">
        Podés:
        <ul className="mt-2 ml-4 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
          <li><strong>Acceder</strong> a todos tus datos desde la plataforma</li>
          <li><strong>Corregir</strong> información incorrecta en cualquier momento</li>
          <li><strong>Exportar</strong> tus datos en formato estándar</li>
          <li><strong>Eliminar</strong> tu cuenta y datos contactándonos</li>
        </ul>
      </Section>

      <Section title="8. Cookies">
        Usamos cookies estrictamente necesarias para el funcionamiento de la aplicación
        (sesión, preferencias de tema). No usamos cookies de tracking ni publicidad.
      </Section>

      <Section title="9. Cambios en esta Política">
        Te notificaremos por email sobre cambios significativos en esta política con
        al menos 15 días de anticipación.
      </Section>

      <Section title="10. Contacto">
        Para ejercer tus derechos o hacer consultas de privacidad: <EmailLink />
      </Section>
    </>
  )
}

// ── Shared Components ──

function LegalHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
      <div className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{children}</div>
    </div>
  )
}

function EmailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">
      {CONTACT_EMAIL}
    </a>
  )
}

// ── Main Legal Page (public) ──

export default function Legal() {
  const { pathname } = useLocation()
  const isPrivacidad = pathname.includes('privacidad')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <div className="flex gap-4 text-sm">
            <Link
              to="/terminos"
              className={`transition-colors ${!isPrivacidad ? 'text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Términos
            </Link>
            <Link
              to="/privacidad"
              className={`transition-colors ${isPrivacidad ? 'text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Privacidad
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
          {isPrivacidad ? <PrivacidadContent /> : <TerminosContent />}
        </div>
      </div>
    </div>
  )
}
