import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { actividadesAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  X,
  Car,
  DollarSign,
  ShoppingCart,
  User,
  FileText,
  CreditCard,
  Clock,
  ArrowRight,
  Loader2,
  Bell,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'

const ICON_MAP = {
  unidad: Car,
  operacion: ShoppingCart,
  cliente: User,
  caja: DollarSign,
  cheque: CreditCard,
  documento: FileText,
  gasto: DollarSign,
}

const COLOR_MAP = {
  unidad: 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400',
  operacion: 'text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-400',
  cliente: 'text-purple-600 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-400',
  caja: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-400',
  cheque: 'text-orange-600 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-400',
  documento: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  gasto: 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400',
}

export default function ActivityFeed({ isOpen, onClose }) {
  const navigate = useNavigate()

  const { data: actividades, isLoading } = useQuery({
    queryKey: ['actividades-recientes'],
    queryFn: async () => {
      const res = await actividadesAPI.recientes()
      return res.data
    },
    enabled: isOpen,
    refetchInterval: 30000, // Refresh every 30s when open
  })

  if (!isOpen) return null

  const items = Array.isArray(actividades) ? actividades : actividades?.items || []

  return (
    <div className="fixed inset-0 z-50 lg:absolute lg:inset-auto lg:right-0 lg:top-0 lg:w-96 lg:h-full">
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 w-full max-w-sm h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Actividad Reciente</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bell className="w-10 h-10 mb-3" />
              <p className="text-sm">No hay actividad reciente</p>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item, i) => {
                const Icon = ICON_MAP[item.tipo] || Activity
                const colorClass = COLOR_MAP[item.tipo] || COLOR_MAP.documento

                return (
                  <button
                    key={item.id || i}
                    onClick={() => {
                      if (item.link) {
                        navigate(item.link)
                        onClose()
                      }
                    }}
                    className={clsx(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                      item.link ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'
                    )}
                  >
                    <div className={clsx('p-1.5 rounded-lg flex-shrink-0 mt-0.5', colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">{item.usuario || 'Sistema'}</span>
                        {' '}{item.accion || item.descripcion}
                      </p>
                      {item.detalle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{item.detalle}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.fecha
                          ? formatDistanceToNow(new Date(item.fecha), { addSuffix: true, locale: es })
                          : 'hace un momento'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
