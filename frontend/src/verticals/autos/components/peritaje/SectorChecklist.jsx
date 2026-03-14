/**
 * Componente de checklist por sector con ratings touch-friendly
 * Diseñado para uso en móvil con botones grandes
 */
import { useState } from 'react'
import { CheckCircle, AlertCircle, XCircle, MinusCircle, ChevronDown, ChevronUp, Camera, MessageSquare, DollarSign, AlertTriangle, CheckCheck } from 'lucide-react'
import clsx from 'clsx'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { peritajesAPI } from '../../services/api'
import toast from 'react-hot-toast'

// Configuración de calificaciones
const RATINGS = {
  bueno: {
    label: 'Bueno',
    color: 'green',
    bgColor: 'bg-green-500',
    bgColorLight: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-500',
    icon: CheckCircle,
    value: 100
  },
  regular: {
    label: 'Regular',
    color: 'yellow',
    bgColor: 'bg-yellow-500',
    bgColorLight: 'bg-yellow-100 dark:bg-yellow-900',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-500',
    icon: AlertCircle,
    value: 50
  },
  malo: {
    label: 'Malo',
    color: 'red',
    bgColor: 'bg-red-500',
    bgColorLight: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-500',
    icon: XCircle,
    value: 0
  },
  na: {
    label: 'N/A',
    color: 'gray',
    bgColor: 'bg-gray-400',
    bgColorLight: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-400',
    icon: MinusCircle,
    value: null
  }
}

// Botón de rating individual
function RatingButton({ rating, selected, onSelect, disabled, size = 'md' }) {
  const config = RATINGS[rating]
  const Icon = config.icon

  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base'
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(rating)}
      disabled={disabled}
      className={clsx(
        'flex flex-col items-center justify-center rounded-xl transition-all',
        'min-w-[60px] min-h-[60px]', // Touch target mínimo
        sizeClasses[size],
        selected
          ? `${config.bgColor} text-white shadow-lg scale-105`
          : `${config.bgColorLight} ${config.textColor} hover:scale-105`,
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon className={clsx(
        'mb-1',
        size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-7 h-7'
      )} />
      <span className="font-medium">{config.label}</span>
    </button>
  )
}

// Botón de rating compacto para vista principal
function RatingButtonCompact({ rating, selected, onSelect, disabled }) {
  const config = RATINGS[rating]
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(rating)
      }}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-center rounded-lg transition-all p-2',
        'min-w-[44px] min-h-[44px]', // Touch target mínimo
        selected
          ? `${config.bgColor} text-white shadow-md`
          : `bg-gray-100 dark:bg-gray-800 ${config.textColor} hover:${config.bgColorLight}`,
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={config.label}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}

