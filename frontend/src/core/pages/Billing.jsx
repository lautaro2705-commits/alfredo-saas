import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/core/context/AuthContext'
import { billingAPI } from '@/core/services/api'
import toast from 'react-hot-toast'
import {
  CreditCard, Users, Package, Check,
  AlertTriangle, Clock, ArrowUpRight,
} from 'lucide-react'

// ── Usage bar ──

function UsageBar({ label, current, max, icon: Icon }) {
  const isUnlimited = max === 'unlimited'
  const numMax = parseInt(max)
  const percentage = isUnlimited ? 0 : (numMax > 0 ? Math.min((current / numMax) * 100, 100) : 0)
  const isNearLimit = !isUnlimited && percentage >= 80

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${isNearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
          {current} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isNearLimit ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Plan card ──

function PlanCard({ plan, currentPlan, onSubscribe, loading }) {
  const isCurrent = plan.name === currentPlan
  const hasPromo = !!plan.promo_price_ars
  const hasAnnual = !!plan.annual_price_ars
  const fmtPrice = (v) => `$${v.toLocaleString('es-AR')}`

  return (
    <div className={`rounded-xl border-2 p-6 flex flex-col ${
      isCurrent ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
    }`}>
      {isCurrent && (
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
          Plan actual
        </span>
      )}
      {hasPromo && !isCurrent && (
        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
          🔥 Oferta de lanzamiento
        </span>
      )}
      <h3 className="text-lg font-bold mt-1 text-gray-900 dark:text-white">{plan.display_name}</h3>

      {/* Pricing section */}
      <div className="mt-2">
        {hasPromo ? (
          <>
            <span className="text-lg text-gray-400 line-through">
              {fmtPrice(plan.price_ars)}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-emerald-600">
                {fmtPrice(plan.promo_price_ars)}
              </span>
              <span className="text-gray-500 text-sm">/mes</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">
              {plan.promo_label}
            </p>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {fmtPrice(plan.price_ars)}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">/mes</span>
          </>
        )}
      </div>

      {/* Annual option — highlighted as best value */}
      {hasAnnual && (
        <div className="mt-3 relative bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-xl px-4 py-3">
          <span className="absolute -top-2.5 left-3 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            ⭐ Mas elegida
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-700">
              {fmtPrice(plan.annual_price_ars)}
            </span>
            <span className="text-sm text-emerald-600">/mes</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium">{plan.annual_label}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Ahorra {fmtPrice((plan.promo_price_ars - plan.annual_price_ars) * 12)}/año
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2 flex-1">
        <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {plan.max_usuarios === 'unlimited'
            ? 'Usuarios ilimitados'
            : `Hasta ${plan.max_usuarios} usuarios`}
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {plan.max_items === 'unlimited'
            ? 'Items ilimitados'
            : `Hasta ${plan.max_items} items`}
        </li>
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span className="capitalize">{f.replace(/_/g, ' ')}</span>
          </li>
        ))}
      </ul>

      {!isCurrent && (
        <button
          onClick={() => onSubscribe(plan.name)}
          disabled={loading}
          className="mt-6 w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 font-medium
                     flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowUpRight className="h-4 w-4" />
          {loading ? 'Procesando...' : 'Elegir plan'}
        </button>
      )}
    </div>
  )
}

// ── Status badge ──

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  past_due: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  active: 'Activo',
  trial: 'Prueba',
  past_due: 'Pago pendiente',
  cancelled: 'Cancelado',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
      STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'
    }`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Main billing page ──

export default function Billing() {
  const { tenant, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [subscribing, setSubscribing] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [payerEmail, setPayerEmail] = useState('')

  // Queries
  const { data: overview, isLoading } = useQuery({
    queryKey: ['billing-overview'],
    queryFn: () => billingAPI.getOverview().then((r) => r.data),
  })

  const { data: plans } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => billingAPI.getPlans().then((r) => r.data),
  })

  const { data: payments } = useQuery({
    queryKey: ['billing-payments'],
    queryFn: () => billingAPI.getPayments().then((r) => r.data),
  })

  // Actions
  const handleSubscribe = (planName) => {
    setSelectedPlan(planName)
    setPayerEmail('')
    setShowEmailModal(true)
  }

  const confirmSubscribe = async () => {
    if (!payerEmail) return
    setSubscribing(true)
    try {
      const res = await billingAPI.subscribe({
        plan: selectedPlan,
        payer_email: payerEmail,
      })
      const { mp_init_point } = res.data
      if (mp_init_point) {
        window.location.href = mp_init_point
      } else {
        toast.success('Suscripcion creada')
        queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al suscribirse')
    } finally {
      setSubscribing(false)
      setShowEmailModal(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('¿Seguro que queres cancelar tu suscripcion? Vas a volver al plan de prueba.')) {
      return
    }
    try {
      await billingAPI.cancelSubscription()
      toast.success('Suscripcion cancelada')
      queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cancelar')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // Trial countdown
  const trialDaysLeft = overview?.trial_end
    ? Math.max(0, Math.ceil((new Date(overview.trial_end) - new Date()) / 86400000))
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturacion y Plan</h1>
        <CreditCard className="h-6 w-6 text-gray-400" />
      </div>

      {/* Trial warning banner */}
      {overview?.plan === 'trial' && trialDaysLeft !== null && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          trialDaysLeft <= 3
            ? 'bg-red-50 border border-red-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          {trialDaysLeft <= 3
            ? <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            : <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`font-medium ${
              trialDaysLeft <= 3 ? 'text-red-800' : 'text-amber-800'
            }`}>
              {trialDaysLeft === 0
                ? 'Tu periodo de prueba ha expirado'
                : `Te quedan ${trialDaysLeft} dias de prueba`}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Elegi un plan para seguir usando la plataforma sin interrupciones.
            </p>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Plan actual</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {overview?.plan_display_name || overview?.plan}
            </h2>
            <div className="mt-2">
              <StatusBadge status={overview?.status} />
            </div>
          </div>
          {overview?.status === 'active' && overview?.plan !== 'trial' && isAdmin && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50
                         rounded-lg border border-red-200 transition-colors"
            >
              Cancelar suscripcion
            </button>
          )}
        </div>
      </div>

      {/* Usage meters */}
      {overview?.usage && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Uso actual</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UsageBar
              label="Usuarios activos"
              current={overview.usage.usuarios_activos}
              max={overview.usage.max_usuarios}
              icon={Users}
            />
            <UsageBar
              label={
                overview.usage.items_label === 'vehiculos'
                  ? 'Vehiculos en stock'
                  : 'Ventas del mes'
              }
              current={overview.usage.items_count}
              max={overview.usage.max_items}
              icon={Package}
            />
          </div>
        </div>
      )}

      {/* Available plans */}
      {plans?.plans && isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Planes disponibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.plans.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                currentPlan={overview?.plan}
                onSubscribe={handleSubscribe}
                loading={subscribing}
              />
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments?.payments?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Historial de pagos
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Descripcion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(p.paid_at || p.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      ${p.amount.toLocaleString('es-AR')} {p.currency}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {p.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty payments state */}
      {payments && payments.payments?.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <CreditCard className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hay pagos registrados aun.</p>
        </div>
      )}

      {/* Payer email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Confirmar suscripcion">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirmar suscripcion
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingresa tu email para procesar el pago con MercadoPago:
            </p>
            <input
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSubscribe()}
              placeholder="tu@email.com"
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg mb-4
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         outline-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
                           rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSubscribe}
                disabled={!payerEmail || subscribing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg
                           hover:bg-blue-700 disabled:opacity-50 font-medium
                           transition-colors"
              >
                {subscribing ? 'Procesando...' : 'Ir a MercadoPago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
