import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { costosAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Wrench, CheckCircle, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'

export default function CostoRapido() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [dominio, setDominio] = useState(searchParams.get('dominio') || '')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: categorias } = useQuery({
    queryKey: ['categorias-costos'],
    queryFn: async () => {
      const res = await costosAPI.categorias()
      return res.data
    },
  })

  const mutation = useMutation({
    mutationFn: (params) => costosAPI.createRapido(params),
    onSuccess: (res) => {
      setSuccess(true)
      toast.success(`Gasto registrado en ${res.data.unidad}`)
      setTimeout(() => {
        setSuccess(false)
        setCategoria('')
        setDescripcion('')
        setMonto('')
        setProveedor('')
      }, 3000)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al registrar')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!dominio || !categoria || !descripcion || !monto) {
      toast.error('Complete todos los campos obligatorios')
      return
    }

    mutation.mutate({
      dominio,
      categoria,
      descripcion,
      monto: parseFloat(monto),
      proveedor: proveedor || undefined,
    })
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4 animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Gasto Registrado!</h2>
        <p className="text-gray-500 dark:text-gray-400">El costo se agregó correctamente a la unidad</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cargar Gasto Rápido</h1>
          <p className="text-gray-500 dark:text-gray-400">Registre un gasto directamente por patente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          {/* Dominio */}
          <div className="mb-6">
            <label className="label text-lg">Patente del Auto *</label>
            <input
              type="text"
              className="input text-2xl text-center uppercase font-mono tracking-wider"
              placeholder="AB123CD"
              value={dominio}
              onChange={(e) => setDominio(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>

          {/* Categoría */}
          <div className="mb-4">
            <label className="label">Tipo de Gasto *</label>
            <div className="grid grid-cols-3 gap-2">
              {categorias?.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategoria(cat.value)}
                  className={clsx(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    categoria === cat.value
                      ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div className="mb-4">
            <label className="label">Descripción *</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Cambio de aceite y filtros"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {/* Monto */}
          <div className="mb-4">
            <label className="label">Monto *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">$</span>
              <input
                type="number"
                step="0.01"
                className="input pl-8 text-xl"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          {/* Proveedor */}
          <div className="mb-4">
            <label className="label">Proveedor (opcional)</label>
            <input
              type="text"
              className="input"
              placeholder="Nombre del taller o proveedor"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>
        </div>

        {/* Botón submit */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full btn btn-primary py-4 text-lg flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Wrench className="w-6 h-6" />
          )}
          Registrar Gasto
        </button>
      </form>

      {/* Instrucciones */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">Instrucciones:</h3>
        <ul className="text-blue-700 dark:text-blue-400 text-sm space-y-1">
          <li>1. Ingrese la patente del vehículo</li>
          <li>2. Seleccione el tipo de gasto</li>
          <li>3. Describa brevemente el trabajo realizado</li>
          <li>4. Ingrese el monto total</li>
        </ul>
      </div>
    </div>
  )
}
