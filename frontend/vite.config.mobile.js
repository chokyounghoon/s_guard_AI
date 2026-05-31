import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 📱 S-Guard AI Mobile PWA Build Config
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const accept = req.headers.accept || '';

          // SPA Fallback Logic:
          // 1. Root path (/)
          // 2. Paths that accept HTML (browser navigation)
          // 3. AND are not internal Vite paths (/@vite, /@fs, etc.)
          // 4. AND are not API/Auth calls
          const isHtmlRequest = accept.includes('text/html');
          const isViteInternal = url.startsWith('/@');
          const isApiRequest = url.startsWith('/api/') || url.startsWith('/auth/') || url.startsWith('/sms/') || url.startsWith('/ai/');

          if (url === '/' || (isHtmlRequest && !isViteInternal && !isApiRequest)) {
            req.url = '/index.mobile.html';
          }
          next();
        });
      }
    }
  ],
  root: '.',
  cacheDir: 'node_modules/.vite-mobile-final',

  // 🚀 PC와 동일하게 단순 설정 (auto-detect 사용)
  optimizeDeps: {
    force: false,
  },

  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.mobile.html'),
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          ui: ['framer-motion', 'lucide-react', 'react-hot-toast'],
          markdown: ['react-markdown', 'remark-gfm', 'html2pdf.js']
        }
      }
    },
  },

  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
  },

  server: {
    host: '0.0.0.0',
    port: 5174,
    // 🚀 로컬 개발 시 Worker API를 프록시 → 외부 HTTPS 왕복 제거 (PC와 동일한 응답속도)
    proxy: {
      '/ai': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/db': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/sms': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/warroom': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/incidents': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
      '/users': {
        target: 'https://sguardai.khcho0421.workers.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
