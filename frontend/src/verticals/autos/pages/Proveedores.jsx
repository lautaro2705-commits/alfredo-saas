import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { proveedoresAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  Store,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Wrench,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3
} from 'lucide-react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/Skeletons'

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value || 0)

export default function Proveedores() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Keyboard shortcut: N → open new provider modal
  useEffect(() => {
    const handler = () => { reset(); setEditando(null); setModalOpen(true) }
    window.addEventListener('shortcut:new', handler)
    return () => window.removeEventListener('shortcut:new', handler)
  }, [reset])

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ['proveedores', busqueda],
    queryFn: async () => {
      const res = await proveedoresAPI.list({
        buscar: busqueda || undefined,
        activos: true,
      })
      return res.data
    }
  })

  const { data: estadisticas } = useQuery({
    queryKey: ['proveedores-stats'],
    queryFn: async () => {
      const res = await proveedoresAPI.estadisticas()
      return res.data
    }
  })

  const { data: costosExpandido } = useQuery({
    queryKey: ['proveedor-costos', expandedId],
    queryFn: async () => {
      const res = await proveedoresAPI.costos(expandedId, { limit: 10 })
      return res.data
    },
    enabled: !!expandedId
  })

  const crearMutation = useMutation({
    mutationFn: (data) => proveedoresAPI.create(data),
    onSuccess: () => {
      toast.success('Proveedor creado')
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      queryClient.invalidateQueries({ queryKey: ['proveedores-stats'] })
      cerrarModal()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al crear')
  })

  const editarMutation = useMutation({
    mutationFn: ({ id, data }) => proveedoresAPI.update(id, data),
    onSuccess: () => {
      toast.success('Proveedor actualizado')
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      queryClient.invalidateQueries({ queryKey: ['proveedores-stats'] })
      cerrarModal()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error al editar')
  })

  const eliminarMutation = useMutation({
    mutationFn: (id) => proveedoresAPI.delete(id),
    onSuccess: () => {
      toast.success('Proveedor desactivado')
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      queryClient.invalidateQueries({ queryKey: ['proveedores-stats'] })
    }
  })

  const cerrarModal = () => {
    setModalOpen(false)
    setEditando(null)
    reset()
  }

  const abrirEditar = (prov) => {
    setEditando(prov)
    reset({
      nombre: prov.nombre,
      tipo: prov.tipo || '',
      telefono: prov.telefono || '',
      email: prov.email || '',
      direccion: prov.direccion || '',
      cuit: prov.cuit || '',
      notas: prov.notas || '',
    })
    setModalOpen(true)
  }

  const onSubmit = (data) => {
    if (editando) {
      editarMutation.mutate({ id: editando.id, data })
    } else {
      crearMutation.mutate(data)
    }
  }

  const handleExportar = () => {
    if (!proveedores?.length) return
    exportToExcel({
      filename: 'proveedores',
      sheets: [{
        name: 'Proveedores',
        data: proveedores.map(p => ({
          nombre: p.nombre,
          tipo: p.tipo || '',
          telefono: p.telefono || '',
          email: p.email || '',
          cuit: p.cuit || '',
          total_gastado: p.total_gastado || 0,
          cantidad_trabajos: p.cantidad_trabajos || 0,
        })),
        columns: [
          { header: 'Nombre', key: 'nombre', width: 25 },
          { header: 'Tipo', key: 'tipo', width: 15 },
          { header: 'Teléfono', key: 'telefono', width: 15 },
          { header: 'Email', key: 'email', width: 25 },
          { header: 'CUIT', key: 'cuit', width: 15 },
          { header: 'Total Gastado', key: 'total_gastado', width: 16, format: 'currency' },
          { header: 'Trabajos', key: 'cantidad_trabajos', width: 10 },
        ],
      }],
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Store className="w-7 h-7 text-primary-600" />
              Proveedores
            </h1>
            <p className="text-gray-500">Gestión de proveedores y servicios</p>
          </div>
          {proveedores?.length > 0 && <ExportButton onClick={handleExportar} />}
        </div>
        <button onClick={() => { reset(); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Proveedor
        </button>
      </div>

      {/* Stats */}
      {estadisticas && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-primary-600">{estadisticas.total_proveedores}</p>
            <p className="text-sm text-gray-500">Proveedores activos</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(estadisticas.total_gastado)}</p>
            <p className="text-sm text-gray-500">Total gastado</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{estadisticas.proveedor_mas_usado || '-'}</p>
            <p className="text-sm text-gray-500">Más usado</p>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor..."
          className="input pl-10"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : !proveedores?.length ? (
        <EmptyState
          icon={Store}
          title={busqueda ? 'Sin resultados' : 'No hay proveedores'}
          description={
            busqueda
              ? 'No se encontraron proveedores con esa búsqueda.'
              : 'Agrega tu primer proveedor para llevar registro de servicios y gastos.'
          }
          actionLabel={busqueda ? undefined : 'Nuevo Proveedor'}
          onAction={busqueda ? undefined : () => { reset(); setModalOpen(true) }}
          secondaryLabel={busqueda ? 'Limpiar búsqueda' : undefined}
          onSecondaryAction={busqueda ? () => setBusqueda('') : undefined}
        />
      ) : (
        <div className="space-y-3">
          {proveedores.map(prov => (
            <div key={prov.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <Store className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{prov.nombre}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {prov.tipo && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{prov.tipo}</span>
                      )}
                      {prov.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {prov.telefono}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(prov.total_gastado)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {prov.cantidad_trabajos || 0} trabajos
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(prov)} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpandedId(expandedId === prov.id ? null : prov.id)} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50">
                      {expandedId === prov.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { if (confirm('¿Desactivar este proveedor?')) eliminarMutation.mutate(prov.id) }} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Detalle expandido: historial de costos */}
              {expandedId === prov.id && (
                <div className="mt-4 pt-4 border-t">
                  {prov.email && (
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {prov.email}
                    </p>
                  )}
                  {prov.direccion && (
                    <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {prov.direccion}
                    </p>
                  )}
                  {prov.cuit && (
                    <p className="text-sm text-gray-600 mb-3">CUIT: {prov.cuit}</p>
                  )}
                  {prov.notas && (
                    <p className="text-sm text-gray-500 italic mb-3">{prov.notas}</p>
                  )}

                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Últimos trabajos</h4>
                  {costosExpandido?.length ? (
                    <div className="space-y-2">
                      {costosExpandido.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="font-medium">{c.descripcion}</span>
                            <span className="text-gray-400 ml-2">
                              {new Date(c.fecha).toLocaleDateString('es-AR')}
                            </span>
                          </div>
                          <span className="font-semibold text-gray-700">{formatCurrency(c.monto)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Sin costos registrados</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={cerrarModal}
        title={editando ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...register('nombre', { required: 'Requerido' })} className="input" placeholder="Nombre del proveedor" />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="label">Tipo / Rubro</label>
            <input {...register('tipo')} className="input" placeholder="Ej: Mecánica, Chapa y pintura, Electricidad..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input {...register('telefono')} className="input" placeholder="Teléfono" />
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} className="input" placeholder="Email" type="email" />
            </div>
          </div>

          <div>
            <label className="label">Dirección</label>
            <input {...register('direccion')} className="input" placeholder="Dirección" />
          </div>

          <div>
            <label className="label">CUIT</label>
            <input {...register('cuit')} className="input" placeholder="XX-XXXXXXXX-X" />
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea {...register('notas')} className="input" rows={3} placeholder="Notas u observaciones..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cerrarModal} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={crearMutation.isPending || editarMutation.isPending}>
              {editando ? 'Guardar Cambios' : 'Crear Proveedor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
