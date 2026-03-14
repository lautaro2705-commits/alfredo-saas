import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { actividadesAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import {
  History,
  Car,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  FileText,
  UserPlus,
  CalendarCheck,
  Filter,
  ChevronDown
} from 'lucide-react'
import clsx from 'clsx'

const ENTIDAD_CONFIG = {
  unidad: { icon: Car, color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900', href: (id) => `/unidades/${id}` },
  operacion: { icon: ShoppingCart, color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900', href: (id) => `/operaciones` },
  cliente: { icon: Users, color: 'text-purple-600 dark:text-purple-400 bg-purple-100', href: () => `/clientes` },
  caja: { icon: Wallet, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900', href: () => `/caja` },
  costo: { icon: Wrench, color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900', href: () => `/costo-rapido` },
  cheque: { icon: FileText, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100', href: () => `/cheques` },
  seguimiento: { icon: CalendarCheck, color: 'text-teal-600 bg-teal-100', href: () => `/agenda` },
  interesado: { icon: UserPlus, color: 'text-pink-600 bg-pink-100', href: () => `/interesados` },
}

const ACCION_LABELS = {
  crear: 'Creó',
  editar: 'Editó',
  eliminar: 'Eliminó',
  vender: 'Vendió',
  completar: 'Completó',
  cancelar: 'Canceló',
  ingresar: 'Ingresó',
  reservar: 'Reservó',
}

const ENTIDAD_OPTIONS = [
  { value: '', label: 'Todas las entidades' },
  { value: 'unidad', label: 'Unidades' },
  { value: 'operacion', label: 'Operaciones' },
  { value: 'caja', label: 'Caja' },
  { value: 'costo', label: 'Costos' },
  { value: 'cheque', label: 'Cheques' },
  { value: 'seguimiento', label: 'Seguimientos' },
  { value: 'interesado', label: 'Interesados' },
]

function tiempoRelativo(fechaStr) {
  const fecha = new Date(fechaStr)
  const ahora = new Date()
  const diffMs = ahora - fecha
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDias = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Ahora mismo'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHrs < 24) return `Hace ${diffHrs}h`
  if (diffDias < 7) return `Hace ${diffDias}d`
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Actividad() {
  const navigate = useNavigate()
  const [filtroEntidad, setFiltroEntidad] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [limit, setLimit] = useState(50)

  const { data: actividades, isLoading } = useQuery({
    queryKey: ['actividades', filtroEntidad, fechaDesde, fechaHasta, limit],
    queryFn: async () => {
      const params = { limit }
      if (filtroEntidad) params.entidad = filtroEntidad
      if (fechaDesde) params.fecha_desde = fechaDesde
      if (fechaHasta) params.fecha_hasta = fechaHasta
      const res = await actividadesAPI.list(params)
      return res.data
    }
  })

  const handleClickEntidad = (entidad, entidadId) => {
    const config = ENTIDAD_CONFIG[entidad]
    if (config?.href) {
      navigate(config.href(entidadId))
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          Historial de Actividad
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Registro de todas las acciones del sistema</p>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap items-center gap-4">
        <Filter className="w-5 h-5 text-gray-400" />
        <select
          value={filtroEntidad}
          onChange={(e) => setFiltroEntidad(e.target.value)}
          className="input w-auto"
        >
          {ENTIDAD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="input w-auto"
          placeholder="Desde"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="input w-auto"
          placeholder="Hasta"
        />
      </div>

      {/* Timeline */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : !actividades?.length ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay actividad registrada</p>
        ) : (
          <div className="space-y-0">
            {actividades.map((act, idx) => {
              const config = ENTIDAD_CONFIG[act.entidad] || ENTIDAD_CONFIG.unidad
              const Icon = config.icon
              const isLast = idx === actividades.length - 1

              return (
                <div key={act.id} className="flex gap-4">
                  {/* Línea timeline */}
                  <div className="flex flex-col items-center">
                    <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                  </div>

                  {/* Contenido */}
                  <div className={clsx('flex-1 pb-6', !isLast && 'border-b-0')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {act.descripcion}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{act.usuario_nombre}</span>
                          <span className="text-xs text-gray-300">•</span>
                          <span className="text-xs text-gray-400">{tiempoRelativo(act.created_at)}</span>
                        </div>
                      </div>
                      {act.entidad_id && (
                        <button
                          onClick={() => handleClickEntidad(act.entidad, act.entidad_id)}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                        >
                          Ver →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Cargar más */}
        {actividades?.length >= limit && (
          <button
            onClick={() => setLimit(prev => prev + 50)}
            className="w-full mt-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown className="w-4 h-4" />
            Cargar más actividad
          </button>
        )}
      </div>
    </div>
  )
}
