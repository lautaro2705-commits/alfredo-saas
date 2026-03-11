# Frontend Production-Ready Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden Alfredo's frontend for production launch — migrate JWT from localStorage to memory+sessionStorage, remove dead code, fix stale references, add ErrorBoundary, and update password validation.

**Architecture:** Module-scoped token variable in `api.js` as primary JWT store, `sessionStorage` as page-refresh fallback (dies on tab close). All localStorage usage eliminated from 3 files. Dead legacy files deleted, branding fixed, password validation aligned with backend hardening.

**Tech Stack:** React 18, Vite 5, Axios, React Router v6, Tailwind CSS

---

### Task 1: Dead Code Cleanup

Delete 3 unused legacy files that are remnants of the standalone autos app. These are NOT imported by any active component (verified via grep).

**IMPORTANT:** Do NOT delete `verticals/autos/context/AuthContext.jsx` — it's a re-export shim used by 15 active files (Dashboard, Unidades, Layout, etc.).

**Files:**
- Delete: `frontend/src/verticals/autos/main.jsx`
- Delete: `frontend/src/verticals/autos/App.jsx`
- Delete: `frontend/src/verticals/autos/pages/Login.jsx`

**Step 1: Verify nothing imports these files**

Run:
```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
grep -r "verticals/autos/main" src/ || echo "No imports found"
grep -r "verticals/autos/App" src/ --include="*.jsx" --include="*.js" | grep -v "src/verticals/autos/main.jsx" || echo "No imports found"
grep -r "verticals/autos/pages/Login" src/ --include="*.jsx" --include="*.js" | grep -v "src/verticals/autos/App.jsx" || echo "No imports found"
```
Expected: "No imports found" for each (only self-references within the dead files themselves).

**Step 2: Delete the files**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
rm src/verticals/autos/main.jsx
rm src/verticals/autos/App.jsx
rm src/verticals/autos/pages/Login.jsx
```

**Step 3: Verify build still works**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add -A frontend/src/verticals/autos/main.jsx frontend/src/verticals/autos/App.jsx frontend/src/verticals/autos/pages/Login.jsx
git commit -m "chore: remove dead legacy entry point files

Delete 3 unused files from the pre-separation standalone autos app:
- verticals/autos/main.jsx (dead entry point)
- verticals/autos/App.jsx (dead router, duplicated by root App.jsx)
- verticals/autos/pages/Login.jsx (dead login, uses username not email)"
```

---

### Task 2: Stale References & Branding

Fix stale "travel" vertical option in AdminDashboard and wrong page title.

**Files:**
- Modify: `frontend/src/admin/pages/AdminDashboard.jsx:395-405`
- Modify: `frontend/index.html:6`

**Step 1: Remove the vertical filter dropdown from AdminDashboard**

In `frontend/src/admin/pages/AdminDashboard.jsx`, find and replace the entire vertical select block (lines 395-405). Since Alfredo is single-vertical, the dropdown is useless.

Find this exact block:
```jsx
            <select
              className="border rounded-lg text-sm px-3 py-2 text-gray-700"
              onChange={(e) => setFilters((f) => ({
                ...f,
                vertical: e.target.value || undefined,
              }))}
            >
              <option value="">Todas las verticales</option>
              <option value="autos">Autos</option>
              <option value="travel">Travel</option>
            </select>
```

Replace with nothing (delete the entire block).

**Step 2: Fix index.html title**

In `frontend/index.html`, change line 6:

Find:
```html
    <title>SaaS Platform</title>
```

Replace with:
```html
    <title>Alfredo</title>
```

**Step 3: Verify build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/admin/pages/AdminDashboard.jsx frontend/index.html
git commit -m "fix: remove stale travel reference and fix page title

