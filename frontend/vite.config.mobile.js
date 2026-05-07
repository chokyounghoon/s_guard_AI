import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 📱 S-Guard AI Mobile PWA Build Config
// This produces a separate optimized bundle for mobile browsers.
// Deploy to a separate Cloudflare Pages project: sguard-mobile
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            req.url = '/index.mobile.html'
          }
          next()
        })
      }
    }
  ],
  root: '.',
  // 🔑 캐시 충돌 완벽 차단을 위해 새로운 캐시 디렉터리 사용
  cacheDir: 'node_modules/.vite-mobile-final',
  optimizeDeps: {
    // 주요 의존성을 미리 명시해 504 Outdated Dep 에러 방지
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'react-router-dom',
      'lucide-react',
      'react-markdown',
      '@react-oauth/google',
    ],
    force: false, // 🚀 force:true 제거 → 초기 로딩 속도 개선 (캐시 재사용)
  },
  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.mobile.html'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    // 개발 서버도 모바일 캐시 폴더 사용
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5174,
    },
  },
})
