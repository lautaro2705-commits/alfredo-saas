import { Download } from 'lucide-react'
import clsx from 'clsx'

/**
 * Botón reutilizable para exportar a Excel.
 */
export default function ExportButton({ onClick, loading = false, label = 'Exportar Excel', className }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all',
        'border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 hover:bg-green-100',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exportando...' : label}
    </button>
  )
}
