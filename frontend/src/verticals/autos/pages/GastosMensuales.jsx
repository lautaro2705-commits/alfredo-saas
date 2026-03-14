import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gastosAPI } from '../services/api'
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  Wrench,
  TrendingDown,
  Receipt,
  Car,
  Filter
} from 'lucide-react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value || 0)

// Labels legibles para categorías
const LABELS_CATEGORIAS = {
  alquiler: 'Alquiler',
  servicios: 'Servicios',
  sueldos: 'Sueldos',
  impuestos: 'Impuestos',
  seguros: 'Seguros',
  publicidad: 'Publicidad',
  mantenimiento_local: 'Mantenimiento Local',
  contador: 'Contador',
  seguridad: 'Seguridad',
  otros_egresos: 'Otros Egresos',
  retiro_socio: 'Retiro Socio',
  mecanica: 'Mecánica',
  electricidad: 'Electricidad',
  chapa_pintura: 'Chapa/Pintura',
  tapiceria: 'Tapicería',
  neumaticos: 'Neumáticos',
  cristales: 'Cristales',
  gestoria: 'Gestoría',
  lavado: 'Lavado',
  combustible: 'Combustible',
  grua: 'Grúa',
  vtv: 'VTV',
  otros: 'Otros',
}

export default function GastosMensuales() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [filtroOrigen, setFiltroOrigen] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['gastos-mensuales', mes, anio],
    queryFn: async () => {
      const res = await gastosAPI.mensuales(mes, anio)
      return res.data
    },
  })

  const irMesAnterior = () => {
    if (mes === 1) { setMes(12); setAnio(anio - 1) }
    else { setMes(mes - 1) }
  }

  const irMesSiguiente = () => {
    if (mes === 12) { setMes(1); setAnio(anio + 1) }
    else { setMes(mes + 1) }
  }

  // Filtrar gastos
  const gastosFiltrados = data?.gastos?.filter((g) => {
    if (filtroOrigen !== 'todos' && g.origen !== filtroOrigen) return false
    if (filtroCategoria && g.categoria !== filtroCategoria) return false
    return true
  }) || []

  const totalFiltrado = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0)

  // Categorías únicas para el filtro
  const categoriasDisponibles = [...new Set(data?.gastos?.map(g => g.categoria) || [])]

  const handleExportar = () => {
    if (!data?.gastos?.length) return
    const sheets = [
      {
        name: 'Gastos',
        data: gastosFiltrados.map(g => ({
          fecha: g.fecha,
          tipo: g.origen === 'operativo' ? 'Operativo' : 'Directo',
          categoria: LABELS_CATEGORIAS[g.categoria] || g.categoria,
          descripcion: g.descripcion,
          unidad: g.unidad_descripcion || '',
          monto: g.monto,
        })),
        columns: [
          { header: 'Fecha', key: 'fecha', width: 12 },
          { header: 'Tipo', key: 'tipo', width: 12 },
          { header: 'Categoría', key: 'categoria', width: 18 },
          { header: 'Descripción', key: 'descripcion', width: 35 },
          { header: 'Unidad', key: 'unidad', width: 22 },
          { header: 'Monto', key: 'monto', width: 16, format: 'currency' },
        ],
      },
      {
        name: 'Resumen',
        data: (data.resumen_por_categoria || []).map(cat => ({
          categoria: LABELS_CATEGORIAS[cat.categoria] || cat.categoria,
          origen: cat.origen === 'operativo' ? 'Operativo' : 'Directo',
          cantidad: cat.cantidad,
          total: cat.total,
        })),
        columns: [
          { header: 'Categoría', key: 'categoria', width: 22 },
          { header: 'Origen', key: 'origen', width: 12 },
          { header: 'Cantidad', key: 'cantidad', width: 10 },
          { header: 'Total', key: 'total', width: 16, format: 'currency' },
        ],
      },
    ]
    exportToExcel({
      filename: `gastos-${MESES[mes - 1].toLowerCase()}-${anio}`,
      sheets,
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header con selector de mes */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gastos del Mes</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Detalle completo de todos los gastos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.gastos?.length > 0 && (
            <ExportButton onClick={handleExportar} />
          )}
          <button
            onClick={irMesAnterior}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-300 min-w-[160px] text-center">
            {MESES[mes - 1]} {anio}
          </span>
          <button
            onClick={irMesSiguiente}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <Wallet className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Gastos Operativos</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(data?.total_gastos_operativos)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data?.cantidad_gastos_operativos || 0} movimientos
          </p>
        </div>
        <div className="card text-center">
          <Wrench className="w-8 h-8 text-orange-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Costos Directos</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(data?.total_costos_directos)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data?.cantidad_costos_directos || 0} movimientos
          </p>
        </div>
        <div className="card text-center bg-red-50 dark:bg-red-950 border-red-200">
          <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">TOTAL GASTOS</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(data?.gran_total)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data?.cantidad_total || 0} movimientos
          </p>
        </div>
      </div>

      {/* Desglose por categoría */}
      {data?.resumen_por_categoria?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Desglose por Categoría
          </h2>
          <div className="space-y-3">
            {data.resumen_por_categoria.map((cat) => {
              const porcentaje = data.gran_total > 0
                ? (cat.total / data.gran_total) * 100
                : 0
              return (
                <button
                  key={`${cat.origen}-${cat.categoria}`}
                  onClick={() => {
                    setFiltroCategoria(
                      filtroCategoria === cat.categoria ? '' : cat.categoria
                    )
                  }}
                  className={clsx(
                    'w-full text-left p-2 rounded-lg transition-colors',
                    filtroCategoria === cat.categoria
                      ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-primary-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'inline-block w-2 h-2 rounded-full',
                        cat.origen === 'operativo' ? 'bg-blue-500' : 'bg-orange-500'
                      )} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {LABELS_CATEGORIAS[cat.categoria] || cat.categoria}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({cat.cantidad})
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={clsx(
                        'h-2 rounded-full transition-all',
                        cat.origen === 'operativo' ? 'bg-blue-500' : 'bg-orange-500'
                      )}
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Operativo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Directo (unidades)
            </span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {['todos', 'operativo', 'directo'].map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltroOrigen(tipo)}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-full transition-colors',
              filtroOrigen === tipo
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            )}
          >
            {tipo === 'todos' ? 'Todos' : tipo === 'operativo' ? 'Operativos' : 'Directos'}
          </button>
        ))}
        {filtroCategoria && (
          <button
            onClick={() => setFiltroCategoria('')}
            className="px-3 py-1.5 text-sm rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 hover:bg-yellow-200"
          >
            {LABELS_CATEGORIAS[filtroCategoria] || filtroCategoria} ✕
          </button>
        )}
      </div>

      {/* Tabla de gastos */}
      <div className="card overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detalle de Gastos ({gastosFiltrados.length})
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No hay gastos en este período</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2 -mx-2">
              {gastosFiltrados.map((g) => (
                <div key={`${g.origen}-${g.id}`} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {LABELS_CATEGORIAS[g.categoria] || g.categoria}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{g.descripcion}</p>
                    </div>
                    <p className="font-semibold text-red-600 dark:text-red-400 text-sm ml-3 whitespace-nowrap">
                      {formatCurrency(g.monto)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">
                      {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit'
                      })}
                    </span>
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium',
                      g.origen === 'operativo'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
                        : 'bg-orange-100 text-orange-700'
                    )}>
                      {g.origen === 'operativo' ? 'Op' : 'Dir'}
                    </span>
                    {g.unidad_descripcion && (
                      <span className="text-gray-400 truncate">{g.unidad_descripcion}</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 font-bold">
                <span className="text-gray-700 dark:text-gray-300">TOTAL</span>
                <span className="text-red-700 dark:text-red-400 text-lg">{formatCurrency(totalFiltrado)}</span>
              </div>
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Fecha</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Categoría</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Descripción</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Unidad</th>
                    <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {gastosFiltrados.map((g) => (
                    <tr key={`${g.origen}-${g.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                          day: '2-digit', month: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          g.origen === 'operativo'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
                            : 'bg-orange-100 text-orange-700'
                        )}>
                          {g.origen === 'operativo' ? (
                            <><Wallet className="w-3 h-3" /> Operativo</>
                          ) : (
                            <><Car className="w-3 h-3" /> Directo</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                        {LABELS_CATEGORIAS[g.categoria] || g.categoria}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                        {g.descripcion}
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {g.unidad_descripcion || '—'}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(g.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800 font-bold">
                    <td colSpan={5} className="px-6 py-3 text-gray-700 dark:text-gray-300 text-right">
                      TOTAL
                    </td>
                    <td className="px-6 py-3 text-right text-red-700 dark:text-red-400 text-lg whitespace-nowrap">
                      {formatCurrency(totalFiltrado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
