/**
 * EmptyState — contextual empty states with icon, title, description, and CTA.
 * Replaces generic "No hay datos" messages with meaningful guidance.
 */
import { Link } from 'react-router-dom'
import clsx from 'clsx'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  onSecondaryAction,
  className,
}) {
  return (
    <div className={clsx('card-static text-center py-16 px-6', className)}>
      {Icon && (
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-gray-100">{title}</h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto text-sm leading-relaxed">
          {description}
        </p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {secondaryLabel && secondaryHref && (
            <Link to={secondaryHref} className="btn btn-secondary text-sm">
              {secondaryLabel}
            </Link>
          )}
          {secondaryLabel && onSecondaryAction && !secondaryHref && (
            <button onClick={onSecondaryAction} className="btn btn-secondary text-sm">
              {secondaryLabel}
            </button>
          )}
          {actionLabel && actionHref && (
            <Link to={actionHref} className="btn btn-primary text-sm">
              {actionLabel}
            </Link>
          )}
          {actionLabel && onAction && !actionHref && (
            <button onClick={onAction} className="btn btn-primary text-sm">
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
