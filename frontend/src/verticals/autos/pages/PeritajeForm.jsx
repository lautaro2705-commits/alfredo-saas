/**
 * Formulario de peritaje - Wizard mobile-first
 * Permite crear y editar peritajes con checklist por sectores
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { peritajesAPI, unidadesAPI } from '../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Helper para extraer mensaje de error de Pydantic/FastAPI
function getErrorMessage(error, fallback = 'Error') {
  const detail = error?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
  }
  if (typeof detail === 'object') return detail.msg || detail.message || JSON.stringify(detail)
  return fallback
}
import {
  ArrowLeft, ArrowRight, Check, Car, Wrench, Paintbrush,
  FileText, Camera, Save, CheckCircle, AlertCircle, Search, X
} from 'lucide-react'
import SectorChecklist from '../components/peritaje/SectorChecklist'
import CameraCapture from '../components/peritaje/CameraCapture'
import ScoreCard from '../components/peritaje/ScoreCard'

// Pasos del wizard
const STEPS = [
  { id: 'vehiculo', label: 'Vehículo', icon: Car },
  { id: 'mecanica', label: 'Mecánica', icon: Wrench },
  { id: 'estetica', label: 'Estética', icon: Paintbrush },
  { id: 'documentacion', label: 'Documentación', icon: FileText },
  { id: 'resumen', label: 'Resumen', icon: CheckCircle }
]

export default function PeritajeForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isEditing = Boolean(id)
  const unidadIdParam = searchParams.get('unidad')

  const [currentStep, setCurrentStep] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const [currentItemForPhoto, setCurrentItemForPhoto] = useState(null)
  const [busquedaPatente, setBusquedaPatente] = useState('')
  const [showBusqueda, setShowBusqueda] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      tipo: 'tasacion',
      vehiculo_marca: '',
      vehiculo_modelo: '',
      vehiculo_version: '',
      vehiculo_anio: '',
      vehiculo_dominio: '',
      vehiculo_kilometraje: '',
      vehiculo_color: '',
      vehiculo_combustible: 'nafta',
      observaciones_generales: ''
    }
  })

  // Cargar peritaje existente
  const { data: peritaje, isLoading: loadingPeritaje } = useQuery({
    queryKey: ['peritaje', id],
    queryFn: async () => {
      const res = await peritajesAPI.get(id)
      return res.data
    },
    enabled: isEditing
  })

  // Cargar unidad si viene de una unidad existente
  const { data: unidad } = useQuery({
    queryKey: ['unidad', unidadIdParam],
    queryFn: async () => {
      const res = await unidadesAPI.get(unidadIdParam)
      return res.data
    },
    enabled: Boolean(unidadIdParam) && !isEditing
  })

  // Buscar unidades por patente
  const { data: unidadesBusqueda = [], isFetching: buscandoUnidades } = useQuery({
    queryKey: ['unidades-busqueda', busquedaPatente],
    queryFn: async () => {
      if (busquedaPatente.length < 2) return []
      const res = await unidadesAPI.list({ dominio: busquedaPatente })
      return res.data?.items || res.data || []
    },
    enabled: busquedaPatente.length >= 2 && !isEditing
  })

  // Seleccionar unidad de la búsqueda
  const seleccionarUnidad = (unidadSeleccionada) => {
    reset({
      tipo: 'tasacion',
      vehiculo_marca: unidadSeleccionada.marca,
      vehiculo_modelo: unidadSeleccionada.modelo,
      vehiculo_version: unidadSeleccionada.version || '',
      vehiculo_anio: unidadSeleccionada.anio,
      vehiculo_dominio: unidadSeleccionada.dominio,
      vehiculo_kilometraje: unidadSeleccionada.kilometraje || '',
      vehiculo_color: unidadSeleccionada.color || '',
      vehiculo_combustible: unidadSeleccionada.combustible?.toLowerCase() || 'nafta',
      observaciones_generales: ''
    })
    setShowBusqueda(false)
    setBusquedaPatente('')
    toast.success(`Datos de ${unidadSeleccionada.marca} ${unidadSeleccionada.modelo} cargados`)
  }

  // Llenar formulario con datos
  useEffect(() => {
    if (peritaje) {
      reset({
        tipo: peritaje.tipo,
        vehiculo_marca: peritaje.vehiculo_marca || '',
        vehiculo_modelo: peritaje.vehiculo_modelo || '',
        vehiculo_version: peritaje.vehiculo_version || '',
        vehiculo_anio: peritaje.vehiculo_anio || '',
        vehiculo_dominio: peritaje.vehiculo_dominio || '',
        vehiculo_kilometraje: peritaje.vehiculo_kilometraje || '',
        vehiculo_color: peritaje.vehiculo_color || '',
        vehiculo_combustible: peritaje.vehiculo_combustible || 'nafta',
        observaciones_generales: peritaje.observaciones_generales || ''
      })
    } else if (unidad) {
      reset({
        tipo: 'ingreso_stock',
        vehiculo_marca: unidad.marca,
        vehiculo_modelo: unidad.modelo,
        vehiculo_version: unidad.version || '',
        vehiculo_anio: unidad.anio,
        vehiculo_dominio: unidad.dominio,
        vehiculo_kilometraje: unidad.kilometraje || '',
        vehiculo_color: unidad.color || '',
        vehiculo_combustible: unidad.combustible || 'nafta',
        observaciones_generales: ''
      })
    }
  }, [peritaje, unidad, reset])

  // Crear peritaje
  const createMutation = useMutation({
    mutationFn: (data) => peritajesAPI.create(data),
    onSuccess: (response) => {
      toast.success('Peritaje creado')
      navigate(`/peritajes/${response.data.id}`, { replace: true })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al crear peritaje'))
    }
  })

  // Actualizar peritaje
  const updateMutation = useMutation({
    mutationFn: (data) => peritajesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['peritaje', id])
      toast.success('Peritaje actualizado')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al actualizar'))
    }
  })

  // Completar peritaje
  const completarMutation = useMutation({
    mutationFn: () => peritajesAPI.completar(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['peritaje', id])
      toast.success('Peritaje completado')
      navigate(`/peritajes/${id}`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al completar'))
    }
  })

  // Subir foto
  const uploadFotoMutation = useMutation({
    mutationFn: async ({ file, sector, itemId }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sector', sector)
      if (itemId) formData.append('item_id', itemId)
      formData.append('tipo_foto', 'detalle')
      return peritajesAPI.subirFoto(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['peritaje', id])
      toast.success('Foto subida')
      setShowCamera(false)
      setCurrentItemForPhoto(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al subir foto'))
    }
  })

  // Manejar submit del paso de vehículo
  const onSubmitVehiculo = (data) => {
    const payload = {
      ...data,
      vehiculo_anio: data.vehiculo_anio ? parseInt(data.vehiculo_anio) : null,
      vehiculo_kilometraje: data.vehiculo_kilometraje ? parseInt(data.vehiculo_kilometraje) : null,
      vehiculo_version: data.vehiculo_version || null,
      vehiculo_color: data.vehiculo_color || null,
      observaciones_generales: data.observaciones_generales || null,
    }

    if (isEditing) {
      updateMutation.mutate(payload)
      setCurrentStep(1)
    } else {
      payload.unidad_id = unidadIdParam ? parseInt(unidadIdParam) : null
      createMutation.mutate(payload)
    }
  }

  // Manejar captura de foto
  const handlePhotoCapture = (file) => {
    if (!id) return

    const sector = STEPS[currentStep].id
    uploadFotoMutation.mutate({
      file,
      sector,
      itemId: currentItemForPhoto?.id
    })
  }

  // Abrir cámara para un item específico
  const handlePhotoClick = (item) => {
    setCurrentItemForPhoto(item)
    setShowCamera(true)
  }

  // Navegación entre pasos
  const goToStep = (stepIndex) => {
    if (!isEditing && stepIndex > 0) {
      toast.error('Primero debes guardar los datos del vehículo')
      return
    }
    setCurrentStep(stepIndex)
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Verificar si se puede completar
  const canComplete = peritaje?.porcentaje_completado === 100

  if (loadingPeritaje) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 pb-24">
      {/* Header fijo */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Editar Peritaje' : 'Nuevo Peritaje'}
            </h1>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Indicador de pasos */}
          <div className="flex items-center justify-between mt-4 gap-1">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep || (
                isEditing && peritaje?.items_por_sector?.[step.id]?.every(i => i.calificacion)
              )

              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  disabled={!isEditing && index > 0}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all',
                    isActive && 'bg-primary-50 dark:bg-primary-950',
                    !isEditing && index > 0 && 'opacity-50'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isActive ? 'bg-primary-600 text-white' :
                    isCompleted ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500 dark:text-gray-400'
                  )}>
                    {isCompleted && !isActive ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={clsx(
                    'text-xs font-medium',
                    isActive ? 'text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                  )}>
                    {step.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div className="p-4">
        {/* Paso 0: Datos del vehículo */}
        {currentStep === 0 && (
          <form onSubmit={handleSubmit(onSubmitVehiculo)} className="space-y-4">
            {/* Búsqueda por patente - solo al crear */}
            {!isEditing && (
              <div className="card bg-blue-50 dark:bg-blue-950 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-blue-900">
                    ¿El vehículo ya está en el sistema?
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowBusqueda(!showBusqueda)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium"
                  >
                    {showBusqueda ? 'Ocultar' : 'Buscar por patente'}
                  </button>
                </div>

                {showBusqueda && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={busquedaPatente}
                        onChange={(e) => setBusquedaPatente(e.target.value.toUpperCase())}
                        placeholder="Ingresá la patente..."
                        className="input pl-10 uppercase"
                        autoComplete="off"
                      />
                      {busquedaPatente && (
                        <button
                          type="button"
                          onClick={() => setBusquedaPatente('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {buscandoUnidades && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        Buscando...
                      </div>
                    )}

                    {unidadesBusqueda.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                        {unidadesBusqueda.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => seleccionarUnidad(u)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                          >
                            <Car className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {u.marca} {u.modelo} {u.anio}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {u.dominio} • {u.color || 'Sin color'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {busquedaPatente.length >= 2 && !buscandoUnidades && unidadesBusqueda.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No se encontraron vehículos con esa patente. Podés cargar los datos manualmente.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Datos del Vehículo
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Tipo de Peritaje</label>
                  <select {...register('tipo')} className="input">
                    <option value="tasacion">Tasación</option>
                    <option value="retoma">Retoma</option>
                    <option value="ingreso_stock">Ingreso a Stock</option>
                    <option value="periodico">Periódico</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Marca *</label>
                    <input
                      {...register('vehiculo_marca', { required: 'Requerido' })}
                      className="input"
                      placeholder="Ej: Toyota"
                    />
                    {errors.vehiculo_marca && (
                      <p className="text-red-500 text-sm mt-1">{errors.vehiculo_marca.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Modelo *</label>
                    <input
                      {...register('vehiculo_modelo', { required: 'Requerido' })}
                      className="input"
                      placeholder="Ej: Corolla"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Año *</label>
                    <input
                      type="number"
                      {...register('vehiculo_anio', { required: 'Requerido' })}
                      className="input"
                      placeholder="Ej: 2020"
                    />
                  </div>
                  <div>
                    <label className="label">Dominio *</label>
                    <input
                      {...register('vehiculo_dominio', { required: 'Requerido' })}
                      className="input uppercase"
                      placeholder="Ej: AB123CD"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Versión</label>
                    <input
                      {...register('vehiculo_version')}
                      className="input"
                      placeholder="Ej: XEI"
                    />
                  </div>
                  <div>
                    <label className="label">Color</label>
                    <input
                      {...register('vehiculo_color')}
                      className="input"
                      placeholder="Ej: Blanco"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Kilometraje</label>
                    <input
                      type="number"
                      {...register('vehiculo_kilometraje')}
                      className="input"
                      placeholder="Ej: 50000"
                    />
                  </div>
                  <div>
                    <label className="label">Combustible</label>
                    <select {...register('vehiculo_combustible')} className="input">
                      <option value="nafta">Nafta</option>
                      <option value="diesel">Diesel</option>
                      <option value="gnc">GNC</option>
                      <option value="hibrido">Híbrido</option>
                      <option value="electrico">Eléctrico</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Observaciones</label>
                  <textarea
                    {...register('observaciones_generales')}
                    className="input"
                    rows={3}
                    placeholder="Observaciones generales del vehículo..."
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  {isEditing ? 'Guardar y continuar' : 'Crear peritaje'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Pasos 1-3: Checklists por sector */}
        {currentStep >= 1 && currentStep <= 3 && peritaje && (
          <div className="space-y-4">
            <SectorChecklist
              peritajeId={id}
              sector={STEPS[currentStep].id}
              items={peritaje.items_por_sector?.[STEPS[currentStep].id] || []}
              onPhotoClick={handlePhotoClick}
              readOnly={peritaje.estado !== 'borrador'}
            />

            {/* Botón de agregar foto general del sector */}
            <button
              onClick={() => {
                setCurrentItemForPhoto(null)
                setShowCamera(true)
              }}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Agregar foto general de {STEPS[currentStep].label}
            </button>
          </div>
        )}

        {/* Paso 4: Resumen */}
        {currentStep === 4 && peritaje && (
          <div className="space-y-4">
            {/* Puntajes */}
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard
                label="Mecánica"
                score={peritaje.puntaje_mecanica}
                size="sm"
              />
              <ScoreCard
                label="Estética"
                score={peritaje.puntaje_estetica}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard
                label="Documentación"
                score={peritaje.puntaje_documentacion}
                size="sm"
              />
              <ScoreCard
                label="TOTAL"
                score={peritaje.puntaje_total}
                size="sm"
              />
            </div>

            {/* Info del vehículo */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Vehículo</h3>
              <p className="text-lg font-medium">{peritaje.vehiculo_descripcion}</p>
              {peritaje.vehiculo_kilometraje && (
                <p className="text-gray-500 dark:text-gray-400">{peritaje.vehiculo_kilometraje.toLocaleString()} km</p>
              )}
            </div>

            {/* Costo de reparaciones */}
            {peritaje.costo_reparaciones_estimado > 0 && (
              <div className="card bg-red-50 dark:bg-red-950 border-red-200">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Reparaciones estimadas</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-2">
                  ${peritaje.costo_reparaciones_estimado.toLocaleString()}
                </p>
              </div>
            )}

            {/* Progreso */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">Progreso</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {peritaje.items_calificados} / {peritaje.items_total} items
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    peritaje.porcentaje_completado === 100 ? 'bg-green-500' : 'bg-primary-500'
                  )}
                  style={{ width: `${peritaje.porcentaje_completado}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                {peritaje.porcentaje_completado}% completado
              </p>
            </div>

            {/* Botón completar */}
            {peritaje.estado === 'borrador' && (
              <button
                onClick={() => completarMutation.mutate()}
                disabled={!canComplete || completarMutation.isPending}
                className={clsx(
                  'btn w-full flex items-center justify-center gap-2',
                  canComplete ? 'btn-success' : 'btn-secondary opacity-50'
                )}
              >
                {completarMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Completando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {canComplete ? 'Completar Peritaje' : 'Faltan items por calificar'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navegación inferior */}
      {isEditing && currentStep > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3 lg:pl-68">
          <button
            onClick={prevStep}
            className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Anterior
          </button>
          {currentStep < STEPS.length - 1 && (
            <button
              onClick={nextStep}
              className="flex-1 btn btn-primary flex items-center justify-center gap-2"
            >
              Siguiente
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Modal de cámara */}
      {showCamera && (
        <CameraCapture
          onCapture={handlePhotoCapture}
          onCancel={() => {
            setShowCamera(false)
            setCurrentItemForPhoto(null)
          }}
        />
      )}
    </div>
  )
}
