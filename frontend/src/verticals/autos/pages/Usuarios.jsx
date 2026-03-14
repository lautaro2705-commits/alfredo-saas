import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usuariosAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  RefreshCcw,
  Shield,
  ShieldCheck,
  X,
  Save,
  Eye,
  EyeOff,
  BarChart3,
  Calendar,
  Mail,
  Phone,
  Key,
  Check,
  RotateCcw
} from 'lucide-react'
import clsx from 'clsx'

// Categorias de permisos para agrupar visualmente
const CATEGORIAS_PERMISOS = {
  "Stock": ["ver_stock", "crear_unidad", "editar_unidad", "eliminar_unidad", "ver_costos", "editar_precios", "ver_valorizacion"],
  "Clientes": ["ver_clientes", "crear_cliente", "editar_cliente"],
  "Ventas": ["ver_operaciones", "ver_todas_operaciones", "crear_operacion", "completar_operacion", "cancelar_operacion", "eliminar_operacion"],
  "Caja": ["ver_caja", "crear_movimiento_caja", "eliminar_movimiento_caja", "ver_cierres", "crear_cierre"],
  "Cheques": ["ver_cheques", "gestionar_cheques"],
  "Documentacion": ["ver_documentacion", "editar_documentacion", "gestionar_gestoria"],
  "Reportes": ["ver_reportes", "ver_inteligencia", "editar_configuracion"],
  "Usuarios": ["ver_usuarios", "gestionar_usuarios"],
  "CRM": ["ver_interesados", "gestionar_interesados"]
}

