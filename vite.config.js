import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'timetables.json', 'stops_gps.json'],
      manifest: {
        name: 'ŻPA Żyrardów - Rozkład Live',
        short_name: 'ŻPA Live',
        description: 'Live rozkład jazdy Żyrardowskich Przewozów Autobusowych - offline, PWA, Material UI',
        theme_color: '#2A9D6F',
        background_color: '#FAFDFB',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        lang: 'pl',
        categories: ['travel', 'navigation'],
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: './icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Szukaj przystanku', url: './?action=search', description: 'Szybkie wyszukiwanie przystanku' },
          { name: 'Linia 1 - Spółdzielcza', url: './?line=1', description: 'Ulubiona linia 1' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/timetables\.json.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'zpa-timetables',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 5,
            }
          },
          {
            urlPattern: /^https:\/\/.*\/stops_gps\.json.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'zpa-stops',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 7 },
            }
          },
          {
            urlPattern: /^https:\/\/pksgostynin\.kiedyprzyjedzie\.pl\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kiedy-api',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5,
            }
          },
          {
            urlPattern: /^https:\/\/router\.project-osrm\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osrm-routes',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            }
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    cors: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    headers: {
      'X-Frame-Options': 'ALLOWALL',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    cors: true,
    allowedHosts: true,
  },
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'leaflet': ['leaflet', 'react-leaflet'],
          'fallback': ['./src/data/fallback.js'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
