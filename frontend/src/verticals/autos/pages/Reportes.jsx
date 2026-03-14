import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportesAPI, cajaAPI } from '../services/api'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Car,
  Calendar,
  FileText
} from 'lucide-react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Reportes() {
  const [periodo, setPeriodo] = useState('mes')
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [fechaHasta, setFechaHasta] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const { data: reporteUtilidad, isLoading } = useQuery({
    queryKey: ['reporte-utilidad', fechaDesde, fechaHasta],
    queryFn: async () => {
      const res = await reportesAPI.utilidad({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      })
      return res.data
    },
  })

  const { data: reporteStock } = useQuery({
    queryKey: ['reporte-stock'],
    queryFn: async () => {
      const res = await reportesAPI.stock()
      return res.data
    },
  })

  const { data: ventasMensuales } = useQuery({
    queryKey: ['ventas-mensuales', new Date().getFullYear()],
    queryFn: async () => {
      const res = await reportesAPI.ventasMensuales(new Date().getFullYear())
      return res.data
    },
  })

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  const handlePeriodoChange = (p) => {
    setPeriodo(p)
    const hoy = new Date()
    if (p === 'mes') {
      setFechaDesde(format(startOfMonth(hoy), 'yyyy-MM-dd'))
      setFechaHasta(format(endOfMonth(hoy), 'yyyy-MM-dd'))
    } else if (p === 'trimestre') {
      setFechaDesde(format(subMonths(startOfMonth(hoy), 2), 'yyyy-MM-dd'))
      setFechaHasta(format(endOfMonth(hoy), 'yyyy-MM-dd'))
    } else if (p === 'anio') {
      setFechaDesde(`${hoy.getFullYear()}-01-01`)
      setFechaHasta(`${hoy.getFullYear()}-12-31`)
    }
  }

  const handleExportar = () => {
    if (!reporteUtilidad?.unidades_vendidas?.length) return
    exportToExcel({
      filename: `ventas-${fechaDesde}-a-${fechaHasta}`,
      sheets: [{
        name: 'Ventas',
        data: reporteUtilidad.unidades_vendidas.map(u => ({
          unidad: `${u.marca} ${u.modelo}`,
          dominio: u.dominio,
          fecha: u.fecha_venta,
          costo: u.costo_total,
          venta: u.precio_venta,
          utilidad: u.utilidad_bruta,
          margen: u.margen_porcentaje,
        })),
        columns: [
          { header: 'Unidad', key: 'unidad', width: 25 },
          { header: 'Dominio', key: 'dominio', width: 12 },
          { header: 'Fecha', key: 'fecha', width: 12 },
          { header: 'Costo', key: 'costo', width: 16, format: 'currency' },
          { header: 'Venta', key: 'venta', width: 16, format: 'currency' },
          { header: 'Utilidad', key: 'utilidad', width: 16, format: 'currency' },
          { header: 'Margen %', key: 'margen', width: 10 },
        ],
      }],
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
            <p className="text-gray-500 dark:text-gray-400">Análisis de utilidad y rendimiento</p>
          </div>
          {reporteUtilidad?.unidades_vendidas?.length > 0 && (
            <ExportButton onClick={handleExportar} />
          )}
        </div>
        <div className="flex gap-2">
          {['mes', 'trimestre', 'anio'].map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodoChange(p)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                periodo === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              )}
            >
              {p === 'mes' ? 'Mes' : p === 'trimestre' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de fechas */}
      <div className="card flex flex-wrap items-center gap-4">
        <Calendar className="w-5 h-5 text-gray-400" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="input w-auto"
          />
          <span className="text-gray-500 dark:text-gray-400">a</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="input w-auto"
          />
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Ventas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {reporteUtilidad?.cantidad_ventas || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatCurrency(reporteUtilidad?.total_ventas)}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Costos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(
              (reporteUtilidad?.total_costo_adquisicion || 0) +
              (reporteUtilidad?.total_costos_directos || 0)
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adq: {formatCurrency(reporteUtilidad?.total_costo_adquisicion)}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Utilidad Bruta</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(reporteUtilidad?.utilidad_bruta_total)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Margen: {reporteUtilidad?.margen_bruto_promedio || 0}%
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Utilidad Neta</span>
          </div>
          <p className={clsx(
            'text-2xl font-bold',
            (reporteUtilidad?.utilidad_neta || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {formatCurrency(reporteUtilidad?.utilidad_neta)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gastos fijos: {formatCurrency(reporteUtilidad?.total_gastos_fijos)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de ventas mensuales */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ventas Mensuales</h3>
          {ventasMensuales?.meses && (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ventasMensuales.meses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="mes"
                  tickFormatter={(v) => ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][v - 1]}
                />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(v) => ventasMensuales.meses[v - 1]?.nombre_mes}
                />
                <Bar dataKey="total_ventas" fill="#3b82f6" name="Ventas" />
                <Bar dataKey="utilidad_bruta" fill="#10b981" name="Utilidad" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribución de stock */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Estado del Stock</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Disponibles: {reporteStock?.unidades_disponibles}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm">Reservados: {reporteStock?.unidades_reservadas}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">En reparación: {reporteStock?.unidades_en_reparacion}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm">Inmovilizados: {reporteStock?.unidades_inmovilizadas}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {reporteStock?.total_unidades}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">unidades</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-2">
                {formatCurrency(reporteStock?.valor_stock_costo)}
              </p>
              <p className="text-xs text-gray-400">inversión total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle de unidades vendidas */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Detalle de Ventas del Período
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : reporteUtilidad?.unidades_vendidas?.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay ventas en este período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Unidad</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Fecha</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Costo</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Venta</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Utilidad</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reporteUtilidad?.unidades_vendidas?.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2">
                      <p className="font-medium">{u.marca} {u.modelo}</p>
                      <p className="text-xs text-gray-500">{u.dominio}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {format(new Date(u.fecha_venta), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(u.costo_total)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(u.precio_venta)}
                    </td>
                    <td className={clsx(
                      'px-3 py-2 text-right font-semibold',
                      u.utilidad_bruta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {formatCurrency(u.utilidad_bruta)}
                    </td>
                    <td className={clsx(
                      'px-3 py-2 text-right',
                      u.margen_porcentaje >= 10 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                    )}>
                      {u.margen_porcentaje}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold">
                <tr>
                  <td colSpan="2" className="px-3 py-2">TOTALES</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(
                      (reporteUtilidad?.total_costo_adquisicion || 0) +
                      (reporteUtilidad?.total_costos_directos || 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(reporteUtilidad?.total_ventas)}
                  </td>
                  <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                    {formatCurrency(reporteUtilidad?.utilidad_bruta_total)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {reporteUtilidad?.margen_bruto_promedio}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