- Remove vertical filter dropdown from AdminDashboard (single-vertical)
- Change <title> from 'SaaS Platform' to 'Alfredo'"
```

---

### Task 3: JWT Security Migration — api.js

Rewrite `api.js` to use a module-scoped variable as primary token store and `sessionStorage` as page-refresh fallback. Eliminate all `localStorage` usage.

**Files:**
- Modify: `frontend/src/core/services/api.js` (full rewrite)

**Step 1: Rewrite api.js**

Replace the entire content of `frontend/src/core/services/api.js` with:

```javascript
/**
 * Core API client — Alfredo.
 *
 * Security: JWT stored in module-scoped memory (primary) + sessionStorage (refresh fallback).
 * sessionStorage dies on tab close — no persistent token on disk.
 *
 * Usage:
 *   import api, { authAPI } from '@/core/services/api'
 *   const res = await api.get('/autos/unidades')
 */
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ── Token storage: memory-first, sessionStorage as refresh backup ──
let authToken = null
const SESSION_TOKEN_KEY = '_st'
const SESSION_TENANT_KEY = '_tenant'

export function setAuthToken(token) {
  authToken = token
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
  }
}

export function getAuthToken() {
  if (authToken) return authToken
  // Fallback: restore from sessionStorage after page refresh
  const stored = sessionStorage.getItem(SESSION_TOKEN_KEY)
  if (stored) {
    authToken = stored
    return stored
  }
  return null
}

export function clearAuthData() {
  authToken = null
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  sessionStorage.removeItem(SESSION_TENANT_KEY)
}

