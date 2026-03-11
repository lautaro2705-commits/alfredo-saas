import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportesAPI } from '../services/api'
import {
  Users, DollarSign, TrendingUp, Award, ChevronDown, ChevronUp,
  Calendar, Target, Percent, ArrowUpRight, ArrowDownRight,
  Minus, Equal, Receipt, Building2
} from 'lucide-react'
import clsx from 'clsx'
import ExportButton from '../components/ExportButton'
import { exportToExcel } from '../utils/exportExcel'

// Formatear moneda
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const LABELS_CATEGORIAS = {
  alquiler: 'Alquiler', servicios: 'Servicios', sueldos: 'Sueldos',
  impuestos: 'Impuestos', seguros: 'Seguros', publicidad: 'Publicidad',
  mantenimiento_local: 'Mant. Local', contador: 'Contador', seguridad: 'Seguridad',
  otros_egresos: 'Otros Egresos', retiro_socio: 'Retiro Socio',
  mecanica: 'Mecánica', chapa_pintura: 'Chapa/Pintura', gestoria: 'Gestoría',
  otros: 'Otros', electricidad: 'Electricidad', tapiceria: 'Tapicería',
  neumaticos: 'Neumáticos', cristales: 'Cristales', lavado: 'Lavado',
  combustible: 'Combustible', grua: 'Grúa', vtv: 'VTV',
}

// Componente de tarjeta de estadística
function StatCard({ title, value, icon: Icon, subtitle, trend, color = 'primary' }) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={clsx(
          'flex items-center gap-1 mt-2 text-sm',
          trend >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{Math.abs(trend).toFixed(1)}% vs período anterior</span>
        </div>
      )}
    </div>
  )
}

