import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { operacionesAPI, clientesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import {
  Plus,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
  Trash2,
  Printer,
  FileText,
  X,
  AlertTriangle,
  RefreshCw,
  Calendar
} from 'lucide-react'
import clsx from 'clsx'
import BoletoCompraVenta from '../components/BoletoCompraVenta'

const estadoColors = {
  reserva: 'badge-info',
  en_proceso: 'badge-warning',
  completada: 'badge-success',
  cancelada: 'badge-danger',
}

const estadoLabels = {
  reserva: 'Reserva',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export default function Operaciones() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [filtroEstado, setFiltroEstado] = useState('')

  // Estados para modal de completar operacion o cargar datos boleto
  const [showCompletarModal, setShowCompletarModal] = useState(false)
  const [operacionCompletar, setOperacionCompletar] = useState(null)
  const [kmEntrega, setKmEntrega] = useState('')
  const [costoTransferencia, setCostoTransferencia] = useState('')
  const [modoCargarDatos, setModoCargarDatos] = useState(false) // true = cargar datos en venta ya completada

  // Estados para imprimir boleto
  const [showBoletoModal, setShowBoletoModal] = useState(false)
  const [boletoData, setBoletoData] = useState(null)
  const [loadingBoleto, setLoadingBoleto] = useState(false)
  const boletoRef = useRef(null)

  // Estados para recuperacion de operaciones
  const [showRecuperarModal, setShowRecuperarModal] = useState(false)
  const [diagnostico, setDiagnostico] = useState(null)
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false)
  const [clienteRecuperar, setClienteRecuperar] = useState('')
  const [clientes, setClientes] = useState([])

  const { data: operaciones, isLoading } = useQuery({
    queryKey: ['operaciones', filtroEstado],
    queryFn: async () => {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      const res = await operacionesAPI.list(params)
      return res.data
    },
  })

  const completarMutation = useMutation({
    mutationFn: ({ id, datos }) => operacionesAPI.completar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success('Operacion completada. Ya puede imprimir el boleto.')
      cerrarModalCompletar()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al completar')
    },
  })

  const cargarDatosBoletoMutation = useMutation({
    mutationFn: ({ id, datos }) => operacionesAPI.cargarDatosBoleto(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success('Datos del boleto cargados. Ya puede imprimir el boleto.')
      cerrarModalCompletar()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al cargar datos')
    },
  })

  const cerrarModalCompletar = () => {
    setShowCompletarModal(false)
    setOperacionCompletar(null)
    setKmEntrega('')
    setCostoTransferencia('')
    setModoCargarDatos(false)
  }

  const marcarImpresoMutation = useMutation({
    mutationFn: (id) => operacionesAPI.marcarBoletoImpreso(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
    },
  })

  const recuperarMutation = useMutation({
    mutationFn: (clienteId) => operacionesAPI.recuperarOperaciones(clienteId),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success(`Se recuperaron ${res.data.operaciones_creadas} operaciones`)
      setShowRecuperarModal(false)
      setDiagnostico(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al recuperar operaciones')
    },
  })

  const corregirFechasMutation = useMutation({
    mutationFn: () => operacionesAPI.corregirFechasCaja(),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success(`Se corrigieron ${res.data.corregidos} movimientos de caja`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al corregir fechas')
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: ({ id, motivo }) => operacionesAPI.cancelar(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success('Operación cancelada')
    },
  })

  const eliminarMutation = useMutation({
    mutationFn: (id) => operacionesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
      toast.success('Operación eliminada')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar')
    },
  })

  const actualizarDocMutation = useMutation({
    mutationFn: ({ id, data }) => operacionesAPI.actualizarDocumentacion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['operaciones'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar')
    },
  })

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  // Funcion para imprimir usando react-to-print v2
  const handlePrint = useReactToPrint({
    content: () => boletoRef.current,
    documentTitle: 'Boleto_compraventa',
    onAfterPrint: () => {
      // Marcar como impreso despues de imprimir
      if (boletoData?.operacion_id) {
        marcarImpresoMutation.mutate(boletoData.operacion_id)
      }
      toast.success('Boleto impreso correctamente')
    },
  })

  const handleCompletar = (op) => {
    // Abrir modal para ingresar km_entrega (completar operacion)
    setOperacionCompletar(op)
    setKmEntrega('')
    setCostoTransferencia('')
    setModoCargarDatos(false)
    setShowCompletarModal(true)
  }

  const handleCargarDatosBoleto = (op) => {
    // Abrir modal para cargar datos en operacion ya completada
    setOperacionCompletar(op)
    setKmEntrega('')
    setCostoTransferencia(op.costo_transferencia_venta?.toString() || '')
    setModoCargarDatos(true)
    setShowCompletarModal(true)
  }

  const handleConfirmarCompletar = () => {
    if (!kmEntrega || parseInt(kmEntrega) <= 0) {
      toast.error('Debe ingresar un kilometraje valido')
      return
    }

    const datos = {
      km_entrega: parseInt(kmEntrega),
      costo_transferencia_venta: parseFloat(costoTransferencia) || 0
    }

    if (modoCargarDatos) {
      cargarDatosBoletoMutation.mutate({ id: operacionCompletar.id, datos })
    } else {
      completarMutation.mutate({ id: operacionCompletar.id, datos })
    }
  }

  const handleImprimirBoleto = async (op) => {
    setLoadingBoleto(true)
    try {
      const res = await operacionesAPI.getBoleto(op.id)
      setBoletoData(res.data)
      setShowBoletoModal(true)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al obtener datos del boleto')
    } finally {
      setLoadingBoleto(false)
    }
  }

  const handleAbrirRecuperar = async () => {
    setLoadingDiagnostico(true)
    setShowRecuperarModal(true)
    try {
      const [diagRes, clientesRes] = await Promise.all([
        operacionesAPI.diagnostico(),
        clientesAPI.list()
      ])
      setDiagnostico(diagRes.data)
      setClientes(clientesRes.data)
      if (clientesRes.data.length > 0) {
        setClienteRecuperar(clientesRes.data[0].id.toString())
      }
    } catch (error) {
      console.error('Error diagnostico completo:', error)
      console.error('Error response:', error.response)
      console.error('Error status:', error.response?.status)
      const errorMsg = error.response?.data?.detail || error.message || 'Error al obtener diagnostico'
      toast.error(`Error: ${errorMsg}`)
      setShowRecuperarModal(false)
    } finally {
      setLoadingDiagnostico(false)
    }
  }

  const handleRecuperar = () => {
    if (!clienteRecuperar) {
      toast.error('Seleccione un cliente')
      return
    }
    recuperarMutation.mutate(parseInt(clienteRecuperar))
  }

  const handleCancelar = (op) => {
    const motivo = window.prompt('Motivo de cancelación:')
    if (motivo !== null) {
      cancelarMutation.mutate({ id: op.id, motivo })
    }
  }

  const handleEliminar = (op) => {
    if (window.confirm(`¿Eliminar la operación #${op.id}? Esta acción no se puede deshacer.`)) {
      eliminarMutation.mutate(op.id)
    }
  }

  const handleToggleDoc = (op, campo, valorActual) => {
    actualizarDocMutation.mutate({
      id: op.id,
      data: { [campo]: !valorActual }
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operaciones de Venta</h1>
          <p className="text-gray-500">{operaciones?.length || 0} operaciones</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => corregirFechasMutation.mutate()}
                disabled={corregirFechasMutation.isPending}
                className="btn btn-secondary flex items-center gap-2"
                title="Corrige fechas de movimientos de caja para que coincidan con la fecha de venta"
              >
                {corregirFechasMutation.isPending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
                ) : (
                  <Calendar className="w-5 h-5" />
                )}
                Corregir Fechas Caja
              </button>
              <button
                onClick={handleAbrirRecuperar}
                className="btn btn-warning flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Recuperar Operaciones
              </button>
            </>
          )}
          <Link to="/operaciones/nueva" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nueva Venta
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'en_proceso', 'reserva', 'completada', 'cancelada'].map((estado) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              filtroEstado === estado
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {estado === '' ? 'Todas' : estadoLabels[estado]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : operaciones?.length === 0 ? (
        <div className="card text-center py-12">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No hay operaciones</h3>
          <p className="text-gray-500 mt-1">Cree una nueva operación de venta</p>
          <Link to="/operaciones/nueva" className="btn btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nueva Venta
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {operaciones?.map((op) => (
            <div key={op.id} className="card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={clsx('badge', estadoColors[op.estado])}>
                      {estadoLabels[op.estado]}
                    </span>
                    {op.tiene_retoma && (
                      <span className="badge badge-info">Con retoma</span>
                    )}
                    <span className="text-sm text-gray-500">
                      #{op.id} • {format(new Date(op.fecha_operacion), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {op.unidad_vendida?.marca} {op.unidad_vendida?.modelo}
                    </h3>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-700">{op.cliente?.nombre_completo}</span>
                  </div>

                  {op.tiene_retoma && (
                    <p className="text-sm text-gray-500">
                      Retoma: {op.retoma_marca} {op.retoma_modelo} ({op.retoma_dominio}) - {formatCurrency(op.retoma_valor)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col md:items-end gap-2">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(op.precio_venta)}
                    </p>
                    {isAdmin && op.estado === 'completada' && (
                      <p className="text-sm text-gray-500">
                        Utilidad: {formatCurrency(op.utilidad_bruta)}
                      </p>
                    )}
                  </div>

                  {op.estado === 'en_proceso' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCompletar(op)}
                        disabled={completarMutation.isPending}
                        className="btn btn-success text-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Completar
                      </button>
                      <button
                        onClick={() => handleCancelar(op)}
                        className="btn btn-danger text-sm flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Boton cargar datos para boleto (ventas antiguas sin km_entrega) */}
                  {op.estado === 'completada' && !op.km_entrega && (
                    <button
                      onClick={() => handleCargarDatosBoleto(op)}
                      disabled={cargarDatosBoletoMutation.isPending}
                      className="btn btn-warning text-sm flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      Cargar datos para boleto
                    </button>
                  )}

                  {/* Boton imprimir boleto para operaciones completadas con datos */}
                  {op.estado === 'completada' && op.km_entrega && (
                    <button
                      onClick={() => handleImprimirBoleto(op)}
                      disabled={loadingBoleto}
                      className="btn btn-primary text-sm flex items-center gap-1"
                    >
                      <Printer className="w-4 h-4" />
                      {op.boleto_impreso ? 'Reimprimir Boleto' : 'Imprimir Boleto'}
                    </button>
                  )}

                  {/* Boton eliminar para operaciones completadas/canceladas (solo admin) */}
                  {isAdmin && (op.estado === 'completada' || op.estado === 'cancelada') && (
                    <button
                      onClick={() => handleEliminar(op)}
                      disabled={eliminarMutation.isPending}
                      className="btn btn-danger text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {/* Info de garantia para operaciones completadas */}
              {op.estado === 'completada' && op.km_entrega && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">
                        Km entrega: <strong>{new Intl.NumberFormat('es-AR').format(op.km_entrega)} km</strong>
                      </span>
                    </div>
                    {op.garantia_km_limite && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          Garantia hasta: <strong>{new Intl.NumberFormat('es-AR').format(op.garantia_km_limite)} km</strong>
                          {op.garantia_fecha_limite && (
                            <> o <strong>{format(new Date(op.garantia_fecha_limite), 'dd/MM/yyyy')}</strong></>
                          )}
                        </span>
                      </div>
                    )}
                    {op.boleto_impreso && (
                      <span className="badge badge-success">Boleto impreso</span>
                    )}
                  </div>
                </div>
              )}

              {/* Documentación pendiente - checkboxes clickeables */}
              {op.estado === 'en_proceso' && (
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm">
                  <label
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    onClick={() => handleToggleDoc(op, 'boleto_compraventa', op.boleto_compraventa)}
                  >
                    <input
                      type="checkbox"
                      checked={op.boleto_compraventa}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <span className={op.boleto_compraventa ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      Boleto firmado
                    </span>
                  </label>
                  <label
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    onClick={() => handleToggleDoc(op, 'form_08_firmado', op.form_08_firmado)}
                  >
                    <input
                      type="checkbox"
                      checked={op.form_08_firmado}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <span className={op.form_08_firmado ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      Form. 08 firmado
                    </span>
                  </label>
                  <label
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    onClick={() => handleToggleDoc(op, 'transferencia_realizada', op.transferencia_realizada)}
                  >
                    <input
                      type="checkbox"
                      checked={op.transferencia_realizada}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <span className={op.transferencia_realizada ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      Transferencia
                    </span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para completar operacion o cargar datos de boleto */}
      {showCompletarModal && operacionCompletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {modoCargarDatos ? 'Cargar Datos para Boleto' : 'Completar Operacion'}
              </h3>
              <button
                onClick={cerrarModalCompletar}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className={modoCargarDatos ? 'bg-yellow-50 rounded-lg p-3' : 'bg-blue-50 rounded-lg p-3'}>
                <p className={modoCargarDatos ? 'text-sm text-yellow-800' : 'text-sm text-blue-800'}>
                  <strong>{operacionCompletar.unidad_vendida?.marca} {operacionCompletar.unidad_vendida?.modelo}</strong>
                  <br />
                  Cliente: {operacionCompletar.cliente?.nombre_completo}
                  {modoCargarDatos && (
                    <>
                      <br />
                      <span className="text-xs">Venta del {format(new Date(operacionCompletar.fecha_operacion), 'dd/MM/yyyy')}</span>
                    </>
                  )}
                </p>
              </div>

              {modoCargarDatos && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Esta venta fue completada sin datos del boleto. Ingrese el kilometraje de entrega
                    para poder generar e imprimir el boleto de compra-venta.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kilometraje de Entrega *
                </label>
                <input
                  type="number"
                  value={kmEntrega}
                  onChange={(e) => setKmEntrega(e.target.value)}
                  placeholder="Ej: 85000"
                  className="input w-full"
                  min="0"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este valor se utilizara para calcular la garantia (2.000 km adicionales)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo de Transferencia
                </label>
                <input
                  type="number"
                  value={costoTransferencia}
                  onChange={(e) => setCostoTransferencia(e.target.value)}
                  placeholder="Ej: 150000"
                  className="input w-full"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se mostrara desglosado en el boleto de compra-venta
                </p>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Garantia:</strong> 3 meses o 2.000 km (lo que ocurra primero), exclusivamente sobre motor y caja.
                  <br />
                  <strong>Otros desperfectos:</strong> 72 horas para reclamo.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={cerrarModalCompletar}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCompletar}
                disabled={(modoCargarDatos ? cargarDatosBoletoMutation.isPending : completarMutation.isPending) || !kmEntrega}
                className={`flex-1 flex items-center justify-center gap-2 ${modoCargarDatos ? 'btn btn-primary' : 'btn btn-success'}`}
              >
                {(modoCargarDatos ? cargarDatosBoletoMutation.isPending : completarMutation.isPending) ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : modoCargarDatos ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {modoCargarDatos ? 'Guardar y Generar Boleto' : 'Completar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para vista previa e impresion de boleto */}
      {showBoletoModal && boletoData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                Boleto de Compra-Venta - Operacion #{boletoData.operacion_id}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Duplicado
                </button>
                <button
                  onClick={() => {
                    setShowBoletoModal(false)
                    setBoletoData(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-100 max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Vista previa del boleto. Se imprimiran 2 copias: Original (Comprador) y Duplicado (Agencia).
                <br />
                <strong>Nota:</strong> Solo la copia de la Agencia incluye el kilometraje de entrega.
              </p>
              <BoletoCompraVenta ref={boletoRef} data={boletoData} tipo="ambos" />
            </div>
          </div>
        </div>
      )}

      {/* Modal para recuperar operaciones faltantes */}
      {showRecuperarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Recuperar Operaciones Faltantes
              </h3>
              <button
                onClick={() => {
                  setShowRecuperarModal(false)
                  setDiagnostico(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {loadingDiagnostico ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : diagnostico ? (
                <>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">Diagnostico</h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>Unidades vendidas: <strong>{diagnostico.total_unidades_vendidas}</strong></p>
                      <p>Operaciones registradas: <strong>{diagnostico.total_operaciones_completadas}</strong></p>
                      <p className="text-lg">
                        Operaciones faltantes: <strong className="text-red-600">{diagnostico.unidades_sin_operacion}</strong>
                      </p>
                    </div>
                  </div>

                  {diagnostico.unidades_sin_operacion > 0 ? (
                    <>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <p className="text-sm font-medium text-gray-700 mb-2">Unidades sin operacion:</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {diagnostico.detalle_unidades_sin_operacion.map((u) => (
                            <li key={u.id}>
                              {u.marca} {u.modelo} ({u.dominio}) - ${u.precio_publicado?.toLocaleString() || 'Sin precio'}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Asignar a cliente:
                        </label>
                        <select
                          value={clienteRecuperar}
                          onChange={(e) => setClienteRecuperar(e.target.value)}
                          className="input w-full"
                        >
                          {clientes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.apellido} - {c.dni_cuit}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Puede editar el cliente correcto despues en cada operacion
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700">Todas las unidades vendidas tienen su operacion registrada</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => {
                  setShowRecuperarModal(false)
                  setDiagnostico(null)
                }}
                className="btn btn-secondary flex-1"
              >
                Cerrar
              </button>
              {diagnostico?.unidades_sin_operacion > 0 && (
                <button
                  onClick={handleRecuperar}
                  disabled={recuperarMutation.isPending || !clienteRecuperar}
                  className="btn btn-warning flex-1 flex items-center justify-center gap-2"
                >
                  {recuperarMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Recuperar {diagnostico.unidades_sin_operacion} operaciones
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
