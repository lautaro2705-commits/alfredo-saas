/**
 * Core API client — Alfredo.
 *
 * Security:
 *   - Access token  (JWT, 15 min) — memory + sessionStorage
 *   - Refresh token (opaque, 7 days) — memory + sessionStorage
 *   - sessionStorage dies on tab close — no persistent token on disk
 *
 * On 401 the interceptor silently refreshes the access token and retries
 * the original request.  Concurrent 401s share a single refresh call.
 *
 * Usage:
 *   import api, { authAPI } from '@/core/services/api'
 *   const res = await api.get('/autos/unidades')
 */
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ── Token storage: memory-first, sessionStorage as page-refresh backup ──
let accessToken = null
let refreshToken = null

const SK = {
  ACCESS: '_st',
  REFRESH: '_rt',
  TENANT: '_tenant',
}

export function setAuthToken(token) {
  accessToken = token
  if (token) {
    sessionStorage.setItem(SK.ACCESS, token)
  } else {
    sessionStorage.removeItem(SK.ACCESS)
  }
}

export function getAuthToken() {
  if (accessToken) return accessToken
  const stored = sessionStorage.getItem(SK.ACCESS)
  if (stored) {
    accessToken = stored
    return stored
  }
  return null
}

export function setRefreshToken(token) {
  refreshToken = token
  if (token) {
    sessionStorage.setItem(SK.REFRESH, token)
  } else {
    sessionStorage.removeItem(SK.REFRESH)
  }
}

export function getRefreshToken() {
  if (refreshToken) return refreshToken
  const stored = sessionStorage.getItem(SK.REFRESH)
  if (stored) {
    refreshToken = stored
    return stored
  }
  return null
}

export function clearAuthData() {
  accessToken = null
  refreshToken = null
  sessionStorage.removeItem(SK.ACCESS)
  sessionStorage.removeItem(SK.REFRESH)
  sessionStorage.removeItem(SK.TENANT)
}

// ── Tenant info helpers ──
export function getTenantInfo() {
  try {
    const raw = sessionStorage.getItem(SK.TENANT)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTenantInfo(tenantData) {
  sessionStorage.setItem(SK.TENANT, JSON.stringify(tenantData))
}

// ── Save auth data after login/onboarding ──
export function saveAuthData(tokenResponse) {
  setAuthToken(tokenResponse.access_token)
  setRefreshToken(tokenResponse.refresh_token)
  saveTenantInfo({
    tenant_id: tokenResponse.tenant_id,
    tenant_name: tokenResponse.tenant_name,
    vertical: tokenResponse.vertical,
    plan: tokenResponse.plan,
    rol: tokenResponse.rol,
  })
}

// ── Axios instance ──
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: inject JWT from memory ──
api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Session expiry event (avoids hard redirects) ──
let onSessionExpired = null
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

// ── JWT expiry helpers ──
export function getTokenExpiry() {
  const token = getAuthToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null // ms
  } catch {
    return null
  }
}

export function isTokenExpiringSoon(thresholdMs = 5 * 60 * 1000) {
  const exp = getTokenExpiry()
  if (!exp) return true
  return Date.now() > exp - thresholdMs
}

// ── Silent refresh logic ──
let refreshPromise = null // Shared promise to avoid concurrent refreshes

async function tryRefresh() {
  const rt = getRefreshToken()
  if (!rt) return false

  try {
    // Use raw axios to avoid our interceptors (would cause infinite loop)
    const res = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: rt,
    })
    const data = res.data
    setAuthToken(data.access_token)
    setRefreshToken(data.refresh_token)
    saveTenantInfo({
      tenant_id: data.tenant_id,
      tenant_name: data.tenant_name,
      vertical: data.vertical,
      plan: data.plan,
      rol: data.rol,
    })
    return true
  } catch {
    return false
  }
}

function handleSessionEnd() {
  clearAuthData()
  if (onSessionExpired) {
    onSessionExpired()
  } else {
    const current = window.location.pathname
    if (current !== '/login' && current !== '/registro') {
      window.location.href = '/login'
    }
  }
}

// ── Response interceptor: 401 → silent refresh → retry ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // Only try refresh once per request, and only on 401
    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error)
    }

    // Don't try to refresh auth endpoints themselves
    if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')) {
      handleSessionEnd()
      return Promise.reject(error)
    }

    original._retried = true

    // Share a single refresh call across concurrent 401s
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null
      })
    }

    const success = await refreshPromise
    if (success) {
      // Retry original request with new token
      original.headers.Authorization = `Bearer ${getAuthToken()}`
      return api(original)
    }

    // Refresh failed — session truly expired
    handleSessionEnd()
    return Promise.reject(error)
  }
)

// ── Auth API ──
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  onboarding: (data) => api.post('/auth/onboarding', data),
  me: () => api.get('/auth/me'),
  refresh: (rt) => api.post('/auth/refresh', { refresh_token: rt }),
  logout: (rt) => api.post('/auth/logout', { refresh_token: rt }),
  requestPasswordReset: (email) => api.post('/auth/password-reset/request', { email }),
  confirmPasswordReset: (token, newPassword) =>
    api.post('/auth/password-reset/confirm', { token, new_password: newPassword }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/password-change', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
}

// ── Billing API ──
export const billingAPI = {
  getPlans: () => api.get('/billing/plans'),
  getOverview: () => api.get('/billing/overview'),
  subscribe: (data) => api.post('/billing/subscribe', data),
  cancelSubscription: () => api.post('/billing/cancel'),
  getPayments: () => api.get('/billing/payments'),
  getTrialStatus: () => api.get('/billing/trial-status'),
}

// ── Admin API (platform super-admin) ──
export const adminAPI = {
  getMetrics: () => api.get('/admin/metrics'),
  getTenants: (params) => api.get('/admin/tenants', { params }),
  getTenant: (id) => api.get(`/admin/tenants/${id}`),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  impersonate: (id) => api.post(`/admin/tenants/${id}/impersonate`),
}

export default api
