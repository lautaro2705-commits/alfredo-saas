import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { chequesAPI } from '../services/api'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileText,
  Plus,
  X,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowRightLeft,
  Ban,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2
} from 'lucide-react'
import clsx from 'clsx'

const estadoRecibidoColors = {
  en_cartera: 'badge-info',
  depositado: 'badge-warning',
  cobrado: 'badge-success',
  endosado: 'badge-info',
  rechazado: 'badge-danger',
}

const estadoEmitidoColors = {
  pendiente: 'badge-warning',
  pagado: 'badge-success',
  anulado: 'badge-danger',
}

export default function Cheques() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('recibidos')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState('recibido')
  const [accionModal, setAccionModal] = useState(null)
  const [chequeSeleccionado, setChequeSeleccionado] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Queries
  const { data: resumenRecibidos } = useQuery({
    queryKey: ['cheques-recibidos-resumen'],
    queryFn: async () => {
      const res = await chequesAPI.recibidosResumen()
      return res.data
    },
  })

  const { data: resumenEmitidos } = useQuery({
    queryKey: ['cheques-emitidos-resumen'],
    queryFn: async () => {
      const res = await chequesAPI.emitidosResumen()
      return res.data
    },
  })

  const { data: chequesCartera, isLoading: loadingCartera } = useQuery({
    queryKey: ['cheques-cartera'],
    queryFn: async () => {
      const res = await chequesAPI.recibidosCartera()
      return res.data
    },
    enabled: activeTab === 'recibidos',
  })

  const { data: chequesPendientes, isLoading: loadingPendientes } = useQuery({
    queryKey: ['cheques-pendientes'],
    queryFn: async () => {
      const res = await chequesAPI.emitidosPendientes()
      return res.data
    },
    enabled: activeTab === 'emitidos',
  })

  const { data: calendario } = useQuery({
    queryKey: ['cheques-calendario'],
    queryFn: async () => {
      const res = await chequesAPI.calendario(30)
      return res.data
    },
    enabled: activeTab === 'calendario',
  })

  const { data: alertas } = useQuery({
    queryKey: ['cheques-alertas'],
    queryFn: async () => {
      const res = await chequesAPI.alertas()
      return res.data
    },
  })

  // Helper para invalidar todas las queries de cheques
  const invalidarCheques = () => {
    queryClient.invalidateQueries({ queryKey: ['cheques-recibidos-resumen'] })
    queryClient.invalidateQueries({ queryKey: ['cheques-emitidos-resumen'] })
    queryClient.invalidateQueries({ queryKey: ['cheques-cartera'] })
    queryClient.invalidateQueries({ queryKey: ['cheques-pendientes'] })
    queryClient.invalidateQueries({ queryKey: ['cheques-calendario'] })
    queryClient.invalidateQueries({ queryKey: ['cheques-alertas'] })
  }

  // Mutations
  const createRecibidoMutation = useMutation({
    mutationFn: (data) => chequesAPI.createRecibido(data),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque registrado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al registrar cheque')
    },
  })

  const createEmitidoMutation = useMutation({
    mutationFn: (data) => chequesAPI.createEmitido(data),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque registrado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al registrar cheque')
    },
  })

  const cobrarMutation = useMutation({
    mutationFn: (id) => chequesAPI.cobrarCheque(id),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque cobrado e ingreso registrado en caja')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al cobrar cheque')
    },
  })

  const depositarMutation = useMutation({
    mutationFn: ({ id, data }) => chequesAPI.depositarCheque(id, data),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque marcado como depositado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al depositar cheque')
    },
  })

  const endosarMutation = useMutation({
    mutationFn: ({ id, data }) => chequesAPI.endosarCheque(id, data),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque endosado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al endosar cheque')
    },
  })

  const pagarMutation = useMutation({
    mutationFn: ({ id, data }) => chequesAPI.pagarCheque(id, data),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque marcado como pagado')
      closeModal()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al marcar como pagado')
    },
  })

  const deleteRecibidoMutation = useMutation({
    mutationFn: (id) => chequesAPI.deleteRecibido(id),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque eliminado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar cheque')
    },
  })

  const deleteEmitidoMutation = useMutation({
    mutationFn: (id) => chequesAPI.deleteEmitido(id),
    onSuccess: () => {
      invalidarCheques()
      toast.success('Cheque eliminado')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar cheque')
    },
  })

  const handleDeleteRecibido = (cheque) => {
    if (window.confirm(`¿Eliminar el cheque #${cheque.numero_cheque} de ${cheque.emisor_nombre}?`)) {
      deleteRecibidoMutation.mutate(cheque.id)
    }
  }

  const handleDeleteEmitido = (cheque) => {
    if (window.confirm(`¿Eliminar el cheque #${cheque.numero_cheque} a ${cheque.beneficiario}?`)) {
      deleteEmitidoMutation.mutate(cheque.id)
    }
  }

  const openModal = (tipo, accion = null, cheque = null) => {
    setModalTipo(tipo)
    setAccionModal(accion)
    setChequeSeleccionado(cheque)
    reset({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setAccionModal(null)
    setChequeSeleccionado(null)
    reset({})
  }

  const onSubmit = (data) => {
    if (accionModal === 'cobrar') {
      cobrarMutation.mutate(chequeSeleccionado.id)
    } else if (accionModal === 'depositar') {
      depositarMutation.mutate({ id: chequeSeleccionado.id, data })
    } else if (accionModal === 'endosar') {
      endosarMutation.mutate({ id: chequeSeleccionado.id, data })
    } else if (accionModal === 'pagar') {
      pagarMutation.mutate({ id: chequeSeleccionado.id, data })
    } else if (modalTipo === 'recibido') {
      createRecibidoMutation.mutate({
        ...data,
        monto: parseFloat(data.monto),
      })
    } else {
      createEmitidoMutation.mutate({
        ...data,
        monto: parseFloat(data.monto),
      })
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Cheques</h1>
          <p className="text-gray-500">Cartera de cheques recibidos y emitidos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal('recibido')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Cheque Recibido
          </button>
          <button
            onClick={() => openModal('emitido')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Cheque Emitido
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alertas?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Vencimiento
          </h3>
          <div className="space-y-2">
            {alertas.slice(0, 5).map((alerta, i) => (
              <p key={i} className={clsx(
                'text-sm',
                alerta.prioridad === 'alta' ? 'text-red-700' : 'text-yellow-700'
              )}>
                {alerta.mensaje} - {formatCurrency(alerta.monto)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">En Cartera</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(resumenRecibidos?.total_en_cartera)}
          </p>
          <p className="text-xs text-gray-400">{resumenRecibidos?.cantidad_en_cartera} cheques</p>
        </div>
        <div className="card text-center">
          <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Pendientes Pago</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(resumenEmitidos?.total_pendientes)}
          </p>
          <p className="text-xs text-gray-400">{resumenEmitidos?.cantidad_pendientes} cheques</p>
        </div>
        <div className="card text-center">
          <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Cobrados</p>
          <p className="text-xl font-bold text-gray-700">
            {formatCurrency(resumenRecibidos?.total_depositados)}
          </p>
        </div>
        <div className="card text-center">
          <ArrowRightLeft className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Endosados</p>
          <p className="text-xl font-bold text-purple-600">
            {formatCurrency(resumenRecibidos?.total_endosados)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { id: 'recibidos', label: 'Cartera (Recibidos)' },
            { id: 'emitidos', label: 'Emitidos (Propios)' },
            { id: 'calendario', label: 'Calendario' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab */}
      {activeTab === 'recibidos' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Cheques en Cartera</h3>
          {loadingCartera ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : chequesCartera?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay cheques en cartera</p>
          ) : (
            <div className="space-y-3">
              {chequesCartera?.map((cheque) => (
                <div
                  key={cheque.id}
                  className={clsx(
                    'p-4 rounded-lg border',
                    cheque.vencido ? 'border-red-300 bg-red-50' :
                    cheque.dias_para_vencer <= 7 ? 'border-yellow-300 bg-yellow-50' :
                    'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium">#{cheque.numero_cheque}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600">{cheque.banco}</span>
                      </div>
                      <p className="text-sm text-gray-600">{cheque.emisor_nombre}</p>
                      <p className="text-xs text-gray-400">
                        Vence: {format(new Date(cheque.fecha_vencimiento), 'dd/MM/yyyy')}
                        {cheque.dias_para_vencer >= 0 ? (
                          <span className="ml-2">({cheque.dias_para_vencer} días)</span>
                        ) : (
                          <span className="ml-2 text-red-600 font-medium">VENCIDO</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(cheque.monto)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal('recibido', 'depositar', cheque)}
                          className="btn btn-secondary text-xs py-1 px-2"
                        >
                          Depositar
                        </button>
                        <button
                          onClick={() => openModal('recibido', 'cobrar', cheque)}
                          className="btn btn-success text-xs py-1 px-2"
                        >
                          Cobrar
                        </button>
                        <button
                          onClick={() => openModal('recibido', 'endosar', cheque)}
                          className="btn btn-primary text-xs py-1 px-2"
                        >
                          Endosar
                        </button>
                        <button
                          onClick={() => handleDeleteRecibido(cheque)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar cheque"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'emitidos' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Cheques Pendientes de Débito</h3>
          {loadingPendientes ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : chequesPendientes?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay cheques pendientes</p>
          ) : (
            <div className="space-y-3">
              {chequesPendientes?.map((cheque) => (
                <div
                  key={cheque.id}
                  className={clsx(
                    'p-4 rounded-lg border',
                    cheque.dias_para_debito <= 3 ? 'border-red-300 bg-red-50' :
                    cheque.dias_para_debito <= 7 ? 'border-yellow-300 bg-yellow-50' :
                    'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium">#{cheque.numero_cheque}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600">{cheque.banco}</span>
                      </div>
                      <p className="text-sm text-gray-600">A: {cheque.beneficiario}</p>
                      <p className="text-xs text-gray-400">
                        Se debita: {format(new Date(cheque.fecha_pago), 'dd/MM/yyyy')}
                        <span className="ml-2">({cheque.dias_para_debito} días)</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-red-600">
                        -{formatCurrency(cheque.monto)}
                      </p>
                      <button
                        onClick={() => openModal('emitido', 'pagar', cheque)}
                        className="btn btn-success text-xs py-1 px-2"
                      >
                        Marcar Pagado
                      </button>
                      <button
                        onClick={() => handleDeleteEmitido(cheque)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar cheque"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendario' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendario de Vencimientos (Próximos 30 días)
          </h3>

          {calendario && (
            <>
              <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500">A Cobrar</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(calendario.totales?.total_a_cobrar)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">A Pagar</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(calendario.totales?.total_a_pagar)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Saldo Proyectado</p>
                  <p className={clsx(
                    'text-2xl font-bold',
                    calendario.totales?.saldo_proyectado >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatCurrency(calendario.totales?.saldo_proyectado)}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-green-700 mb-3">Cheques a Cobrar</h4>
                  {calendario.cheques_a_cobrar?.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sin cheques próximos</p>
                  ) : (
                    <div className="space-y-2">
                      {calendario.cheques_a_cobrar?.map((c) => (
                        <div key={c.id} className="flex justify-between text-sm p-2 bg-green-50 rounded">
                          <div>
                            <span className="font-mono">#{c.numero}</span>
                            <span className="text-gray-500 ml-2">{c.emisor}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(c.monto)}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(c.fecha), 'dd/MM')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-red-700 mb-3">Cheques a Pagar</h4>
                  {calendario.cheques_a_pagar?.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sin cheques próximos</p>
                  ) : (
                    <div className="space-y-2">
                      {calendario.cheques_a_pagar?.map((c) => (
                        <div key={c.id} className="flex justify-between text-sm p-2 bg-red-50 rounded">
                          <div>
                            <span className="font-mono">#{c.numero}</span>
                            <span className="text-gray-500 ml-2">{c.beneficiario}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(c.monto)}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(c.fecha), 'dd/MM')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {accionModal === 'cobrar' && 'Confirmar Cobro'}
                {accionModal === 'depositar' && 'Depositar Cheque'}
                {accionModal === 'endosar' && 'Endosar Cheque'}
                {accionModal === 'pagar' && 'Confirmar Pago'}
                {!accionModal && modalTipo === 'recibido' && 'Nuevo Cheque Recibido'}
                {!accionModal && modalTipo === 'emitido' && 'Nuevo Cheque Emitido'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
              {/* Formularios según acción */}
              {accionModal === 'cobrar' && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">
                    ¿Confirmar cobro del cheque #{chequeSeleccionado?.numero_cheque}
                    por {formatCurrency(chequeSeleccionado?.monto)}?
                  </p>
                  <p className="text-sm text-gray-500">
                    Se registrará automáticamente un ingreso en caja.
                  </p>
                </div>
              )}

              {accionModal === 'depositar' && (
                <div>
                  <label className="label">Banco donde se deposita *</label>
                  <input
                    type="text"
                    className="input"
                    {...register('banco_deposito', { required: 'Banco requerido' })}
                  />
                </div>
              )}

              {accionModal === 'endosar' && (
                <>
                  <div>
                    <label className="label">Entregar a (nombre) *</label>
                    <input
                      type="text"
                      className="input"
                      {...register('endosado_a', { required: 'Nombre requerido' })}
                    />
                  </div>
                  <div>
                    <label className="label">CUIT</label>
                    <input type="text" className="input" {...register('endosado_cuit')} />
                  </div>
                  <div>
                    <label className="label">Motivo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ej: Pago a proveedor X"
                      {...register('motivo_endoso')}
                    />
                  </div>
                </>
              )}

              {accionModal === 'pagar' && (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">
                    ¿Confirmar que el cheque #{chequeSeleccionado?.numero_cheque}
                    por {formatCurrency(chequeSeleccionado?.monto)} fue debitado?
                  </p>
                  <p className="text-sm text-gray-500">
                    Se registrará automáticamente un egreso en caja.
                  </p>
                </div>
              )}

              {!accionModal && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Banco *</label>
                      <input
                        type="text"
                        className="input"
                        {...register('banco', { required: 'Banco requerido' })}
                      />
                    </div>
                    <div>
                      <label className="label">Nº Cheque *</label>
                      <input
                        type="text"
                        className="input"
                        {...register('numero_cheque', { required: 'Número requerido' })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Monto *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      {...register('monto', { required: 'Monto requerido' })}
                    />
                  </div>

                  {modalTipo === 'recibido' ? (
                    <>
                      <div>
                        <label className="label">Emisor (Nombre) *</label>
                        <input
                          type="text"
                          className="input"
                          {...register('emisor_nombre', { required: 'Emisor requerido' })}
                        />
                      </div>
                      <div>
                        <label className="label">CUIT Emisor</label>
                        <input type="text" className="input" {...register('emisor_cuit')} />
                      </div>
                      <div>
                        <label className="label">Fecha de Vencimiento *</label>
                        <input
                          type="date"
                          className="input"
                          {...register('fecha_vencimiento', { required: 'Fecha requerida' })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="label">Beneficiario *</label>
                        <input
                          type="text"
                          className="input"
                          {...register('beneficiario', { required: 'Beneficiario requerido' })}
                        />
                      </div>
                      <div>
                        <label className="label">CUIT Beneficiario</label>
                        <input type="text" className="input" {...register('beneficiario_cuit')} />
                      </div>
                      <div>
                        <label className="label">Fecha de Pago *</label>
                        <input
                          type="date"
                          className="input"
                          {...register('fecha_pago', { required: 'Fecha requerida' })}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="label">Observaciones</label>
                    <textarea className="input" rows="2" {...register('observaciones')} />
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {accionModal ? 'Confirmar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
