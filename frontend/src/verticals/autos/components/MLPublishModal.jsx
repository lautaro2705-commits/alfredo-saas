import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mercadolibreAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  X,
  Upload,
  Loader2,
  DollarSign,
  Tag,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'
import clsx from 'clsx'

const LISTING_TYPES = [
  {
    id: 'gold_special',
    name: 'Destacada',
    description: 'Mayor visibilidad, aparece primero en búsquedas',
    recommended: true
  },
  {
    id: 'gold_pro',
    name: 'Clásica Premium',
    description: 'Buena visibilidad con menor costo',
    recommended: false
  },
  {
    id: 'gold',
    name: 'Clásica',
    description: 'Visibilidad estándar',
    recommended: false
  }
]

export default function MLPublishModal({ unidad, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [listingType, setListingType] = useState('gold_special')
  const [priceOverride, setPriceOverride] = useState('')
  const [published, setPublished] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  const publishMutation = useMutation({
    mutationFn: (data) => mercadolibreAPI.publish(unidad.id, data),
    onSuccess: (response) => {
      setPublished(true)
      setPublishResult(response.data)
      queryClient.invalidateQueries(['unidad', unidad.id])
      toast.success('¡Publicado en MercadoLibre!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al publicar')
    }
  })

  const handlePublish = () => {
    const data = {
      category_id: 'MLA1744', // Autos usados
      listing_type: listingType,
      price_override: priceOverride ? parseFloat(priceOverride) : null
    }
    publishMutation.mutate(data)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  const effectivePrice = priceOverride ? parseFloat(priceOverride) : unidad.precio_publicado

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label="Publicar en MercadoLibre">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛒</span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Publicar en MercadoLibre</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{unidad.marca} {unidad.modelo} {unidad.anio}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {published && publishResult ? (
            // Resultado exitoso
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                ¡Publicación creada!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Tu vehículo ya está visible en MercadoLibre
              </p>

              <a
                href={publishResult.mercadolibre_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                Ver publicación
              </a>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                ID: {publishResult.mercadolibre_id}
              </p>
            </div>
          ) : (
            // Formulario de publicación
            <div className="space-y-6">
              {/* Preview del vehículo */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex gap-4">
                  {unidad.fotos && (
                    <img
                      src={Array.isArray(unidad.fotos) ? unidad.fotos[0] : unidad.fotos.split(',')[0]}
                      alt={`${unidad.marca} ${unidad.modelo}`}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {unidad.marca} {unidad.modelo} {unidad.version}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {unidad.anio} • {unidad.kilometraje?.toLocaleString()} km
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {unidad.combustible} • {unidad.transmision}
                    </p>
                  </div>
                </div>
              </div>

              {/* Precio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Precio de publicación
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={formatCurrency(unidad.precio_publicado)}
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    className="input flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Precio actual: {formatCurrency(unidad.precio_publicado)}
                  {priceOverride && ` → ${formatCurrency(effectivePrice)}`}
                </p>
              </div>

              {/* Tipo de publicación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Tipo de publicación
                </label>
                <div className="space-y-2">
                  {LISTING_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setListingType(type.id)}
                      className={clsx(
                        "w-full p-3 rounded-lg border-2 text-left transition-colors",
                        listingType === type.id
                          ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {type.name}
                          </span>
                          {type.recommended && (
                            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                              Recomendado
                            </span>
                          )}
                        </div>
                        {listingType === type.id && (
                          <CheckCircle2 className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advertencia */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 La publicación se creará con las fotos y datos actuales del vehículo.
                  Asegurate de tener todo actualizado antes de publicar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!published && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={publishMutation.isPending || !effectivePrice}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              Publicar
            </button>
          </div>
        )}

        {published && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => {
                onSuccess?.()
                onClose()
              }}
              className="w-full px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
