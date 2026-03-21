import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { busquedaAPI } from '../services/api'
import {
  Search,
  X,
  Car,
  User,
  ShoppingCart,
  Loader2,
  Plus,
  DollarSign,
  BarChart3,
  Calendar,
  CreditCard,
  Users,
  FileText,
  Home,
  Settings,
  HelpCircle,
  Zap,
  ArrowRight,
  Clipboard,
  UserPlus,
  BookOpen,
} from 'lucide-react'
import clsx from 'clsx'

const iconMap = {
  car: Car,
  user: User,
  'shopping-cart': ShoppingCart,
}

// ── Quick actions: commands available without typing ──
const QUICK_ACTIONS = [
  { id: 'new-unit', label: 'Nueva Unidad', desc: 'Agregar vehiculo al stock', icon: Plus, color: 'blue', path: '/unidades/nuevo', category: 'crear' },
  { id: 'new-expense', label: 'Cargar Gasto', desc: 'Registrar gasto rapido', icon: DollarSign, color: 'red', path: '/costo-rapido', category: 'crear' },
  { id: 'new-sale', label: 'Nueva Operacion', desc: 'Crear venta o permuta', icon: ShoppingCart, color: 'green', path: '/operaciones/nueva', category: 'crear' },
  { id: 'new-client', label: 'Nuevo Cliente', desc: 'Registrar cliente', icon: UserPlus, color: 'purple', path: '/clientes?nuevo=1', category: 'crear' },
  { id: 'go-dashboard', label: 'Dashboard', desc: 'Ir al panel principal', icon: Home, color: 'gray', path: '/', category: 'navegar' },
  { id: 'go-stock', label: 'Stock', desc: 'Ver unidades en stock', icon: Car, color: 'gray', path: '/unidades', category: 'navegar' },
  { id: 'go-ops', label: 'Operaciones', desc: 'Ver operaciones', icon: Clipboard, color: 'gray', path: '/operaciones', category: 'navegar' },
  { id: 'go-clients', label: 'Clientes', desc: 'Ver clientes', icon: Users, color: 'gray', path: '/clientes', category: 'navegar' },
  { id: 'go-caja', label: 'Caja', desc: 'Caja diaria', icon: DollarSign, color: 'gray', path: '/caja', category: 'navegar' },
  { id: 'go-cheques', label: 'Cheques', desc: 'Gestion de cheques', icon: CreditCard, color: 'gray', path: '/cheques', category: 'navegar' },
  { id: 'go-reports', label: 'Reportes', desc: 'Ver reportes y metricas', icon: BarChart3, color: 'gray', path: '/reportes', category: 'navegar' },
  { id: 'go-agenda', label: 'Agenda', desc: 'Seguimientos y tareas', icon: Calendar, color: 'gray', path: '/agenda', category: 'navegar' },
  { id: 'go-interesados', label: 'Interesados', desc: 'CRM de interesados', icon: Users, color: 'gray', path: '/interesados', category: 'navegar' },
  { id: 'go-profile', label: 'Mi Perfil', desc: 'Ver y editar perfil', icon: Settings, color: 'gray', path: '/mi-perfil', category: 'navegar' },
  { id: 'go-manual', label: 'Manual de Uso', desc: 'Ver ayuda y documentacion', icon: BookOpen, color: 'gray', path: '/manual', category: 'navegar' },
  { id: 'go-billing', label: 'Suscripcion', desc: 'Gestionar plan', icon: CreditCard, color: 'gray', path: '/billing', category: 'navegar' },
]

