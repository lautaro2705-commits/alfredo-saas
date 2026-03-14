/**
 * usePWAInstall — captures the browser's beforeinstallprompt event
 * and exposes a clean API to trigger the install prompt from custom UI.
 *
 * Only works on Chromium-based browsers (Chrome, Edge, Samsung Internet).
 * Safari uses a different "Add to Home Screen" flow that can't be triggered
 * programmatically — for Safari we detect standalone mode instead.
 *
 * @returns {Object}
 *   - canInstall:  boolean — true when the browser has offered to install
 *   - isInstalled: boolean — true if already running as standalone PWA
 *   - promptInstall: () => Promise — triggers the native install dialog
 */
import { useState, useEffect, useCallback, useRef } from 'react'

export function usePWAInstall() {
  const deferredPrompt = useRef(null)
  const [canInstall, setCanInstall] = useState(false)

  // Check if already installed (standalone mode)
  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // Safari iOS

  useEffect(() => {
    if (isInstalled) return // No need to listen if already installed

    function handleBeforeInstall(e) {
      e.preventDefault() // Prevent the mini-infobar
      deferredPrompt.current = e
      setCanInstall(true)
    }

    function handleAppInstalled() {
      deferredPrompt.current = null
      setCanInstall(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isInstalled])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt.current) return false
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    setCanInstall(false)
    return outcome === 'accepted'
  }, [])

  return { canInstall, isInstalled, promptInstall }
}
