import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './sguard_orbital_stream.css'

import App from './App.jsx'

// 🛡️ Enhanced Global Fetch Interceptor with Silent Refresh & Retry
import { getAccessToken, setAccessToken, clearSession, getGhostToken, setGhostToken } from './lib/authStore';

const originalFetch = window.fetch;
const API_BASE = 'https://sguardai.khcho0421.workers.dev';
const API_BASE_DOMAIN = 'api.chokerslab.store'; // Reverse proxy domain

// 🔄 Global Refresh Lock: Ensures only one silent refresh happens at a time
let isRefreshingPromise = null;

window.fetch = async (...args) => {
  const [url, config = {}] = args;
  const urlString = String(url);
  // 🚀 AI 스트리밍 엔드포인트 감지 (지연 방지용)
  const isAiStream = urlString.includes('/ai/');
  // Detect if it's an API request (Cloudflare Worker or Local FastAPI)
  const isApiRequest = urlString.includes(API_BASE) || 
                       urlString.includes(API_BASE_DOMAIN) ||
                       urlString.includes('localhost:8000') || 
                       urlString.includes('127.0.0.1:8000') ||
                       urlString.startsWith('/auth/') || 
                       urlString.startsWith('/api/') ||
                       urlString.startsWith('/sms/') || 
                       urlString.startsWith('/ai/');

  // 1. Add Authorization header if it's an API request
  if (isApiRequest) {
    const jwt = getAccessToken();
    const headers = new Headers(config.headers || {});
    
    // 🛡️ SECURITY: 'Bearer null'이나 'Bearer undefined'가 포함된 잘못된 헤더 제거 (컴포넌트의 실수 방지)
    const existingAuth = headers.get('Authorization');
    if (existingAuth && (existingAuth.includes('null') || existingAuth.includes('undefined'))) {
      headers.delete('Authorization');
    }

    if (jwt && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${jwt}`);
    }
    config.headers = headers;
    
    // Always include credentials (for refresh token cookie)
    config.credentials = 'include';
  }

  // 2. Execute original fetch
  let response = await originalFetch(url, config);

  // 3. Handle 401 Unauthorized (except for login/verify/refresh itself)
  if (response.status === 401 && isApiRequest && 
      !urlString.includes('/auth/login') && 
      !urlString.includes('/auth/verify') && 
      !urlString.includes('/auth/init') && 
      !urlString.includes('/auth/refresh')) {
    
    // 🛡️ SECURITY: 이미 재시도한 요청인 경우 무한 루프 방지 (세션 만료 처리)
    if (config._retry) {
      console.warn('[Security] Retry failed with 401 - clearing session.');
      clearSession();
      return response;
    }
      
    if (!isRefreshingPromise) {
      isRefreshingPromise = (async () => {
            console.log('[Security] Initiating shared silent refresh...');
            try {
              let refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
                method: 'GET',
                credentials: 'include'
              });

              // 👻 Ghost Token Fallback logic for Interceptor
              if (!refreshRes.ok) {
                const ghostToken = getGhostToken();
                if (ghostToken) {
                  console.log('[Interceptor] Attempting Ghost Token recovery...');
                  refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${ghostToken}` }
                  });
                }
              }

              if (refreshRes.ok) {
                const data = await refreshRes.json();
                if (data.access_token) {
                  setAccessToken(data.access_token);
                  if (data.ghost_token) setGhostToken(data.ghost_token);
                  return data.access_token;
                }
              } else {
                console.error(`[Security] Silent refresh failed with status: ${refreshRes.status}`);
              }
              return null;
            } catch (err) {
              console.error('[Security] Shared refresh failed:', err);
              return null;
            } finally {
              isRefreshingPromise = null;
            }
          })();
        }

    const newToken = await isRefreshingPromise;

    if (newToken) {
      console.info(`[Security] Retrying request for: ${urlString.split('/').pop()}`);
      const retryHeaders = new Headers(config.headers || {});
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      config.headers = retryHeaders;
      config._retry = true; // 🛡️ Mark as retried
      return await originalFetch(url, config);
    } else {
      console.warn('[Security] Session expired. Clearing state.');
      clearSession();
    }
  }

  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 🕹️ PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker failed:', err));
  });
}
