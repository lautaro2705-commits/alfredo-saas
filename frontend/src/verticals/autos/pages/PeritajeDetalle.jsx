/**
 * Página de detalle de peritaje
 * Muestra el informe completo con puntajes, items y fotos
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { peritajesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Edit, FileText, Download, Trash2, CheckCircle, XCircle,
  Car, User, Calendar, Wrench, Paintbrush, AlertTriangle, Camera,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react'
import ScoreCard, { ScoreBadge } from '../components/peritaje/ScoreCard'

// Configuración de estados
const ESTADOS = {
  borrador: { label: 'Borrador', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200', icon: Edit },
  completado: { label: 'Completado', color: 'bg-blue-100 dark:bg-blue-900 text-blue-800', icon: CheckCircle },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 dark:bg-green-900 text-green-800', icon: CheckCircle },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 dark:bg-red-900 text-red-800', icon: XCircle }
}

const CALIFICACIONES = {
  bueno: { label: 'Bueno', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900' },
  regular: { label: 'Regular', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  malo: { label: 'Malo', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900' },
  na: { label: 'N/A', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' }
}

export default function PeritajeDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const [expandedSector, setExpandedSector] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalObservaciones, setApprovalObservaciones] = useState('')

  // Cargar peritaje
  const { data: peritaje, isLoading, error } = useQuery({
    queryKey: ['peritaje', id],
    queryFn: async () => {
      const res = await peritajesAPI.get(id)
      return res.data
    }
  })

  // Aprobar/rechazar peritaje
  const aprobarMutation = useMutation({
    mutationFn: ({ aprobado }) => peritajesAPI.aprobar(id, {
      aprobado,
      observaciones: approvalObservaciones
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['peritaje', id])
      queryClient.invalidateQueries(['peritajes'])
      setShowApprovalModal(false)
      toast.success('Peritaje actualizado')
    },
    onError: (error) => {
      const d = error.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Error al actualizar')
    }
  })

  // Eliminar peritaje
  const eliminarMutation = useMutation({
    mutationFn: () => peritajesAPI.delete(id),
    onSuccess: () => {
      toast.success('Peritaje eliminado')
      navigate('/peritajes')
    },
    onError: (error) => {
      const d = error.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Error al eliminar')
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !peritaje) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Error al cargar el peritaje</p>
        <Link to="/peritajes" className="btn btn-secondary mt-4">
          Volver a peritajes
        </Link>
      </div>
    )
  }

  const estado = ESTADOS[peritaje.estado] || ESTADOS.borrador
  const EstadoIcon = estado.icon

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/peritajes')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>

        <div className="flex items-center gap-2">
          {peritaje.estado === 'borrador' && (
            <Link
              to={`/peritajes/${id}/editar`}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar
            </Link>
          )}

          <a
            href={peritajesAPI.getPdfUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </a>
        </div>
      </div>

      {/* Info principal */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                estado.color
              )}>
                <EstadoIcon className="w-3 h-3" />
                {estado.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
              {peritaje.vehiculo_descripcion}
            </h1>
          </div>

          <ScoreBadge score={peritaje.puntaje_total} />
        </div>

        {/* Detalles del vehículo */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Kilometraje</span>
            <p className="font-medium">
              {peritaje.vehiculo_kilometraje?.toLocaleString() || '-'} km
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Color</span>
            <p className="font-medium">{peritaje.vehiculo_color || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Combustible</span>
            <p className="font-medium capitalize">{peritaje.vehiculo_combustible || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Versión</span>
            <p className="font-medium">{peritaje.vehiculo_version || '-'}</p>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {peritaje.perito_nombre}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {format(new Date(peritaje.fecha_peritaje), "dd/MM/yyyy HH:mm", { locale: es })}
          </span>
          {peritaje.unidad_id && (
            <Link
              to={`/unidades/${peritaje.unidad_id}`}
              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700"
            >
              <ExternalLink className="w-4 h-4" />
              Ver unidad
            </Link>
          )}
        </div>
      </div>

      {/* Puntajes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard label="Mecánica" score={peritaje.puntaje_mecanica} size="sm" />
        <ScoreCard label="Estética" score={peritaje.puntaje_estetica} size="sm" />
        <ScoreCard label="Documentación" score={peritaje.puntaje_documentacion} size="sm" />
        <ScoreCard label="TOTAL" score={peritaje.puntaje_total} size="sm" />
      </div>

      {/* Alerta de costo de reparaciones */}
      {peritaje.costo_reparaciones_estimado > 0 && (
        <div className="card bg-red-50 dark:bg-red-950 border-red-200">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Reparaciones estimadas</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
            ${peritaje.costo_reparaciones_estimado.toLocaleString()}
          </p>
          {peritaje.ajuste_precio_sugerido !== 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Ajuste de precio sugerido: ${Math.abs(peritaje.ajuste_precio_sugerido).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Checklist por sector */}
      {['mecanica', 'estetica', 'documentacion'].map((sector) => {
        const items = peritaje.items_por_sector?.[sector] || []
        const isExpanded = expandedSector === sector

        const sectorConfig = {
          mecanica: { label: 'Mecánica', icon: Wrench, color: 'text-blue-600 dark:text-blue-400' },
          estetica: { label: 'Estética', icon: Paintbrush, color: 'text-purple-600 dark:text-purple-400' },
          documentacion: { label: 'Documentación', icon: FileText, color: 'text-green-600 dark:text-green-400' }
        }

        const config = sectorConfig[sector]
        const SectorIcon = config.icon

        // Estadísticas del sector
        const stats = {
          buenos: items.filter(i => i.calificacion === 'bueno').length,
          regulares: items.filter(i => i.calificacion === 'regular').length,
          malos: items.filter(i => i.calificacion === 'malo').length
        }

        return (
          <div key={sector} className="card">
            <button
              onClick={() => setExpandedSector(isExpanded ? null : sector)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <SectorIcon className={clsx('w-5 h-5', config.color)} />
                <span className="font-semibold text-gray-900 dark:text-white">{config.label}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({items.length} items)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">{stats.buenos} ✓</span>
                  <span className="text-yellow-600 dark:text-yellow-400">{stats.regulares} ⚠</span>
                  <span className="text-red-600 dark:text-red-400">{stats.malos} ✗</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {items.map((item) => {
                  const calif = CALIFICACIONES[item.calificacion] || CALIFICACIONES.na

                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        'p-3 rounded-lg border',
                        item.urgente && 'border-red-300 bg-red-50 dark:bg-red-950'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {item.urgente && (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {item.nombre_item}
                            </span>
                          </div>
                          {item.observaciones && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {item.observaciones}
                            </p>
                          )}
                          {item.costo_reparacion_estimado > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                              Costo estimado: ${item.costo_reparacion_estimado.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          calif.bgColor,
                          calif.color
                        )}>
                          {calif.label}
                        </span>
                      </div>

                      {/* Fotos del item */}
                      {item.fotos?.length > 0 && (
                        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                          {item.fotos.map((foto) => (
                            <a
                              key={foto.id}
                              href={foto.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={foto.thumbnail_url || foto.url}
                                alt={foto.descripcion || 'Foto'}
                                className="w-16 h-16 object-cover rounded-lg flex-shrink-0 hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Galería de fotos */}
      {peritaje.fotos?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Fotos ({peritaje.fotos.length})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {peritaje.fotos.map((foto) => (
              <a
                key={foto.id}
                href={foto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square"
              >
                <img
                  src={foto.thumbnail_url || foto.url}
                  alt={foto.descripcion || 'Foto'}
                  className="w-full h-full object-cover rounded-lg hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {peritaje.observaciones_generales && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Observaciones</h3>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {peritaje.observaciones_generales}
          </p>
        </div>
      )}

      {/* Acciones de admin */}
      {isAdmin && peritaje.estado === 'completado' && (
        <div className="card bg-gray-50 dark:bg-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Acciones de administrador</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowApprovalModal(true)}
              className="flex-1 btn btn-success flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </button>
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de rechazar este peritaje?')) {
                  aprobarMutation.mutate({ aprobado: false })
                }
              }}
              className="flex-1 btn btn-danger flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          </div>
        </div>
      )}

      {/* Botón eliminar */}
      {(peritaje.estado === 'borrador' || isAdmin) && (
        <button
          onClick={() => {
            if (confirm('¿Estás seguro de eliminar este peritaje?')) {
              eliminarMutation.mutate()
            }
          }}
          disabled={eliminarMutation.isPending}
          className="w-full btn btn-danger flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar peritaje
        </button>
      )}

      {/* Modal de aprobación */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Aprobar peritaje
            </h3>
            <div className="mb-4">
              <label className="label">Observaciones (opcional)</label>
              <textarea
                value={approvalObservaciones}
                onChange={(e) => setApprovalObservaciones(e.target.value)}
                className="input"
                rows={3}
                placeholder="Agregar comentarios..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => aprobarMutation.mutate({ aprobado: true })}
                disabled={aprobarMutation.isPending}
                className="flex-1 btn btn-success"
              >
                {aprobarMutation.isPending ? 'Aprobando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
