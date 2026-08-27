import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.allorigins.win",
  "manifest-src 'self' https://vercel.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

function securityMetaTags() {
  return {
    name: 'inject-security-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
          {
            tag: 'meta',
            attrs: { name: 'referrer', content: 'no-referrer' },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    securityMetaTags(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['FNAHS.png', 'favicon.ico'],
      manifest: {
        id: '/',
        name: 'FNAHS Aﬁ PULSO',
        short_name: 'FNAHS PULSO',
        description: 'FNAHS Aﬁ PULSO — Proactive and United Legion of Student nurses Organization, the Faculty of Nursing and Allied Health Sciences community platform.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        background_color: '#faf7ee',
        theme_color: '#a67400',
        lang: 'en',
        orientation: 'portrait-primary',
        categories: ['education', 'social'],
        icons: [
          { src: '/FNAHS.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Feed', short_name: 'Feed', url: '/app/feed', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Events', short_name: 'Events', url: '/app/events', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Health Centre', short_name: 'Health', url: '/app/health', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        screenshots: [
          { src: '/screenshots/wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'FNAHS PULSO home' },
          { src: '/screenshots/narrow.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow', label: 'FNAHS PULSO home' },
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,webmanifest}'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/api\.allorigins\.win\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'allorigins-cache',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          qr: ['qrcode.react'],
          image: ['html-to-image'],
          scanner: ['html5-qrcode'],
          icons: ['lucide-react'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
        },
      },
    },
  },
})