/**
 * Landing page pública — Alfredo.
 * Hero + Features + Pricing + CTA → /registro
 */
import { Link } from 'react-router-dom'
import {
  Car, Users, DollarSign, BarChart3, Shield, Smartphone,
  ChevronRight, Check, Clock, Zap, FileText, Star,
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Nav />
      <Hero />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
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

      <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
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
    <footer className="py-10 border-t border-gray-100 dark:border-gray-800">
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
