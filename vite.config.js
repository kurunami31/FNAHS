import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Production Content-Security-Policy.
 * Dev is excluded so Vite's hot-reload inline scripts keep working.
 */
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
      manifest: false,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          qr: ['qrcode.react'],
          image: ['html-to-image'],
          scanner: ['html5-qrcode'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})