// Componente de fila expandible de vendedor
function VendedorRow({ vendedor, rank, isExpanded, onToggle }) {
  const medalColors = {
    1: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    2: 'bg-gray-100 text-gray-700 border-gray-300',
    3: 'bg-orange-100 text-orange-700 border-orange-300',
  }

  return (
    <>
      <tr
        className={clsx(
          'hover:bg-gray-50 cursor-pointer transition-colors',
          isExpanded && 'bg-primary-50'
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {rank <= 3 ? (
              <span className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2',
                medalColors[rank]
              )}>
                {rank}
              </span>
            ) : (
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                {rank}
              </span>
            )}
            <span className="font-medium text-gray-900">{vendedor.vendedor_nombre}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {vendedor.cantidad_ventas}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-medium">
          {formatCurrency(vendedor.total_ventas)}
        </td>
        <td className="px-4 py-3 text-right">
          <span className={clsx(
            'font-bold',
            vendedor.total_utilidad >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {formatCurrency(vendedor.total_utilidad)}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
            vendedor.margen_promedio >= 15 ? 'bg-green-100 text-green-800' :
            vendedor.margen_promedio >= 10 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          )}>
            {vendedor.margen_promedio.toFixed(1)}%
          </span>
        </td>
        <td className="px-4 py-3 text-right text-gray-600">
          {formatCurrency(vendedor.comisiones_total)}
        </td>
        <td className="px-4 py-3 text-center">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 mx-auto" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 mx-auto" />
          )}
        </td>
      </tr>

      {/* Detalle expandido */}
      {isExpanded && vendedor.operaciones.length > 0 && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-gray-50">
            <div className="ml-10">
              <p className="text-sm font-medium text-gray-700 mb-2">Detalle de operaciones:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 pr-4">Fecha</th>
                      <th className="text-left py-2 pr-4">Unidad</th>
                      <th className="text-right py-2 pr-4">Precio Venta</th>
                      <th className="text-right py-2 pr-4">Costo</th>
                      <th className="text-right py-2 pr-4">Utilidad</th>
                      <th className="text-right py-2">Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedor.operaciones.map((op) => (
                      <tr key={op.id} className="border-t border-gray-200">
                        <td className="py-2 pr-4 text-gray-600">
                          {new Date(op.fecha).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-medium">{op.unidad}</span>
                          <span className="text-gray-500 ml-2">({op.dominio})</span>
                        </td>
                        <td className="py-2 pr-4 text-right">{formatCurrency(op.precio_venta)}</td>
                        <td className="py-2 pr-4 text-right text-gray-500">{formatCurrency(op.costo_total)}</td>
                        <td className={clsx(
                          'py-2 pr-4 text-right font-medium',
                          op.utilidad >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {formatCurrency(op.utilidad)}
                        </td>
                        <td className="py-2 text-right text-gray-600">{formatCurrency(op.comision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isExpanded && vendedor.operaciones.length === 0 && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-gray-50 text-center text-gray-500 text-sm">
            Sin operaciones en este período
          </td>
        </tr>
      )}
    </>
  )
}

export default function RentabilidadVendedores() {
  // Estado para fechas
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Estado para vendedor expandido
  const [expandedVendedor, setExpandedVendedor] = useState(null)

  // Query de datos
  const { data, isLoading, error } = useQuery({
    queryKey: ['rentabilidad-vendedores', fechaDesde, fechaHasta],
    queryFn: async () => {
      const res = await reportesAPI.rentabilidadVendedores({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      })
      return res.data
    },
    enabled: !!fechaDesde && !!fechaHasta
  })

  // Períodos rápidos
  const setPeriodo = (tipo) => {
    const hoy = new Date()
    let desde = new Date()

    switch (tipo) {
      case 'semana':
        desde.setDate(hoy.getDate() - 7)
        break
      case 'mes':
        desde.setMonth(hoy.getMonth() - 1)
        break
      case 'trimestre':
        desde.setMonth(hoy.getMonth() - 3)
        break
      case 'anio':
        desde.setFullYear(hoy.getFullYear() - 1)
        break
      case 'este-mes':
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        break
      case 'este-anio':
        desde = new Date(hoy.getFullYear(), 0, 1)
        break
    }

    setFechaDesde(desde.toISOString().split('T')[0])
    setFechaHasta(hoy.toISOString().split('T')[0])
  }

  const handleExportar = () => {
    if (!data) return
    const sheets = []
    // Hoja P&L
    if (data.rentabilidad) {
      const r = data.rentabilidad
      sheets.push({
        name: 'Rentabilidad',
        data: [
          { concepto: 'Utilidad Bruta', monto: r.utilidad_bruta },
          { concepto: '(-) Gastos Operativos', monto: -r.gastos_operativos },
          { concepto: '(-) Comisiones', monto: -r.comisiones },
          { concepto: '= RENTABILIDAD NETA', monto: r.rentabilidad_neta },
          { concepto: 'Margen Neto %', monto: r.margen_neto },
        ],
        columns: [
          { header: 'Concepto', key: 'concepto', width: 28 },
          { header: 'Monto', key: 'monto', width: 18, format: 'currency' },
        ],
      })
    }
    // Hoja Vendedores
    if (data.vendedores?.length) {
      sheets.push({
        name: 'Vendedores',
        data: data.vendedores.map(v => ({
          vendedor: v.nombre,
          ventas: v.cantidad_ventas,
          total_ventas: v.total_ventas,
          utilidad: v.utilidad_bruta,
          margen: v.margen_promedio,
          ticket: v.ticket_promedio,
          comision: v.comision_total,
        })),
        columns: [
          { header: 'Vendedor', key: 'vendedor', width: 22 },
          { header: 'Ventas', key: 'ventas', width: 10 },
          { header: 'Total Ventas', key: 'total_ventas', width: 18, format: 'currency' },
          { header: 'Utilidad', key: 'utilidad', width: 18, format: 'currency' },
          { header: 'Margen %', key: 'margen', width: 12 },
          { header: 'Ticket Prom.', key: 'ticket', width: 18, format: 'currency' },
          { header: 'Comisión', key: 'comision', width: 16, format: 'currency' },
        ],
      })
    }
    exportToExcel({ filename: `rentabilidad-${fechaDesde}-a-${fechaHasta}`, sheets })
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        Error al cargar el reporte: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rentabilidad por Vendedor</h1>
            <p className="text-gray-500 text-sm mt-1">Análisis de desempeño y utilidad por vendedor</p>
          </div>
          {data && <ExportButton onClick={handleExportar} />}
        </div>

        {/* Selector de período */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPeriodo('semana')} className="btn btn-secondary text-xs px-3 py-1">
            7 días
          </button>
          <button onClick={() => setPeriodo('mes')} className="btn btn-secondary text-xs px-3 py-1">
            30 días
          </button>
          <button onClick={() => setPeriodo('este-mes')} className="btn btn-secondary text-xs px-3 py-1">
            Este mes
          </button>
          <button onClick={() => setPeriodo('trimestre')} className="btn btn-secondary text-xs px-3 py-1">
            Trimestre
          </button>
          <button onClick={() => setPeriodo('este-anio')} className="btn btn-secondary text-xs px-3 py-1">
            Este año
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Vendedores"
              value={data.vendedores.length}
              icon={Users}
              subtitle={`${data.vendedores.filter(v => v.cantidad_ventas > 0).length} con ventas`}
              color="blue"
            />
            <StatCard
              title="Total Ventas"
              value={formatCurrency(data.total_general.total_ventas)}
              icon={DollarSign}
              subtitle={`${data.total_general.cantidad_ventas} operaciones`}
              color="primary"
            />
            <StatCard
              title="Utilidad Total"
              value={formatCurrency(data.total_general.total_utilidad)}
              icon={TrendingUp}
              subtitle={`${data.total_general.total_ventas > 0 ? ((data.total_general.total_utilidad / data.total_general.total_ventas) * 100).toFixed(1) : 0}% margen`}
              color="green"
            />
            <StatCard
              title="Comisiones Pagadas"
              value={formatCurrency(data.total_general.comisiones_pagadas)}
              icon={Award}
              subtitle="Total del período"
              color="purple"
            />
          </div>

          {/* Rentabilidad del Negocio */}
          {data.rentabilidad && (
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Rentabilidad del Negocio</h2>
                  <p className="text-sm text-gray-500">Utilidad bruta menos gastos operativos y comisiones</p>
                </div>
              </div>

              {/* P&L Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {/* Utilidad Bruta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">Utilidad Bruta de Ventas</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(data.rentabilidad.utilidad_bruta)}
                  </span>
                </div>

                <div className="border-t border-gray-200" />

                {/* Gastos Operativos */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-600">Gastos Operativos</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    - {formatCurrency(data.rentabilidad.gastos_operativos)}
                  </span>
                </div>

                {/* Comisiones */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-600">Comisiones Vendedores</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    - {formatCurrency(data.rentabilidad.comisiones)}
                  </span>
                </div>

                <div className="border-t-2 border-gray-300" />

                {/* Rentabilidad Neta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Equal className="w-4 h-4 text-gray-700" />
                    <span className="text-base font-bold text-gray-900">RENTABILIDAD NETA</span>
                  </div>
                  <div className="text-right">
                    <span className={clsx(
                      'text-2xl font-bold',
                      data.rentabilidad.rentabilidad_neta >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(data.rentabilidad.rentabilidad_neta)}
                    </span>
                    <span className={clsx(
                      'ml-2 text-sm font-medium px-2 py-0.5 rounded',
                      data.rentabilidad.margen_neto >= 10 ? 'bg-green-100 text-green-700' :
                      data.rentabilidad.margen_neto >= 5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {data.rentabilidad.margen_neto}%
                    </span>
                  </div>
                </div>

                {/* Info: costos directos ya incluidos */}
                <p className="text-xs text-gray-400 mt-2">
                  * Los costos directos ({formatCurrency(data.rentabilidad.costos_directos_periodo)}) ya están incluidos en el costo de cada unidad vendida
                </p>
              </div>

              {/* Desglose de gastos operativos */}
              {data.rentabilidad.desglose_gastos?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Desglose de gastos del período:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {data.rentabilidad.desglose_gastos
                      .filter(g => g.origen === 'operativo')
                      .map((g) => (
                        <div key={g.categoria} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-600 truncate mr-2">
                            {LABELS_CATEGORIAS[g.categoria] || g.categoria}
                          </span>
                          <span className="text-xs font-semibold text-red-600 whitespace-nowrap">
                            {formatCurrency(g.total)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla de vendedores */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Ranking de Vendedores</h2>
              <p className="text-sm text-gray-500">Ordenado por utilidad generada</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendedor
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ventas
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Facturado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilidad
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margen
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comisiones
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.vendedores.map((vendedor, index) => (
                    <VendedorRow
                      key={vendedor.vendedor_id}
                      vendedor={vendedor}
                      rank={index + 1}
                      isExpanded={expandedVendedor === vendedor.vendedor_id}
                      onToggle={() => setExpandedVendedor(
                        expandedVendedor === vendedor.vendedor_id ? null : vendedor.vendedor_id
                      )}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {data.vendedores.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No hay datos de ventas para el período seleccionado
              </div>
            )}
          </div>

          {/* Resumen por métricas */}
          {data.vendedores.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              {/* Mejor vendedor por utilidad */}
              <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-green-800">Mayor Utilidad</span>
                </div>
                <p className="text-xl font-bold text-green-900">{data.vendedores[0]?.vendedor_nombre || '-'}</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {formatCurrency(data.vendedores[0]?.total_utilidad || 0)}
                </p>
              </div>

              {/* Más ventas */}
              <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-blue-800">Más Ventas</span>
                </div>
                {(() => {
                  const masVentas = [...data.vendedores].sort((a, b) => b.cantidad_ventas - a.cantidad_ventas)[0]
                  return (
                    <>
                      <p className="text-xl font-bold text-blue-900">{masVentas?.vendedor_nombre || '-'}</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {masVentas?.cantidad_ventas || 0} operaciones
                      </p>
                    </>
                  )
                })()}
              </div>

              {/* Mejor margen */}
              <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Percent className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-purple-800">Mejor Margen</span>
                </div>
                {(() => {
                  const mejorMargen = [...data.vendedores]
                    .filter(v => v.cantidad_ventas > 0)
                    .sort((a, b) => b.margen_promedio - a.margen_promedio)[0]
                  return (
                    <>
                      <p className="text-xl font-bold text-purple-900">{mejorMargen?.vendedor_nombre || '-'}</p>
                      <p className="text-2xl font-bold text-purple-700 mt-1">
                        {mejorMargen?.margen_promedio.toFixed(1) || 0}%
                      </p>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
