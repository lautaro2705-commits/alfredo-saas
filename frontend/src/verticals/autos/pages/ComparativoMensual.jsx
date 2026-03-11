import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportesAPI } from '../services/api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Car,
  Clock,
  ShoppingCart,
  Percent
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

function VariacionBadge({ variacion, invertir = false }) {
  if (!variacion) return null
  const { porcentaje } = variacion
  const esPositivo = invertir ? porcentaje <= 0 : porcentaje >= 0
  const esCero = porcentaje === 0

  if (esCero) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <Minus className="w-3 h-3" />
        0%
      </span>
    )
  }

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      esPositivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    )}>
      {porcentaje > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {porcentaje > 0 ? '+' : ''}{porcentaje}%
    </span>
  )
}

const METRICAS = [
  { key: 'ventas_cantidad', label: 'Ventas (cant.)', icon: ShoppingCart, format: 'number' },
  { key: 'ventas_total', label: 'Ventas ($)', icon: DollarSign, format: 'currency' },
  { key: 'utilidad_bruta', label: 'Utilidad Bruta', icon: TrendingUp, format: 'currency' },
  { key: 'gastos_operativos', label: 'Gastos Operativos', icon: DollarSign, format: 'currency', invertir: true },
  { key: 'gastos_directos', label: 'Costos Directos', icon: DollarSign, format: 'currency', invertir: true },
  { key: 'rentabilidad_neta', label: 'Rentabilidad Neta', icon: DollarSign, format: 'currency' },
  { key: 'ticket_promedio', label: 'Ticket Promedio', icon: DollarSign, format: 'currency' },
  { key: 'margen_promedio', label: 'Margen Promedio', icon: Percent, format: 'percent' },
  { key: 'unidades_ingresadas', label: 'Unidades Ingresadas', icon: Car, format: 'number' },
  { key: 'dias_promedio_venta', label: 'Días Prom. de Venta', icon: Clock, format: 'number', invertir: true },
]

export default function ComparativoMensual() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const { data, isLoading } = useQuery({
    queryKey: ['comparativo-mensual', mes, anio],
    queryFn: async () => {
      const res = await reportesAPI.comparativoMensual({ mes, anio })
      return res.data
    }
  })

  const irMesAnterior = () => {
    if (mes === 1) { setMes(12); setAnio(anio - 1) }
    else setMes(mes - 1)
  }

  const irMesSiguiente = () => {
    if (mes === 12) { setMes(1); setAnio(anio + 1) }
    else setMes(mes + 1)
  }

  const formatValue = (value, format) => {
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percent') return `${value}%`
    return value
  }

  // Datos para el gráfico comparativo
  const chartData = data ? METRICAS
    .filter(m => m.format === 'currency')
    .map(m => ({
      name: m.label.replace(' ($)', '').replace('Gastos ', 'G. '),
      actual: data.mes_actual[m.key],
      anterior: data.mes_anterior[m.key],
    })) : []

  const handleExportar = () => {
    if (!data) return
    exportToExcel({
      filename: `comparativo-${MESES[mes - 1]}-${anio}`,
      sheets: [{
        name: 'Comparativo',
        data: METRICAS.map(m => ({
          metrica: m.label,
          mes_actual: data.mes_actual[m.key],
          mes_anterior: data.mes_anterior[m.key],
          variacion_abs: data.variaciones[m.key]?.absoluta || 0,
          variacion_pct: data.variaciones[m.key]?.porcentaje || 0,
        })),
        columns: [
          { header: 'Métrica', key: 'metrica', width: 25 },
          { header: `${data.mes_actual.nombre_mes} ${data.mes_actual.anio}`, key: 'mes_actual', width: 18 },
          { header: `${data.mes_anterior.nombre_mes} ${data.mes_anterior.anio}`, key: 'mes_anterior', width: 18 },
          { header: 'Variación', key: 'variacion_abs', width: 16 },
          { header: 'Var %', key: 'variacion_pct', width: 10 },
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowLeftRight className="w-7 h-7 text-primary-600" />
              Comparativo Mensual
            </h1>
            <p className="text-gray-500">Comparación mes a mes de métricas clave</p>
          </div>
          {data && <ExportButton onClick={handleExportar} />}
        </div>

        {/* Navegación de meses */}
        <div className="flex items-center gap-3 bg-white rounded-lg border px-4 py-2">
          <button onClick={irMesAnterior} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center">
            {MESES[mes - 1]} {anio}
          </span>
          <button onClick={irMesSiguiente} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !data ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay datos para este período</p>
        </div>
      ) : (
        <>
          {/* Tabla de métricas comparativas */}
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Métrica</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                    {data.mes_actual.nombre_mes} {data.mes_actual.anio}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                    {data.mes_anterior.nombre_mes} {data.mes_anterior.anio}
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {METRICAS.map(m => {
                  const Icon = m.icon
                  return (
                    <tr key={m.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{m.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatValue(data.mes_actual[m.key], m.format)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-600">
                          {formatValue(data.mes_anterior[m.key], m.format)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <VariacionBadge
                          variacion={data.variaciones[m.key]}
                          invertir={m.invertir}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Gráfico comparativo */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparación Visual</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="actual" name={`${data.mes_actual.nombre_mes}`} fill="#3b82f6" />
                <Bar dataKey="anterior" name={`${data.mes_anterior.nombre_mes}`} fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Highlight card - Rentabilidad */}
          <div className={clsx(
            'card border-2',
            data.mes_actual.rentabilidad_neta >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rentabilidad Neta del Mes</p>
                <p className={clsx(
                  'text-3xl font-bold',
                  data.mes_actual.rentabilidad_neta >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(data.mes_actual.rentabilidad_neta)}
                </p>
              </div>
              <VariacionBadge variacion={data.variaciones.rentabilidad_neta} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
