import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { interesadosAPI, inteligenciaAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  Plus,
  Users,
  Search,
  Bell,
  X,
  Phone,
  Mail,
  Car,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
  MessageCircle,
} from 'lucide-react'
import clsx from 'clsx'
import WhatsAppTemplates from '../components/WhatsAppTemplates'

export default function Interesados() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [waInteresado, setWaInteresado] = useState(null) // for WhatsApp templates modal
  const [filtroActivos, setFiltroActivos] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { data: interesados, isLoading } = useQuery({
    queryKey: ['interesados', filtroActivos, busqueda],
    queryFn: async () => {
      const res = await interesadosAPI.list({
        activos: filtroActivos,
        buscar: busqueda || undefined
      })
      return res.data
    }
  })

  // Agency config for WhatsApp number
  const { data: agencyConfig } = useQuery({
    queryKey: ['agency-config'],
    queryFn: async () => {
      const res = await inteligenciaAPI.configuracion()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: estadisticas } = useQuery({
    queryKey: ['interesados-stats'],
    queryFn: async () => {
      const res = await interesadosAPI.estadisticas()
      return res.data
    }
  })

  const { data: notificaciones } = useQuery({
    queryKey: ['notificaciones-pendientes'],
    queryFn: async () => {
      const res = await interesadosAPI.notificacionesPendientes()
      return res.data
    }
  })

  const createMutation = useMutation({
    mutationFn: (data) => interesadosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interesados'] })
      queryClient.invalidateQueries({ queryKey: ['interesados-stats'] })
      toast.success('Interesado registrado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al registrar')
    }
  })

  const desactivarMutation = useMutation({
    mutationFn: (id) => interesadosAPI.desactivar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interesados'] })
      queryClient.invalidateQueries({ queryKey: ['interesados-stats'] })
      toast.success('Interesado desactivado')
    }
  })

  const marcarLeidaMutation = useMutation({
    mutationFn: (id) => interesadosAPI.marcarLeida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones-pendientes'] })
    }
  })

  const openModal = () => {
    reset({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    reset({})
  }

  const onSubmit = (data) => {
    // Limpiar campos vacios
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    )
    createMutation.mutate(cleanData)
  }

  const handleDesactivar = (interesado) => {
    if (window.confirm(`Desactivar a ${interesado.nombre_completo}?`)) {
      desactivarMutation.mutate(interesado.id)
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

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lista de Espera</h1>
          <p className="text-gray-500 dark:text-gray-400">Clientes buscando autos que no tenemos</p>
        </div>
        <div className="flex gap-2">
          {notificaciones && notificaciones.length > 0 && (
            <button
              onClick={() => setNotifModalOpen(true)}
              className="btn btn-warning relative flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notificaciones.length}
              </span>
            </button>
          )}
          <button onClick={openModal} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      {/* Estadisticas */}
      {estadisticas && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <Users className="w-8 h-8 text-primary-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Interesados Activos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{estadisticas.interesados_activos}</p>
          </div>
          <div className="card text-center">
            <Bell className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Matches Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{estadisticas.notificaciones_pendientes}</p>
          </div>
          <div className="card text-center">
            <Car className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Marca Mas Buscada</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {estadisticas.marcas_mas_buscadas?.[0]?.marca || '-'}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, telefono, marca..."
            className="input pl-10"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={filtroActivos}
          onChange={(e) => setFiltroActivos(e.target.value === 'true')}
        >
          <option value="true">Solo Activos</option>
          <option value="false">Solo Inactivos</option>
        </select>
      </div>

      {/* Lista */}
      <div className="card">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : interesados?.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay interesados registrados</p>
        ) : (
          <div className="space-y-3">
            {interesados?.map((interesado) => (
              <div
                key={interesado.id}
                className={clsx(
                  "p-4 rounded-lg border",
                  interesado.activo ? "bg-white border-gray-200 dark:border-gray-700" : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{interesado.nombre_completo}</h3>
                      {interesado.activo ? (
                        <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded">Activo</span>
                      ) : (
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 rounded">Inactivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {interesado.telefono}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {interesado.marca_buscada && (
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded">
                          {interesado.marca_buscada}
                        </span>
                      )}
                      {interesado.modelo_buscado && (
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded">
                          {interesado.modelo_buscado}
                        </span>
                      )}
                      {interesado.precio_maximo && (
                        <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded">
                          Max: {formatCurrency(interesado.precio_maximo)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {interesado.activo && interesado.telefono && (
                      <button
                        onClick={() => setWaInteresado(interesado)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                    {interesado.activo && (
                      <button
                        onClick={() => handleDesactivar(interesado)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Desactivar"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nuevo Interesado */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-primary-50 dark:bg-primary-950">
              <h2 className="text-lg font-semibold">Nuevo Interesado</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/50 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input
                    type="text"
                    className="input"
                    {...register('nombre', { required: 'Requerido' })}
                  />
                  {errors.nombre && <p className="text-red-500 text-sm">{errors.nombre.message}</p>}
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input
                    type="text"
                    className="input"
                    {...register('apellido', { required: 'Requerido' })}
                  />
                  {errors.apellido && <p className="text-red-500 text-sm">{errors.apellido.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefono *</label>
                  <input
                    type="tel"
                    className="input"
                    {...register('telefono', { required: 'Requerido' })}
                  />
                  {errors.telefono && <p className="text-red-500 text-sm">{errors.telefono.message}</p>}
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" {...register('email')} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Que busca?</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Marca</label>
                    <input type="text" className="input" placeholder="Ej: Toyota" {...register('marca_buscada')} />
                  </div>
                  <div>
                    <label className="label">Modelo</label>
                    <input type="text" className="input" placeholder="Ej: Corolla" {...register('modelo_buscado')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">Ano Desde</label>
                    <input type="number" className="input" placeholder="2018" {...register('anio_desde')} />
                  </div>
                  <div>
                    <label className="label">Ano Hasta</label>
                    <input type="number" className="input" placeholder="2024" {...register('anio_hasta')} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="label">Precio Maximo</label>
                  <input type="number" className="input" placeholder="15000000" {...register('precio_maximo')} />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="label">Combustible</label>
                    <select className="input" {...register('combustible')}>
                      <option value="">Cualquiera</option>
                      <option value="Nafta">Nafta</option>
                      <option value="Diesel">Diesel</option>
                      <option value="GNC">GNC</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Transmision</label>
                    <select className="input" {...register('transmision')}>
                      <option value="">Cualquiera</option>
                      <option value="Manual">Manual</option>
                      <option value="Automatica">Automatica</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="label">Otras preferencias</label>
                  <textarea
                    className="input"
                    rows="2"
                    placeholder="Color, caracteristicas especiales..."
                    {...register('otras_preferencias')}
                  />
                </div>
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
                  {createMutation.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Notificaciones */}
      {notifModalOpen && notificaciones && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setNotifModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-yellow-50 dark:bg-yellow-950">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                Matches Encontrados ({notificaciones.length})
              </h2>
              <button onClick={() => setNotifModalOpen(false)} className="p-2 hover:bg-white/50 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {notificaciones.map((notif) => (
                <div key={notif.id} className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {notif.unidad.marca} {notif.unidad.modelo} ({notif.unidad.anio})
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{notif.unidad.dominio}</p>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Precio: {formatCurrency(notif.unidad.precio_publicado)}
                      </p>
                    </div>
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                      {notif.score_match?.toFixed(0)}% match
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-yellow-300">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Para: <span className="font-medium">{notif.interesado.nombre_completo}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{notif.interesado.telefono}</p>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => marcarLeidaMutation.mutate(notif.id)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Marcar como leida
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Templates Modal */}
      {waInteresado && (
        <WhatsAppTemplates
          telefono={waInteresado.telefono}
          nombre={waInteresado.nombre_completo}
          vehiculo={[waInteresado.marca_buscada, waInteresado.modelo_buscado].filter(Boolean).join(' ') || 'vehiculo'}
          precio={waInteresado.precio_maximo ? formatCurrency(waInteresado.precio_maximo) : null}
          agencia={agencyConfig?.nombre_agencia || 'nuestra agencia'}
          whatsappAgencia={agencyConfig?.whatsapp_agencia}
          onClose={() => setWaInteresado(null)}
        />
      )}
    </div>
  )
}
