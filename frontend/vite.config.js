import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 🚀 로컬 개발 시 Worker API 프록시 → 외부 HTTPS 왕복 제거
    proxy: {
      '/ai': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
      '/db': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
      '/sms': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
      '/warroom': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
      '/incidents': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
      '/users': { target: 'https://sguardai.khcho0421.workers.dev', changeOrigin: true, secure: true },
    },
  },
})
