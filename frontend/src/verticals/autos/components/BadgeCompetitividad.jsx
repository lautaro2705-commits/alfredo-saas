import clsx from 'clsx'
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'

/**
 * Badge que muestra la competitividad de precio de una unidad
 * comparando el precio publicado con el valor de mercado.
 *
 * - Verde (competitivo): precio <= mercado
 * - Rojo (desfasado): precio > mercado
 * - Gris (sin datos): no hay valor de mercado
 */
export default function BadgeCompetitividad({
  competitividad,
  valorMercado,
  precioPublicado,
  showDetails = false,
  size = 'normal' // 'small' | 'normal'
}) {
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Sin datos de mercado
  if (!competitividad || !valorMercado) {
    return (
      <span className={clsx(
        'badge bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-1',
        size === 'small' && 'text-xs px-1.5 py-0.5'
      )}>
        <HelpCircle className={clsx('w-3 h-3', size === 'small' && 'w-2.5 h-2.5')} />
        {size !== 'small' && 'Sin datos'}
      </span>
    )
  }

  const esCompetitivo = competitividad === 'competitivo'
  const diferencia = precioPublicado && valorMercado ? precioPublicado - valorMercado : 0

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={clsx(
        'badge flex items-center gap-1',
        esCompetitivo ? 'badge-success' : 'badge-danger',
        size === 'small' && 'text-xs px-1.5 py-0.5'
      )}>
        {esCompetitivo ? (
          <TrendingUp className={clsx('w-3 h-3', size === 'small' && 'w-2.5 h-2.5')} />
        ) : (
          <TrendingDown className={clsx('w-3 h-3', size === 'small' && 'w-2.5 h-2.5')} />
        )}
        {esCompetitivo ? 'Competitivo' : 'Desfasado'}
      </span>

      {showDetails && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          <div>Mercado: {formatCurrency(valorMercado)}</div>
          {diferencia !== 0 && (
            <div className={clsx(
              diferencia > 0 ? 'text-red-500' : 'text-green-500'
            )}>
              {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
