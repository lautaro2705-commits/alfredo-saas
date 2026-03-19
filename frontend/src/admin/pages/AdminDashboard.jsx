import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminAPI, saveAuthData } from '@/core/services/api'
import toast from 'react-hot-toast'
import {
  Building2, Users, TrendingUp, DollarSign,
  Search, Eye, Power, UserCheck, ArrowLeft,
  BarChart3, ChevronRight,
} from 'lucide-react'

// ── Metric Card ──

function MetricCard({ label, value, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ── Status badge ──

function PlanBadge({ plan }) {
  const styles = {
    trial: 'bg-gray-100 text-gray-700',
    basico: 'bg-blue-100 text-blue-700',
    profesional: 'bg-purple-100 text-purple-700',
    premium: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      styles[plan] || 'bg-gray-100 text-gray-700'
    }`}>
      {plan}
    </span>
  )
}

// ── Tenant Detail Panel ──

function TenantDetailPanel({ tenantId, onClose, onImpersonate }) {
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin-tenant', tenantId],
    queryFn: () => adminAPI.getTenant(tenantId).then((r) => r.data),
  })

  const toggleActive = async () => {
    if (!tenant) return
    const action = tenant.activa ? 'desactivar' : 'activar'
    if (!confirm(`¿${action} tenant "${tenant.nombre}"?`)) return

    try {
      await adminAPI.updateTenant(tenantId, { activa: !tenant.activa })
      toast.success(`Tenant ${tenant.activa ? 'desactivado' : 'activado'}`)
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!tenant) return null

  return (
    <div className="bg-white rounded-xl border">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{tenant.nombre}</h2>
              <p className="text-sm text-gray-500">
                {tenant.email_contacto} {tenant.cuit && `| CUIT: ${tenant.cuit}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlanBadge plan={tenant.plan} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              tenant.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {tenant.activa ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b">
        <div>
          <p className="text-xs text-gray-500 uppercase">Vertical</p>
          <p className="font-medium capitalize">{tenant.vertical}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Usuarios</p>
          <p className="font-medium">{tenant.users.length} / {tenant.max_usuarios}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Items</p>
          <p className="font-medium">{tenant.item_count} / {tenant.max_items}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Creado</p>
          <p className="font-medium">
            {tenant.created_at
              ? new Date(tenant.created_at).toLocaleDateString('es-AR')
              : '-'}
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="p-6 border-b">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
          Usuarios ({tenant.users.length})
        </h3>
        {tenant.users.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Rol</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Ultimo login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenant.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-medium text-gray-900">
                    {u.nombre} {u.apellido}
                  </td>
                  <td className="py-2 text-gray-600">{u.email}</td>
                  <td className="py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-medium">
                      {u.rol}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${
                      u.activo ? 'bg-green-500' : 'bg-red-400'
                    }`} />
                  </td>
                  <td className="py-2 text-gray-500">
                    {u.last_login
                      ? new Date(u.last_login).toLocaleDateString('es-AR')
                      : 'Nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Sin usuarios</p>
        )}
      </div>

      {/* Subscription info */}
      {tenant.subscription && (
        <div className="p-6 border-b">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
            Suscripcion
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Plan</p>
              <p className="font-medium">{tenant.subscription.plan}</p>
            </div>
            <div>
              <p className="text-gray-500">Estado</p>
              <p className="font-medium">{tenant.subscription.status}</p>
            </div>
            <div>
              <p className="text-gray-500">Monto</p>
              <p className="font-medium">
                {tenant.subscription.amount
                  ? `$${tenant.subscription.amount.toLocaleString('es-AR')} ${tenant.subscription.currency}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">MP ID</p>
              <p className="font-mono text-xs text-gray-600">
                {tenant.subscription.mp_preapproval_id || '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-6 flex gap-3">
        <button
          onClick={() => onImpersonate(tenantId)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg
                     hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <UserCheck className="h-4 w-4" />
          Impersonar
        </button>
        <button
          onClick={toggleActive}
          className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
            tenant.activa
              ? 'text-red-600 border border-red-200 hover:bg-red-50'
              : 'text-green-600 border border-green-200 hover:bg-green-50'
          }`}
        >
          <Power className="h-4 w-4" />
          {tenant.activa ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ──

export default function AdminDashboard() {
  const [search, setSearch] = useState('')
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [filters, setFilters] = useState({})

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => adminAPI.getMetrics().then((r) => r.data),
    refetchInterval: 60_000, // refresh every minute
  })

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['admin-tenants', filters],
    queryFn: () => adminAPI.getTenants({ ...filters, search: search || undefined }).then((r) => r.data),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    // Trigger refetch with search term
    setFilters((f) => ({ ...f, _t: Date.now() }))
  }

  const handleImpersonate = async (tenantId) => {
    if (!confirm('¿Impersonar este tenant? Se generara un token temporal de 1 hora.')) {
      return
    }
    try {
      const res = await adminAPI.impersonate(tenantId)
      const data = res.data

      // Save impersonation token
      saveAuthData({
        access_token: data.access_token,
        tenant_id: data.tenant_id,
        tenant_name: data.tenant_name,
        vertical: data.vertical,
        plan: data.plan,
        rol: 'admin',
      })

      toast.success(data.message)
      // Reload to apply new token
      window.location.href = '/'
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al impersonar')
    }
  }

  // Show tenant detail
  if (selectedTenant) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <TenantDetailPanel
          tenantId={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onImpersonate={handleImpersonate}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* KPI cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Tenants totales"
            value={metrics.total_tenants}
            icon={Building2}
            color="blue"
          />
          <MetricCard
            label="Pagando"
            value={metrics.paying_tenants}
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            label="En trial"
            value={metrics.trial_tenants}
            icon={TrendingUp}
            color="amber"
          />
          <MetricCard
            label="Usuarios totales"
            value={metrics.total_users}
            icon={Users}
            color="purple"
          />
        </div>
      )}

      {/* Revenue + MRR + breakdown */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
            <p className="text-sm text-green-600 font-medium">MRR Estimado</p>
            <p className="text-2xl font-bold text-green-700 mt-1">
              ${(metrics.mrr_estimated || 0).toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-green-500 mt-1">Ingreso mensual recurrente</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Revenue cobrado</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ${metrics.total_revenue_ars.toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-gray-400 mt-1">ARS acumulado real</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Signups ultimos 7 dias</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {metrics.recent_signups}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Por plan</p>
            <div className="mt-2 space-y-1">
              {Object.entries(metrics.tenants_by_plan || {}).map(([plan, count]) => (
                <div key={plan} className="flex justify-between text-sm">
                  <span className="capitalize text-gray-700">{plan}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tenant list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Tenants</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email, CUIT..."
                className="pl-9 pr-4 py-2 border rounded-lg text-sm w-72
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <select
              className="border rounded-lg text-sm px-3 py-2 text-gray-700"
              onChange={(e) => setFilters((f) => ({
                ...f,
                plan: e.target.value || undefined,
              }))}
            >
              <option value="">Todos los planes</option>
              <option value="trial">Trial</option>
              <option value="basico">Basico</option>
              <option value="profesional">Profesional</option>
              <option value="premium">Premium</option>
            </select>
          </form>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          {tenantsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : tenantsData?.tenants?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No se encontraron tenants
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Agencia
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Vertical
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Usuarios
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Items
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Alta
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenantsData?.tenants?.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedTenant(t.id)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{t.nombre}</p>
                        <p className="text-xs text-gray-500">{t.email_contacto}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm capitalize text-gray-700">{t.vertical}</span>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={t.plan} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {t.user_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {t.item_count}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`w-2 h-2 rounded-full inline-block ${
                        t.activa ? 'bg-green-500' : 'bg-red-400'
                      }`} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString('es-AR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
