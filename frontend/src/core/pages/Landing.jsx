/**
 * Landing page pública — Alfredo.
 * Hero + HowItWorks + Features + Social Proof + Pricing + FAQ + CTA → /registro
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Car, Users, DollarSign, BarChart3, Shield, Smartphone,
  ChevronRight, ChevronDown, Check, Clock, Zap, FileText, Star,
  MessageCircle, UserPlus, Settings, TrendingUp,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Car,
    title: 'Stock en tiempo real',
    desc: 'Registrá cada vehículo con fotos, costos, documentación y estado. Sabé qué tenés disponible al instante.',
  },
  {
    icon: DollarSign,
    title: 'Operaciones y Caja',
    desc: 'Compras, ventas, permutas y consignaciones. Caja diaria con todos los movimientos y saldos automáticos.',
  },
  {
    icon: Users,
    title: 'Clientes e Interesados',
    desc: 'Base de datos de compradores y vendedores. Seguimiento de interesados para no perder ninguna oportunidad.',
  },
  {
    icon: BarChart3,
    title: 'Reportes de Rentabilidad',
    desc: 'Ganancia por unidad, por vendedor, comparativos mensuales. Datos reales para tomar mejores decisiones.',
  },
  {
    icon: FileText,
    title: 'Peritajes Digitales',
    desc: 'Registrá inspecciones con checklist y fotos. Historial completo de cada vehículo peritado.',
  },
  {
    icon: Shield,
    title: 'Seguridad Enterprise',
    desc: 'Datos aislados por agencia, cifrado SSL, tokens rotativos. Tu información está protegida al máximo nivel.',
  },
]

const PLANS = [
  {
    name: 'Básico',
    price: '49.000',
    originalPrice: '70.000',
    promoLabel: 'Primeros 6 meses',
    users: '2 usuarios',
    items: '30 vehículos',
    features: ['Stock completo', 'Clientes', 'Operaciones', 'Caja diaria', 'Reportes básicos'],
    highlight: false,
  },
  {
    name: 'Profesional',
    price: '69.000',
    originalPrice: '90.000',
    promoLabel: 'Primeros 6 meses',
    users: '5 usuarios',
    items: '100 vehículos',
    features: ['Todo lo del Básico', 'Cheques', 'MercadoLibre', 'Peritajes', 'Reportes avanzados'],
    highlight: true,
  },
  {
    name: 'Premium',
    price: '170.000',
    originalPrice: '200.000',
    promoLabel: 'Primer año',
    users: 'Usuarios ilimitados',
    items: 'Vehículos ilimitados',
    features: ['Todo lo del Profesional', 'Inteligencia de mercado', 'API', 'Soporte prioritario'],
    highlight: false,
  },
]

const FAQS = [
  {
    q: '¿Necesito instalar algo?',
    a: 'No. Alfredo es 100% web y funciona desde el navegador de tu computadora o celular. No necesitás instalar nada.',
  },
  {
    q: '¿Puedo migrar los datos de mi sistema actual?',
    a: 'Sí. Nuestro equipo te ayuda con la migración sin costo. Podés importar stock, clientes y operaciones desde Excel o tu sistema anterior.',
  },
  {
    q: '¿Qué pasa después de los 14 días gratis?',
    a: 'Elegís el plan que mejor se adapte a tu agencia. Si no te convence, simplemente dejás de usarlo. Sin cargos ni compromisos.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Los datos de cada agencia están completamente aislados. Usamos cifrado SSL, tokens rotativos y backups diarios. Tu información nunca se comparte con terceros.',
  },
  {
    q: '¿Puedo usar Alfredo desde el celular?',
    a: 'Sí. Alfredo es una Progressive Web App: se instala como una app en tu celular, funciona rápido y podés consultar stock o registrar operaciones desde cualquier lugar.',
  },
  {
    q: '¿Incluye soporte?',
    a: 'Todos los planes incluyen soporte por WhatsApp. Los planes Profesional y Premium tienen respuesta prioritaria.',
  },
]

const STEPS = [
  {
    icon: UserPlus,
    title: 'Creá tu cuenta',
    desc: 'Registrate en 2 minutos. Sin tarjeta de crédito.',
  },
  {
    icon: Settings,
    title: 'Cargá tu stock',
    desc: 'Subí tus vehículos con fotos, costos y documentación.',
  },
  {
    icon: TrendingUp,
    title: 'Gestioná y crecé',
    desc: 'Operaciones, caja, reportes. Todo desde un solo lugar.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <SocialProof />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}

// ── Navigation ──
function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Car className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">Alfredo</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-2">
            Ingresar
          </Link>
          <Link to="/registro" className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium">
            Empezar gratis
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ── Hero ──
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-white dark:from-primary-950/20 dark:to-gray-950" />

      <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" />
          14 días gratis — sin tarjeta
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
          Gestión completa para{' '}
          <span className="text-primary-600 dark:text-primary-400">agencias de autos</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Stock, operaciones, caja, clientes, reportes y mucho más.
          Todo en una sola plataforma diseñada para agencias argentinas.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/registro"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/25 hover:shadow-xl hover:shadow-primary-600/30"
          >
            Empezar gratis
            <ChevronRight className="w-4 h-4" />
          </Link>
          <a
            href="#funcionalidades"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300 px-8 py-3.5 rounded-xl text-base font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Ver funcionalidades
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
          <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Datos cifrados</span>
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Setup en 2 min</span>
          <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> Funciona en celular</span>
        </div>

        {/* Product mockup */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl shadow-gray-900/10 dark:shadow-black/40">
            {/* Browser chrome */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white dark:bg-gray-900 rounded-md px-3 py-1 text-xs text-gray-400 text-center">
                  app.alfredo.com
                </div>
              </div>
            </div>
            {/* Dashboard mockup */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'En stock', value: '24', color: 'text-primary-600 dark:text-primary-400' },
                  { label: 'Ventas del mes', value: '8', color: 'text-green-600 dark:text-green-400' },
                  { label: 'Facturación', value: '$12.4M', color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Utilidad', value: '$2.1M', color: 'text-amber-600 dark:text-amber-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                    <div className={`text-lg sm:text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
              {/* Simulated table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stock de vehículos</span>
                  <span className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">Ver todos →</span>
                </div>
                {[
                  { model: 'Toyota Corolla 2024', price: '$18.500.000', status: 'Disponible', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                  { model: 'VW Amarok V6 2023', price: '$32.900.000', status: 'Reservado', statusColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                  { model: 'Ford Ranger XLT 2024', price: '$28.700.000', status: 'Disponible', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                ].map((row) => (
                  <div key={row.model} className="px-3 py-2 flex items-center justify-between border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{row.model}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{row.price}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${row.statusColor}`}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── How It Works ──
function HowItWorks() {
  return (
    <section className="py-16 border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
          Empezá en 3 pasos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="relative inline-flex items-center justify-center w-14 h-14 bg-primary-50 dark:bg-primary-900/30 rounded-2xl mb-4">
                <step.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Features ──
function Features() {
  return (
    <section id="funcionalidades" className="py-20 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Todo lo que necesitás</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 text-lg">
            Diseñado específicamente para agencias de automotores en Argentina
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200"
            >
              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Social Proof ──
function SocialProof() {
  return (
    <section className="py-16 border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center mb-16">
          {[
            { value: '50+', label: 'Agencias activas' },
            { value: '10.000+', label: 'Vehículos gestionados' },
            { value: '99.9%', label: 'Uptime' },
            { value: '4.8/5', label: 'Satisfacción' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl sm:text-3xl font-extrabold text-primary-600 dark:text-primary-400">{stat.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote: 'Antes manejábamos todo en Excel. Con Alfredo en una semana ya teníamos todo organizado. La caja diaria es espectacular.',
              name: 'Martín R.',
              role: 'Automotores del Sur, Bahía Blanca',
            },
            {
              quote: 'La integración con MercadoLibre nos ahorró horas de trabajo. Publicamos directo desde el sistema y los interesados caen solos.',
              name: 'Carolina S.',
              role: 'CS Automotores, Córdoba',
            },
            {
              quote: 'Los reportes de rentabilidad me cambiaron el negocio. Ahora sé exactamente cuánto gano por unidad y por vendedor.',
              name: 'Diego L.',
              role: 'DL Motors, CABA',
            },
          ].map((t) => (
            <div key={t.name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">"{t.quote}"</p>
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ──
function Pricing() {
  return (
    <section id="precios" className="py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Planes simples, sin sorpresas</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 text-lg">
            Empezá gratis 14 días. Elegí tu plan cuando estés listo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20 shadow-lg shadow-primary-100 dark:shadow-primary-900/20'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Más elegido
                </div>
              )}

              <h3 className="font-bold text-lg text-gray-900 dark:text-white">{plan.name}</h3>

              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-sm text-gray-500">/mes</span>
                </div>
                {plan.originalPrice && (
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-gray-400 line-through">${plan.originalPrice}</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">{plan.promoLabel}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 py-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{plan.users}</span> · {plan.items}
              </div>

              <ul className="mt-3 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/registro"
                className={`mt-6 block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Empezar gratis
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ──
function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq" className="py-20 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
          Preguntas frecuentes
        </h2>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                    open === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ──
function CTA() {
  return (
    <section className="py-20 bg-primary-600 dark:bg-primary-700">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-white">¿Listo para ordenar tu agencia?</h2>
        <p className="mt-4 text-primary-100 text-lg">
          Registrate en menos de 2 minutos. 14 días gratis, sin tarjeta de crédito.
        </p>
        <Link
          to="/registro"
          className="mt-8 inline-flex items-center gap-2 bg-white text-primary-700 px-8 py-3.5 rounded-xl text-base font-bold hover:bg-primary-50 transition-colors shadow-lg"
        >
          Crear mi cuenta gratis
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

// ── Footer ──
function Footer() {
  return (
    <footer className="py-10 pb-24 sm:pb-10 border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center">
            <Car className="w-3 h-3 text-white" />
          </div>
          Alfredo © {new Date().getFullYear()}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link to="/terminos" className="hover:text-gray-900 dark:hover:text-white transition-colors">Términos</Link>
          <Link to="/privacidad" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacidad</Link>
          <a href="mailto:soporte@alfredo.app" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contacto</a>
        </div>
      </div>
    </footer>
  )
}

// ── WhatsApp Floating Button ──
function WhatsAppButton() {
  const phone = '543512055411'
  const message = encodeURIComponent('Hola! Me interesa Alfredo para mi agencia de autos.')

  return (
    <a
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all hover:scale-105"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
    </a>
  )
}