// Item individual del checklist
function ChecklistItem({
  item,
  peritajeId,
  onUpdate,
  readOnly = false,
  onPhotoClick
}) {
  const [expanded, setExpanded] = useState(false)
  const [observaciones, setObservaciones] = useState(item.observaciones || '')
  const [costo, setCosto] = useState(item.costo_reparacion_estimado || 0)
  const [urgente, setUrgente] = useState(item.urgente || false)

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => peritajesAPI.calificarItem(peritajeId, item.id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['peritaje', peritajeId])
      onUpdate?.(response.data)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Error al guardar'
      toast.error(msg)
    }
  })

  const handleRatingSelect = (rating) => {
    if (readOnly) return

    mutation.mutate({
      calificacion: rating,
      observaciones: observaciones,
      costo_reparacion_estimado: costo,
      urgente: urgente
    })
  }

  const handleDetailsChange = () => {
    if (item.calificacion) {
      mutation.mutate({
        calificacion: item.calificacion,
        observaciones,
        costo_reparacion_estimado: parseFloat(costo) || 0,
        urgente
      })
    }
  }

  const ratingConfig = item.calificacion ? RATINGS[item.calificacion] : null

  return (
    <div className={clsx(
      'border rounded-xl overflow-hidden transition-all',
      ratingConfig ? ratingConfig.borderColor : 'border-gray-200 dark:border-gray-700',
      item.urgente && 'ring-2 ring-red-500'
    )}>
      {/* Header del item con botones de rating visibles */}
      <div
        className={clsx(
          'p-3 flex flex-col gap-3',
          ratingConfig ? ratingConfig.bgColorLight : 'bg-white dark:bg-gray-800'
        )}
      >
        {/* Nombre del item y botón expandir */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2 flex-1">
            {item.urgente && (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <span className="font-medium text-gray-900 dark:text-white text-sm">{item.nombre_item}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.fotos?.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                {item.fotos.length} 📷
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Botones de rating SIEMPRE visibles */}
        {!readOnly && (
          <div className="flex gap-2 justify-end">
            {Object.keys(RATINGS).map((rating) => (
              <RatingButtonCompact
                key={rating}
                rating={rating}
                selected={item.calificacion === rating}
                onSelect={handleRatingSelect}
                disabled={mutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Mostrar calificación si es readOnly */}
        {readOnly && ratingConfig && (
          <div className="flex justify-end">
            <span className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              ratingConfig.bgColor,
              'text-white'
            )}>
              {ratingConfig.label}
            </span>
          </div>
        )}
      </div>

      {/* Contenido expandido - observaciones y detalles */}
      {expanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-4">
          {/* Observaciones */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              onBlur={handleDetailsChange}
              disabled={readOnly}
              rows={2}
              className="input text-sm"
              placeholder="Agregar observaciones..."
            />
          </div>

          {/* Costo estimado de reparación */}
          {(item.calificacion === 'regular' || item.calificacion === 'malo') && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Costo de reparación estimado
              </label>
              <input
                type="number"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                onBlur={handleDetailsChange}
                disabled={readOnly}
                className="input text-sm"
                placeholder="0"
                min="0"
              />
            </div>
          )}

          {/* Marcar como urgente */}
          {(item.calificacion === 'malo') && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={urgente}
                onChange={(e) => {
                  setUrgente(e.target.checked)
                  if (item.calificacion) {
                    mutation.mutate({
                      calificacion: item.calificacion,
                      observaciones,
                      costo_reparacion_estimado: parseFloat(costo) || 0,
                      urgente: e.target.checked
                    })
                  }
                }}
                disabled={readOnly}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Marcar como urgente
              </span>
            </label>
          )}

          {/* Botón para agregar foto */}
          {!readOnly && (
            <button
              onClick={() => onPhotoClick?.(item)}
              className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Agregar foto a este item
            </button>
          )}

          {/* Fotos del item */}
          {item.fotos?.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Fotos ({item.fotos.length})
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {item.fotos.map((foto) => (
                  <img
                    key={foto.id}
                    src={foto.thumbnail_url || foto.url}
                    alt={foto.descripcion || 'Foto'}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente principal del checklist por sector
export default function SectorChecklist({
  peritajeId,
  sector,
  items = [],
  onUpdate,
  onPhotoClick,
  readOnly = false
}) {
  const queryClient = useQueryClient()

  // Calcular estadísticas del sector
  const stats = {
    total: items.length,
    calificados: items.filter(i => i.calificacion).length,
    buenos: items.filter(i => i.calificacion === 'bueno').length,
    regulares: items.filter(i => i.calificacion === 'regular').length,
    malos: items.filter(i => i.calificacion === 'malo').length,
    na: items.filter(i => i.calificacion === 'na').length,
  }

  const porcentaje = stats.total > 0
    ? Math.round((stats.calificados / stats.total) * 100)
    : 0

  // Nombre formateado del sector
  const sectorNames = {
    mecanica: 'Mecánica',
    estetica: 'Estética',
    documentacion: 'Documentación'
  }

  // Mutation para marcar todos como bueno
  const marcarTodosBuenoMutation = useMutation({
    mutationFn: async () => {
      const itemsSinCalificar = items.filter(i => !i.calificacion)
      const batchData = itemsSinCalificar.map(item => ({
        item_id: item.id,
        calificacion: 'bueno',
        observaciones: null,
        costo_reparacion_estimado: 0,
        urgente: false
      }))
      return peritajesAPI.calificarItemsBatch(peritajeId, batchData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['peritaje', peritajeId])
      toast.success(`Todos los items de ${sectorNames[sector]} marcados como Bueno`)
      onUpdate?.()
    },
    onError: (error) => {
      const detail = error.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Error al marcar items')
    }
  })

  const itemsSinCalificar = items.filter(i => !i.calificacion).length

  return (
    <div className="space-y-4">
      {/* Header del sector con estadísticas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {sectorNames[sector] || sector}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {stats.calificados} / {stats.total}
          </span>
        </div>

        {/* Barra de progreso */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        {/* Mini estadísticas + Botón marcar todo bueno */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3" /> {stats.buenos}
            </span>
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="w-3 h-3" /> {stats.regulares}
            </span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="w-3 h-3" /> {stats.malos}
            </span>
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <MinusCircle className="w-3 h-3" /> {stats.na}
            </span>
          </div>

          {/* Botón marcar todo bueno */}
          {!readOnly && itemsSinCalificar > 0 && (
            <button
              onClick={() => marcarTodosBuenoMutation.mutate()}
              disabled={marcarTodosBuenoMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {marcarTodosBuenoMutation.isPending ? 'Marcando...' : `Todo Bueno (${itemsSinCalificar})`}
            </button>
          )}
        </div>
      </div>

      {/* Lista de items */}
      <div className="space-y-3">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            peritajeId={peritajeId}
            onUpdate={onUpdate}
            onPhotoClick={onPhotoClick}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}
