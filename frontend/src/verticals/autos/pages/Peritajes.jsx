/**
 * Página de listado de peritajes
 * Muestra todos los peritajes con filtros y acciones rápidas
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { peritajesAPI } from '../services/api'
import {
  Plus, Search, Filter, FileText, Eye, Trash2,
  ClipboardCheck, Car, Calendar, User
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'
import { ScoreBadge } from '../components/peritaje/ScoreCard'

// Configuración de estados
const ESTADOS = {
  borrador: { label: 'Borrador', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' },
  completado: { label: 'Completado', color: 'bg-blue-100 dark:bg-blue-900 text-blue-800' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 dark:bg-green-900 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 dark:bg-red-900 text-red-800' }
}

const TIPOS = {
  tasacion: { label: 'Tasación', icon: '💰' },
  ingreso_stock: { label: 'Ingreso Stock', icon: '📥' },
  retoma: { label: 'Retoma', icon: '🔄' },
  periodico: { label: 'Periódico', icon: '📅' }
}

export default function Peritajes() {
  const [filtros, setFiltros] = useState({
    estado: '',
    tipo: '',
    busqueda: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  const { data: peritajes, isLoading, error } = useQuery({
    queryKey: ['peritajes', filtros],
    queryFn: async () => {
      const params = {}
      if (filtros.estado) params.estado = filtros.estado
      if (filtros.tipo) params.tipo = filtros.tipo
      const res = await peritajesAPI.list(params)
      return res.data
    }
  })

  // Filtrar por búsqueda local
  const peritajesFiltrados = peritajes?.filter(p => {
    if (!filtros.busqueda) return true
    const busqueda = filtros.busqueda.toLowerCase()
    return (
      p.vehiculo_descripcion?.toLowerCase().includes(busqueda) ||
      p.perito_nombre?.toLowerCase().includes(busqueda)
    )
  }) || []

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Peritajes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Inspecciones vehiculares realizadas
          </p>
        </div>
        <Link
          to="/peritajes/nuevo"
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuevo Peritaje</span>
        </Link>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por vehículo o perito..."
              value={filtros.busqueda}
              onChange={(e) => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
              className="input pl-10"
            />
          </div>

          {/* Toggle filtros */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn flex items-center gap-2',
              showFilters ? 'btn-primary' : 'btn-secondary'
            )}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {/* Panel de filtros */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estado</label>
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros(f => ({ ...f, estado: e.target.value }))}
                className="input"
              >
                <option value="">Todos</option>
                {Object.entries(ESTADOS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select
                value={filtros.tipo}
                onChange={(e) => setFiltros(f => ({ ...f, tipo: e.target.value }))}
                className="input"
              >
                <option value="">Todos</option>
                {Object.entries(TIPOS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Lista de peritajes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 p-4 rounded-xl">
          Error al cargar los peritajes: {error.message}
        </div>
      ) : peritajesFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay peritajes
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filtros.busqueda || filtros.estado || filtros.tipo
              ? 'No se encontraron peritajes con los filtros aplicados'
              : 'Comienza creando tu primer peritaje'
            }
          </p>
          <Link to="/peritajes/nuevo" className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Crear Peritaje
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {peritajesFiltrados.map((peritaje) => (
            <PeritajeCard key={peritaje.id} peritaje={peritaje} />
          ))}
        </div>
      )}
    </div>
  )
}

// Card individual de peritaje
function PeritajeCard({ peritaje }) {
  const estado = ESTADOS[peritaje.estado] || ESTADOS.borrador
  const tipo = TIPOS[peritaje.tipo] || TIPOS.tasacion

  return (
    <Link
      to={`/peritajes/${peritaje.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{tipo.icon}</span>
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {peritaje.vehiculo_descripcion}
            </h3>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(peritaje.fecha_peritaje), 'dd/MM/yyyy', { locale: es })}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {peritaje.perito_nombre}
            </span>
          </div>

          {/* Barra de progreso */}
          {peritaje.estado === 'borrador' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Progreso</span>
                <span>{Math.round(peritaje.porcentaje_completado)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${peritaje.porcentaje_completado}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Badges y puntaje */}
        <div className="flex flex-col items-end gap-2">
          <span className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium',
            estado.color
          )}>
            {estado.label}
          </span>

          {peritaje.estado !== 'borrador' && (
            <ScoreBadge score={peritaje.puntaje_total} />
          )}
        </div>
      </div>
    </Link>
  )
}
