/**
 * Re-export from SaaS core.
 *
 * All autos components use the shared multi-tenant AuthContext.
 * This file exists so that relative imports (../context/AuthContext)
 * from Alfredo's original components keep working without changes.
 */
export { AuthProvider, useAuth } from '@/core/context/AuthContext'
