import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['FNAHS.png', 'favicon.svg', 'favicon.ico'],
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