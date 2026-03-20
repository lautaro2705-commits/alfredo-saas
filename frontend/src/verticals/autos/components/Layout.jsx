import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import SearchModal from './SearchModal'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import NotificacionesBadge from './NotificacionesBadge'
import ActivityFeed from './ActivityFeed'
import AppTour from '@/core/components/AppTour'
import { useTour } from '@/core/hooks/useTour'
import {
  Car,
  Users,
  ShoppingCart,
  Wallet,
  BarChart3,
  Menu,
  X,
  LogOut,
  Wrench,
  Home,
  ChevronDown,
  FileText,
  Search,
  Brain,
  UserPlus,
  Settings,
  ClipboardCheck,
  TrendingUp,
  Receipt,
  CalendarCheck,
  History,
  Store,
  ArrowLeftRight,
  Clock,
  CreditCard,
  AlertTriangle,
  Sun,
  Moon,
  Keyboard,
  Shield,
  BookOpen,
  Play,
  Bell,
  Activity,
} from 'lucide-react'
import clsx from 'clsx'

// ── Sidebar sections ──

const sidebarSections = [
  {
    id: 'main',
    label: null,
    items: [
      { name: 'Dashboard', href: '/', icon: Home },
    ],
  },
  {
    id: 'operativo',
    label: 'Operativo',
    items: [
      { name: 'Stock', href: '/unidades', icon: Car },
      { name: 'Peritajes', href: '/peritajes', icon: ClipboardCheck },
      { name: 'Clientes', href: '/clientes', icon: Users },
      { name: 'Interesados', href: '/interesados', icon: UserPlus },
      { name: 'Agenda', href: '/agenda', icon: CalendarCheck },
      { name: 'Ventas', href: '/operaciones', icon: ShoppingCart },
      { name: 'Cargar Gasto', href: '/costo-rapido', icon: Wrench },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    adminOnly: true,
    items: [
      { name: 'Caja', href: '/caja', icon: Wallet },
      { name: 'Cheques', href: '/cheques', icon: FileText },
      { name: 'Gastos del Mes', href: '/gastos-mensuales', icon: Receipt },
      { name: 'Proveedores', href: '/proveedores', icon: Store },
    ],
  },
  {
    id: 'analytics',
    label: 'Reportes',
    adminOnly: true,
    items: [
      { name: 'Inteligencia', href: '/inteligencia', icon: Brain },
      { name: 'Reportes', href: '/reportes', icon: BarChart3 },
      { name: 'Rentabilidad', href: '/reportes/rentabilidad-vendedores', icon: TrendingUp },
      { name: 'Stock Aging', href: '/antiguedad-stock', icon: Clock },
      { name: 'Comparativo', href: '/comparativo', icon: ArrowLeftRight },
      { name: 'Actividad', href: '/actividad', icon: History },
    ],
  },
  {
    id: 'config',
    label: 'Configuracion',
    adminOnly: true,
    items: [
      { name: 'Usuarios', href: '/usuarios', icon: Settings },
      { name: 'Facturacion', href: '/billing', icon: CreditCard },
    ],
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    items: [
      { name: 'Manual de Uso', href: '/manual', icon: BookOpen },
    ],
  },
  {
    id: 'platform',
    label: 'Plataforma',
    platformAdminOnly: true,
    items: [
      { name: 'Admin Panel', href: '/admin', icon: Shield },
    ],
  },
]

const nonAdminExtra = [
  { name: 'Caja', href: '/caja', icon: Wallet },
]

// ── Collapsible Section ──

function SidebarSection({ section, collapsed, onToggle, onNavClick, location }) {
  if (!section.label) {
    return (
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <SidebarItem key={item.href} item={item} onNavClick={onNavClick} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {section.label}
        <ChevronDown
          className={clsx(
            'w-3.5 h-3.5 transition-transform duration-200',
            collapsed && '-rotate-90'
          )}
        />
      </button>
      <div
        className={clsx(
          'space-y-0.5 overflow-hidden transition-all duration-200',
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
        )}
      >
        {section.items.map((item) => (
          <SidebarItem key={item.href} item={item} onNavClick={onNavClick} />
        ))}
      </div>
    </div>
  )
}

function SidebarItem({ item, onNavClick }) {
  return (
    <NavLink
      to={item.href}
      end={item.href === '/'}
      onClick={onNavClick}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm',
        isActive
          ? 'bg-primary-50 text-primary-600 font-medium shadow-sm dark:bg-primary-950 dark:text-primary-400'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
      )}
    >
      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
      {item.name}
    </NavLink>
  )
}

