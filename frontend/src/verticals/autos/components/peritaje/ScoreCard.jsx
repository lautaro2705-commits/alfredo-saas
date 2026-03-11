/**
 * Componente para mostrar puntajes con indicador visual
 * Usado en la vista de detalle y resumen de peritaje
 */
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'

export default function ScoreCard({ label, score, maxScore = 100, size = 'md' }) {
  const percentage = (score / maxScore) * 100

  // Determinar color y estado basado en el puntaje
  const getScoreInfo = () => {
    if (percentage >= 80) {
      return {
        color: 'green',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        barColor: 'bg-green-500',
        icon: CheckCircle,
        label: 'Excelente'
      }
    } else if (percentage >= 60) {
      return {
        color: 'blue',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        barColor: 'bg-blue-500',
        icon: CheckCircle,
        label: 'Bueno'
      }
    } else if (percentage >= 40) {
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        barColor: 'bg-yellow-500',
        icon: AlertCircle,
        label: 'Regular'
      }
    } else {
      return {
        color: 'red',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        barColor: 'bg-red-500',
        icon: XCircle,
        label: 'Malo'
      }
    }
  }

  const info = getScoreInfo()
  const Icon = info.icon

  const sizeClasses = {
    sm: {
      container: 'p-3',
      score: 'text-2xl',
      label: 'text-xs',
      icon: 'w-4 h-4'
    },
    md: {
      container: 'p-4',
      score: 'text-3xl',
      label: 'text-sm',
      icon: 'w-5 h-5'
    },
    lg: {
      container: 'p-6',
      score: 'text-4xl',
      label: 'text-base',
      icon: 'w-6 h-6'
    }
  }

  const sizes = sizeClasses[size]

  return (
    <div className={clsx(
      'rounded-xl border',
      info.bgColor,
      info.borderColor,
      sizes.container
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className={clsx('font-medium', info.textColor, sizes.label)}>
          {label}
        </span>
        <Icon className={clsx(info.textColor, sizes.icon)} />
      </div>

      <div className="flex items-baseline gap-1">
        <span className={clsx('font-bold', info.textColor, sizes.score)}>
          {Math.round(score)}
        </span>
        <span className={clsx('text-gray-500', sizes.label)}>
          / {maxScore}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', info.barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className={clsx('mt-2 text-right', info.textColor, sizes.label)}>
        {info.label}
      </div>
    </div>
  )
}

// Variante compacta para usar en listados
export function ScoreBadge({ score, showLabel = true }) {
  const getInfo = () => {
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Excelente' }
    if (score >= 60) return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Bueno' }
    if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Regular' }
    return { bg: 'bg-red-100', text: 'text-red-800', label: 'Malo' }
  }

  const info = getInfo()

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
      info.bg,
      info.text
    )}>
      <span className="font-bold">{Math.round(score)}</span>
      {showLabel && <span>- {info.label}</span>}
    </span>
  )
}
