/**
 * AuthContext — Alfredo.
 *
 * Provides: user, tenant info, login/logout/onboarding, role checks.
 * Access token (JWT 15 min) + refresh token (opaque 7 days), both in
 * memory + sessionStorage (never localStorage).
 *
 * The axios interceptor handles silent token refresh on 401 transparently.
 * This context adds a proactive refresh timer so the user never sees a
 * stale token if they keep the tab open.
 *
 * Usage:
 *   import { useAuth } from '@/core/context/AuthContext'
 *   const { user, tenant, login, isAdmin } = useAuth()
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  authAPI,
  saveAuthData,
  clearAuthData,
  getAuthToken,
  getRefreshToken,
  saveTenantInfo,
  setSessionExpiredHandler,
  isTokenExpiringSoon,
} from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const refreshTimer = useRef(null)

  // ── Session expired handler (called by axios interceptor when refresh fails) ──
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setTenant(null)
      setSessionExpired(true)
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  // ── Proactive token refresh: renew 2 min before expiry ──
  useEffect(() => {
    if (!user) return

    const REFRESH_CHECK_INTERVAL = 60 * 1000 // Check every 1 min

    const proactiveRefresh = async () => {
      // If access token expires within 2 min, refresh proactively
      if (isTokenExpiringSoon(2 * 60 * 1000)) {
        try {
          // The interceptor's tryRefresh handles the actual refresh.
          // We just make any authenticated call — if the token is expired,
          // the interceptor will silently refresh it.
          const res = await authAPI.me()
          if (res.data) {
            setUser(res.data)
          }
        } catch {
          // If even the refresh fails, interceptor calls handleSessionEnd
        }
      }
    }

    refreshTimer.current = setInterval(proactiveRefresh, REFRESH_CHECK_INTERVAL)
    return () => clearInterval(refreshTimer.current)
  }, [user])

  // ── Init: restore session from sessionStorage ──
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getAuthToken()

        if (!token) {
          setLoading(false)
          return
        }

        // Verify token with /me endpoint (interceptor will refresh if expired)
        const res = await authAPI.me()
        if (res.data) {
          setUser(res.data)

          // Update tenant from /me response (source of truth)
          const tenantData = {
            tenant_id: res.data.tenant_id,
            tenant_name: res.data.tenant_name,
            vertical: res.data.vertical,
            plan: res.data.plan,
            rol: res.data.rol,
          }
          setTenant(tenantData)
          saveTenantInfo(tenantData)
        }
      } catch (err) {
        console.error('Error en initAuth:', err)
        clearAuthData()
        setUser(null)
        setTenant(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // ── Login ──
  const login = useCallback(async (email, password) => {
    try {
      const res = await authAPI.login({ email, password })
      const tokenData = res.data

      if (!tokenData.access_token) {
        return { success: false, error: 'No se recibio token' }
      }

      // Save tokens + tenant info (memory + sessionStorage)
      saveAuthData(tokenData)
      setTenant({
        tenant_id: tokenData.tenant_id,
        tenant_name: tokenData.tenant_name,
        vertical: tokenData.vertical,
        plan: tokenData.plan,
        rol: tokenData.rol,
      })

      // Fetch full user profile
      const userRes = await authAPI.me()
      if (userRes.data) {
        setUser(userRes.data)
      }

      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error de autenticacion'
      return { success: false, error: msg }
    }
  }, [])

  // ── Onboarding (registro) ──
  const onboarding = useCallback(async (data) => {
    try {
      const res = await authAPI.onboarding(data)
      const result = res.data

      if (!result.access_token) {
        return { success: false, error: 'No se recibio token' }
      }

      // Save auth data (memory + sessionStorage)
      saveAuthData({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        tenant_id: result.tenant_id,
        tenant_name: result.tenant_name,
        vertical: result.vertical,
        plan: result.plan,
        rol: 'admin',
      })

      setTenant({
        tenant_id: result.tenant_id,
        tenant_name: result.tenant_name,
        vertical: result.vertical,
        plan: result.plan,
        rol: 'admin',
      })

      // Fetch full user profile
      const userRes = await authAPI.me()
      if (userRes.data) {
        setUser(userRes.data)
      }

      return { success: true, data: result }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error en registro'
      return { success: false, error: msg }
    }
  }, [])

  // ── Logout ──
  const logout = useCallback(async () => {
    // Revoke refresh token on the server (best-effort)
    const rt = getRefreshToken()
    if (rt) {
      try {
        await authAPI.logout(rt)
      } catch {
        // Ignore — we're logging out regardless
      }
    }
    clearAuthData()
    setUser(null)
    setTenant(null)
    setSessionExpired(false)
  }, [])

  // ── Dismiss session expired banner (navigate to login) ──
  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false)
  }, [])

  const value = {
    // State
    user,
    tenant,
    loading,
    sessionExpired,

    // Actions
    login,
    logout,
    onboarding,
    dismissSessionExpired,

    // Derived
    isAuthenticated: !!user,
    isAdmin: user?.rol === 'admin',
    isVendedor: user?.rol === 'vendedor',
    isMecanico: user?.rol === 'mecanico',
    isPlatformAdmin: user?.is_platform_admin || false,
    vertical: tenant?.vertical || null,
    tenantName: tenant?.tenant_name || '',
    plan: tenant?.plan || null,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
