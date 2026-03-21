import { useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unidadesAPI, documentacionAPI, marketingAPI, archivosAPI, mercadolibreAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  Wrench,
  Calendar,
  Car,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Share2,
  Copy,
  ExternalLink,
  Image,
  Upload,
  TrendingUp,
  RefreshCw,
  Pause,
  Play,
  Loader2,
  Camera,
  X,
  ImagePlus
} from 'lucide-react'
import clsx from 'clsx'
import BadgeCompetitividad from '../components/BadgeCompetitividad'
import MLPublishModal from '../components/MLPublishModal'

const estadoColors = {
  disponible: 'badge-success',
  reservado: 'badge-warning',
  vendido: 'badge-info',
  en_reparacion: 'badge-danger',
}

export default function UnidadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('info')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [mlPublishModalOpen, setMLPublishModalOpen] = useState(false)
  const [fotoExpandida, setFotoExpandida] = useState(null)
  const fileInputRef = useRef(null)

  const { data: unidad, isLoading } = useQuery({
    queryKey: ['unidad', id],
    queryFn: async () => {
      const res = await unidadesAPI.get(id)
      return res.data
    },
  })

  const { data: documentacion } = useQuery({
    queryKey: ['documentacion', id],
    queryFn: async () => {
      const res = await documentacionAPI.getByUnidad(id)
      return res.data
    },
  })

  const { data: historialCostos } = useQuery({
    queryKey: ['historial-costos', id],
    queryFn: async () => {
      const res = await unidadesAPI.historialCostos(id)
      return res.data
    },
  })

  const { data: fichaVenta } = useQuery({
    queryKey: ['ficha-venta', id],
    queryFn: async () => {
      const res = await marketingAPI.fichaVenta(id)
      return res.data
    },
    enabled: shareModalOpen
  })

  const { data: archivosUnidad } = useQuery({
    queryKey: ['archivos-unidad', id],
    queryFn: async () => {
      const res = await archivosAPI.resumenUnidad(id)
      return res.data
    }
  })

  // Fotos de la unidad
  const { data: fotosData, isLoading: fotosLoading } = useQuery({
    queryKey: ['unidad-fotos', id],
    queryFn: async () => {
      const res = await unidadesAPI.getFotos(id)
      return res.data
    }
  })

  // Estado de MercadoLibre del usuario
  const { data: mlStatus } = useQuery({
    queryKey: ['mercadolibre-status'],
    queryFn: async () => {
      const res = await mercadolibreAPI.status()
      return res.data
    }
  })

  // Subir foto
  const uploadFotoMutation = useMutation({
    mutationFn: (file) => unidadesAPI.subirFoto(id, file),
    onSuccess: () => {
      toast.success('Foto subida correctamente')
      queryClient.invalidateQueries({ queryKey: ['unidad-fotos', id] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al subir foto')
    }
  })

  // Eliminar foto
  const deleteFotoMutation = useMutation({
    mutationFn: (fotoIndex) => unidadesAPI.eliminarFoto(id, fotoIndex),
    onSuccess: () => {
      toast.success('Foto eliminada')
      queryClient.invalidateQueries({ queryKey: ['unidad-fotos', id] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar foto')
    }
  })

  // Mutaciones de MercadoLibre
  const pauseMLMutation = useMutation({
    mutationFn: () => mercadolibreAPI.pause(id),
    onSuccess: () => {
      toast.success('Publicación pausada')
      queryClient.invalidateQueries({ queryKey: ['unidad', id] })
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Error')
  })

  const activateMLMutation = useMutation({
    mutationFn: () => mercadolibreAPI.activate(id),
    onSuccess: () => {
      toast.success('Publicación reactivada')
      queryClient.invalidateQueries({ queryKey: ['unidad', id] })
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Error')
  })

  const syncMLMutation = useMutation({
    mutationFn: () => mercadolibreAPI.sync(id),
    onSuccess: () => {
      toast.success('Precio sincronizado')
      queryClient.invalidateQueries({ queryKey: ['unidad', id] })
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Error')
  })

  // Precio de mercado - DESHABILITADO (los portales bloquean servidores)
  // TODO: Reactivar cuando tengamos API oficial (InfoAuto, etc)
  const precioMercado = null
  const refetchPrecioMercado = () => {}
  const fetchingPrecio = false
  const MOSTRAR_PRECIOS_MERCADO = false

  const deleteMutation = useMutation({
    mutationFn: () => unidadesAPI.delete(id),
    onSuccess: () => {
      toast.success('Unidad eliminada')
      navigate('/unidades')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar')
    },
  })

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!unidad) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Unidad no encontrada</h3>
        <Link to="/unidades" className="btn btn-primary mt-4">Volver al stock</Link>
      </div>
    )
  }

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de eliminar esta unidad?')) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/unidades" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {unidad.marca} {unidad.modelo}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{unidad.version || ''} • {unidad.anio}</p>
        </div>
        <span className={clsx('badge', estadoColors[unidad.estado])}>
          {unidad.estado.replaceAll('_', ' ')}
        </span>
        {unidad.mercadolibre_id && (
          <span className={clsx(
            'badge flex items-center gap-1',
            unidad.mercadolibre_status === 'active' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800' :
            unidad.mercadolibre_status === 'paused' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' :
            'bg-red-100 dark:bg-red-900 text-red-800'
          )}>
            🛒 {unidad.mercadolibre_status === 'active' ? 'Publicado' :
                unidad.mercadolibre_status === 'paused' ? 'Pausado' : 'ML'}
          </span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <Link to={`/unidades/${id}/editar`} className="btn btn-primary flex items-center gap-2">
          <Edit className="w-4 h-4" />
          Editar
        </Link>
        {unidad.estado === 'disponible' && (
          <>
            <Link to={`/operaciones/nueva?unidad=${id}`} className="btn btn-success flex items-center gap-2">
              Crear Venta
            </Link>
            <button
              onClick={async () => {
                // Native share on mobile (Chrome, Safari, Samsung)
                if (navigator.share && unidad) {
                  try {
                    await navigator.share({
                      title: `${unidad.marca} ${unidad.modelo} ${unidad.anio} - ${unidad.dominio}`,
                      text: `${unidad.marca} ${unidad.modelo} ${unidad.anio}\n${unidad.kilometraje?.toLocaleString() || '0'} km\n$${unidad.precio_publicado?.toLocaleString() || 'Consultar'}`,
                      url: window.location.href,
                    })
                    return
                  } catch (err) {
                    // User cancelled or share failed — fall through to modal
                    if (err.name === 'AbortError') return
                  }
                }
                // Fallback: clipboard-based share modal
                setShareModalOpen(true)
              }}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>

            {/* MercadoLibre - solo si el usuario tiene ML conectado */}
            {mlStatus?.connected && !unidad.mercadolibre_id && (
              <button
                onClick={() => setMLPublishModalOpen(true)}
                className="btn flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <span>🛒</span>
                Publicar en ML
              </button>
            )}

            {unidad.mercadolibre_id && (
              <>
                <a
                  href={unidad.mercadolibre_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver en ML
                </a>

                {mlStatus?.connected && (
                  <>
                    {unidad.mercadolibre_status === 'active' ? (
                      <button
                        onClick={() => pauseMLMutation.mutate()}
                        disabled={pauseMLMutation.isPending}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        {pauseMLMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                        Pausar
                      </button>
                    ) : unidad.mercadolibre_status === 'paused' && (
                      <button
                        onClick={() => activateMLMutation.mutate()}
                        disabled={activateMLMutation.isPending}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        {activateMLMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Reactivar
                      </button>
                    )}

                    <button
                      onClick={() => syncMLMutation.mutate()}
                      disabled={syncMLMutation.isPending}
                      className="btn btn-secondary flex items-center gap-2"
                      title="Sincronizar precio con MercadoLibre"
                    >
                      {syncMLMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Sync ML
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
        {isAdmin && unidad.estado !== 'vendido' && (
          <button onClick={handleDelete} className="btn btn-danger flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 overflow-x-auto">
          {['info', 'fotos', 'costos', 'documentacion', 'archivos'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
              )}
            >
              {tab === 'info' && 'Información'}
              {tab === 'fotos' && `Fotos (${fotosData?.total || 0})`}
              {tab === 'costos' && 'Costos'}
              {tab === 'documentacion' && 'Documentación'}
              {tab === 'archivos' && 'Archivos'}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab */}
      {activeTab === 'info' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Car className="w-5 h-5" />
              Datos del Vehículo
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Dominio</dt>
                <dd className="font-mono font-medium">{unidad.dominio}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Chasis</dt>
                <dd className="font-mono text-sm">{unidad.numero_chasis || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Motor</dt>
                <dd className="font-mono text-sm">{unidad.numero_motor || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Kilometraje</dt>
                <dd>{unidad.kilometraje ? `${unidad.kilometraje.toLocaleString()} km` : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Combustible</dt>
                <dd>{unidad.combustible || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Transmisión</dt>
                <dd>{unidad.transmision || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Color</dt>
                <dd>{unidad.color || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Ubicación</dt>
                <dd>{unidad.ubicacion || '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Información Comercial
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Fecha Ingreso</dt>
                <dd>{unidad.fecha_ingreso ? format(new Date(unidad.fecha_ingreso), 'dd/MM/yyyy') : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Días en Stock</dt>
                <dd className={clsx(
                  'font-medium',
                  unidad.stock_inmovilizado ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                )}>
                  {unidad.dias_en_stock} días
                  {unidad.stock_inmovilizado && (
                    <AlertTriangle className="w-4 h-4 inline ml-1" />
                  )}
                </dd>
              </div>
              {isAdmin && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Precio Compra</dt>
                    <dd>{formatCurrency(unidad.precio_compra)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Gastos Transferencia</dt>
                    <dd>{formatCurrency(unidad.gastos_transferencia)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Costos Directos</dt>
                    <dd>{formatCurrency(historialCostos?.total_costos)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-3">
                    <dt>Costo Total</dt>
                    <dd>{formatCurrency(unidad.costo_total)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Precio Publicado</dt>
                <dd className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(unidad.precio_publicado)}
                </dd>
              </div>
              {isAdmin && unidad.precio_publicado && (
                <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                  <dt>Margen Esperado</dt>
                  <dd>{formatCurrency(unidad.precio_publicado - unidad.costo_total)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Panel de Precio de Mercado - DESHABILITADO */}
          {MOSTRAR_PRECIOS_MERCADO && isAdmin && (unidad.estado === 'disponible' || unidad.estado === 'reservado') && (
            <div className="card md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Precio de Mercado (Cordoba)
                </h3>
                <button
                  onClick={() => refetchPrecioMercado()}
                  disabled={fetchingPrecio}
                  className="btn btn-secondary text-sm flex items-center gap-2"
                >
                  <RefreshCw className={clsx('w-4 h-4', fetchingPrecio && 'animate-spin')} />
                  {fetchingPrecio ? 'Consultando...' : 'Actualizar'}
                </button>
              </div>

              {precioMercado ? (
                <div className="space-y-4">
                  {precioMercado.error && !precioMercado.valor_mercado ? (
                    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 rounded-lg p-3 text-yellow-700 dark:text-yellow-400 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      {precioMercado.error}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Minimo</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">
                            {formatCurrency(precioMercado.valor_mercado_min)}
                          </p>
                        </div>
                        <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Promedio</p>
                          <p className="text-xl font-bold text-blue-700">
                            {formatCurrency(precioMercado.valor_mercado)}
                          </p>
                          <p className="text-xs text-blue-500">
                            {precioMercado.cantidad_resultados} resultados
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Maximo</p>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">
                            {formatCurrency(precioMercado.valor_mercado_max)}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Competitividad</p>
                          <BadgeCompetitividad
                            competitividad={precioMercado.competitividad}
                            valorMercado={precioMercado.valor_mercado}
                            precioPublicado={unidad.precio_publicado}
                          />
                        </div>
                      </div>

                      {/* Diferencia con precio publicado */}
                      {precioMercado.diferencia_mercado !== null && precioMercado.diferencia_mercado !== undefined && (
                        <div className={clsx(
                          'rounded-lg p-3 text-center',
                          precioMercado.diferencia_mercado <= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
                        )}>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tu precio ({formatCurrency(unidad.precio_publicado)}) esta{' '}
                            <span className={clsx(
                              'font-bold',
                              precioMercado.diferencia_mercado <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            )}>
                              {formatCurrency(Math.abs(precioMercado.diferencia_mercado))}
                              {precioMercado.diferencia_mercado <= 0 ? ' por debajo' : ' por encima'}
                            </span>
                            {' '}del promedio de mercado
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {precioMercado.fecha_consulta && (
                    <p className="text-xs text-gray-400 text-right">
                      Ultima consulta: {format(new Date(precioMercado.fecha_consulta), 'dd/MM/yyyy HH:mm')}
                      {precioMercado.desde_cache && ' (cache)'}
                    </p>
                  )}
                </div>
              ) : fetchingPrecio ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <p>Haz clic en "Actualizar" para consultar el precio de mercado</p>
                </div>
              )}
            </div>
          )}

          {unidad.observaciones && (
            <div className="card md:col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Observaciones</h3>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{unidad.observaciones}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Fotos */}
      {activeTab === 'fotos' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Fotos del Vehículo
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {fotosData?.total || 0} / 12 fotos
              </span>
              {(fotosData?.total || 0) < 12 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFotoMutation.isPending}
                  className="btn btn-primary text-sm flex items-center gap-1"
                >
                  {uploadFotoMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                  Agregar Foto
                </button>
              )}
            </div>
          </div>

          {/* Input oculto para seleccionar archivo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                uploadFotoMutation.mutate(file)
                e.target.value = '' // Reset para permitir subir el mismo archivo
              }
            }}
          />

          {fotosLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : fotosData?.fotos?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {fotosData.fotos.map((foto, index) => (
                <div
                  key={index}
                  className="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
                >
                  <img
                    src={foto.thumbnail || foto.url}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setFotoExpandida(foto)}
                  />
                  {/* Botón eliminar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('¿Eliminar esta foto?')) {
                        deleteFotoMutation.mutate(index)
                      }
                    }}
                    disabled={deleteFotoMutation.isPending}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {/* Número de foto */}
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">No hay fotos cargadas</p>
              <p className="text-sm text-gray-400 mb-4">
                Subí fotos del vehículo para publicar en MercadoLibre
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFotoMutation.isPending}
                className="btn btn-primary flex items-center gap-2 mx-auto"
              >
                {uploadFotoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
                Subir Primera Foto
              </button>
            </div>
          )}

          {/* Nota sobre MercadoLibre */}
          {fotosData?.total > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
              <span className="font-medium">💡 Tip:</span> MercadoLibre acepta hasta 12 fotos por publicación.
              La primera foto será la principal.
            </div>
          )}
        </div>
      )}

      {/* Modal foto expandida */}
      {fotoExpandida && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoExpandida(null)}
        >
          <button
            onClick={() => setFotoExpandida(null)}
            aria-label="Cerrar foto"
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fotoExpandida.url}
            alt="Foto expandida"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {activeTab === 'costos' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Historial de Costos
            </h3>
            <Link
              to={`/costo-rapido?dominio=${unidad.dominio}`}
              className="btn btn-primary text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </Link>
          </div>

          {isAdmin ? (
            <>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Adquisición</p>
                    <p className="font-semibold">{formatCurrency(historialCostos?.costo_adquisicion)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Costos Directos</p>
                    <p className="font-semibold">{formatCurrency(historialCostos?.total_costos)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                    <p className="font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(historialCostos?.costo_total)}</p>
                  </div>
                </div>
              </div>

              {historialCostos?.costos?.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay costos registrados</p>
              ) : (
                <div className="space-y-3">
                  {historialCostos?.costos?.map((costo) => (
                    <div key={costo.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{costo.descripcion}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {costo.categoria.replaceAll('_', ' ')} • {costo.proveedor || 'Sin proveedor'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(costo.monto)}</p>
                        <p className="text-xs text-gray-400">
                          {costo.fecha ? format(new Date(costo.fecha), 'dd/MM/yyyy') : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No tiene permisos para ver los costos
            </p>
          )}
        </div>
      )}

      {activeTab === 'documentacion' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Checklist de Documentación
            </h3>
            {documentacion?.documentacion_completa ? (
              <span className="badge badge-success flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Completa
              </span>
            ) : (
              <span className="badge badge-warning flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Pendiente
              </span>
            )}
          </div>

          {documentacion?.items_pendientes?.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Items pendientes:</p>
              <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 text-sm space-y-1">
                {documentacion.items_pendientes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: 'Título/Cédula', value: documentacion?.titulo_tiene },
              { label: 'Formulario 08', value: documentacion?.form_08_tiene },
              { label: 'Form 08 Firmado', value: documentacion?.form_08_firmado },
              { label: 'VPA', value: documentacion?.vpa_tiene },
              { label: 'VTV Vigente', value: documentacion?.vtv_tiene },
              { label: 'Informe Dominio', value: documentacion?.informe_dominio_tiene },
              { label: 'Sin Multas', value: !documentacion?.multas_tiene },
              { label: 'Sin Deuda Patentes', value: !documentacion?.patentes_deuda },
              { label: 'Llave Original', value: documentacion?.llave_original },
              { label: 'Manual Usuario', value: documentacion?.manual_usuario },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                {item.value ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
            ))}
          </div>

          {documentacion?.multas_monto_total > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-red-700 dark:text-red-400">
                <span className="font-medium">Multas pendientes:</span> {formatCurrency(documentacion.multas_monto_total)}
              </p>
              {documentacion.multas_detalle && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{documentacion.multas_detalle}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Archivos */}
      {activeTab === 'archivos' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Image className="w-5 h-5" />
              Legajo Digital
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {archivosUnidad?.total_archivos || 0} archivos
            </span>
          </div>

          {archivosUnidad?.documentos_faltantes?.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Documentos faltantes:</p>
              <div className="flex flex-wrap gap-2">
                {archivosUnidad.documentos_faltantes.map((doc) => (
                  <span key={doc} className="bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 text-xs px-2 py-1 rounded">
                    {doc.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {archivosUnidad?.por_tipo && Object.keys(archivosUnidad.por_tipo).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(archivosUnidad.por_tipo).map(([tipo, archivos]) => (
                <div key={tipo} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">{tipo.replaceAll('_', ' ')}</p>
                  <div className="flex flex-wrap gap-2">
                    {archivos.map((archivo) => (
                      <div
                        key={archivo.id}
                        className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-sm"
                      >
                        {archivo.es_imagen ? (
                          <Image className="w-4 h-4 text-blue-500" />
                        ) : (
                          <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                        <span className="truncate max-w-[150px]">{archivo.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No hay archivos cargados</p>
              <p className="text-sm text-gray-400 mt-1">
                Subi fotos y documentos desde la API
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Compartir */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShareModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Compartir Unidad
              </h2>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* WhatsApp */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">WhatsApp</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fichaVenta?.whatsapp_texto || '')
                      toast.success('Texto copiado')
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                </div>
                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded max-h-40 overflow-y-auto">
                  {fichaVenta?.whatsapp_texto}
                </pre>
              </div>

              {/* Instagram */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Instagram</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fichaVenta?.instagram_caption || '')
                      toast.success('Caption copiado')
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                </div>
                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded max-h-40 overflow-y-auto">
                  {fichaVenta?.instagram_caption}
                </pre>
              </div>

              {/* Ficha HTML */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Ficha de Venta</h3>
                <a
                  href={marketingAPI.fichaVentaHtml(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver Ficha Compartible
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Publicar en MercadoLibre */}
      {mlPublishModalOpen && (
        <MLPublishModal
          unidad={unidad}
          onClose={() => setMLPublishModalOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['unidad', id] })}
        />
      )}
    </div>
  )
}