// ── Tenant info helpers ──
export function getTenantInfo() {
  try {
    const raw = sessionStorage.getItem(SESSION_TENANT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTenantInfo(tenantData) {
  sessionStorage.setItem(SESSION_TENANT_KEY, JSON.stringify(tenantData))
}

// ── Save auth data after login/onboarding ──
export function saveAuthData(tokenResponse) {
  setAuthToken(tokenResponse.access_token)
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

// ── Response interceptor: handle 401 ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData()
      const current = window.location.pathname
      if (current !== '/login' && current !== '/registro') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth API ──
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  onboarding: (data) => api.post('/auth/onboarding', data),
  me: () => api.get('/auth/me'),
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
```

**Key changes from original:**
- `let authToken = null` replaces all `localStorage.getItem('token')` reads
- `setAuthToken()` writes to memory + sessionStorage (not localStorage)
- `getAuthToken()` reads memory first, falls back to sessionStorage
- `clearAuthData()` clears memory + sessionStorage
- `saveTenantInfo()` / `getTenantInfo()` use sessionStorage
- All `localStorage` references eliminated
- Keys use short names `_st` / `_tenant` (sessionStorage is same-origin, short keys are fine)

**Step 2: Verify no `localStorage` remains in api.js**

```bash
grep -n "localStorage" /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/core/services/api.js
```
Expected: No output (zero matches).

**Step 3: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/core/services/api.js
git commit -m "security: migrate JWT from localStorage to memory + sessionStorage

- Module-scoped authToken variable as primary store (not accessible from DOM)
- sessionStorage as page-refresh fallback (dies on tab close)
- Eliminates all localStorage usage from API client
- Short session keys: _st (token), _tenant (tenant info)"
```

---

### Task 4: JWT Security Migration — AuthContext.jsx

Update AuthContext to use the new api.js token functions instead of localStorage directly.

**Files:**
- Modify: `frontend/src/core/context/AuthContext.jsx` (full rewrite)

**Step 1: Rewrite AuthContext.jsx**

Replace the entire content of `frontend/src/core/context/AuthContext.jsx` with:

```jsx
/**
 * AuthContext — Alfredo.
 *
 * Provides: user, tenant info, login/logout/onboarding, role checks.
 * Token stored in memory + sessionStorage (never localStorage).
 *
 * Usage:
 *   import { useAuth } from '@/core/context/AuthContext'
 *   const { user, tenant, login, isAdmin } = useAuth()
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  authAPI,
  saveAuthData,
  clearAuthData,
  getAuthToken,
  saveTenantInfo,
} from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Init: restore session from sessionStorage ──
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getAuthToken()

        if (!token) {
          setLoading(false)
          return
        }

        // Verify token with /me endpoint
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

      // Save token and tenant info (memory + sessionStorage)
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
  const logout = useCallback(() => {
    clearAuthData()
    setUser(null)
    setTenant(null)
  }, [])

  const value = {
    // State
    user,
    tenant,
    loading,

    // Actions
    login,
    logout,
    onboarding,

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
```

**Key changes from original:**
- Import `getAuthToken`, `saveTenantInfo` from api.js (new exports)
- `initAuth()` uses `getAuthToken()` instead of `localStorage.getItem('token')`
- Removed all `localStorage.getItem()` and `localStorage.setItem()` calls
- No longer stores `user` object in storage (only kept in React state)
- Tenant info saved via `saveTenantInfo()` (sessionStorage)
- Comment updated: "restore session from sessionStorage"

**Step 2: Verify no localStorage remains in AuthContext**

```bash
grep -n "localStorage" /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/core/context/AuthContext.jsx
```
Expected: No output (zero matches).

**Step 3: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/core/context/AuthContext.jsx
git commit -m "security: migrate AuthContext from localStorage to memory + sessionStorage

- Use getAuthToken() for session restoration (memory-first, sessionStorage fallback)
- Remove all localStorage reads/writes
- User profile kept only in React state (no storage)
- Tenant info persisted via saveTenantInfo() to sessionStorage"
```

---

### Task 5: Update ErrorBoundary — Remove localStorage

The ErrorBoundary component still references `localStorage`. Update it to use `clearAuthData` from the api module.

**Files:**
- Modify: `frontend/src/verticals/autos/components/ErrorBoundary.jsx:25-29`

**Step 1: Update ErrorBoundary**

In `frontend/src/verticals/autos/components/ErrorBoundary.jsx`:

Add import at line 1 (after `import React from 'react'`):
```jsx
import { clearAuthData } from '@/core/services/api'
```

Find this block (lines 25-29):
```jsx
              onClick={() => {
                // Solo eliminar datos de sesión, no todo localStorage
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                window.location.href = '/login'
              }}
```

Replace with:
```jsx
              onClick={() => {
                clearAuthData()
                window.location.href = '/login'
              }}
```

**Step 2: Verify no localStorage remains in the entire src/**

```bash
grep -rn "localStorage" /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/
```
Expected: No output (zero matches across entire frontend src).

**Step 3: Verify build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/verticals/autos/components/ErrorBoundary.jsx
git commit -m "security: remove last localStorage reference from ErrorBoundary

Use clearAuthData() from api module instead of direct localStorage calls.
Zero localStorage references remain in frontend src/."
```

---

### Task 6: Add ErrorBoundary to Root main.jsx

The root `main.jsx` doesn't have an ErrorBoundary wrapper. The component exists but isn't used at the entry level.

**Files:**
- Modify: `frontend/src/main.jsx:1-37`

**Step 1: Add ErrorBoundary import and wrapper**

In `frontend/src/main.jsx`, add the import after line 7:

Find:
```jsx
import App from './App'
import './index.css'
```

Replace with:
```jsx
import ErrorBoundary from '@/verticals/autos/components/ErrorBoundary'
import App from './App'
import './index.css'
```

Then wrap the `<App />` component. Find:
```jsx
        <AuthProvider>
          <App />
          <Toaster
```

Replace with:
```jsx
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster
```

**Step 2: Verify build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/main.jsx
git commit -m "feat: add ErrorBoundary wrapper to root entry point

Catches unhandled React errors and shows friendly error page
instead of blank screen."
```

---

### Task 7: Password Validation Update — Onboarding.jsx

Update password field to require 12+ characters and show complexity hints, matching the backend PasswordValidator being added in the security hardening plan.

**Files:**
- Modify: `frontend/src/core/pages/Onboarding.jsx:230-249`

**Step 1: Update password validation rules and add hints**

In `frontend/src/core/pages/Onboarding.jsx`, find the password field block (lines 228-249):

Find:
```jsx
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('admin_password', {
                        required: 'La contrasena es obligatoria',
                        minLength: { value: 8, message: 'Minimo 8 caracteres' },
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all pr-12"
                      placeholder="Minimo 8 caracteres"
                      autoComplete="new-password"
                    />
```

Replace with:
```jsx
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('admin_password', {
                        required: 'La contrasena es obligatoria',
                        minLength: { value: 12, message: 'Minimo 12 caracteres' },
                        validate: {
                          hasUpper: (v) => /[A-Z]/.test(v) || 'Debe incluir al menos una mayuscula',
                          hasDigit: (v) => /\d/.test(v) || 'Debe incluir al menos un numero',
                          hasSpecial: (v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v) || 'Debe incluir un caracter especial',
                        },
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all pr-12"
                      placeholder="Minimo 12 caracteres"
                      autoComplete="new-password"
                    />
```

Then, after the password show/hide button's closing `</div>` and before the error display, add a hints block. Find:

```jsx
                  </div>
                  {errors.admin_password && (
                    <p className="text-red-500 text-xs mt-1">{errors.admin_password.message}</p>
                  )}
```

Replace with:

```jsx
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Min. 12 caracteres, una mayuscula, un numero, un caracter especial
                  </p>
                  {errors.admin_password && (
                    <p className="text-red-500 text-xs mt-1">{errors.admin_password.message}</p>
                  )}
```

**Step 2: Verify build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/src/core/pages/Onboarding.jsx
git commit -m "security: enforce stronger password in onboarding form

- Increase minimum length from 8 to 12 characters
- Add validation: uppercase, digit, special character required
- Show password requirements hint below field
- Aligns with backend PasswordValidator from security hardening"
```

---

### Task 8: Environment & Dependencies Cleanup

Create `.env.example` for frontend, fix package.json name, remove unused TypeScript type deps.

**Files:**
- Create: `frontend/.env.example`
- Modify: `frontend/package.json`

**Step 1: Create .env.example**

Create `frontend/.env.example` with:

```
# Alfredo Frontend — Environment Variables
#
# Copy to .env and customize:
#   cp .env.example .env

# Backend API URL (include /api/v1 prefix)
VITE_API_URL=http://localhost:8000/api/v1
```

**Step 2: Update package.json**

In `frontend/package.json`:

Find:
```json
  "name": "agencia-autos-frontend",
```
Replace with:
```json
  "name": "alfredo-frontend",
```

Remove `@types/react` and `@types/react-dom` from devDependencies. Find:
```json
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
```
Delete these two lines.

**Step 3: Verify build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build 2>&1 | tail -5
```
Expected: Build succeeds (Vite doesn't need @types/* for JSX).

**Step 4: Commit**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo
git add frontend/.env.example frontend/package.json
git commit -m "chore: add .env.example, fix package name, remove unused deps

- Create .env.example documenting VITE_API_URL
- Rename package from 'agencia-autos-frontend' to 'alfredo-frontend'
- Remove @types/react and @types/react-dom (no TypeScript in project)"
```

---

### Task 9: Final Verification & Smoke Test

Verify the complete frontend builds and has zero localStorage references.

**Step 1: Full localStorage audit**

```bash
grep -rn "localStorage" /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/
```
Expected: No output (zero matches).

**Step 2: Full build**

```bash
cd /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend
npx vite build
```
Expected: Build succeeds with no errors or warnings.

**Step 3: Verify dead files are gone**

```bash
ls /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/main.jsx 2>&1
ls /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/App.jsx 2>&1
ls /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/pages/Login.jsx 2>&1
```
Expected: "No such file or directory" for each.

**Step 4: Verify .env.example exists**

```bash
cat /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/.env.example
```
Expected: Shows VITE_API_URL config.

**Step 5: Verify title**

```bash
grep "<title>" /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/index.html
```
Expected: `<title>Alfredo</title>`

**Step 6: Summary report**

Print a summary:
```bash
echo "=== Frontend Production-Ready Verification ==="
echo "1. localStorage refs: $(grep -rn 'localStorage' /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/ | wc -l | tr -d ' ') (expected: 0)"
echo "2. Dead files: $(ls /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/main.jsx /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/App.jsx /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/src/verticals/autos/pages/Login.jsx 2>&1 | grep -c 'No such file') / 3 deleted"
echo "3. Title: $(grep -o '<title>[^<]*</title>' /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/index.html)"
echo "4. .env.example: $(test -f /Users/macbook/mis-proyectos/saas-platform/alfredo/frontend/.env.example && echo 'EXISTS' || echo 'MISSING')"
echo "5. Build: run 'cd alfredo/frontend && npx vite build' to confirm"
echo "=============================================="
```

Expected output:
```
=== Frontend Production-Ready Verification ===
1. localStorage refs: 0 (expected: 0)
2. Dead files: 3 / 3 deleted
3. Title: <title>Alfredo</title>
4. .env.example: EXISTS
5. Build: run 'cd alfredo/frontend && npx vite build' to confirm
==============================================
```
