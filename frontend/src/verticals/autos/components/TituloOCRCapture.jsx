/**
 * Componente para capturar foto del título automotor y extraer datos via OCR
 * Reutiliza CameraCapture para la captura de fotos
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { unidadesAPI } from '../services/api'
import CameraCapture from './peritaje/CameraCapture'
import {
  FileText, Camera, Check, X, AlertCircle, Edit3, Loader2,
  Car, Hash, Calendar, Palette, Fuel, User
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// Campos que se extraen del título
const CAMPOS_TITULO = [
  { key: 'marca', label: 'Marca', icon: Car, editable: true },
  { key: 'modelo', label: 'Modelo', icon: Car, editable: true },
  { key: 'version', label: 'Versión', icon: Car, editable: true },
  { key: 'anio', label: 'Año', icon: Calendar, editable: true, type: 'number' },
  { key: 'dominio', label: 'Patente', icon: Hash, editable: true },
  { key: 'numero_chasis', label: 'Nº Chasis', icon: Hash, editable: true },
  { key: 'numero_motor', label: 'Nº Motor', icon: Hash, editable: true },
  { key: 'color', label: 'Color', icon: Palette, editable: true },
  { key: 'combustible', label: 'Combustible', icon: Fuel, editable: true },
  { key: 'titular', label: 'Titular', icon: User, editable: false, info: true },
]

export default function TituloOCRCapture({ onDataExtracted, onCancel }) {
  const [stage, setStage] = useState('capture') // capture, processing, preview
  const [extractedData, setExtractedData] = useState(null)
  const [editingField, setEditingField] = useState(null)

  // Mutation para OCR
  const ocrMutation = useMutation({
    mutationFn: (file) => unidadesAPI.ocrTitulo(file),
    onSuccess: (response) => {
      if (response.data.success) {
        setExtractedData(response.data.datos_extraidos)
        setStage('preview')
      } else {
        toast.error(response.data.error || 'No se pudieron extraer los datos')
        setStage('capture')
      }
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || 'Error al procesar el título'
      toast.error(msg)
      setStage('capture')
    }
  })

  // Manejar captura de foto
  const handlePhotoCapture = async (file) => {
    setStage('processing')
    ocrMutation.mutate(file)
  }

  // Actualizar campo editado
  const handleFieldChange = (key, value) => {
    setExtractedData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Aplicar datos al formulario
  const handleApply = () => {
    if (extractedData) {
      // Filtrar solo campos editables (excluir titular)
      const datosParaFormulario = { ...extractedData }
      delete datosParaFormulario.titular
      onDataExtracted(datosParaFormulario)
    }
  }

  // Renderizar estado de procesamiento
  if (stage === 'processing') {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Analizando título...
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Extrayendo datos del documento con inteligencia artificial
          </p>
        </div>
      </div>
    )
  }

  // Renderizar preview de datos extraídos
  if (stage === 'preview' && extractedData) {
    const camposDetectados = CAMPOS_TITULO.filter(c => extractedData[c.key])
    const camposNoDetectados = CAMPOS_TITULO.filter(c => !extractedData[c.key] && c.editable)

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center overflow-y-auto py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Datos extraídos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {camposDetectados.length} de {CAMPOS_TITULO.length} campos detectados
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Lista de campos */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {CAMPOS_TITULO.map((campo) => {
                const valor = extractedData[campo.key]
                const Icon = campo.icon
                const isEditing = editingField === campo.key

                return (
                  <div
                    key={campo.key}
                    className={clsx(
                      'p-3 rounded-xl border transition-colors',
                      valor ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800' : 'border-dashed border-gray-300 dark:border-gray-600',
                      campo.info && 'bg-blue-50 dark:bg-blue-950 border-blue-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={clsx(
                        'w-5 h-5 flex-shrink-0',
                        valor ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400',
                        campo.info && 'text-blue-500'
                      )} />

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{campo.label}</p>

                        {isEditing ? (
                          <input
                            type={campo.type || 'text'}
                            value={valor || ''}
                            onChange={(e) => handleFieldChange(campo.key, e.target.value)}
                            onBlur={() => setEditingField(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-primary-300 dark:border-primary-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        ) : (
                          <p className={clsx(
                            'font-medium truncate',
                            valor ? 'text-gray-900 dark:text-white' : 'text-gray-400 italic'
                          )}>
                            {valor || 'No detectado'}
                          </p>
                        )}
                      </div>

                      {campo.editable && !isEditing && (
                        <button
                          onClick={() => setEditingField(campo.key)}
                          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}

                      {campo.info && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                          Solo info
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Advertencia si hay campos no detectados */}
            {camposNoDetectados.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Campos no detectados
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Podés completarlos manualmente: {camposNoDetectados.map(c => c.label).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Info sobre el titular */}
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Nota:</strong> El nombre del titular se muestra solo como referencia
                y no se guarda en el sistema.
              </p>
            </div>
          </div>

          {/* Footer con acciones */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={() => setStage('capture')}
              className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Otra foto
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Aplicar datos
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizar captura de foto (estado inicial)
  return (
    <CameraCapture
      onCapture={handlePhotoCapture}
      onCancel={onCancel}
      maxWidth={1600}  // Mayor resolución para mejor OCR
      quality={0.85}   // Mayor calidad para mejor OCR
      allowGallery={true}
      showPreview={false}  // No mostrar preview, ir directo a OCR
    />
  )
}
