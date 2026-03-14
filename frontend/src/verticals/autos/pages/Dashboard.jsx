import { useQuery } from '@tanstack/react-query'
import { dashboardAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import {
  Car,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Clock,
  Users,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  FileText,
  Calendar,
  CalendarCheck
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'
import { DashboardSkeleton } from '../components/Skeletons'

function StatCard({ title, value, subtitle, icon: Icon, color = 'primary', link }) {
  const colors = {
    primary: 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  }

  const content = (
    <>
      <div className={clsx('p-3 rounded-xl', colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {link && <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
    </>
  )

  if (link) {
    return (
      <Link to={link} className="card flex items-center gap-4 hover:border-primary-300 dark:hover:border-primary-600 transition-all">
        {content}
      </Link>
    )
  }

  return <div className="card flex items-center gap-4">{content}</div>
}

function AlertItem({ alerta }) {
  const prioridadColors = {
    alta: 'border-red-500 bg-red-50 dark:bg-red-950/40',
    media: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/40',
    baja: 'border-primary-500 bg-primary-50 dark:bg-primary-950/40',
  }

  const tipoIcons = {
    cheque_por_cobrar: CreditCard,
    cheque_por_pagar: CreditCard,
    inmovilizado: Clock,
    documentacion_pendiente: FileText,
    vtv_vencimiento: Calendar,
    seguimiento_pendiente: CalendarCheck,
  }

  const Icon = tipoIcons[alerta.tipo] || AlertTriangle

  // Determinar link basado en tipo de alerta
  const linkTo = alerta.link || (alerta.unidad_id ? `/unidades/${alerta.unidad_id}` : '/unidades')

  return (
    <Link
      to={linkTo}
      className={clsx(
        'flex items-start gap-3 p-3 rounded-lg border-l-4 hover:opacity-80 transition-opacity',
        prioridadColors[alerta.prioridad]
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white text-sm">{alerta.mensaje}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{alerta.unidad_info}</p>
      </div>
    </Link>
  )
}

function VariacionBadge({ valor, tipo = 'cantidad' }) {
  if (valor === 0 || valor === undefined) return null

  const isPositive = valor > 0
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight
  const colorClass = isPositive
    ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40'
    : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/40'

  const formatted = tipo === 'dinero'
    ? `${isPositive ? '+' : ''}$${Math.abs(valor).toLocaleString('es-AR')}`
    : `${isPositive ? '+' : ''}${valor}`

  return (
    <span className={clsx('inline-flex items-center text-xs px-1.5 py-0.5 rounded-full', colorClass)}>
      <Icon className="w-3 h-3 mr-0.5" />
      {formatted}
    </span>
  )
}

// Get greeting based on time of day
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos dias'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function Dashboard() {
  const { isAdmin, user } = useAuth()

  const { data: resumen, isLoading, error } = useQuery({
    queryKey: ['dashboard-resumen'],
    queryFn: async () => {
      const res = await dashboardAPI.resumen()
      return res.data
    },
    refetchInterval: 60000,
    retry: 2,
  })

  const { data: metricas } = useQuery({
    queryKey: ['dashboard-metricas'],
    queryFn: async () => {
      const res = await dashboardAPI.metricasRapidas()
      return res.data
    },
    retry: 2,
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Error al cargar el dashboard</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">No se pudieron obtener los datos. Intenta recargar la pagina.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          Recargar
        </button>
      </div>
    )
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header with Alfredo greeting */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {user?.nombre || 'Usuario'}
        </h1>
        <p className="text-primary-100 mt-1">
          Soy Alfredo, tu asistente de gestion. Que operacion realizaremos hoy?
        </p>
        <p className="text-primary-200 text-sm mt-2">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Stock Total"
          value={resumen?.stock?.total_unidades || 0}
          subtitle={`${resumen?.stock?.disponibles || 0} disponibles`}
          icon={Car}
          color="primary"
          link="/unidades"
        />
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Ventas del Mes</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumen?.ventas_mes?.cantidad || 0}</p>
              <VariacionBadge valor={resumen?.ventas_mes?.variacion_cantidad} tipo="cantidad" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatCurrency(resumen?.ventas_mes?.ingresos)}</p>
          </div>
          <Link to="/operaciones"><ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" /></Link>
        </div>
        <StatCard
          title="Caja Hoy"
          value={formatCurrency(resumen?.caja_hoy?.saldo)}
          subtitle={`+${formatCurrency(resumen?.caja_hoy?.ingresos)} | -${formatCurrency(resumen?.caja_hoy?.egresos)}`}
          icon={DollarSign}
          color={resumen?.caja_hoy?.saldo >= 0 ? 'green' : 'red'}
          link="/caja"
        />
        {isAdmin && (
          <StatCard
            title="Utilidad del Mes"
            value={formatCurrency(resumen?.ventas_mes?.utilidad_bruta)}
            subtitle={`Gastos: ${formatCurrency(resumen?.ventas_mes?.gastos_mes)}`}
            icon={TrendingUp}
            color="green"
            link="/reportes"
          />
        )}
        {!isAdmin && (
          <StatCard
            title="En Proceso"
            value={metricas?.operaciones_en_proceso || 0}
            subtitle="Operaciones activas"
            icon={Clock}
            color="yellow"
            link="/operaciones"
          />
        )}
      </div>

      {/* Cheques - si hay pendientes */}
      {(resumen?.cheques?.por_cobrar_7_dias > 0 || resumen?.cheques?.por_pagar_7_dias > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <Link to="/cheques" className="card flex items-center gap-4 hover:border-primary-300 transition-all bg-primary-50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-800">
            <div className="p-3 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-primary-600 dark:text-primary-400">Cheques por cobrar (7 dias)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{resumen?.cheques?.por_cobrar_7_dias || 0}</p>
              <p className="text-xs text-primary-600 dark:text-primary-400">{formatCurrency(resumen?.cheques?.monto_por_cobrar)}</p>
            </div>
          </Link>
          <Link to="/cheques" className="card flex items-center gap-4 hover:border-orange-300 transition-all bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800">
            <div className="p-3 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-600 dark:text-orange-400">Cheques por pagar (7 dias)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{resumen?.cheques?.por_pagar_7_dias || 0}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400">{formatCurrency(resumen?.cheques?.monto_por_pagar)}</p>
            </div>
          </Link>
        </div>
      )}

      {/* Seguimientos pendientes */}
      {resumen?.seguimientos_pendientes > 0 && (
        <Link
          to="/agenda"
          className="card flex items-center gap-4 hover:border-orange-300 transition-all bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800"
        >
          <div className="p-3 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-orange-600 dark:text-orange-400">Tareas Pendientes</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{resumen.seguimientos_pendientes}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400">Para hoy o vencidas → ver agenda</p>
          </div>
          <ArrowRight className="w-5 h-5 text-orange-400" />
        </Link>
      )}

      {/* Metricas rapidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{metricas?.ventas_7_dias || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ventas ultima semana</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{metricas?.unidades_nuevas_semana || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ingresos esta semana</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{resumen?.stock?.inmovilizadas || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Stock inmovilizado</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{metricas?.total_clientes || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Clientes registrados</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Alertas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Alertas Activas
            </h2>
            <span className="badge badge-warning">{resumen?.alertas?.length || 0}</span>
          </div>

          {resumen?.alertas?.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay alertas activas. Todo en orden.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {resumen?.alertas?.slice(0, 8).map((alerta, i) => (
                <AlertItem key={i} alerta={alerta} />
              ))}
            </div>
          )}
        </div>

        {/* Ultimas ventas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ultimas Ventas</h2>
            <Link to="/operaciones" className="text-primary-600 dark:text-primary-400 text-sm hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
              Ver todas
            </Link>
          </div>

          {resumen?.ultimas_ventas?.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay ventas recientes</p>
          ) : (
            <div className="space-y-3">
              {resumen?.ultimas_ventas?.map((venta) => (
                <Link
                  key={venta.id}
                  to={`/operaciones`}
                  className="block p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{venta.unidad}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{venta.cliente}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(venta.monto)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(venta.fecha), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Acciones rapidas - solo movil */}
      <div className="lg:hidden grid grid-cols-2 gap-4">
        <Link
          to="/unidades/nuevo"
          className="card flex flex-col items-center justify-center py-6 text-center hover:border-primary-300 dark:hover:border-primary-600 transition-all"
        >
          <Car className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-2" />
          <span className="font-medium text-gray-900 dark:text-white">Nueva Unidad</span>
        </Link>
        <Link
          to="/costo-rapido"
          className="card flex flex-col items-center justify-center py-6 text-center hover:border-primary-300 dark:hover:border-primary-600 transition-all"
        >
          <DollarSign className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-2" />
          <span className="font-medium text-gray-900 dark:text-white">Cargar Gasto</span>
        </Link>
      </div>
    </div>
  )
}
