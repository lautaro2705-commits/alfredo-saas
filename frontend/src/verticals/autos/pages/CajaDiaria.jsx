import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { cajaAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { format, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  Trash2
} from 'lucide-react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'

export default function CajaDiaria() {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [fecha, setFecha] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [tipoMovimiento, setTipoMovimiento] = useState('egreso')

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fechaStr = format(fecha, 'yyyy-MM-dd')

  const { data: resumen } = useQuery({
    queryKey: ['caja-resumen', fechaStr],
    queryFn: async () => {
      const res = await cajaAPI.resumenDiario(fechaStr)
      return res.data
    },
  })

  const { data: movimientos, isLoading } = useQuery({
    queryKey: ['caja-movimientos', fechaStr],
    queryFn: async () => {
      const res = await cajaAPI.movimientos({
        fecha_desde: fechaStr,
        fecha_hasta: fechaStr,
      })
      return res.data
    },
  })

  const { data: categorias } = useQuery({
    queryKey: ['caja-categorias'],
    queryFn: async () => {
      const res = await cajaAPI.categorias()
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => cajaAPI.crearMovimiento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-resumen'] })
      toast.success('Movimiento registrado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al registrar')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => cajaAPI.eliminarMovimiento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-resumen'] })
      toast.success('Movimiento eliminado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar')
    },
  })

  const openModal = (tipo) => {
    setTipoMovimiento(tipo)
    reset({ tipo })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    reset({})
  }

  const onSubmit = (data) => {
    createMutation.mutate({
      tipo: tipoMovimiento,
      categoria: data.categoria,
      descripcion: data.descripcion.trim(),
      monto: parseFloat(data.monto),
      fecha: fechaStr,
      medio_pago: data.medio_pago && data.medio_pago.trim() !== '' ? data.medio_pago : null,
      numero_comprobante: data.numero_comprobante && data.numero_comprobante.trim() !== '' ? data.numero_comprobante : null,
    })
  }

  const handleDelete = (mov) => {
    if (window.confirm('¿Eliminar este movimiento?')) {
      deleteMutation.mutate(mov.id)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  const categoriasActuales = tipoMovimiento === 'ingreso'
    ? categorias?.ingresos
    : categorias?.egresos

  const handleExportar = () => {
    if (!movimientos?.length) return
    exportToExcel({
      filename: `caja-${fechaStr}`,
      sheets: [{
        name: 'Movimientos',
        data: movimientos.map(m => ({
          tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
          categoria: m.categoria,
          descripcion: m.descripcion,
          monto: m.monto,
          medio_pago: m.medio_pago || '',
          comprobante: m.numero_comprobante || '',
          usuario: m.usuario_nombre || '',
        })),
        columns: [
          { header: 'Tipo', key: 'tipo', width: 10 },
          { header: 'Categoría', key: 'categoria', width: 18 },
          { header: 'Descripción', key: 'descripcion', width: 35 },
          { header: 'Monto', key: 'monto', width: 16, format: 'currency' },
          { header: 'Medio de Pago', key: 'medio_pago', width: 14 },
          { header: 'Comprobante', key: 'comprobante', width: 14 },
          { header: 'Usuario', key: 'usuario', width: 16 },
        ],
      }],
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header con fecha */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja Diaria</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {format(fecha, "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFecha(subDays(fecha, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input
            type="date"
            value={fechaStr}
            onChange={(e) => setFecha(new Date(e.target.value + 'T12:00:00'))}
            className="input w-auto"
          />
          <button
            onClick={() => setFecha(addDays(fecha, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {movimientos?.length > 0 && (
            <ExportButton onClick={handleExportar} label="Excel" />
          )}
        </div>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Ingresos</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(resumen?.total_ingresos)}
          </p>
        </div>
        <div className="card text-center">
          <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Egresos</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(resumen?.total_egresos)}
          </p>
        </div>
        <div className="card text-center">
          <Wallet className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Saldo</p>
          <p className={clsx(
            'text-xl font-bold',
            (resumen?.saldo || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {formatCurrency(resumen?.saldo)}
          </p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-4">
        <button
          onClick={() => openModal('ingreso')}
          className="btn btn-success flex-1 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ingreso
        </button>
        <button
          onClick={() => openModal('egreso')}
          className="btn btn-danger flex-1 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Egreso
        </button>
      </div>

      {/* Lista de movimientos */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Movimientos del día ({movimientos?.length || 0})
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : movimientos?.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay movimientos en esta fecha</p>
        ) : (
          <div className="space-y-3">
            {movimientos?.map((mov) => (
              <div
                key={mov.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg',
                  mov.tipo === 'ingreso' ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
                )}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{mov.descripcion}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {mov.categoria.replace('_', ' ')}
                    {mov.medio_pago && ` • ${mov.medio_pago}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={clsx(
                    'font-semibold',
                    mov.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                  </p>
                  {!mov.cierre_caja_id && (
                    <button
                      onClick={() => handleDelete(mov)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nuevo movimiento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className={clsx(
              'flex items-center justify-between p-4 border-b',
              tipoMovimiento === 'ingreso' ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
            )}>
              <h2 className="text-lg font-semibold">
                Nuevo {tipoMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/50 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Categoría *</label>
                <select
                  className="input"
                  {...register('categoria', { required: 'Seleccione una categoría' })}
                >
                  <option value="">Seleccionar...</option>
                  {categoriasActuales?.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                {errors.categoria && (
                  <p className="text-red-500 text-sm mt-1">{errors.categoria.message}</p>
                )}
              </div>

              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Detalle del movimiento"
                  {...register('descripcion', { required: 'Descripción requerida' })}
                />
                {errors.descripcion && (
                  <p className="text-red-500 text-sm mt-1">{errors.descripcion.message}</p>
                )}
              </div>

              <div>
                <label className="label">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  {...register('monto', { required: 'Monto requerido' })}
                />
                {errors.monto && (
                  <p className="text-red-500 text-sm mt-1">{errors.monto.message}</p>
                )}
              </div>

              <div>
                <label className="label">Medio de Pago</label>
                <select className="input" {...register('medio_pago')}>
                  <option value="">Seleccionar...</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="label">Nº Comprobante</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Opcional"
                  {...register('numero_comprobante')}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className={clsx(
                    'btn flex-1',
                    tipoMovimiento === 'ingreso' ? 'btn-success' : 'btn-danger'
                  )}
                >
                  {createMutation.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
