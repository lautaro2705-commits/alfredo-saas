import { useState, useEffect, useCallback } from 'react'

const TOUR_STORAGE_KEY = 'alfredo_tour_completed'

/**
 * Hook para manejar el tour interactivo de la app.
 * - Se muestra automaticamente la primera vez que un usuario entra al dashboard
 * - Se puede relanzar manualmente desde el sidebar (boton Ayuda)
 * - Guarda estado en localStorage por user email
 */
export function useTour(userEmail) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const storageKey = `${TOUR_STORAGE_KEY}_${userEmail || 'guest'}`

  const hasCompleted = useCallback(() => {
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  }, [storageKey])

  // Auto-start on first visit
  useEffect(() => {
    if (userEmail && !hasCompleted()) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => setIsActive(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [userEmail, hasCompleted])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1)
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }, [])

  const endTour = useCallback(() => {
    setIsActive(false)
    setCurrentStep(0)
    try {
      localStorage.setItem(storageKey, 'true')
    } catch { /* ignore */ }
  }, [storageKey])

  const skipTour = useCallback(() => {
    endTour()
  }, [endTour])

  return {
    isActive,
    currentStep,
    startTour,
    nextStep,
    prevStep,
    endTour,
    skipTour,
    hasCompleted: hasCompleted(),
  }
}
