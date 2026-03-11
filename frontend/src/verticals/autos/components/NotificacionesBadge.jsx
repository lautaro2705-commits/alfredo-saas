/**
 * Badge de notificaciones: peritajes pendientes (admin) + seguimientos vencidos (todos)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, ClipboardCheck, CalendarCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { peritajesAPI, seguimientosAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function NotificacionesBadge() {
  const { isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  // Peritajes pendientes de aprobación (solo admins)
  const { data: peritajesPendientes = [] } = useQuery({
    queryKey: ['peritajes-pendientes-aprobacion'],
    queryFn: async () => {
      if (!isAdmin) return []
      const res = await peritajesAPI.list({ estado: 'completado' })
      return res.data || []
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  })

  // Seguimientos pendientes del usuario (hoy + vencidos)
  const { data: segPendientes = [] } = useQuery({
    queryKey: ['seguimientos-pendientes'],
    queryFn: async () => {
      const res = await seguimientosAPI.misPendientes()
      return res.data || []
    },
    refetchInterval: 60000,
  })

  const count = peritajesPendientes.length + segPendientes.length

  if (count === 0) return null

  return (
    <div className="relative">
      {/* Botón con badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {count === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay notificaciones
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Seguimientos pendientes/vencidos */}
                  {segPendientes.slice(0, 5).map((seg) => (
                    <Link
                      key={`seg-${seg.id}`}
                      to="/agenda"
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <CalendarCheck className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {seg.titulo}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {seg.cliente_nombre || seg.interesado_nombre || seg.unidad_info || 'Sin vincular'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {seg.vencido ? '⚠ Vencido' : 'Hoy'} • {format(new Date(seg.fecha_vencimiento + 'T12:00:00'), "d MMM", { locale: es })}
                        </p>
                      </div>
                      <div className={clsx(
                        'flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium',
                        seg.vencido ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      )}>
                        {seg.prioridad}
                      </div>
                    </Link>
                  ))}

                  {/* Peritajes pendientes de aprobación */}
                  {peritajesPendientes.slice(0, 5).map((peritaje) => (
                    <Link
                      key={`per-${peritaje.id}`}
                      to={`/peritajes/${peritaje.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          Peritaje pendiente de aprobación
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {peritaje.vehiculo_descripcion}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Por {peritaje.perito_nombre} • {format(new Date(peritaje.fecha_peritaje), "d MMM", { locale: es })}
                        </p>
                      </div>
                      <div className={clsx(
                        'flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium',
                        peritaje.puntaje_total >= 70 ? 'bg-green-100 text-green-700' :
                        peritaje.puntaje_total >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {Math.round(peritaje.puntaje_total)}%
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {(segPendientes.length > 5 || peritajesPendientes.length > 5) && (
              <Link
                to="/agenda"
                onClick={() => setIsOpen(false)}
                className="block p-3 text-center text-sm font-medium text-primary-600 hover:bg-primary-50 border-t border-gray-200"
              >
                Ver todas las notificaciones
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
