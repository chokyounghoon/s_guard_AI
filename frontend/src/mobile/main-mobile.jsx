import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.mobile.css'; // 📱 모바일 전용 CSS (PC/태블릿 index.css와 완전 독립)
import MobileApp from './App.mobile.jsx';
import { getAccessToken, setAccessToken, clearSession, getGhostToken, setGhostToken } from '../lib/authStore';

// 📱 S-Guard AI Mobile PWA Entry Point - Unified Fetch Interceptor
const originalFetch = window.fetch;
const API_BASE = 'https://sguardai.khcho0421.workers.dev';
const API_BASE_DOMAIN = 'api.chokerslab.store';

let isRefreshingPromise = null;

window.fetch = async (...args) => {
  const [url, config = {}] = args;
  const urlString = String(url);
  
  const isApiRequest = (urlString.includes(API_BASE) || 
                       urlString.includes(API_BASE_DOMAIN) ||
                       urlString.includes('localhost:8000') || 
                       urlString.includes('127.0.0.1:8000') ||
                       urlString.startsWith('/auth/') || 
                       urlString.startsWith('/api/') ||
                       urlString.startsWith('/sms/') || 
                       urlString.startsWith('/ai/')) && !urlString.includes('/ai/'); // 🚀 AI Streaming bypass interceptor

  if (isApiRequest) {
    let jwt = getAccessToken();
    
    // ⚡ [Proactive Refresh] 토큰은 없는데 Ghost Token이 있다면 즉시 리프레시 시도
    if (!jwt && !urlString.includes('/auth/login') && !urlString.includes('/auth/refresh')) {
      const ghost = getGhostToken();
      if (ghost && !isRefreshingPromise) {
        isRefreshingPromise = (async () => {
          try {
            const r = await originalFetch(`${API_BASE}/auth/refresh`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${ghost}` }
            });
            if (r.ok) {
              const d = await r.json();
              if (d.access_token) {
                setAccessToken(d.access_token);
                if (d.ghost_token) setGhostToken(d.ghost_token);
                return d.access_token;
              }
            }
          } catch {}
          return null;
        })();
        jwt = await isRefreshingPromise;
        isRefreshingPromise = null;
      }
    }

    if (jwt) {
      const headers = new Headers(config.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${jwt}`);
      }
      config.headers = headers;
    }
    config.credentials = 'include';
  }

  let response = await originalFetch(url, config);

  if (response.status === 401 && isApiRequest && 
      !urlString.includes('/auth/login') && 
      !urlString.includes('/auth/verify') && 
      !urlString.includes('/auth/init') && 
      !urlString.includes('/auth/refresh')) {
    try {
      const errorText = await response.clone().text();
      let errorData = {};
      try { errorData = JSON.parse(errorText); } catch(e) {}
      
      if (errorData.code === 'AUTH_INVALID_TOKEN' || 
          errorData.code === 'AUTH_TOKEN_EXPIRED' || 
          errorData.code === 'AUTH_TOKEN_MISSING' || 
          errorData.code === 'AUTH_NO_PAYLOAD') {
        
        if (!isRefreshingPromise) {
          isRefreshingPromise = (async () => {
            try {
              let refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
                method: 'GET',
                credentials: 'include'
              });

              if (!refreshRes.ok) {
                const ghostToken = getGhostToken();
                if (ghostToken) {
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
              }
              return null;
            } catch (err) {
              return null;
            } finally {
              isRefreshingPromise = null;
            }
          })();
        }

        const newToken = await isRefreshingPromise;

        if (newToken) {
          const retryHeaders = new Headers(config.headers || {});
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          config.headers = retryHeaders;
          return await originalFetch(url, config);
        } else {
          clearSession();
        }
      }
    } catch (e) {}
  }

  return response;
};

ReactDOM.createRoot(document.getElementById('mobile-root')).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);

// 🕹️ S-Guard AI Mobile PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[Mobile PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[Mobile PWA] Service Worker failed:', err));
  });
}
