import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  ChevronRight,
  ChevronLeft,
  Car,
  ShoppingCart,
  Wallet,
  Users,
  BarChart3,
  Home,
  Wrench,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

// ── Tour Steps Definition ──
const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenido a Alfredo',
    description: 'Tu sistema de gestion integral para la agencia. Te vamos a hacer un recorrido rapido para que conozcas todas las herramientas disponibles.',
    icon: Sparkles,
    route: '/',
    position: 'center',
    highlight: null,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Aca ves el resumen de tu agencia: stock actual, valor del inventario, operaciones del mes, alertas de cheques y unidades inmovilizadas. Todo de un vistazo.',
    icon: Home,
    route: '/',
    position: 'center',
    highlight: null,
  },
  {
    id: 'stock',
    title: 'Stock de Unidades',
    description: 'Gestioná todo tu stock: cargá vehiculos con datos completos (marca, modelo, dominio, precios), subí fotos, y controlá el estado de cada unidad (disponible, reservado, vendido).',
    icon: Car,
    route: '/unidades',
    position: 'center',
    highlight: null,
  },
  {
    id: 'peritajes',
    title: 'Peritajes',
    description: 'Registrá peritajes con checklist detallado: motor, carroceria, interior, neumaticos. Adjuntá fotos y tené un historial completo de cada inspeccion.',
    icon: ClipboardCheck,
    route: '/peritajes',
    position: 'center',
    highlight: null,
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Tu cartera de clientes organizada: datos de contacto, historial de compras y ventas, y seguimiento personalizado para cada uno.',
    icon: Users,
    route: '/clientes',
    position: 'center',
    highlight: null,
  },
  {
    id: 'operaciones',
    title: 'Ventas y Operaciones',
    description: 'Registrá ventas, compras y permutas. Generá boletos de compra-venta, controlá formas de pago (efectivo, cheques, transferencias) y calculá rentabilidad automaticamente.',
    icon: ShoppingCart,
    route: '/operaciones',
    position: 'center',
    highlight: null,
  },
  {
    id: 'gastos',
    title: 'Carga Rapida de Gastos',
    description: 'Cargá gastos asociados a una unidad en segundos: mecanico, pintura, gestoría, etc. Se descuentan automaticamente de la rentabilidad.',
    icon: Wrench,
    route: '/costo-rapido',
    position: 'center',
    highlight: null,
  },
  {
    id: 'caja',
    title: 'Caja Diaria',
    description: 'Control total de ingresos y egresos del dia. Registrá movimientos, hacé cierres de caja, y mantené la trazabilidad de todo el dinero que entra y sale.',
    icon: Wallet,
    route: '/caja',
    position: 'center',
    highlight: null,
    adminOnly: true,
  },
  {
    id: 'reportes',
    title: 'Reportes e Inteligencia',
    description: 'Reportes avanzados: rentabilidad por vendedor, antiguedad de stock, comparativo mensual, y analisis de inteligencia de negocio con sugerencias de repricing.',
    icon: BarChart3,
    route: '/reportes',
    position: 'center',
    highlight: null,
    adminOnly: true,
  },
  {
    id: 'finish',
    title: 'Listo para empezar!',
    description: 'Ya conoces las herramientas principales. Podes acceder al manual completo desde el menu "Ayuda" en la barra lateral. Si necesitas soporte, escribinos por WhatsApp.',
    icon: Sparkles,
    route: '/',
    position: 'center',
    highlight: null,
  },
]

// ── Tour Overlay Component ──
export default function AppTour({ isActive, currentStep, onNext, onPrev, onSkip, onEnd, isAdmin }) {
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible] = useState(false)

  // Filter steps based on admin status
  const steps = TOUR_STEPS.filter(step => !step.adminOnly || isAdmin)
  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100

  // Show/hide with animation
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isActive])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    const handler = (e) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) onEnd()
        else onNext()
      }
      if (e.key === 'ArrowLeft' && !isFirst) onPrev()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isActive, isFirst, isLast, onNext, onPrev, onSkip, onEnd])

  const handleNext = useCallback(() => {
    setAnimating(true)
    setTimeout(() => {
      if (isLast) onEnd()
      else onNext()
      setAnimating(false)
    }, 200)
  }, [isLast, onEnd, onNext])

  const handlePrev = useCallback(() => {
    setAnimating(true)
    setTimeout(() => {
      onPrev()
      setAnimating(false)
    }, 200)
  }, [onPrev])

  if (!isActive || !step) return null

  const StepIcon = step.icon

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={onSkip} />

      {/* Card */}
      <div
        className={clsx(
          'relative w-[90vw] max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200',
          animating ? 'scale-95 opacity-70' : 'scale-100 opacity-100'
        )}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors z-10"
          title="Saltar tour (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 pt-6">
          {/* Step counter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2.5 py-1 rounded-full">
              {currentStep + 1} de {steps.length}
            </span>
          </div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-5 shadow-lg shadow-primary-500/20">
            <StepIcon className="w-7 h-7 text-white" />
          </div>

          {/* Text */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {step.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 pb-6">
          <button
            onClick={onSkip}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Saltar tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
            >
              {isLast ? 'Comenzar a usar Alfredo' : 'Siguiente'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 pb-5">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={clsx(
                'h-1.5 rounded-full transition-all duration-300',
                idx === currentStep
                  ? 'w-6 bg-primary-600'
                  : idx < currentStep
                    ? 'w-1.5 bg-primary-300 dark:bg-primary-700'
                    : 'w-1.5 bg-gray-200 dark:bg-gray-700'
              )}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
