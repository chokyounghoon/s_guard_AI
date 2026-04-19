import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 📱 S-Guard AI Mobile PWA Build Config
// This produces a separate optimized bundle for mobile browsers.
// Deploy to a separate Cloudflare Pages project: sguard-mobile
export default defineConfig({
  plugins: [react()],
  root: '.',
  // 🔑 PC 서버(5173)와 캐시 충돌 방지: 모바일 전용 캐시 디렉터리
  cacheDir: 'node_modules/.vite-mobile',
  optimizeDeps: {
    // 주요 의존성을 미리 명시해 504 Outdated Dep 에러 방지
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'react-markdown',
      '@react-oauth/google',
    ],
    force: false, // 개발 중 true로 설정하면 매번 강제 재번들
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
    hmr: true,
  },
})
