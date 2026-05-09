import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.mobile.css'; // 📱 모바일 전용 CSS (PC/태블릿 index.css와 완전 독립)
import MobileApp from './App.mobile.jsx';
import { getAccessToken, setAccessToken, clearSession, getGhostToken, setGhostToken } from '../lib/authStore';

console.log('🚀 [Mobile] S-Guard AI v1.2.0 - Performance Optimized & Cache Bypass Active');

// 📱 S-Guard AI Mobile PWA Entry Point - Unified Fetch Interceptor
const originalFetch = window.fetch;
const API_BASE = 'https://sguardai.khcho0421.workers.dev';
const API_BASE_DOMAIN = 'api.chokerslab.store';

let isRefreshingPromise = null;

window.fetch = async (...args) => {
  const [url, config = {}] = args;
  const urlString = String(url);

  // 🚀 AI 스트리밍 엔드포인트 감지 (지연 방지용)
  const isAiStream = urlString.includes('/ai/');
  
  const isApiRequest = urlString.includes(API_BASE) || 
                       urlString.includes(API_BASE_DOMAIN) ||
                       urlString.includes('localhost:8000') || 
                       urlString.includes('127.0.0.1:8000') ||
                       urlString.startsWith('/auth/') || 
                       urlString.startsWith('/api/') ||
                       urlString.startsWith('/sms/') || 
                       urlString.startsWith('/ai/');

  // 1. Authorization 헤더 추가 및 Credentials 설정
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
    
    // 세션 유지를 위해 모든 API 요청에 credentials: 'include' 적용
    config.credentials = 'include';
  }

  let response = await originalFetch(url, config);

  // 2. 401 Unauthorized 처리 (Silent Refresh)
  if (response.status === 401 && isApiRequest && 
      !urlString.includes('/auth/login') && 
      !urlString.includes('/auth/verify') && 
      !urlString.includes('/auth/init') && 
      !urlString.includes('/auth/refresh')) {
    
    // 🛡️ SECURITY: 이미 재시도한 요청인 경우 무한 루프 방지 (세션 만료 처리)
    if (config._retry) {
      console.warn('[Auth] Retry failed with 401 - clearing session.');
      clearSession();
      return response;
    }
        
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
      config._retry = true; // 🛡️ Mark as retried
      return await originalFetch(url, config);
    } else {
      clearSession();
    }
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
