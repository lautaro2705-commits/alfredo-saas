import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { operacionesAPI, unidadesAPI, clientesAPI, usuariosAPI } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Plus, Car, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'

export default function OperacionForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedUnidad = searchParams.get('unidad')

  const [conRetoma, setConRetoma] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      unidad_id: preselectedUnidad || '',
      forma_pago: 'contado',
      fecha_operacion: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const precioVenta = watch('precio_venta')
  const retomaValor = watch('retoma.valor')

  const { data: unidadesDisponibles } = useQuery({
    queryKey: ['unidades-disponibles'],
    queryFn: async () => {
      const res = await unidadesAPI.stockDisponible()
      return res.data
    },
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes-list'],
    queryFn: async () => {
      const res = await clientesAPI.list({})
      return res.data
    },
  })

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores-list'],
    queryFn: async () => {
      const res = await usuariosAPI.vendedores()
      return res.data
    },
  })

  const mutation = useMutation({
    mutationFn: (data) => operacionesAPI.create(data),
    onSuccess: () => {
      toast.success('Operación creada correctamente')
      navigate('/operaciones')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al crear operación')
    },
  })

  const onSubmit = (data) => {
    const payload = {
      unidad_id: parseInt(data.unidad_id),
      cliente_id: parseInt(data.cliente_id),
      precio_venta: parseFloat(data.precio_venta),
      forma_pago: data.forma_pago,
      monto_contado: parseFloat(data.monto_contado) || 0,
      monto_financiado: parseFloat(data.monto_financiado) || 0,
      entidad_financiera: data.entidad_financiera || null,
      observaciones: data.observaciones || null,
      fecha_operacion: data.fecha_operacion || null,
      vendedor_id: data.vendedor_id ? parseInt(data.vendedor_id) : null,
    }

    if (conRetoma && data.retoma?.marca) {
      payload.retoma = {
        marca: data.retoma.marca,
        modelo: data.retoma.modelo,
        anio: parseInt(data.retoma.anio),
        dominio: data.retoma.dominio,
        valor: parseFloat(data.retoma.valor),
        kilometraje: data.retoma.kilometraje ? parseInt(data.retoma.kilometraje) : null,
        color: data.retoma.color || null,
      }
    }

    mutation.mutate(payload)
  }

  const formatCurrency = (value) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/operaciones" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Operación de Venta</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Fecha de operación */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            Fecha de la Operación
          </h2>
          <input
            type="date"
            className="input"
            {...register('fecha_operacion', { required: 'Fecha requerida' })}
          />
          {errors.fecha_operacion && (
            <p className="text-red-500 text-sm mt-1">{errors.fecha_operacion.message}</p>
          )}
        </div>

        {/* Selección de unidad */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Car className="w-5 h-5" />
            Unidad a Vender
          </h2>

          <select
            className="input"
            {...register('unidad_id', { required: 'Seleccione una unidad' })}
          >
            <option value="">Seleccionar unidad...</option>
            {unidadesDisponibles?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.marca} {u.modelo} {u.anio} - {u.dominio}
              </option>
            ))}
          </select>
          {errors.unidad_id && (
            <p className="text-red-500 text-sm mt-1">{errors.unidad_id.message}</p>
          )}
        </div>

        {/* Cliente */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cliente</h2>

          <select
            className="input"
            {...register('cliente_id', { required: 'Seleccione un cliente' })}
          >
            <option value="">Seleccionar cliente...</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellido} - {c.dni_cuit}
              </option>
            ))}
          </select>
          {errors.cliente_id && (
            <p className="text-red-500 text-sm mt-1">{errors.cliente_id.message}</p>
          )}
          <Link to="/clientes" className="text-primary-600 text-sm hover:underline mt-2 inline-block">
            + Agregar nuevo cliente
          </Link>
        </div>

        {/* Vendedor */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Vendedor
          </h2>

          <select
            className="input"
            {...register('vendedor_id')}
          >
            <option value="">Seleccionar vendedor...</option>
            {vendedores?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre} {v.apellido}
              </option>
            ))}
          </select>
          <p className="text-gray-500 text-sm mt-1">Si no selecciona, se asignará automáticamente al usuario actual</p>
        </div>

        {/* Precio y forma de pago */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Condiciones de Venta</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Precio de Venta *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0"
                {...register('precio_venta', { required: 'Precio requerido' })}
              />
              {errors.precio_venta && (
                <p className="text-red-500 text-sm mt-1">{errors.precio_venta.message}</p>
              )}
            </div>

            <div>
              <label className="label">Forma de Pago</label>
              <select className="input" {...register('forma_pago')}>
                <option value="contado">Contado</option>
                <option value="financiado">Financiado</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>

            <div>
              <label className="label">Monto Contado</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0"
                {...register('monto_contado')}
              />
            </div>

            <div>
              <label className="label">Monto Financiado</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0"
                {...register('monto_financiado')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Entidad Financiera</label>
              <input
                type="text"
                className="input"
                placeholder="Banco o financiera"
                {...register('entidad_financiera')}
              />
            </div>
          </div>
        </div>

        {/* Retoma */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Retoma</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conRetoma}
                onChange={(e) => setConRetoma(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-600">Incluye retoma</span>
            </label>
          </div>

          {conRetoma && (
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <label className="label">Marca *</label>
                <input
                  type="text"
                  className="input"
                  {...register('retoma.marca', { required: conRetoma })}
                />
              </div>
              <div>
                <label className="label">Modelo *</label>
                <input
                  type="text"
                  className="input"
                  {...register('retoma.modelo', { required: conRetoma })}
                />
              </div>
              <div>
                <label className="label">Año *</label>
                <input
                  type="number"
                  className="input"
                  {...register('retoma.anio', { required: conRetoma })}
                />
              </div>
              <div>
                <label className="label">Dominio *</label>
                <input
                  type="text"
                  className="input uppercase"
                  {...register('retoma.dominio', { required: conRetoma })}
                />
              </div>
              <div>
                <label className="label">Valor de Retoma *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  {...register('retoma.valor', { required: conRetoma })}
                />
              </div>
              <div>
                <label className="label">Kilometraje</label>
                <input
                  type="number"
                  className="input"
                  {...register('retoma.kilometraje')}
                />
              </div>
              <div>
                <label className="label">Color</label>
                <input
                  type="text"
                  className="input"
                  {...register('retoma.color')}
                />
              </div>
            </div>
          )}

          {conRetoma && precioVenta && retomaValor && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800">
                <span className="font-medium">Monto neto a recibir: </span>
                {formatCurrency(parseFloat(precioVenta) - parseFloat(retomaValor))}
              </p>
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div className="card">
          <label className="label">Observaciones</label>
          <textarea
            className="input"
            rows="3"
            placeholder="Notas adicionales sobre la operación..."
            {...register('observaciones')}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-4">
          <Link to="/operaciones" className="btn btn-secondary flex-1">
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
            Crear Operación
          </button>
        </div>
      </form>
    </div>
  )
}