export default function Usuarios() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [filterActivo, setFilterActivo] = useState(true)
  const [showPermisosModal, setShowPermisosModal] = useState(false)
  const [permisosEditando, setPermisosEditando] = useState([])
  const [userParaPermisos, setUserParaPermisos] = useState(null)

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    nombre: '',
    apellido: '',
    telefono: '',
    password: '',
    rol: 'vendedor'
  })

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios', filterActivo],
    queryFn: async () => {
      const res = await usuariosAPI.list({ activo: filterActivo })
      return res.data
    },
    enabled: isAdmin
  })

  const { data: permisosDisponibles } = useQuery({
    queryKey: ['permisos-disponibles'],
    queryFn: async () => {
      const res = await usuariosAPI.permisosDisponibles()
      return res.data
    },
    enabled: isAdmin
  })

  const { data: estadisticas } = useQuery({
    queryKey: ['usuario-estadisticas', selectedUser?.id],
    queryFn: async () => {
      const res = await usuariosAPI.estadisticas(selectedUser.id)
      return res.data
    },
    enabled: !!selectedUser && isAdmin
  })

  const createMutation = useMutation({
    mutationFn: (data) => usuariosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario creado correctamente')
      resetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al crear usuario')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usuariosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario actualizado')
      resetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar')
    }
  })

  const updatePermisosMutation = useMutation({
    mutationFn: ({ id, permisos }) => usuariosAPI.actualizarPermisos(id, permisos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Permisos actualizados')
      setShowPermisosModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar permisos')
    }
  })

  const restablecerPermisosMutation = useMutation({
    mutationFn: (id) => usuariosAPI.restablecerPermisos(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Permisos restablecidos a los del rol')
      setShowPermisosModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al restablecer')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => usuariosAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario desactivado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al desactivar')
    }
  })

  const reactivateMutation = useMutation({
    mutationFn: (id) => usuariosAPI.reactivar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario reactivado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al reactivar')
    }
  })

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      nombre: '',
      apellido: '',
      telefono: '',
      password: '',
      rol: 'vendedor'
    })
    setEditingUser(null)
    setShowForm(false)
    setShowPassword(false)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono || '',
      password: '',
      rol: user.rol
    })
    setShowForm(true)
  }

  const handleEditPermisos = (user) => {
    setUserParaPermisos(user)
    setPermisosEditando([...user.permisos])
    setShowPermisosModal(true)
  }

  const handleTogglePermiso = (permiso) => {
    if (permisosEditando.includes(permiso)) {
      setPermisosEditando(permisosEditando.filter(p => p !== permiso))
    } else {
      setPermisosEditando([...permisosEditando, permiso])
    }
  }

  const handleToggleCategoria = (permisos) => {
    const todosSeleccionados = permisos.every(p => permisosEditando.includes(p))
    if (todosSeleccionados) {
      setPermisosEditando(permisosEditando.filter(p => !permisos.includes(p)))
    } else {
      const nuevos = permisos.filter(p => !permisosEditando.includes(p))
      setPermisosEditando([...permisosEditando, ...nuevos])
    }
  }

  const handleGuardarPermisos = () => {
    updatePermisosMutation.mutate({
      id: userParaPermisos.id,
      permisos: permisosEditando
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (editingUser) {
      const updateData = { ...formData }
      if (!updateData.password) delete updateData.password
      delete updateData.username
      updateMutation.mutate({ id: editingUser.id, data: updateData })
    } else {
      if (!formData.password || formData.password.length < 6) {
        toast.error('La contrasena debe tener al menos 6 caracteres')
        return
      }
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (user) => {
    if (window.confirm(`¿Desactivar a ${user.nombre_completo}?`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const handleReactivate = (user) => {
    if (window.confirm(`¿Reactivar a ${user.nombre_completo}?`)) {
      reactivateMutation.mutate(user.id)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDescripcionPermiso = (clave) => {
    const permiso = permisosDisponibles?.permisos?.find(p => p.clave === clave)
    return permiso?.descripcion || clave
  }

  const getRolColor = (rol) => {
    switch(rol) {
      case 'admin': return 'bg-purple-100 text-purple-700'
      case 'vendedor': return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
      case 'gestor': return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400'
      case 'administrativo': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const getRolLabel = (rol) => {
    switch(rol) {
      case 'admin': return 'Administrador'
      case 'vendedor': return 'Vendedor'
      case 'gestor': return 'Gestor'
      case 'administrativo': return 'Administrativo'
      default: return rol
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Acceso Restringido</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Solo administradores pueden gestionar usuarios.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestion de usuarios y permisos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Filtro activos/inactivos */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterActivo(true)}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            filterActivo
              ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
          )}
        >
          Activos
        </button>
        <button
          onClick={() => setFilterActivo(false)}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            !filterActivo
              ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
          )}
        >
          Inactivos
        </button>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  className="input w-full"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono</label>
                <input
                  type="tel"
                  className="input w-full"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editingUser ? 'Nueva Contrasena (dejar vacio para no cambiar)' : 'Contrasena'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input w-full pr-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    minLength={editingUser ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                <select
                  className="input w-full"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="gestor">Gestor (Gestoria)</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  El rol define los permisos por defecto. Puedes personalizarlos luego.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={resetForm} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de permisos */}
      {showPermisosModal && userParaPermisos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Permisos de {userParaPermisos.nombre_completo}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Rol: {getRolLabel(userParaPermisos.rol)}</p>
              </div>
              <button onClick={() => setShowPermisosModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {Object.entries(CATEGORIAS_PERMISOS).map(([categoria, permisos]) => {
                  const permisosValidos = permisos.filter(p =>
                    permisosDisponibles?.permisos?.some(pd => pd.clave === p)
                  )
                  if (permisosValidos.length === 0) return null

                  const todosSeleccionados = permisosValidos.every(p => permisosEditando.includes(p))
                  const algunoSeleccionado = permisosValidos.some(p => permisosEditando.includes(p))

                  return (
                    <div key={categoria} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{categoria}</h3>
                        <button
                          type="button"
                          onClick={() => handleToggleCategoria(permisosValidos)}
                          className={clsx(
                            "text-xs px-2 py-1 rounded",
                            todosSeleccionados
                              ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                          )}
                        >
                          {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {permisosValidos.map(permiso => (
                          <label
                            key={permiso}
                            className={clsx(
                              "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                              permisosEditando.includes(permiso)
                                ? "bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-700"
                                : "bg-gray-50 dark:bg-gray-800 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={permisosEditando.includes(permiso)}
                              onChange={() => handleTogglePermiso(permiso)}
                              className="rounded text-primary-600 dark:text-primary-400 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {getDescripcionPermiso(permiso)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex justify-between">
              <button
                type="button"
                onClick={() => restablecerPermisosMutation.mutate(userParaPermisos.id)}
                disabled={restablecerPermisosMutation.isPending}
                className="btn btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restablecer a rol
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPermisosModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarPermisos}
                  disabled={updatePermisosMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {updatePermisosMutation.isPending ? 'Guardando...' : 'Guardar Permisos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de estadisticas */}
      {selectedUser && estadisticas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Estadisticas de {estadisticas.vendedor.nombre_completo}
              </h2>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{estadisticas.vendedor.nombre_completo}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{estadisticas.vendedor.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">Este Mes</p>
                  <p className="text-2xl font-bold text-blue-900">{estadisticas.mes_actual.ventas}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{formatCurrency(estadisticas.mes_actual.monto_total)}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Trimestre</p>
                  <p className="text-2xl font-bold text-green-900">{estadisticas.trimestre.ventas}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">{formatCurrency(estadisticas.trimestre.monto_total)}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400">Este Ano</p>
                  <p className="text-2xl font-bold text-purple-900">{estadisticas.anio.ventas}</p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">{formatCurrency(estadisticas.anio.monto_total)}</p>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Historico</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{estadisticas.historico.ventas}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(estadisticas.historico.monto_total)}</p>
                </div>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Creado: {formatDate(estadisticas.vendedor.created_at)}
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Ultimo login: {formatDate(estadisticas.vendedor.last_login)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : usuarios?.length === 0 ? (
        <div className="text-center py-12 card">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No hay usuarios {filterActivo ? 'activos' : 'inactivos'}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {usuarios?.map((user) => (
            <div
              key={user.id}
              className={clsx(
                "card flex items-center justify-between",
                !user.activo && "opacity-60"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  user.rol === 'admin' ? "bg-purple-100" :
                  user.rol === 'gestor' ? "bg-green-100 dark:bg-green-900" :
                  user.rol === 'administrativo' ? "bg-orange-100" :
                  "bg-blue-100 dark:bg-blue-900"
                )}>
                  {user.rol === 'admin' ? (
                    <ShieldCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{user.nombre_completo}</h3>
                    <span className={clsx(
                      "text-xs px-2 py-0.5 rounded-full",
                      getRolColor(user.rol)
                    )}>
                      {getRolLabel(user.rol)}
                    </span>
                    {!user.activo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {user.email}
                  </p>
                  {user.permisos && (
                    <p className="text-xs text-gray-400 mt-1">
                      {user.permisos.length} permisos asignados
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {user.rol !== 'admin' && user.activo && (
                  <>
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Ver estadisticas"
                    >
                      <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEditPermisos(user)}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                      title="Editar permisos"
                    >
                      <Key className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleEdit(user)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  title="Editar"
                >
                  <Edit className="w-5 h-5" />
                </button>
                {user.activo ? (
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Desactivar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(user)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                    title="Reactivar"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
