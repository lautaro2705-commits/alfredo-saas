import { useQuery } from '@tanstack/react-query'
import { reportesAPI } from '../services/api'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Car,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'

const RANGE_COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
}

const RANGE_BG = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  red: 'bg-red-100 text-red-700 border-red-200',
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value || 0)

export default function AntiguedadStock() {
  const navigate = useNavigate()
  const [expandedRange, setExpandedRange] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['antiguedad-stock'],
    queryFn: async () => {
      const res = await reportesAPI.antiguedadStock()
      return res.data
    }
  })

  const chartData = data?.rangos?.map(r => ({
    name: r.label,
    cantidad: r.cantidad,
    inversion: r.valor_costo,
    color: RANGE_COLORS[r.color],
  })) || []

  const handleExportar = () => {
    if (!data?.rangos) return
    const allUnidades = data.rangos.flatMap(r =>
      r.unidades.map(u => ({
        rango: r.label,
        unidad: `${u.marca} ${u.modelo} ${u.anio}`,
        dominio: u.dominio,
        estado: u.estado,
        dias_en_stock: u.dias_en_stock,
        costo_total: u.costo_total,
        precio_publicado: u.precio_publicado || 0,
        fecha_ingreso: u.fecha_ingreso || '',
      }))
    )
    exportToExcel({
      filename: 'antiguedad-stock',
      sheets: [{
        name: 'Antigüedad',
        data: allUnidades,
        columns: [
          { header: 'Rango', key: 'rango', width: 15 },
          { header: 'Unidad', key: 'unidad', width: 25 },
          { header: 'Dominio', key: 'dominio', width: 12 },
          { header: 'Estado', key: 'estado', width: 12 },
          { header: 'Días', key: 'dias_en_stock', width: 8 },
          { header: 'Costo', key: 'costo_total', width: 16, format: 'currency' },
          { header: 'Publicado', key: 'precio_publicado', width: 16, format: 'currency' },
          { header: 'Ingreso', key: 'fecha_ingreso', width: 12 },
        ],
      }],
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const resumen = data?.resumen || {}

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-7 h-7 text-primary-600" />
              Antigüedad del Stock
            </h1>
            <p className="text-gray-500">Análisis de envejecimiento del inventario</p>
          </div>
          <ExportButton onClick={handleExportar} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-500">Total Unidades</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{resumen.total_unidades || 0}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-500">Promedio Días</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{resumen.promedio_dias || 0}</p>
          <p className="text-xs text-gray-400">Mediana: {resumen.mediana_dias || 0}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-500">Inversión Total</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(resumen.inversion_total)}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-gray-500">Más Antiguo</span>
          </div>
          {resumen.unidad_mas_antigua ? (
            <>
              <p className="text-lg font-bold text-red-600">{resumen.unidad_mas_antigua.dias_en_stock}d</p>
              <p className="text-xs text-gray-500 truncate">
                {resumen.unidad_mas_antigua.marca} {resumen.unidad_mas_antigua.modelo}
              </p>
            </>
          ) : (
            <p className="text-gray-400">-</p>
          )}
        </div>
      </div>

      {/* Gráfico */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Antigüedad</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(value, name) => [
                name === 'inversion' ? formatCurrency(value) : value,
                name === 'inversion' ? 'Inversión' : 'Unidades'
              ]}
            />
            <Bar dataKey="cantidad" name="Unidades">
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rangos expandibles */}
      <div className="space-y-3">
        {data?.rangos?.map(rango => (
          <div key={rango.key} className="card">
            <button
              onClick={() => setExpandedRange(expandedRange === rango.key ? null : rango.key)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className={clsx('px-3 py-1 rounded-full text-sm font-medium border', RANGE_BG[rango.color])}>
                  {rango.label}
                </span>
                <span className="text-lg font-bold text-gray-900">{rango.cantidad}</span>
                <span className="text-sm text-gray-500">unidades</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 hidden sm:block">
                  {formatCurrency(rango.valor_costo)}
                </span>
                {expandedRange === rango.key ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {expandedRange === rango.key && rango.unidades.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Unidad</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Dominio</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Días</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Costo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Publicado</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rango.unidades.map(u => (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/unidades/${u.id}`)}
                      >
                        <td className="px-3 py-2 font-medium">{u.marca} {u.modelo} {u.anio}</td>
                        <td className="px-3 py-2 text-gray-600">{u.dominio}</td>
                        <td className={clsx(
                          'px-3 py-2 text-right font-semibold',
                          u.dias_en_stock > 60 ? 'text-red-600' : u.dias_en_stock > 30 ? 'text-yellow-600' : 'text-green-600'
                        )}>
                          {u.dias_en_stock}d
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(u.costo_total)}</td>
                        <td className="px-3 py-2 text-right">{u.precio_publicado ? formatCurrency(u.precio_publicado) : '-'}</td>
                        <td className="px-3 py-2">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            u.estado === 'disponible' ? 'bg-green-100 text-green-700' :
                            u.estado === 'reservado' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {u.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