// ── Main Layout ──

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({})
  const { user, logout, isAdmin, isPlatformAdmin, sessionExpired, dismissSessionExpired } = useAuth()
  const { theme, toggleTheme, isDark } = useTheme()
  const { showHelp, setShowHelp } = useKeyboardShortcuts({ onOpenSearch: () => setSearchOpen(true) })
  const tour = useTour(user?.email)
  const navigate = useNavigate()
  const location = useLocation()

  // Cmd+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const visibleSections = sidebarSections.filter(
    section => {
      if (section.platformAdminOnly) return isPlatformAdmin
      if (section.adminOnly) return isAdmin
      return true
    }
  )

  const renderSidebarNav = (onNavClick) => (
    <div className="space-y-3">
      {visibleSections.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          collapsed={collapsedSections[section.id]}
          onToggle={() => toggleSection(section.id)}
          onNavClick={onNavClick}
          location={location}
        />
      ))}
      {!isAdmin && nonAdminExtra.map((item) => (
        <SidebarItem key={item.href} item={item} onNavClick={onNavClick} />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Sidebar movil — overlay */}
      <div className={clsx(
        "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
        sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <nav className={clsx(
          "fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <img src="/logo-alfredo.png" alt="Alfredo" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">Alfredo</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {renderSidebarNav(() => setSidebarOpen(false))}
          </div>
        </nav>
      </div>

      {/* Modales */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcutsModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <ActivityFeed isOpen={activityOpen} onClose={() => setActivityOpen(false)} />

      {/* Tour interactivo */}
      <AppTour
        isActive={tour.isActive}
        currentStep={tour.currentStep}
        onNext={tour.nextStep}
        onPrev={tour.prevStep}
        onSkip={tour.skipTour}
        onEnd={tour.endTour}
        isAdmin={isAdmin}
      />

      {/* Sidebar desktop */}
      <nav className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-200 dark:lg:bg-gray-900 dark:lg:border-gray-800 transition-colors duration-300">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-gray-100 dark:border-gray-800">
          <img src="/logo-alfredo.png" alt="Alfredo" className="w-10 h-10 rounded-lg" />
          <div>
            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">Alfredo</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">Smart Dealer OS</p>
          </div>
        </div>

        {/* Busqueda y notificaciones */}
        <div className="px-3 pt-3 flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 flex items-center gap-3 px-3 py-2 text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left text-sm">Buscar...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400">⌘K</kbd>
          </button>
          <NotificacionesBadge />
        </div>

        <div className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          {renderSidebarNav(null)}
        </div>

        {/* Usuario + acciones */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <NavLink
            to="/mi-perfil"
            className={({ isActive }) => clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              isActive ? "bg-primary-50 dark:bg-primary-950" : "hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">
                {user?.nombre?.[0]}{user?.apellido?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.nombre} {user?.apellido}
              </p>
              <p className="text-xs text-gray-400 capitalize">{user?.rol}</p>
            </div>
          </NavLink>

          {/* Theme toggle + shortcuts + logout */}
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark
                ? <Sun className="w-4 h-4 text-yellow-500" />
                : <Moon className="w-4 h-4" />
              }
              <span className="text-xs">{isDark ? 'Claro' : 'Oscuro'}</span>
            </button>
            <button
              onClick={() => setActivityOpen(true)}
              className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
              title="Actividad reciente"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={() => tour.startTour()}
              className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-lg transition-colors"
              title="Recorrido del sistema"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Atajos de teclado (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
              title="Cerrar sesion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="lg:pl-64">
        {/* Header movil */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img src="/logo-alfredo.png" alt="Alfredo" className="w-7 h-7 rounded-lg" />
            <span className="text-base font-bold text-primary-600 dark:text-primary-400">Alfredo</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificacionesBadge />
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Session expired banner */}
        {sessionExpired && (
          <div className="mx-4 mt-4 lg:mx-8 lg:mt-8 p-4 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center gap-3 animate-page-in">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">Tu sesion ha expirado</p>
              <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-0.5">Inicia sesion nuevamente para continuar trabajando.</p>
            </div>
            <button
              onClick={() => { dismissSessionExpired(); navigate('/login') }}
              className="btn btn-primary text-sm px-4 py-1.5"
            >
              Iniciar sesion
            </button>
          </div>
        )}

        {/* Contenido de la pagina con transicion */}
        <main className="p-4 lg:p-8 animate-page-in">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav movil */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 flex justify-around py-1.5 z-40 safe-area-bottom">
        <NavLink
          to="/"
          end
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
            isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Inicio</span>
        </NavLink>
        <NavLink
          to="/unidades"
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
            isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"
          )}
        >
          <Car className="w-5 h-5" />
          <span className="text-[10px] font-medium">Stock</span>
        </NavLink>
        <NavLink
          to="/costo-rapido"
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-0.5 px-3 py-1.5",
            isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"
          )}
        >
          <div className="w-11 h-11 -mt-5 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30 fab-pulse">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-medium">Gasto</span>
        </NavLink>
        <NavLink
          to="/operaciones"
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
            isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"
          )}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] font-medium">Ventas</span>
        </NavLink>
        <NavLink
          to="/caja"
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
            isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"
          )}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Caja</span>
        </NavLink>
      </nav>
    </div>
  )
}
