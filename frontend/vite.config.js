import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',        // Ask user before updating cached app
      includeAssets: [
        'logo-alfredo.png',
        'logo-alfredo-lg.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Alfredo — Gestión de Automotores',
        short_name: 'Alfredo',
        description: 'Sistema de gestión integral para concesionarias de autos',
        theme_color: '#2563eb',       // primary-600
        background_color: '#f9fafb',  // gray-50
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Nueva Unidad',
            short_name: 'Nueva',
            url: '/unidades/nuevo',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Dashboard',
            short_name: 'Inicio',
            url: '/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Registrar Gasto',
            short_name: 'Gasto',
            url: '/caja?accion=nuevo',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Cache page navigations (SPA — all go to index.html)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // API calls: Network-First (always try fresh data, fall back to cache)
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60,    // 1 hour
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Google Fonts: Cache-First
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images: Cache-First with 30-day expiry
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
