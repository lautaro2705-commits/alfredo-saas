import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { preciosMercadoAPI, peritajesAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Calculator, Search, TrendingUp, AlertTriangle, RefreshCw, ClipboardCheck, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

/**
 * Calculadora de Retoma
 *
 * Permite consultar el precio de mercado de un vehiculo y calcular
 * el precio maximo de compra sugerido basado en:
 * - Precio de mercado (MercadoLibre/DeAutos Cordoba)
 * - Margen de la agencia (configurable)
 * - Gastos estimados de reacondicionamiento (configurable)
 *
 * Formula: Precio Compra Max = Precio Mercado - Margen% - Gastos Reacondicionamiento
 */
export default function CalculadoraRetoma({
  marca: marcaInicial = '',
  modelo: modeloInicial = '',
  version: versionInicial = '',
  anio: anioInicial = '',
  peritajeId = null,
  onPrecioCalculado,
  className = ''
}) {
  const [marca, setMarca] = useState(marcaInicial)
  const [modelo, setModelo] = useState(modeloInicial)
  const [version, setVersion] = useState(versionInicial)
  const [anio, setAnio] = useState(anioInicial)
  const [resultado, setResultado] = useState(null)

  // Cargar puntaje de estado del peritaje si existe
  const { data: peritajeEstado } = useQuery({
    queryKey: ['peritaje-estado', peritajeId],
    queryFn: async () => {
      const res = await peritajesAPI.getPuntajeEstado(peritajeId)
      return res.data
    },
    enabled: Boolean(peritajeId)
  })

  // Actualizar campos cuando cambian los props
  useEffect(() => {
    if (marcaInicial) setMarca(marcaInicial)
  }, [marcaInicial])

  useEffect(() => {
    if (modeloInicial) setModelo(modeloInicial)
  }, [modeloInicial])

  useEffect(() => {
    if (versionInicial) setVersion(versionInicial)
  }, [versionInicial])

  useEffect(() => {
    if (anioInicial) setAnio(anioInicial)
  }, [anioInicial])

  // Obtener configuracion
  const { data: config } = useQuery({
    queryKey: ['precios-mercado-config'],
    queryFn: async () => {
      const res = await preciosMercadoAPI.configuracion()
      return res.data
    },
    staleTime: 5 * 60 * 1000 // 5 minutos
  })

  const calcularMutation = useMutation({
    mutationFn: (data) => preciosMercadoAPI.calcularToma(data),
    onSuccess: (res) => {
      setResultado(res.data)
      if (res.data.precio_compra_maximo > 0 && onPrecioCalculado) {
        onPrecioCalculado(res.data.precio_compra_maximo)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Error al calcular precio de mercado')
      setResultado(null)
    }
  })

  const handleCalcular = () => {
    if (!marca.trim()) {
      toast.error('Ingrese la marca del vehiculo')
      return
    }
    if (!modelo.trim()) {
      toast.error('Ingrese el modelo del vehiculo')
      return
    }
    if (!anio || parseInt(anio) < 1990 || parseInt(anio) > new Date().getFullYear() + 1) {
      toast.error('Ingrese un ano valido')
      return
    }
    calcularMutation.mutate({
      marca: marca.trim(),
      modelo: modelo.trim(),
      version: version.trim() || null,
      anio: parseInt(anio)
    })
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleUsarPrecio = () => {
    if (resultado?.precio_compra_maximo > 0 && onPrecioCalculado) {
      onPrecioCalculado(resultado.precio_compra_maximo)
      toast.success(`Precio de compra sugerido: ${formatCurrency(resultado.precio_compra_maximo)}`)
    }
  }

  return (
    <div className={clsx('card bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-purple-900">Calculadora de Retoma</h3>
      </div>

      <p className="text-sm text-purple-700 mb-4">
        Consulta el precio de mercado en Cordoba y obtene una sugerencia de precio maximo de compra.
      </p>

      {/* Formulario de busqueda */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="label text-purple-700">Marca</label>
          <input
            type="text"
            placeholder="Ej: Volkswagen"
            className="input"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-purple-700">Modelo</label>
          <input
            type="text"
            placeholder="Ej: Golf"
            className="input"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-purple-700">Version</label>
          <input
            type="text"
            placeholder="Ej: 1.4 TSI Highline"
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-purple-700">Ano</label>
          <input
            type="number"
            placeholder="Ej: 2020"
            className="input"
            min="1990"
            max={new Date().getFullYear() + 1}
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleCalcular}
            disabled={calcularMutation.isPending}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {calcularMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Calcular
          </button>
        </div>
      </div>

      {/* Resultados */}
      {resultado && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 space-y-4">
          {resultado.error && !resultado.precio_mercado ? (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{resultado.error}</span>
            </div>
          ) : (
            <>
              {/* Precio de mercado */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Precio de Mercado (Cordoba)</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Minimo</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(resultado.precio_mercado_min)}</p>
                  </div>
                  <div className="bg-purple-100 rounded-lg py-2">
                    <p className="text-xs text-purple-600 dark:text-purple-400">Promedio</p>
                    <p className="text-lg font-bold text-purple-700">{formatCurrency(resultado.precio_mercado)}</p>
                    <p className="text-xs text-purple-500">{resultado.cantidad_resultados} resultados</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Maximo</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(resultado.precio_mercado_max)}</p>
                  </div>
                </div>
              </div>

              {/* Desglose del calculo */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Calculo del Precio de Compra:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Precio de Mercado</span>
                    <span className="font-medium">{formatCurrency(resultado.precio_mercado)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>- Margen Agencia ({resultado.margen_agencia_porcentaje}%)</span>
                    <span>-{formatCurrency(resultado.margen_agencia_pesos)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>- Gastos Reacondicionamiento</span>
                    <span>-{formatCurrency(resultado.gastos_reacondicionamiento)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 text-green-600 dark:text-green-400">
                    <span>= Precio Compra Maximo</span>
                    <span>{formatCurrency(resultado.precio_compra_maximo)}</span>
                  </div>
                </div>
              </div>

              {/* Ajuste por estado del vehiculo (Peritaje) */}
              {peritajeEstado && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Ajuste por Estado del Vehiculo:
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Puntaje de Estado</span>
                      <span className={clsx(
                        'font-medium',
                        peritajeEstado.puntaje_estado >= 80 ? 'text-green-600 dark:text-green-400' :
                        peritajeEstado.puntaje_estado >= 60 ? 'text-blue-600 dark:text-blue-400' :
                        peritajeEstado.puntaje_estado >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {Math.round(peritajeEstado.puntaje_estado)}/100 ({peritajeEstado.resumen_estado})
                      </span>
                    </div>
                    {peritajeEstado.costo_reparaciones > 0 && (
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>- Reparaciones estimadas</span>
                        <span>-{formatCurrency(peritajeEstado.costo_reparaciones)}</span>
                      </div>
                    )}
                    {peritajeEstado.ajuste_precio !== 0 && (
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>- Ajuste por estado</span>
                        <span>{formatCurrency(peritajeEstado.ajuste_precio)}</span>
                      </div>
                    )}
                    {peritajeEstado.items_urgentes?.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Items urgentes:
                        </p>
                        <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                          {peritajeEstado.items_urgentes.slice(0, 3).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                          {peritajeEstado.items_urgentes.length > 3 && (
                            <li>y {peritajeEstado.items_urgentes.length - 3} mas...</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/peritajes/${peritajeId}`}
                    className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                  >
                    Ver peritaje completo <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Precio final ajustado */}
              {peritajeEstado && resultado.precio_compra_maximo > 0 && (
                <div className="bg-purple-100 rounded-lg p-3 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-purple-700 font-medium">Precio Compra Ajustado</span>
                    <span className="font-bold text-purple-800 text-lg">
                      {formatCurrency(
                        resultado.precio_compra_maximo +
                        (peritajeEstado.ajuste_precio || 0) -
                        (peritajeEstado.costo_reparaciones || 0)
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    Precio maximo considerando el estado del vehiculo segun peritaje
                  </p>
                </div>
              )}

              {/* Utilidad proyectada */}
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 font-medium">Utilidad Proyectada</span>
                </div>
                <span className="font-bold text-green-700 dark:text-green-400 text-lg">{formatCurrency(resultado.utilidad_proyectada)}</span>
              </div>

              {/* Boton para usar el precio */}
              {onPrecioCalculado && resultado.precio_compra_maximo > 0 && (
                <button
                  onClick={handleUsarPrecio}
                  className="btn btn-success w-full"
                >
                  Usar {formatCurrency(resultado.precio_compra_maximo)} como Precio de Compra
                </button>
              )}

              {/* Recomendacion */}
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {resultado.recomendacion}
              </p>

              {/* Fuente */}
              <p className="text-xs text-gray-400">
                Fuente: {resultado.fuente === 'mercadolibre' ? 'MercadoLibre' : resultado.fuente}
              </p>
            </>
          )}
        </div>
      )}

      {/* Configuracion actual */}
      {config && (
        <div className="mt-4 pt-4 border-t border-purple-200 text-xs text-purple-600 dark:text-purple-400">
          <span className="font-medium">Configuracion:</span>{' '}
          Margen {config.margen_agencia_retoma}% |{' '}
          Gastos estimados {formatCurrency(config.gastos_estimados_reacondicionamiento)} |{' '}
          Cache {config.cache_precios_mercado_horas}h
        </div>
      )}
    </div>
  )
}
