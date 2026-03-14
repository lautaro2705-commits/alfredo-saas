import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { busquedaAPI } from '../services/api'
import { Search, X, Car, User, ShoppingCart, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const iconMap = {
  car: Car,
  user: User,
  'shopping-cart': ShoppingCart,
}

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef(null)
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
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const { data, isLoading } = useQuery({
    queryKey: ['busqueda-global', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return null
      const res = await busquedaAPI.global(debouncedQuery)
      return res.data
    },
    enabled: debouncedQuery.length >= 2,
  })

  const handleSelect = (resultado) => {
    navigate(resultado.link)
    onClose()
    setQuery('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center pt-[15vh] px-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar unidades, clientes, operaciones..."
              className="flex-1 text-lg outline-none placeholder-gray-400 dark:placeholder-gray-500"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
              </div>
            )}

            {!isLoading && query.length < 2 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Escribí al menos 2 caracteres para buscar</p>
              </div>
            )}

            {!isLoading && query.length >= 2 && data?.resultados?.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>No se encontraron resultados para "{query}"</p>
              </div>
            )}

            {!isLoading && data?.resultados?.length > 0 && (
              <div className="py-2">
                {/* Agrupar por tipo */}
                {['unidad', 'cliente', 'operacion'].map((tipo) => {
                  const items = data.resultados.filter((r) => r.tipo === tipo)
                  if (items.length === 0) return null

                  const tipoLabels = {
                    unidad: 'Unidades',
                    cliente: 'Clientes',
                    operacion: 'Operaciones',
                  }

                  return (
                    <div key={tipo} className="mb-2">
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">
                        {tipoLabels[tipo]}
                      </p>
                      {items.map((resultado) => {
                        const Icon = iconMap[resultado.icono] || Search
                        return (
                          <button
                            key={`${resultado.tipo}-${resultado.id}`}
                            onClick={() => handleSelect(resultado)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors text-left"
                          >
                            <div className={clsx(
                              'p-2 rounded-lg',
                              resultado.tipo === 'unidad' && 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
                              resultado.tipo === 'cliente' && 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
                              resultado.tipo === 'operacion' && 'bg-purple-100 text-purple-600 dark:text-purple-400'
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{resultado.titulo}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{resultado.subtitulo}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border rounded text-xs mr-1">↵</kbd>
              para seleccionar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border rounded text-xs mr-1">ESC</kbd>
              para cerrar
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
