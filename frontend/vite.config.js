import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend serves the API at /api and stored images at /images.
// Proxy both to the FastAPI server during development.
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/images': { target: BACKEND, changeOrigin: true },
    },
  },
})
