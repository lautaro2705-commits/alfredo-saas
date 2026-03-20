import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/core/context/AuthContext'

// ── Eager imports: shell + auth (always needed on first load) ──
import Login from '@/core/pages/Login'
import Onboarding from '@/core/pages/Onboarding'
import AutosLayout from '@/verticals/autos/components/Layout'

// ── Lazy imports: each becomes a separate chunk loaded on-demand ──
const Billing = lazy(() => import('@/core/pages/Billing'))
const Legal = lazy(() => import('@/core/pages/Legal'))
const Landing = lazy(() => import('@/core/pages/Landing'))
const AdminDashboard = lazy(() => import('@/admin/pages/AdminDashboard'))

const Dashboard = lazy(() => import('@/verticals/autos/pages/Dashboard'))
const Unidades = lazy(() => import('@/verticals/autos/pages/Unidades'))
const Vendidos = lazy(() => import('@/verticals/autos/pages/Vendidos'))
const UnidadDetalle = lazy(() => import('@/verticals/autos/pages/UnidadDetalle'))
const UnidadForm = lazy(() => import('@/verticals/autos/pages/UnidadForm'))
const Clientes = lazy(() => import('@/verticals/autos/pages/Clientes'))
const Operaciones = lazy(() => import('@/verticals/autos/pages/Operaciones'))
const OperacionForm = lazy(() => import('@/verticals/autos/pages/OperacionForm'))
const CajaDiaria = lazy(() => import('@/verticals/autos/pages/CajaDiaria'))
const Reportes = lazy(() => import('@/verticals/autos/pages/Reportes'))
const CostoRapido = lazy(() => import('@/verticals/autos/pages/CostoRapido'))
const Cheques = lazy(() => import('@/verticals/autos/pages/Cheques'))
const Inteligencia = lazy(() => import('@/verticals/autos/pages/Inteligencia'))
const Interesados = lazy(() => import('@/verticals/autos/pages/Interesados'))
const Usuarios = lazy(() => import('@/verticals/autos/pages/Usuarios'))
const MiPerfil = lazy(() => import('@/verticals/autos/pages/MiPerfil'))
const Peritajes = lazy(() => import('@/verticals/autos/pages/Peritajes'))
const PeritajeForm = lazy(() => import('@/verticals/autos/pages/PeritajeForm'))
const PeritajeDetalle = lazy(() => import('@/verticals/autos/pages/PeritajeDetalle'))
const RentabilidadVendedores = lazy(() => import('@/verticals/autos/pages/RentabilidadVendedores'))
const GastosMensuales = lazy(() => import('@/verticals/autos/pages/GastosMensuales'))
const Agenda = lazy(() => import('@/verticals/autos/pages/Agenda'))
const Actividad = lazy(() => import('@/verticals/autos/pages/Actividad'))
const Proveedores = lazy(() => import('@/verticals/autos/pages/Proveedores'))
const AntiguedadStock = lazy(() => import('@/verticals/autos/pages/AntiguedadStock'))
const ComparativoMensual = lazy(() => import('@/verticals/autos/pages/ComparativoMensual'))
const MercadoLibreCallback = lazy(() => import('@/verticals/autos/pages/MercadoLibreCallback'))
const Manual = lazy(() => import('@/core/pages/Manual'))

// ── Suspense fallback (shown while lazy chunk loads) ──
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Cargando...</span>
      </div>
    </div>
  )
}

// ── Route guards ──

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  return isAuthenticated ? children : <Navigate to="/login" />
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  return isAdmin ? children : <Navigate to="/" />
}

function PlatformAdminRoute({ children }) {
  const { isPlatformAdmin, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  return isPlatformAdmin ? children : <Navigate to="/" />
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  return isAuthenticated ? <Navigate to="/" /> : children
}

// ── Lazy wrapper helper ──
function L({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ── Autos vertical sub-router ──

function AutosVertical() {
  return (
    <Routes>
      <Route element={<AutosLayout />}>
        <Route index element={<L><Dashboard /></L>} />
        <Route path="unidades" element={<L><Unidades /></L>} />
        <Route path="unidades/nuevo" element={<L><UnidadForm /></L>} />
        <Route path="unidades/:id" element={<L><UnidadDetalle /></L>} />
        <Route path="unidades/:id/editar" element={<L><UnidadForm /></L>} />
        <Route path="vendidos" element={<L><Vendidos /></L>} />
        <Route path="clientes" element={<L><Clientes /></L>} />
        <Route path="operaciones" element={<L><Operaciones /></L>} />
        <Route path="operaciones/nueva" element={<L><OperacionForm /></L>} />
        <Route path="caja" element={<AdminRoute><L><CajaDiaria /></L></AdminRoute>} />
        <Route path="costo-rapido" element={<L><CostoRapido /></L>} />
        <Route path="cheques" element={<AdminRoute><L><Cheques /></L></AdminRoute>} />
        <Route path="interesados" element={<L><Interesados /></L>} />
        <Route path="agenda" element={<L><Agenda /></L>} />
        <Route path="peritajes" element={<L><Peritajes /></L>} />
        <Route path="peritajes/nuevo" element={<L><PeritajeForm /></L>} />
        <Route path="peritajes/:id" element={<L><PeritajeDetalle /></L>} />
        <Route path="peritajes/:id/editar" element={<L><PeritajeForm /></L>} />
        <Route path="inteligencia" element={<AdminRoute><L><Inteligencia /></L></AdminRoute>} />
        <Route path="gastos-mensuales" element={<AdminRoute><L><GastosMensuales /></L></AdminRoute>} />
        <Route path="reportes" element={<AdminRoute><L><Reportes /></L></AdminRoute>} />
        <Route path="reportes/rentabilidad-vendedores" element={<AdminRoute><L><RentabilidadVendedores /></L></AdminRoute>} />
        <Route path="actividad" element={<AdminRoute><L><Actividad /></L></AdminRoute>} />
        <Route path="proveedores" element={<AdminRoute><L><Proveedores /></L></AdminRoute>} />
        <Route path="antiguedad-stock" element={<AdminRoute><L><AntiguedadStock /></L></AdminRoute>} />
        <Route path="comparativo" element={<AdminRoute><L><ComparativoMensual /></L></AdminRoute>} />
        <Route path="usuarios" element={<AdminRoute><L><Usuarios /></L></AdminRoute>} />
        <Route path="mi-perfil" element={<L><MiPerfil /></L>} />
        <Route path="billing" element={<AdminRoute><L><Billing /></L></AdminRoute>} />
        <Route path="mercadolibre/callback" element={<L><MercadoLibreCallback /></L>} />
        <Route path="manual" element={<L><Manual /></L>} />
        <Route path="admin" element={<PlatformAdminRoute><L><AdminDashboard /></L></PlatformAdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  )
}

// ── Home: Landing for visitors, Dashboard for authenticated users ──
function HomePage() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (isAuthenticated) return <AutosVertical />
  return <L><Landing /></L>
}

// ── Main App ──

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/registro" element={<PublicRoute><Onboarding /></PublicRoute>} />
      {/* Legal pages — public, no auth required */}
      <Route path="/terminos" element={<L><Legal /></L>} />
      <Route path="/privacidad" element={<L><Legal /></L>} />
      {/* Home: Landing (visitor) or Dashboard (authenticated) */}
      <Route path="/" element={<HomePage />} />
      {/* All other routes require auth */}
      <Route path="/*" element={<PrivateRoute><AutosVertical /></PrivateRoute>} />
    </Routes>
  )
}
