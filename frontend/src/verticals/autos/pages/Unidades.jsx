import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { unidadesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Car,
  AlertTriangle,
  Calendar,
  Filter,
  DollarSign,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Square,
  X,
  Tag,
  Percent,
  ArrowDownToLine,
} from 'lucide-react'
import clsx from 'clsx'
import BadgeCompetitividad from '../components/BadgeCompetitividad'
import { CardGridSkeleton } from '../components/Skeletons'
import EmptyState from '../components/EmptyState'

const estadoColors = {
  disponible: 'badge-success',
  reservado: 'badge-warning',
  vendido: 'badge-info',
  en_reparacion: 'badge-danger',
  retoma_pendiente: 'badge-warning',
}

const estadoLabels = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
  en_reparacion: 'En reparacion',
  retoma_pendiente: 'Retoma pendiente',
}

const origenLabels = {
  compra_directa: 'Compra',
  retoma: 'Retoma',
  consignacion: 'Consignacion',
}

export default function Unidades() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [buscar, setBuscar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroOrigen, setFiltroOrigen] = useState('')
  const [soloInmovilizados, setSoloInmovilizados] = useState(false)
  const [showValorizacion, setShowValorizacion] = useState(false)

  // ── Bulk selection ──
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkAction, setBulkAction] = useState(null) // 'estado' | 'precio' | 'delete'
  const [bulkEstado, setBulkEstado] = useState('disponible')
  const [bulkPrecioPercent, setBulkPrecioPercent] = useState('')

  const toggleSelect = useCallback((id, e) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // selectAll is defined after unidadesFiltradas — see below

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelected(new Set())
    setBulkAction(null)
  }, [])

  // Bulk mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }) => {
      const promises = ids.map(id => unidadesAPI.update(id, updates))
      return Promise.allSettled(promises)
    },
    onSuccess: (results) => {
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.filter(r => r.status === 'rejected').length
      queryClient.invalidateQueries(['unidades'])
      queryClient.invalidateQueries(['valorizacion-stock'])
      if (fail === 0) toast.success(`${ok} unidades actualizadas`)
      else toast.success(`${ok} actualizadas, ${fail} con error`)
      exitSelectionMode()
    },
    onError: () => toast.error('Error en operacion masiva')
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const promises = ids.map(id => unidadesAPI.delete(id, true))
      return Promise.allSettled(promises)
    },
    onSuccess: (results) => {
      const ok = results.filter(r => r.status === 'fulfilled').length
      queryClient.invalidateQueries(['unidades'])
      queryClient.invalidateQueries(['valorizacion-stock'])
      toast.success(`${ok} unidades eliminadas`)
      exitSelectionMode()
    },
    onError: () => toast.error('Error al eliminar')
  })

  const handleBulkApply = () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    if (bulkAction === 'estado') {
      bulkUpdateMutation.mutate({ ids, updates: { estado: bulkEstado } })
    } else if (bulkAction === 'precio') {
      const pct = parseFloat(bulkPrecioPercent)
      if (isNaN(pct)) { toast.error('Porcentaje invalido'); return }
      // Apply percentage to each unit individually
      const promises = ids.map(id => {
        const unidad = unidadesFiltradas?.find(u => u.id === id)
        if (!unidad?.precio_publicado) return Promise.resolve()
        const newPrice = Math.round(unidad.precio_publicado * (1 + pct / 100))
        return unidadesAPI.update(id, { precio_publicado: newPrice })
      })
      Promise.allSettled(promises).then(results => {
        const ok = results.filter(r => r.status === 'fulfilled').length
        queryClient.invalidateQueries(['unidades'])
        toast.success(`Precio ajustado en ${ok} unidades`)
        exitSelectionMode()
      })
    } else if (bulkAction === 'delete') {
      if (window.confirm(`Eliminar ${ids.length} unidades? Esta accion no se puede deshacer.`)) {
        bulkDeleteMutation.mutate(ids)
      }
    }
  }

  const { data: unidades, isLoading } = useQuery({
    queryKey: ['unidades', buscar, filtroEstado, soloInmovilizados],
    queryFn: async () => {
      const params = { excluir_vendidos: true }
      if (buscar) params.buscar = buscar
      if (filtroEstado) params.estado = filtroEstado
      if (soloInmovilizados) params.solo_inmovilizados = true
      const res = await unidadesAPI.list(params)
      return res.data
    },
  })

  const { data: valorizacion, isLoading: loadingValorizacion } = useQuery({
    queryKey: ['valorizacion-stock'],
    queryFn: async () => {
      const res = await unidadesAPI.valorizacion()
      return res.data
    },
    enabled: isAdmin
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, forzar }) => unidadesAPI.delete(id, forzar),
    onSuccess: () => {
      queryClient.invalidateQueries(['unidades'])
      queryClient.invalidateQueries(['valorizacion-stock'])
      toast.success('Unidad eliminada')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar')
    }
  })

  const handleDelete = (e, unidad) => {
    e.preventDefault()
    e.stopPropagation()

    const esVendido = unidad.estado === 'vendido'
    const mensaje = esVendido
      ? `Esta unidad figura como VENDIDA y puede tener operaciones asociadas. ¿Eliminarla de todas formas? Esto borrará también las operaciones y movimientos de caja relacionados.`
      : `¿Eliminar ${unidad.marca} ${unidad.modelo} (${unidad.dominio})? Esta accion no se puede deshacer.`

    if (window.confirm(mensaje)) {
      deleteMutation.mutate({ id: unidad.id, forzar: true })
    }
  }

  const formatCurrency = (value) => {
    if (!value) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const unidadesFiltradas = unidades?.filter(u => {
    if (filtroOrigen && u.origen !== filtroOrigen) return false
    return true
  })

  const selectAll = () => {
    if (!unidadesFiltradas) return
    if (selected.size === unidadesFiltradas.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(unidadesFiltradas.map(u => u.id)))
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock de Unidades</h1>
          <p className="text-gray-500 dark:text-gray-400">{unidadesFiltradas?.length || 0} unidades</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && !selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className="btn btn-secondary flex items-center gap-2"
              title="Seleccion multiple"
            >
              <CheckSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Seleccionar</span>
            </button>
          )}
          {selectionMode && (
            <button
              onClick={exitSelectionMode}
              className="btn btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>
          )}
          <Link to="/vendidos" className="btn btn-secondary flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Vendidos
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowValorizacion(!showValorizacion)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              Valorizacion
              {showValorizacion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <Link to="/unidades/nuevo" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nueva Unidad
          </Link>
        </div>
      </div>

      {/* Panel de Valorizacion */}
      {isAdmin && showValorizacion && (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          {loadingValorizacion ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : valorizacion ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Valorizacion del Stock
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stock Propio */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h4 className="font-medium text-green-700">Stock Propio</h4>
                  </div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(valorizacion.stock_propio.inversion_total)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {valorizacion.stock_propio.cantidad} unidades
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Valor publicado:</span>
                      <span className="font-medium">{formatCurrency(valorizacion.stock_propio.valor_publicado)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Utilidad potencial:</span>
                      <span className="font-medium">{formatCurrency(valorizacion.stock_propio.utilidad_potencial)}</span>
                    </div>
                  </div>
                </div>

                {/* Consignacion */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-medium text-purple-700">Consignacion</h4>
                  </div>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(valorizacion.stock_consignacion.valor_acordado)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {valorizacion.stock_consignacion.cantidad} unidades (no suma al stock)
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Valor publicado:</span>
                      <span className="font-medium">{formatCurrency(valorizacion.stock_consignacion.valor_publicado)}</span>
                    </div>
                    <div className="flex justify-between text-purple-600 dark:text-purple-400">
                      <span>Comision potencial:</span>
                      <span className="font-medium">{formatCurrency(valorizacion.stock_consignacion.comision_potencial)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumen Total */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-medium text-blue-700">Resumen</h4>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {valorizacion.resumen_total.unidades_totales}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">unidades en stock total</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Inversion propia:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(valorizacion.resumen_total.inversion_propia)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Valor total publicado:</span>
                      <span className="font-medium">{formatCurrency(valorizacion.resumen_total.valor_total_publicado)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo o patente..."
              className="input pl-10"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>

          <select
            className="input w-full sm:w-40"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos estados</option>
            <option value="disponible">Disponibles</option>
            <option value="reservado">Reservados</option>
            <option value="en_reparacion">En reparacion</option>
            <option value="vendido">Vendidos</option>
          </select>

          <select
            className="input w-full sm:w-40"
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
          >
            <option value="">Todos origenes</option>
            <option value="compra_directa">Compra directa</option>
            <option value="retoma">Retomas</option>
            <option value="consignacion">Consignacion</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={soloInmovilizados}
              onChange={(e) => setSoloInmovilizados(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Inmovilizados</span>
          </label>
        </div>
      </div>

      {/* Lista de unidades */}
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : unidadesFiltradas?.length === 0 ? (
        <EmptyState
          icon={Car}
          title={buscar || filtroEstado || filtroOrigen ? 'Sin resultados' : 'No hay unidades en stock'}
          description={
            buscar || filtroEstado || filtroOrigen
              ? 'Intenta con otros filtros o limpia la busqueda para ver todas las unidades.'
              : 'Agrega tu primera unidad para comenzar a gestionar tu stock. Podes cargar compras, retomas y consignaciones.'
          }
          actionLabel={buscar || filtroEstado ? undefined : 'Nueva Unidad'}
          actionHref="/unidades/nuevo"
          secondaryLabel={buscar || filtroEstado ? 'Limpiar filtros' : 'Ver vendidos'}
          secondaryHref={buscar || filtroEstado ? undefined : '/vendidos'}
        />
      ) : (
        <>
        {/* Select all bar */}
        {selectionMode && (
          <div className="flex items-center gap-3 px-4 py-2 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg">
            <button onClick={selectAll} className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 hover:text-primary-900 transition-colors">
              {selected.size === unidadesFiltradas?.length
                ? <CheckSquare className="w-4 h-4" />
                : <Square className="w-4 h-4" />
              }
              {selected.size === unidadesFiltradas?.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span className="text-sm text-primary-600 dark:text-primary-400">
              {selected.size} de {unidadesFiltradas?.length} seleccionadas
            </span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {unidadesFiltradas?.map((unidad) => (
            <Link
              key={unidad.id}
              to={selectionMode ? '#' : `/unidades/${unidad.id}`}
              onClick={selectionMode ? (e) => toggleSelect(unidad.id, e) : undefined}
              className={clsx(
                'card hover:border-primary-300 dark:hover:border-primary-600 transition-all relative',
                unidad.origen === 'consignacion' && 'border-l-4 border-l-purple-500',
                selectionMode && selected.has(unidad.id) && 'ring-2 ring-primary-500 border-primary-400'
              )}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <button
                  onClick={(e) => toggleSelect(unidad.id, e)}
                  className="absolute top-2 left-2 p-1 z-10"
                >
                  {selected.has(unidad.id)
                    ? <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    : <Square className="w-5 h-5 text-gray-400" />
                  }
                </button>
              )}

              {/* Boton eliminar */}
              {isAdmin && !selectionMode && (
                <button
                  onClick={(e) => handleDelete(e, unidad)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                  title="Eliminar unidad"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-start justify-between mb-3 pr-8">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {unidad.marca} {unidad.modelo}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{unidad.anio}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className={clsx('badge', estadoColors[unidad.estado])}>
                    {estadoLabels[unidad.estado]}
                  </span>
                  {unidad.origen === 'consignacion' && (
                    <span className="badge bg-purple-100 text-purple-800 text-xs">
                      Consignacion
                    </span>
                  )}
                  {unidad.origen === 'retoma' && (
                    <span className="badge bg-orange-100 text-orange-800 text-xs">
                      Retoma
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-3">
                <Car className="w-4 h-4" />
                <span className="font-mono">{unidad.dominio}</span>
                {unidad.ubicacion && (
                  <span className="text-gray-400">• {unidad.ubicacion}</span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{unidad.dias_en_stock}d</span>
                  </div>
                  {unidad.stock_inmovilizado && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Inmovilizado</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {unidad.precio_publicado ? (
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(unidad.precio_publicado)}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">Sin precio</p>
                    )}
                    {/* Badge de competitividad - DESHABILITADO temporalmente */}
                  </div>
                  {isAdmin && (
                    <p className="text-xs text-gray-400">
                      {unidad.origen === 'consignacion' ? 'Valor:' : 'Costo:'} {formatCurrency(unidad.costo_total)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}

      {/* Floating bulk action bar */}
      {selectionMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-[90vw] max-w-xl animate-page-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selected.size} unidad{selected.size > 1 ? 'es' : ''} seleccionada{selected.size > 1 ? 's' : ''}
            </span>
            <button onClick={exitSelectionMode} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          {!bulkAction && (
            <div className="flex gap-2">
              <button
                onClick={() => setBulkAction('estado')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors"
              >
                <Tag className="w-4 h-4" />
                Cambiar estado
              </button>
              <button
                onClick={() => setBulkAction('precio')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-sm font-medium transition-colors"
              >
                <Percent className="w-4 h-4" />
                Ajustar precio
              </button>
              <button
                onClick={() => setBulkAction('delete')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Estado form */}
          {bulkAction === 'estado' && (
            <div className="flex gap-2">
              <button onClick={() => setBulkAction(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
              <select
                value={bulkEstado}
                onChange={(e) => setBulkEstado(e.target.value)}
                className="input flex-1"
              >
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="en_reparacion">En reparacion</option>
              </select>
              <button
                onClick={handleBulkApply}
                disabled={bulkUpdateMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          )}

          {/* Precio form */}
          {bulkAction === 'precio' && (
            <div className="flex gap-2">
              <button onClick={() => setBulkAction(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  placeholder="Ej: -10 para bajar 10%"
                  value={bulkPrecioPercent}
                  onChange={(e) => setBulkPrecioPercent(e.target.value)}
                  className="input pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <button
                onClick={handleBulkApply}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Aplicar
              </button>
            </div>
          )}

          {/* Delete confirm */}
          {bulkAction === 'delete' && (
            <div className="flex gap-2">
              <button onClick={() => setBulkAction(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
              <p className="flex-1 text-sm text-red-600 flex items-center">Eliminar {selected.size} unidades?</p>
              <button
                onClick={handleBulkApply}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
