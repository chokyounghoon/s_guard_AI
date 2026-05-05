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
    if (jwt) {
      const headers = new Headers(config.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${jwt}`);
      }
      config.headers = headers;
    }
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
    try {
      const errorData = await response.clone().json();
      
      // 🔍 4. If the error is specifically about the token being invalid, missing or expired
      if (errorData.code === 'AUTH_INVALID_TOKEN' || 
          errorData.code === 'AUTH_TOKEN_EXPIRED' || 
          errorData.code === 'AUTH_TOKEN_MISSING' || 
          errorData.code === 'AUTH_NO_PAYLOAD') {
        
        console.warn(`[Security] 401 Unauthorized (${errorData.code}). Handling recovery...`);

        // 🚫 Short-circuit: No credentials at all — skip refresh to prevent infinite loop
        const currentToken = getAccessToken();
        const currentGhostToken = getGhostToken();
        if (!currentToken && !currentGhostToken) {
          console.warn('[Security] No access token or ghost token available. Skipping refresh. Please log in.');
          clearSession();
          return response; // Return the 401 as-is — App.jsx will handle redirect
        }

        // Check if a refresh is already in progress
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
          console.info(`[Security] Retrying request for: ${url.split('/').pop()}`);
          const retryHeaders = new Headers(config.headers || {});
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          config.headers = retryHeaders;
          return await originalFetch(url, config);
        } else {
          // Refresh failed -> Session truly expired
          console.warn('[Security] Session truly expired. Clearing local state.');
          clearSession();
        }
      }
    } catch (e) {
      console.error('[Security] Error during 401 handling:', e);
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