const CATEGORY_LABELS = {
  crear: 'Acciones rapidas',
  navegar: 'Navegar a',
}

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const navigate = useNavigate()

  // Debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Focus en el input al abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filter quick actions by query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS.slice(0, 8) // show top 8 when empty
    const q = query.toLowerCase()
    return QUICK_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q)
    )
  }, [query])

  // API search
  const { data, isLoading: searchLoading } = useQuery({
    queryKey: ['busqueda-global', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return null
      const res = await busquedaAPI.global(debouncedQuery)
      return res.data
    },
    enabled: debouncedQuery.length >= 2,
  })

  // Build unified results list
  const allResults = useMemo(() => {
    const items = []

    // Quick actions first (filtered)
    if (filteredActions.length > 0) {
      filteredActions.forEach(a => {
        items.push({ type: 'action', ...a })
      })
    }

    // Search results
    if (data?.resultados?.length > 0) {
      data.resultados.forEach(r => {
        items.push({ type: 'search', ...r })
      })
    }

    return items
  }, [filteredActions, data])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0)
  }, [allResults.length, query])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(prev => Math.min(prev + 1, allResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && allResults[selectedIdx]) {
        e.preventDefault()
        handleSelectItem(allResults[selectedIdx])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, allResults, selectedIdx, handleSelectItem])

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current) {
      const el = resultsRef.current.querySelector(`[data-idx="${selectedIdx}"]`)
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIdx])

  const handleSelectItem = useCallback((item) => {
    if (item.type === 'action') {
      navigate(item.path)
    } else if (item.type === 'search') {
      if (item.link) navigate(item.link)
    }
    onClose()
    setQuery('')
  }, [navigate, onClose])

  if (!isOpen) return null

  const isSearching = query.length >= 2
  let globalIdx = -1

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Buscar">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center pt-[12vh] px-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-page-in">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            {searchLoading ? (
              <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-gray-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar o ejecutar comando..."
              className="flex-1 text-lg outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
            {/* Quick actions when no query or filtered */}
            {filteredActions.length > 0 && (
              <>
                {/* Group by category */}
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const catActions = filteredActions.filter(a => a.category === cat)
                  if (catActions.length === 0) return null

                  return (
                    <div key={cat}>
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                        {label}
                      </p>
                      {catActions.map((action) => {
                        globalIdx++
                        const idx = globalIdx
                        const Icon = action.icon
                        return (
                          <button
                            key={action.id}
                            data-idx={idx}
                            onClick={() => handleSelectItem({ type: 'action', ...action })}
                            className={clsx(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              idx === selectedIdx
                                ? 'bg-primary-50 dark:bg-primary-950/40'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            <div className={clsx(
                              'p-1.5 rounded-lg',
                              action.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
                              action.color === 'red' && 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
                              action.color === 'green' && 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
                              action.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
                              action.color === 'gray' && 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{action.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{action.desc}</p>
                            </div>
                            {idx === selectedIdx && (
                              <ArrowRight className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}

            {/* API Search results */}
            {isSearching && !searchLoading && data?.resultados?.length > 0 && (
              <>
                {['unidad', 'cliente', 'operacion'].map((tipo) => {
                  const items = data.resultados.filter((r) => r.tipo === tipo)
                  if (items.length === 0) return null

                  const tipoLabels = { unidad: 'Unidades', cliente: 'Clientes', operacion: 'Operaciones' }

                  return (
                    <div key={tipo}>
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                        {tipoLabels[tipo]}
                      </p>
                      {items.map((resultado) => {
                        globalIdx++
                        const idx = globalIdx
                        const Icon = iconMap[resultado.icono] || Search
                        return (
                          <button
                            key={`${resultado.tipo}-${resultado.id}`}
                            data-idx={idx}
                            onClick={() => handleSelectItem({ type: 'search', ...resultado })}
                            className={clsx(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              idx === selectedIdx
                                ? 'bg-primary-50 dark:bg-primary-950/40'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            <div className={clsx(
                              'p-1.5 rounded-lg',
                              resultado.tipo === 'unidad' && 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
                              resultado.tipo === 'cliente' && 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
                              resultado.tipo === 'operacion' && 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{resultado.titulo}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{resultado.subtitulo}</p>
                            </div>
                            {idx === selectedIdx && (
                              <ArrowRight className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}

            {/* No results */}
            {isSearching && !searchLoading && data?.resultados?.length === 0 && filteredActions.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>No se encontraron resultados para "{query}"</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs">↵</kbd>
              seleccionar
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs">?</kbd>
              atajos
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
