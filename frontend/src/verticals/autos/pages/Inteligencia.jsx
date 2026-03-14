import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inteligenciaAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  Save,
  X
} from 'lucide-react'
import clsx from 'clsx'

export default function Inteligencia() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showConfig, setShowConfig] = useState(false)
  const [editingConfig, setEditingConfig] = useState(false)
  const [configValues, setConfigValues] = useState({})
  const [expandedSection, setExpandedSection] = useState('resumen')

  const { data: resumen, isLoading: loadingResumen } = useQuery({
    queryKey: ['inteligencia-resumen'],
    queryFn: async () => {
      const res = await inteligenciaAPI.resumen()
      return res.data
    },
    enabled: isAdmin
  })

  const { data: costoOportunidad, isLoading: loadingCosto } = useQuery({
    queryKey: ['costo-oportunidad'],
    queryFn: async () => {
      const res = await inteligenciaAPI.costoOportunidad({ ordenar_por: 'costo_acumulado' })
      return res.data
    }
  })

  const { data: alertasRepricing } = useQuery({
    queryKey: ['alertas-repricing'],
    queryFn: async () => {
      const res = await inteligenciaAPI.alertasRepricing()
      return res.data
    }
  })

  const { data: roiMarca } = useQuery({
    queryKey: ['roi-marca'],
    queryFn: async () => {
      const res = await inteligenciaAPI.roiPorMarca()
      return res.data
    },
    enabled: isAdmin
  })

  const { data: config } = useQuery({
    queryKey: ['inteligencia-config'],
    queryFn: async () => {
      const res = await inteligenciaAPI.configuracion()
      return res.data
    }
  })

  // Inicializar valores de configuracion cuando se cargan
  useEffect(() => {
    if (config) {
      setConfigValues({
        tasa_costo_oportunidad_anual: config.tasa_costo_oportunidad_anual,
        dias_alerta_repricing: config.dias_alerta_repricing,
        dias_stock_inmovilizado: config.dias_stock_inmovilizado
      })
    }
  }, [config])

  const updateConfigMutation = useMutation({
    mutationFn: async ({ clave, valor }) => {
      return await inteligenciaAPI.actualizarConfiguracion(clave, valor)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inteligencia-config'] })
      queryClient.invalidateQueries({ queryKey: ['inteligencia-resumen'] })
      queryClient.invalidateQueries({ queryKey: ['costo-oportunidad'] })
      queryClient.invalidateQueries({ queryKey: ['alertas-repricing'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar')
    }
  })

  const handleSaveConfig = async () => {
    try {
      // Guardar cada valor que cambio
      if (configValues.tasa_costo_oportunidad_anual !== config.tasa_costo_oportunidad_anual) {
        await updateConfigMutation.mutateAsync({
          clave: 'tasa_costo_oportunidad_anual',
          valor: configValues.tasa_costo_oportunidad_anual
        })
      }
      if (configValues.dias_alerta_repricing !== config.dias_alerta_repricing) {
        await updateConfigMutation.mutateAsync({
          clave: 'dias_alerta_repricing',
          valor: configValues.dias_alerta_repricing
        })
      }
      if (configValues.dias_stock_inmovilizado !== config.dias_stock_inmovilizado) {
        await updateConfigMutation.mutateAsync({
          clave: 'dias_stock_inmovilizado',
          valor: configValues.dias_stock_inmovilizado
        })
      }
      toast.success('Configuracion guardada')
      setEditingConfig(false)
    } catch (error) {
      // Error ya manejado en onError
    }
  }

  const handleCancelEdit = () => {
    setConfigValues({
      tasa_costo_oportunidad_anual: config.tasa_costo_oportunidad_anual,
      dias_alerta_repricing: config.dias_alerta_repricing,
      dias_stock_inmovilizado: config.dias_stock_inmovilizado
    })
    setEditingConfig(false)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Acceso Restringido</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Solo administradores pueden ver este modulo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inteligencia de Negocio</h1>
          <p className="text-gray-500 dark:text-gray-400">Analisis de rentabilidad y costo de oportunidad</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Config
        </button>
      </div>

      {/* Panel de Configuracion */}
      {showConfig && config && (
        <div className="card bg-blue-50 dark:bg-blue-950 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-blue-900">Configuracion de Parametros</h3>
            {!editingConfig ? (
              <button
                onClick={() => setEditingConfig(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium"
              >
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  className="btn btn-primary text-sm py-1 px-3 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  {updateConfigMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>

          {editingConfig ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Tasa Costo Oportunidad (% anual)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input w-full"
                  value={configValues.tasa_costo_oportunidad_anual || ''}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    tasa_costo_oportunidad_anual: parseFloat(e.target.value) || 0
                  })}
                />
                <p className="text-xs text-blue-500 mt-1">
                  Ej: 30 = 30% anual = 0.08% diario
                </p>
              </div>
              <div>
                <label className="block text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Dias para Alerta Re-precio
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="input w-full"
                  value={configValues.dias_alerta_repricing || ''}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    dias_alerta_repricing: parseInt(e.target.value) || 0
                  })}
                />
                <p className="text-xs text-blue-500 mt-1">
                  Unidades sin vender despues de estos dias
                </p>
              </div>
              <div>
                <label className="block text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Dias para Stock Inmovilizado
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="input w-full"
                  value={configValues.dias_stock_inmovilizado || ''}
                  onChange={(e) => setConfigValues({
                    ...configValues,
                    dias_stock_inmovilizado: parseInt(e.target.value) || 0
                  })}
                />
                <p className="text-xs text-blue-500 mt-1">
                  Se marca como inmovilizado en el dashboard
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-blue-600 dark:text-blue-400">Tasa Costo Oportunidad</p>
                <p className="font-bold text-blue-900">{config.tasa_costo_oportunidad_anual}% anual</p>
              </div>
              <div>
                <p className="text-blue-600 dark:text-blue-400">Alerta Re-precio</p>
                <p className="font-bold text-blue-900">{config.dias_alerta_repricing} dias</p>
              </div>
              <div>
                <p className="text-blue-600 dark:text-blue-400">Stock Inmovilizado</p>
                <p className="font-bold text-blue-900">{config.dias_stock_inmovilizado} dias</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resumen KPIs */}
      {loadingResumen ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card text-center">
            <BarChart3 className="w-8 h-8 text-primary-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Unidades en Stock</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumen.total_unidades_stock}</p>
          </div>

          <div className="card text-center">
            <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Capital Inmovilizado</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(resumen.capital_inmovilizado)}</p>
          </div>

          <div className="card text-center">
            <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Costo Oportunidad/Mes</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(resumen.costo_oportunidad_total_mensual)}</p>
          </div>

          <div className="card text-center">
            <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">ROI Ultimo Mes</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{resumen.roi_promedio_ultimo_mes?.toFixed(1) || '-'}%</p>
          </div>
        </div>
      )}

      {/* Alertas */}
      {resumen && (resumen.unidades_requieren_repricing > 0 || resumen.unidades_stock_inmovilizado > 0) && (
        <div className="card bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-semibold text-yellow-900">Alertas</h3>
          </div>
          <div className="flex gap-6 text-sm">
            {resumen.unidades_requieren_repricing > 0 && (
              <p className="text-yellow-800">
                <span className="font-bold">{resumen.unidades_requieren_repricing}</span> unidades requieren revision de precio
              </p>
            )}
            {resumen.unidades_stock_inmovilizado > 0 && (
              <p className="text-yellow-800">
                <span className="font-bold">{resumen.unidades_stock_inmovilizado}</span> unidades con stock inmovilizado
              </p>
            )}
          </div>
        </div>
      )}

      {/* Alertas de Repricing */}
      {alertasRepricing && alertasRepricing.length > 0 && (
        <div className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'repricing' ? '' : 'repricing')}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Unidades para Re-precio ({alertasRepricing.length})
            </h2>
            {expandedSection === 'repricing' ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSection === 'repricing' && (
            <div className="mt-4 space-y-3">
              {alertasRepricing.slice(0, 10).map((alerta) => (
                <div
                  key={alerta.unidad_id}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {alerta.marca} {alerta.modelo} ({alerta.anio})
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{alerta.dominio}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-600 dark:text-orange-400 font-semibold">{alerta.dias_en_stock} dias</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Publicado: {formatCurrency(alerta.precio_publicado)}
                    </p>
                    {alerta.precio_sugerido && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Sugerido: {formatCurrency(alerta.precio_sugerido)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Costo de Oportunidad por Unidad */}
      <div className="card">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpandedSection(expandedSection === 'costo' ? '' : 'costo')}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Costo de Oportunidad por Unidad
          </h2>
          {expandedSection === 'costo' ? <ChevronUp /> : <ChevronDown />}
        </div>

        {expandedSection === 'costo' && (
          <>
            {loadingCosto ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Unidad</th>
                      <th className="text-right py-2">Dias</th>
                      <th className="text-right py-2">Costo Total</th>
                      <th className="text-right py-2">Costo/Dia</th>
                      <th className="text-right py-2">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costoOportunidad?.slice(0, 15).map((item) => (
                      <tr key={item.unidad_id} className={clsx(
                        "border-b",
                        item.requiere_repricing && "bg-red-50 dark:bg-red-950"
                      )}>
                        <td className="py-2">
                          <p className="font-medium">{item.marca} {item.modelo}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">{item.dominio}</p>
                        </td>
                        <td className="text-right py-2">{item.dias_en_stock}</td>
                        <td className="text-right py-2">{formatCurrency(item.costo_total)}</td>
                        <td className="text-right py-2 text-red-600 dark:text-red-400">{formatCurrency(item.costo_oportunidad_diario)}</td>
                        <td className="text-right py-2 font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(item.costo_oportunidad_acumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ROI por Marca */}
      {roiMarca && roiMarca.length > 0 && (
        <div className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'roi' ? '' : 'roi')}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              ROI por Marca (Ultimo Ano)
            </h2>
            {expandedSection === 'roi' ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSection === 'roi' && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Marca</th>
                    <th className="text-right py-2">Vendidas</th>
                    <th className="text-right py-2">Precio Prom.</th>
                    <th className="text-right py-2">Utilidad Prom.</th>
                    <th className="text-right py-2">ROI</th>
                    <th className="text-right py-2">Dias Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {roiMarca.map((item) => (
                    <tr key={item.marca} className="border-b">
                      <td className="py-2 font-medium">{item.marca}</td>
                      <td className="text-right py-2">{item.cantidad_vendidas}</td>
                      <td className="text-right py-2">{formatCurrency(item.precio_venta_promedio)}</td>
                      <td className="text-right py-2 text-green-600 dark:text-green-400">{formatCurrency(item.utilidad_promedio)}</td>
                      <td className={clsx(
                        "text-right py-2 font-semibold",
                        item.roi_promedio >= 15 ? "text-green-600 dark:text-green-400" : item.roi_promedio >= 10 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {item.roi_promedio.toFixed(1)}%
                      </td>
                      <td className="text-right py-2">{item.dias_stock_promedio.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top Performers */}
      {resumen && (resumen.marca_mas_rentable || resumen.modelo_mas_rentable) && (
        <div className="card bg-green-50 dark:bg-green-950 border-green-200">
          <h3 className="font-semibold text-green-900 mb-3">Top Performers (Ultimo Trimestre)</h3>
          <div className="grid grid-cols-2 gap-4">
            {resumen.marca_mas_rentable && (
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Marca mas Rentable</p>
                <p className="font-bold text-green-900 text-lg">{resumen.marca_mas_rentable}</p>
              </div>
            )}
            {resumen.modelo_mas_rentable && (
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Modelo mas Rentable</p>
                <p className="font-bold text-green-900 text-lg">{resumen.modelo_mas_rentable}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
