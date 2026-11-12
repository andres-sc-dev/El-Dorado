import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pruebas de componentes con Vitest en un DOM simulado (jsdom).
  test: {
    environment: 'jsdom',
  },
  server: {
    // En Docker sobre Windows los cambios del volumen montado no generan eventos de archivo:
    // con VITE_USE_POLLING=true Vite revisa los archivos cada cierto tiempo y sí recarga.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 500 } : undefined,
    proxy: {
      '/api': apiProxyTarget,
    },
  },
})
