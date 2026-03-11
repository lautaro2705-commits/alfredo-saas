import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientesAPI } from '../services/api'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, Search, Users, Edit, Trash2, Phone, Mail } from 'lucide-react'
import { TableSkeleton } from '../components/Skeletons'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

export default function Clientes() {
  const queryClient = useQueryClient()
  const [buscar, setBuscar] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Keyboard shortcut: N → open new client modal
  useEffect(() => {
    const handler = () => { reset(); setEditingCliente(null); setModalOpen(true) }
    window.addEventListener('shortcut:new', handler)
    return () => window.removeEventListener('shortcut:new', handler)
  }, [reset])

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes', buscar],
    queryFn: async () => {
      const res = await clientesAPI.list({ buscar })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => editingCliente
      ? clientesAPI.update(editingCliente.id, data)
      : clientesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes'])
      toast.success(editingCliente ? 'Cliente actualizado' : 'Cliente creado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al guardar')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => clientesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes'])
      toast.success('Cliente eliminado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar')
    },
  })

  const openModal = (cliente = null) => {
    setEditingCliente(cliente)
    if (cliente) {
      reset(cliente)
    } else {
      reset({})
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingCliente(null)
    reset({})
  }

  const onSubmit = (data) => {
    createMutation.mutate(data)
  }

  const handleDelete = (cliente) => {
    if (window.confirm(`¿Eliminar a ${cliente.nombre} ${cliente.apellido}?`)) {
      deleteMutation.mutate(cliente.id)
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">{clientes?.length || 0} clientes registrados</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o teléfono..."
          className="input pl-10"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : clientes?.length === 0 ? (
        <EmptyState
          icon={Users}
          title={buscar ? 'Sin resultados' : 'No hay clientes'}
          description={
            buscar
              ? 'No se encontraron clientes con esa búsqueda. Intenta con otro término.'
              : 'Agrega tu primer cliente para comenzar a gestionar tu cartera.'
          }
          actionLabel={buscar ? undefined : 'Nuevo Cliente'}
          onAction={buscar ? undefined : () => openModal()}
          secondaryLabel={buscar ? 'Limpiar búsqueda' : undefined}
          onSecondaryAction={buscar ? () => setBuscar('') : undefined}
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {clientes?.map((cliente) => (
              <div key={cliente.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{cliente.nombre} {cliente.apellido}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{cliente.dni_cuit}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(cliente)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cliente)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  {cliente.telefono && (
                    <a href={`tel:${cliente.telefono}`} className="flex items-center gap-1 hover:text-primary-600">
                      <Phone className="w-3.5 h-3.5" />
                      {cliente.telefono}
                    </a>
                  )}
                  {cliente.email && (
                    <a href={`mailto:${cliente.email}`} className="flex items-center gap-1 hover:text-primary-600">
                      <Mail className="w-3.5 h-3.5" />
                      {cliente.email}
                    </a>
                  )}
                  {cliente.localidad && (
                    <span className="text-gray-400">{cliente.localidad}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI/CUIT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clientes?.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-900">{cliente.nombre} {cliente.apellido}</p>
                        {cliente.localidad && (
                          <p className="text-sm text-gray-500">{cliente.localidad}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">
                        {cliente.dni_cuit}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {cliente.telefono || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {cliente.email || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => openModal(cliente)}
                          className="p-2 text-gray-400 hover:text-primary-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                type="text"
                className="input"
                {...register('nombre', { required: 'Nombre requerido' })}
              />
              {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input
                type="text"
                className="input"
                {...register('apellido', { required: 'Apellido requerido' })}
              />
              {errors.apellido && <p className="text-red-500 text-sm mt-1">{errors.apellido.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">DNI / CUIT *</label>
            <input
              type="text"
              className="input"
              {...register('dni_cuit', { required: 'DNI/CUIT requerido' })}
            />
            {errors.dni_cuit && <p className="text-red-500 text-sm mt-1">{errors.dni_cuit.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input type="text" className="input" {...register('telefono')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...register('email')} />
            </div>
          </div>

          <div>
            <label className="label">Dirección</label>
            <input type="text" className="input" {...register('direccion')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Localidad</label>
              <input type="text" className="input" {...register('localidad')} />
            </div>
            <div>
              <label className="label">Provincia</label>
              <input type="text" className="input" {...register('provincia')} />
            </div>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows="2" {...register('observaciones')} />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn btn-primary flex-1"
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
