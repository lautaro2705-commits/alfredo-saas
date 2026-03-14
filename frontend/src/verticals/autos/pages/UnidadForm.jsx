import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { unidadesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Calculator, ChevronDown, ChevronUp, Camera, FileText } from 'lucide-react'
import CalculadoraRetoma from '../components/CalculadoraRetoma'
import TituloOCRCapture from '../components/TituloOCRCapture'

export default function UnidadForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const isEditing = !!id

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm()
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [showTituloOCR, setShowTituloOCR] = useState(false)

  // Observar el campo origen para mostrar la calculadora
  const origenValue = watch('origen')
  const marcaValue = watch('marca')
  const modeloValue = watch('modelo')
  const versionValue = watch('version')
  const anioValue = watch('anio')

  const { data: unidad, isLoading } = useQuery({
    queryKey: ['unidad', id],
    queryFn: async () => {
      const res = await unidadesAPI.get(id)
      return res.data
    },
    enabled: isEditing,
  })

  useEffect(() => {
    if (unidad) {
      reset(unidad)
    }
  }, [unidad, reset])

  const mutation = useMutation({
    mutationFn: (data) => isEditing
      ? unidadesAPI.update(id, data)
      : unidadesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['unidades'])
      toast.success(isEditing ? 'Unidad actualizada' : 'Unidad creada')
      navigate('/unidades')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al guardar')
    },
  })

  const onSubmit = (data) => {
    // Convertir campos numéricos
    const payload = {
      ...data,
      anio: parseInt(data.anio),
      kilometraje: data.kilometraje ? parseInt(data.kilometraje) : null,
      precio_compra: data.precio_compra ? parseFloat(data.precio_compra) : 0,
      gastos_transferencia: data.gastos_transferencia ? parseFloat(data.gastos_transferencia) : 0,
      precio_publicado: data.precio_publicado ? parseFloat(data.precio_publicado) : null,
      precio_minimo: data.precio_minimo ? parseFloat(data.precio_minimo) : null,
      // Asegurar valores por defecto para estado y origen
      estado: data.estado || 'disponible',
      origen: data.origen || 'compra_directa',
      // Limpiar strings vacíos
      version: data.version || null,
      color: data.color || null,
      combustible: data.combustible || null,
      transmision: data.transmision || null,
      ubicacion: data.ubicacion || null,
      numero_chasis: data.numero_chasis || null,
      numero_motor: data.numero_motor || null,
      observaciones: data.observaciones || null,
    }
    mutation.mutate(payload)
  }

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/unidades" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Editar Unidad' : 'Nueva Unidad'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos del vehículo */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos del Vehículo</h2>

          {/* Botón de OCR del título - solo al crear nueva unidad */}
          {!isEditing && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowTituloOCR(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
              >
                <Camera className="w-5 h-5" />
                <FileText className="w-5 h-5" />
                Escanear Título Automotor
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                Sacale una foto al título para completar los datos automáticamente
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Marca *</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Volkswagen"
                {...register('marca', { required: 'Marca requerida' })}
              />
              {errors.marca && <p className="text-red-500 text-sm mt-1">{errors.marca.message}</p>}
            </div>

            <div>
              <label className="label">Modelo *</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Golf"
                {...register('modelo', { required: 'Modelo requerido' })}
              />
              {errors.modelo && <p className="text-red-500 text-sm mt-1">{errors.modelo.message}</p>}
            </div>

            <div>
              <label className="label">Versión</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: 1.4 TSI Highline"
                {...register('version')}
              />
            </div>

            <div>
              <label className="label">Año *</label>
              <input
                type="number"
                className="input"
                placeholder="2020"
                {...register('anio', {
                  required: 'Año requerido',
                  min: { value: 1900, message: 'Año inválido' },
                  max: { value: new Date().getFullYear() + 1, message: 'Año inválido' }
                })}
              />
              {errors.anio && <p className="text-red-500 text-sm mt-1">{errors.anio.message}</p>}
            </div>

            <div>
              <label className="label">Dominio (Patente) *</label>
              <input
                type="text"
                className="input uppercase"
                placeholder="AB123CD"
                {...register('dominio', { required: 'Dominio requerido' })}
              />
              {errors.dominio && <p className="text-red-500 text-sm mt-1">{errors.dominio.message}</p>}
            </div>

            <div>
              <label className="label">Kilometraje</label>
              <input
                type="number"
                className="input"
                placeholder="50000"
                {...register('kilometraje')}
              />
            </div>

            <div>
              <label className="label">Color</label>
              <input
                type="text"
                className="input"
                placeholder="Blanco"
                {...register('color')}
              />
            </div>

            <div>
              <label className="label">Combustible</label>
              <select className="input" {...register('combustible')}>
                <option value="">Seleccionar</option>
                <option value="Nafta">Nafta</option>
                <option value="Diesel">Diesel</option>
                <option value="GNC">GNC</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Eléctrico">Eléctrico</option>
              </select>
            </div>

            <div>
              <label className="label">Transmisión</label>
              <select className="input" {...register('transmision')}>
                <option value="">Seleccionar</option>
                <option value="Manual">Manual</option>
                <option value="Automática">Automática</option>
              </select>
            </div>

            <div>
              <label className="label">Ubicación</label>
              <input
                type="text"
                className="input"
                placeholder="Sucursal Principal"
                {...register('ubicacion')}
              />
            </div>

            <div>
              <label className="label">Número de Chasis</label>
              <input
                type="text"
                className="input"
                {...register('numero_chasis')}
              />
            </div>

            <div>
              <label className="label">Número de Motor</label>
              <input
                type="text"
                className="input"
                {...register('numero_motor')}
              />
            </div>
          </div>
        </div>

        {/* Datos comerciales */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos Comerciales</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {isAdmin && (
              <>
                <div>
                  <label className="label">Precio de Compra *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0"
                    {...register('precio_compra', { required: 'Precio de compra requerido' })}
                  />
                  {errors.precio_compra && <p className="text-red-500 text-sm mt-1">{errors.precio_compra.message}</p>}
                </div>

                <div>
                  <label className="label">Gastos de Transferencia</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0"
                    {...register('gastos_transferencia')}
                  />
                </div>
              </>
            )}

            <div>
              <label className="label">Precio Publicado</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0"
                {...register('precio_publicado')}
              />
            </div>

            <div>
              <label className="label">Precio Mínimo</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0"
                {...register('precio_minimo')}
              />
            </div>

            <div>
              <label className="label">Estado</label>
              <select className="input" {...register('estado')}>
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="en_reparacion">En reparación</option>
              </select>
            </div>

            <div>
              <label className="label">Origen</label>
              <select className="input" {...register('origen')}>
                <option value="compra_directa">Compra directa</option>
                <option value="retoma">Retoma</option>
                <option value="consignacion">Consignación</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label">Observaciones</label>
            <textarea
              className="input"
              rows="3"
              placeholder="Notas adicionales sobre la unidad..."
              {...register('observaciones')}
            />
          </div>
        </div>

        {/* Calculadora de Retoma - DESHABILITADO temporalmente */}
        {false && isAdmin && origenValue === 'retoma' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowCalculadora(!showCalculadora)}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              {showCalculadora ? 'Ocultar' : 'Mostrar'} Calculadora de Retoma
              {showCalculadora ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCalculadora && (
              <CalculadoraRetoma
                marca={marcaValue || ''}
                modelo={modeloValue || ''}
                version={versionValue || ''}
                anio={anioValue || ''}
                onPrecioCalculado={(precio) => {
                  setValue('precio_compra', precio)
                  toast.success(`Precio de compra sugerido aplicado: $${precio.toLocaleString('es-AR')}`)
                }}
              />
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-4">
          <Link to="/unidades" className="btn btn-secondary flex-1">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Unidad'}
          </button>
        </div>
      </form>

      {/* Modal de OCR del título */}
      {showTituloOCR && (
        <TituloOCRCapture
          onDataExtracted={(datos) => {
            // Llenar formulario con datos extraídos
            if (datos.marca) setValue('marca', datos.marca)
            if (datos.modelo) setValue('modelo', datos.modelo)
            if (datos.version) setValue('version', datos.version)
            if (datos.anio) setValue('anio', datos.anio)
            if (datos.dominio) setValue('dominio', datos.dominio)
            if (datos.numero_chasis) setValue('numero_chasis', datos.numero_chasis)
            if (datos.numero_motor) setValue('numero_motor', datos.numero_motor)
            if (datos.color) setValue('color', datos.color)
            if (datos.combustible) setValue('combustible', datos.combustible)

            setShowTituloOCR(false)
            toast.success('Datos del título aplicados')
          }}
          onCancel={() => setShowTituloOCR(false)}
        />
      )}
    </div>
  )
}
