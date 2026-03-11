import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * useKeyboardShortcuts — global keyboard navigation.
 *
 * Single keys:
 *   ?  → Toggle shortcuts help modal
 *   n  → Dispatch 'shortcut:new' event (pages can listen to trigger "New" action)
 *
 * "Go to" sequences (press G, then target key within 1s):
 *   g d → Dashboard     g s → Stock         g c → Clientes
 *   g i → Interesados   g v → Ventas        g k → Caja
 *   g p → Proveedores   g r → Reportes      g a → Agenda
 *
 * All shortcuts are disabled when an input/textarea/select is focused.
 */

const GO_ROUTES = {
  d: '/',
  s: '/unidades',
  c: '/clientes',
  i: '/interesados',
  v: '/operaciones',
  k: '/caja',
  p: '/proveedores',
  r: '/reportes',
  a: '/agenda',
}

export function useKeyboardShortcuts({ onOpenSearch } = {}) {
  const [showHelp, setShowHelp] = useState(false)
  const pendingPrefix = useRef(null)
  const prefixTimer = useRef(null)
  const navigate = useNavigate()

  const isInputFocused = useCallback(() => {
    const el = document.activeElement
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip when typing in form fields
      if (isInputFocused()) return
      // Skip modifier combos (Cmd+K handled separately in Layout)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()

      // ── "g + key" sequence ──
      if (pendingPrefix.current === 'g') {
        clearTimeout(prefixTimer.current)
        pendingPrefix.current = null

        if (GO_ROUTES[key]) {
          e.preventDefault()
          navigate(GO_ROUTES[key])
        }
        return
      }

      // ── Start "g" prefix ──
      if (key === 'g') {
        e.preventDefault()
        pendingPrefix.current = 'g'
        prefixTimer.current = setTimeout(() => {
          pendingPrefix.current = null
        }, 1000)
        return
      }

      // ── Single-key shortcuts ──
      if (key === '?') {
        e.preventDefault()
        setShowHelp(prev => !prev)
      } else if (key === 'n') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shortcut:new'))
      } else if (key === 'escape') {
        setShowHelp(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearTimeout(prefixTimer.current)
    }
  }, [navigate, isInputFocused, onOpenSearch])

  return { showHelp, setShowHelp }
}
