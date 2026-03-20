import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usuariosAPI, authAPI, mercadolibreAPI, inteligenciaAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Save,
  TrendingUp,
  DollarSign,
  BarChart3,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2Off,
  Building2,
  MessageCircle,
} from 'lucide-react'
import clsx from 'clsx'

export default function MiPerfil() {
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Agency config
  const [agencyWhatsApp, setAgencyWhatsApp] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyAddress, setAgencyAddress] = useState('')
  const [agencySaving, setAgencySaving] = useState(false)

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: async () => {
      const res = await usuariosAPI.miPerfil()
      return res.data
    }
  })

  // Agency config (admin only) — loads from ConfiguracionNegocio
  const { data: agencyConfig } = useQuery({
    queryKey: ['agency-config'],
    queryFn: async () => {
      const res = await inteligenciaAPI.configuracion()
      return res.data
    },
    enabled: isAdmin,
  })

  // Load saved values when config arrives
  useEffect(() => {
    if (agencyConfig) {
      setAgencyWhatsApp(agencyConfig.whatsapp_agencia || '')
      setAgencyName(agencyConfig.nombre_agencia || '')
      setAgencyAddress(agencyConfig.direccion_agencia || '')
    }
  }, [agencyConfig])

  const handleSaveAgency = async () => {
    setAgencySaving(true)
    try {
      const updates = [
        ['whatsapp_agencia', agencyWhatsApp],
        ['nombre_agencia', agencyName],
        ['direccion_agencia', agencyAddress],
      ]
      for (const [clave, valor] of updates) {
        await inteligenciaAPI.actualizarConfiguracion(clave, valor || '')
      }
      queryClient.invalidateQueries(['agency-config'])
      toast.success('Datos de la agencia guardados')
    } catch (e) {
      toast.error('Error al guardar')
    } finally {
      setAgencySaving(false)
    }
  }

  // Estado de MercadoLibre
  const { data: mlStatus, isLoading: mlLoading, refetch: refetchML } = useQuery({
    queryKey: ['mercadolibre-status'],
    queryFn: async () => {
      const res = await mercadolibreAPI.status()
      return res.data
    }
  })

  // Conectar MercadoLibre
  const connectMLMutation = useMutation({
    mutationFn: async () => {
      const res = await mercadolibreAPI.getAuthUrl()
      return res.data.auth_url
    },
    onSuccess: (authUrl) => {
      // Redirigir a MercadoLibre para autorizar
      window.location.href = authUrl
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al conectar con MercadoLibre')
    }
  })

  // Desconectar MercadoLibre
  const disconnectMLMutation = useMutation({
    mutationFn: () => mercadolibreAPI.disconnect(),
    onSuccess: () => {
      toast.success('MercadoLibre desconectado')
      refetchML()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al desconectar')
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: ({ oldPassword, newPassword }) =>
      authAPI.changePassword(oldPassword, newPassword),
    onSuccess: () => {
      toast.success('Contrasena actualizada correctamente')
      setShowPasswordForm(false)
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al cambiar contrasena')
    }
  })

  const handleChangePassword = (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contrasenas no coinciden')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('La nueva contrasena debe tener al menos 6 caracteres')
      return
    }

    changePasswordMutation.mutate({
      oldPassword: passwordData.oldPassword,
      newPassword: passwordData.newPassword
    })
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
        <p className="text-gray-500 dark:text-gray-400">Informacion de tu cuenta y estadisticas</p>
      </div>

      {/* Info del perfil */}
      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className={clsx(
            "w-16 h-16 rounded-full flex items-center justify-center",
            perfil?.rol === 'admin' ? "bg-purple-100 dark:bg-purple-900" : "bg-blue-100 dark:bg-blue-900"
          )}>
            {perfil?.rol === 'admin' ? (
              <ShieldCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            ) : (
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{perfil?.nombre_completo}</h2>
            <span className={clsx(
              "text-sm px-3 py-1 rounded-full",
              perfil?.rol === 'admin' ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400"
            )}>
              {perfil?.rol === 'admin' ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <User className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Usuario:</span>
            <span>{perfil?.username}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Mail className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Email:</span>
            <span>{perfil?.email}</span>
          </div>
          {perfil?.telefono && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <Phone className="w-5 h-5 text-gray-400" />
              <span className="font-medium">Telefono:</span>
              <span>{perfil?.telefono}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Miembro desde:</span>
            <span>{formatDate(perfil?.created_at)}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Ultimo acceso:</span>
            <span>{formatDate(perfil?.last_login)}</span>
          </div>
        </div>
      </div>

      {/* Estadisticas del vendedor */}
      {perfil?.estadisticas && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            Mis Estadisticas
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl text-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Ventas este mes</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{perfil.estadisticas.ventas_mes}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(perfil.estadisticas.monto_mes)}</p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl text-center">
              <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-600 dark:text-green-400 mb-1">Ventas trimestre</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">{perfil.estadisticas.ventas_trimestre}</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">{formatCurrency(perfil.estadisticas.monto_trimestre)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Datos de la Agencia - solo admin */}
      {isAdmin && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-500" />
            Datos de la Agencia
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Esta informacion se usa en las fichas publicas de vehiculos y los mensajes de WhatsApp.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre de la agencia
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ej: Automotores Rodriguez"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp de la agencia
              </label>
              <input
                type="tel"
                className="input w-full"
                placeholder="Ej: 5493518567543 (con codigo de pais)"
                value={agencyWhatsApp}
                onChange={(e) => setAgencyWhatsApp(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-gray-400 mt-1">
                Formato internacional sin + ni espacios. Ej: 5493515551234. Este numero se usa para los botones de WhatsApp en fichas publicas y mensajes a interesados.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Direccion
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="Ej: Av. Colon 1234, Cordoba"
                value={agencyAddress}
                onChange={(e) => setAgencyAddress(e.target.value)}
              />
            </div>

            <button
              onClick={handleSaveAgency}
              disabled={agencySaving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {agencySaving ? 'Guardando...' : 'Guardar datos de agencia'}
            </button>
          </div>
        </div>
      )}

      {/* Integraciones - MercadoLibre */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🛒</span>
          MercadoLibre
        </h3>

        {mlLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !mlStatus?.configured ? (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              MercadoLibre no está configurado en el sistema. Contactá al administrador para habilitarlo.
            </p>
          </div>
        ) : mlStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Cuenta conectada</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Usuario: <span className="font-semibold">{mlStatus.ml_nickname || mlStatus.ml_user_id}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm('¿Desconectar tu cuenta de MercadoLibre?')) {
                  disconnectMLMutation.mutate()
                }
              }}
              disabled={disconnectMLMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
            >
              {disconnectMLMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2Off className="w-4 h-4" />
              )}
              Desconectar MercadoLibre
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Conectá tu cuenta de MercadoLibre para publicar vehículos directamente desde Alfredo.
            </p>

            <button
              onClick={() => connectMLMutation.mutate()}
              disabled={connectMLMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
            >
              {connectMLMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Conectar MercadoLibre
            </button>
          </div>
        )}
      </div>

      {/* Cambiar contrasena */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            Seguridad
          </h3>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
            >
              Cambiar contrasena
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contrasena actual
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nueva contrasena
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirmar nueva contrasena
              </label>
              <input
                type="password"
                className="input w-full"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
                }}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {changePasswordMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Puedes cambiar tu contrasena en cualquier momento para mantener tu cuenta segura.
          </p>
        )}
      </div>
    </div>
  )
}
