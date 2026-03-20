import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { unidadesAPI } from '../services/api'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

/**
 * SmartAlerts — Intelligent stock alerts with actionable suggestions.
 *
 * Shows:
 * 1. Units immobilized >60 days → suggest price reduction
 * 2. Units without price → suggest setting one
 * 3. Units with high margin → opportunity to sell faster
 */

function calcSuggestion(unidad) {
  const dias = unidad.dias_en_stock || 0
  const precio = unidad.precio_publicado || 0
  const costo = unidad.costo_total || 0

  if (dias > 120) {
    // Very old stock: suggest 15% reduction
    return { percent: -15, reason: 'Mas de 120 dias en stock', urgency: 'alta' }
  } else if (dias > 90) {
    // Old stock: suggest 10% reduction
    return { percent: -10, reason: 'Mas de 90 dias en stock', urgency: 'alta' }
  } else if (dias > 60) {
    // Getting old: suggest 5% reduction
    return { percent: -5, reason: 'Mas de 60 dias en stock', urgency: 'media' }
  }
  return null
}

function formatCurrency(value) {
  if (!value) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value)
}

function AlertCard({ unidad, suggestion }) {
  const [expanded, setExpanded] = useState(false)
  const [applying, setApplying] = useState(false)
  const queryClient = useQueryClient()

  const newPrice = suggestion
    ? Math.round(unidad.precio_publicado * (1 + suggestion.percent / 100))
    : unidad.precio_publicado

  const handleApply = async () => {
    setApplying(true)
    try {
      await unidadesAPI.update(unidad.id, { precio_publicado: newPrice })
      queryClient.invalidateQueries(['unidades'])
      toast.success(`Precio actualizado a ${formatCurrency(newPrice)}`)
    } catch {
      toast.error('Error al actualizar precio')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={clsx(
      'p-4 rounded-xl border transition-all',
      suggestion?.urgency === 'alta'
        ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900'
        : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={clsx(
            'p-2 rounded-lg mt-0.5',
            suggestion?.urgency === 'alta' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-yellow-100 dark:bg-yellow-900/40'
          )}>
            {suggestion?.urgency === 'alta'
              ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              : <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <Link
              to={`/unidades/${unidad.id}`}
              className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {unidad.marca} {unidad.modelo} {unidad.anio}
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {unidad.dominio} &middot; {unidad.dias_en_stock} dias en stock &middot; {formatCurrency(unidad.precio_publicado)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && suggestion && (
        <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sugerencia: Bajar precio un {Math.abs(suggestion.percent)}%
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Actual</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(unidad.precio_publicado)}</p>
            </div>
            <TrendingDown className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-gray-500 dark:text-gray-400">Sugerido</p>
              <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(newPrice)}</p>
            </div>
            {unidad.costo_total && (
              <div className="ml-auto text-right">
                <p className="text-gray-500 dark:text-gray-400">Margen</p>
                <p className={clsx(
                  'font-semibold',
                  newPrice > unidad.costo_total ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(newPrice - unidad.costo_total)}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Aplicar {suggestion.percent}%
            </button>
            <Link
              to={`/unidades/${unidad.id}/editar`}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Editar
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SmartAlerts({ unidades }) {
  const [showAll, setShowAll] = useState(false)

  if (!unidades?.length) return null

  // Find units that need attention
  const alertUnits = unidades
    .map(u => ({ ...u, suggestion: calcSuggestion(u) }))
    .filter(u => u.suggestion)
    .sort((a, b) => (b.dias_en_stock || 0) - (a.dias_en_stock || 0))

  // Also add units without price
  const noPriceUnits = unidades.filter(u => !u.precio_publicado && u.estado === 'disponible')

  if (alertUnits.length === 0 && noPriceUnits.length === 0) return null

  const displayUnits = showAll ? alertUnits : alertUnits.slice(0, 3)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alertas Inteligentes</h2>
          <span className="badge badge-warning">{alertUnits.length + noPriceUnits.length}</span>
        </div>
      </div>

      {/* Units without price */}
      {noPriceUnits.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {noPriceUnits.length} unidad{noPriceUnits.length > 1 ? 'es' : ''} sin precio publicado
            </span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {noPriceUnits.map(u => `${u.marca} ${u.modelo}`).slice(0, 3).join(', ')}
            {noPriceUnits.length > 3 && ` y ${noPriceUnits.length - 3} mas`}
          </p>
        </div>
      )}

      {/* Price reduction suggestions */}
      <div className="space-y-3">
        {displayUnits.map(u => (
          <AlertCard key={u.id} unidad={u} suggestion={u.suggestion} />
        ))}
      </div>

      {alertUnits.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors py-2"
        >
          {showAll ? 'Ver menos' : `Ver ${alertUnits.length - 3} mas`}
        </button>
      )}
    </div>
  )
}
