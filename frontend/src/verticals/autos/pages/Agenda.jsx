import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { seguimientosAPI, clientesAPI, interesadosAPI, unidadesAPI, usuariosAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus,
  CalendarCheck,
  Phone,
  Truck,
  DollarSign,
  FileText,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  Filter,
  Edit2,
  Ban,
  Trash2,
  User,
  Car,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import { format, isToday, isPast, isFuture } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_ICONS = {
  llamada: Phone,
  entrega: Truck,
  pago: DollarSign,
  documentacion: FileText,
  general: CalendarCheck,
}

const TIPO_LABELS = {
  llamada: 'Llamada',
  entrega: 'Entrega',
  pago: 'Pago',
  documentacion: 'Documentación',
  general: 'General',
}

const TIPO_COLORS = {
  llamada: 'bg-blue-100 text-blue-700',
  entrega: 'bg-purple-100 text-purple-700',
  pago: 'bg-green-100 text-green-700',
  documentacion: 'bg-yellow-100 text-yellow-700',
  general: 'bg-gray-100 text-gray-700',
}

const PRIORIDAD_COLORS = {
  alta: 'border-l-red-500',
  media: 'border-l-yellow-500',
  baja: 'border-l-blue-300',
}

const PRIORIDAD_BADGE = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baja: 'bg-blue-100 text-blue-700',
}

export default function Agenda() {
  const queryClient = useQueryClient()
  const { isAdmin, user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [filtroTipo, setFiltroTipo] = useState('')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  // ---------- Queries ----------
  const { data: seguimientos, isLoading } = useQuery({
    queryKey: ['seguimientos', filtroEstado, filtroTipo],
    queryFn: async () => {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      if (filtroTipo) params.tipo = filtroTipo
      const res = await seguimientosAPI.list(params)
      return res.data
    },
  })

  // Datos para selects del modal
  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => (await clientesAPI.list({ limit: 500 })).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: interesados } = useQuery({
    queryKey: ['interesados-select'],
    queryFn: async () => (await interesadosAPI.list({ activos: true, limit: 500 })).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: unidades } = useQuery({
    queryKey: ['unidades-select'],
    queryFn: async () => (await unidadesAPI.stockDisponible()).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores-select'],
    queryFn: async () => (await usuariosAPI.vendedores()).data,
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin,
  })

  // ---------- Mutations ----------
  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['seguimientos'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['seguimientos-pendientes'] })
  }

  const createMutation = useMutation({
    mutationFn: (data) => seguimientosAPI.create(data),
    onSuccess: () => { invalidar(); toast.success('Seguimiento creado'); closeModal() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al crear'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => seguimientosAPI.update(id, data),
    onSuccess: () => { invalidar(); toast.success('Seguimiento actualizado'); closeModal() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al actualizar'),
  })

  const completarMutation = useMutation({
    mutationFn: (id) => seguimientosAPI.completar(id, {}),
    onSuccess: () => { invalidar(); toast.success('Marcado como completado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const cancelarMutation = useMutation({
    mutationFn: (id) => seguimientosAPI.cancelar(id),
    onSuccess: () => { invalidar(); toast.success('Seguimiento cancelado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => seguimientosAPI.delete(id),
    onSuccess: () => { invalidar(); toast.success('Seguimiento eliminado') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  // ---------- Handlers ----------
  const openModal = (seg = null) => {
    if (seg) {
      setEditingId(seg.id)
      reset({
        titulo: seg.titulo,
        descripcion: seg.descripcion || '',
        tipo: seg.tipo,
        prioridad: seg.prioridad,
        fecha_vencimiento: seg.fecha_vencimiento,
        hora: seg.hora || '',
        cliente_id: seg.cliente_id || '',
        interesado_id: seg.interesado_id || '',
        unidad_id: seg.unidad_id || '',
        asignado_a: seg.asignado_a || '',
      })
    } else {
      setEditingId(null)
      reset({
        tipo: 'general',
        prioridad: 'media',
        fecha_vencimiento: format(new Date(), 'yyyy-MM-dd'),
        asignado_a: isAdmin ? '' : user?.id,
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    reset({})
  }

  const onSubmit = (data) => {
    // Limpiar campos vacíos y convertir IDs
    const clean = {}
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === null || v === undefined) continue
      if (['cliente_id', 'interesado_id', 'unidad_id', 'asignado_a'].includes(k)) {
        clean[k] = parseInt(v, 10)
      } else {
        clean[k] = v
      }
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: clean })
    } else {
      createMutation.mutate(clean)
    }
  }

  const handleCompletar = (seg) => {
    if (window.confirm(`Completar "${seg.titulo}"?`)) {
      completarMutation.mutate(seg.id)
    }
  }

  const handleCancelar = (seg) => {
    if (window.confirm(`Cancelar "${seg.titulo}"?`)) {
      cancelarMutation.mutate(seg.id)
    }
  }

  const handleEliminar = (seg) => {
    if (window.confirm(`Eliminar "${seg.titulo}" permanentemente?`)) {
      deleteMutation.mutate(seg.id)
    }
  }

  // ---------- Helpers ----------
  const fechaStatus = (fechaStr) => {
    const fecha = new Date(fechaStr + 'T12:00:00')
    if (isToday(fecha)) return 'hoy'
    if (isPast(fecha)) return 'vencido'
    return 'futuro'
  }

  const pendientes = seguimientos?.filter(s => s.estado === 'pendiente' && (s.vencido || s.vence_hoy)) || []
  const contPendientes = pendientes.length

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-primary-600" />
            Agenda
          </h1>
          <p className="text-gray-500">Seguimientos y tareas pendientes</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {/* Resumen rápido */}
      {contPendientes > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">
              Tenés {contPendientes} tarea{contPendientes > 1 ? 's' : ''} pendiente{contPendientes > 1 ? 's' : ''} para hoy o vencida{contPendientes > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[
            { key: 'pendiente', label: 'Pendientes' },
            { key: 'completado', label: 'Completados' },
            { key: '', label: 'Todos' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltroEstado(f.key)}
              className={clsx(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                filtroEstado === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          className="input w-auto text-sm"
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Lista de seguimientos */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : seguimientos?.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay seguimientos {filtroEstado ? 'con este filtro' : ''}</p>
          </div>
        ) : (
          seguimientos?.map(seg => {
            const status = fechaStatus(seg.fecha_vencimiento)
            const TipoIcon = TIPO_ICONS[seg.tipo] || CalendarCheck
            const esCompletado = seg.estado === 'completado'
            const esCancelado = seg.estado === 'cancelado'

            return (
              <div
                key={seg.id}
                className={clsx(
                  'card border-l-4 transition-all',
                  esCompletado ? 'border-l-green-500 opacity-75' :
                  esCancelado ? 'border-l-gray-400 opacity-60' :
                  PRIORIDAD_COLORS[seg.prioridad]
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Icono tipo */}
                  <div className={clsx(
                    'p-2 rounded-lg flex-shrink-0',
                    esCompletado ? 'bg-green-100' :
                    esCancelado ? 'bg-gray-100' :
                    TIPO_COLORS[seg.tipo]?.replace('text-', 'bg-').split(' ')[0] || 'bg-gray-100'
                  )}>
                    {esCompletado ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <TipoIcon className={clsx('w-5 h-5', TIPO_COLORS[seg.tipo]?.split(' ')[1] || 'text-gray-600')} />
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={clsx(
                          'font-semibold',
                          esCompletado ? 'text-gray-500 line-through' : 'text-gray-900'
                        )}>
                          {seg.titulo}
                        </h3>
                        {seg.descripcion && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{seg.descripcion}</p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full', TIPO_COLORS[seg.tipo])}>
                          {TIPO_LABELS[seg.tipo]}
                        </span>
                        {!esCompletado && !esCancelado && (
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full', PRIORIDAD_BADGE[seg.prioridad])}>
                            {seg.prioridad}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                      {/* Fecha */}
                      <span className={clsx(
                        'flex items-center gap-1',
                        esCompletado ? 'text-green-600' :
                        status === 'vencido' ? 'text-red-600 font-medium' :
                        status === 'hoy' ? 'text-yellow-600 font-medium' :
                        'text-gray-500'
                      )}>
                        <Calendar className="w-3.5 h-3.5" />
                        {status === 'vencido' && !esCompletado ? '⚠ ' : ''}
                        {format(new Date(seg.fecha_vencimiento + 'T12:00:00'), "d MMM", { locale: es })}
                        {seg.hora && ` ${seg.hora.slice(0, 5)}`}
                        {status === 'hoy' && !esCompletado && ' (HOY)'}
                      </span>

                      {/* Vinculaciones */}
                      {seg.cliente_nombre && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <User className="w-3.5 h-3.5" />
                          {seg.cliente_nombre}
                        </span>
                      )}
                      {seg.interesado_nombre && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <User className="w-3.5 h-3.5" />
                          {seg.interesado_nombre}
                        </span>
                      )}
                      {seg.unidad_info && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Car className="w-3.5 h-3.5" />
                          {seg.unidad_info}
                        </span>
                      )}

                      {/* Asignado (solo admin) */}
                      {isAdmin && seg.asignado_nombre && (
                        <span className="text-gray-400 text-xs">
                          → {seg.asignado_nombre}
                        </span>
                      )}
                    </div>

                    {/* Observaciones de cierre */}
                    {esCompletado && seg.observaciones_cierre && (
                      <p className="text-sm text-green-700 mt-1 italic">✓ {seg.observaciones_cierre}</p>
                    )}
                  </div>

                  {/* Acciones */}
                  {!esCompletado && !esCancelado && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCompletar(seg)}
                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg"
                        title="Completar"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openModal(seg)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCancelar(seg)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                        title="Cancelar"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleEliminar(seg)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-primary-50">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Editar Seguimiento' : 'Nuevo Seguimiento'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/50 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              {/* Título */}
              <div>
                <label className="label">Título *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Llamar a cliente por entrega"
                  {...register('titulo', { required: 'Requerido' })}
                />
                {errors.titulo && <p className="text-red-500 text-sm">{errors.titulo.message}</p>}
              </div>

              {/* Descripción */}
              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="input"
                  rows="2"
                  placeholder="Detalles adicionales..."
                  {...register('descripcion')}
                />
              </div>

              {/* Tipo + Prioridad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo *</label>
                  <select className="input" {...register('tipo', { required: true })}>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Prioridad *</label>
                  <select className="input" {...register('prioridad', { required: true })}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              {/* Fecha + Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha *</label>
                  <input
                    type="date"
                    className="input"
                    {...register('fecha_vencimiento', { required: 'Requerido' })}
                  />
                  {errors.fecha_vencimiento && <p className="text-red-500 text-sm">{errors.fecha_vencimiento.message}</p>}
                </div>
                <div>
                  <label className="label">Hora</label>
                  <input type="time" className="input" {...register('hora')} />
                </div>
              </div>

              {/* Vincular a */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-700 mb-3 text-sm">Vincular a (opcional)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label text-xs">Cliente</label>
                    <select className="input text-sm" {...register('cliente_id')}>
                      <option value="">Sin cliente</option>
                      {clientes?.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre_completo || `${c.nombre} ${c.apellido}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Interesado</label>
                    <select className="input text-sm" {...register('interesado_id')}>
                      <option value="">Sin interesado</option>
                      {interesados?.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.nombre_completo || `${i.nombre} ${i.apellido}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Unidad</label>
                    <select className="input text-sm" {...register('unidad_id')}>
                      <option value="">Sin unidad</option>
                      {unidades?.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.marca} {u.modelo} ({u.dominio})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Asignar a (solo admin) */}
              {isAdmin && (
                <div>
                  <label className="label">Asignar a</label>
                  <select className="input" {...register('asignado_a')}>
                    <option value="">Yo mismo</option>
                    {vendedores?.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.nombre} {v.apellido} ({v.rol})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
