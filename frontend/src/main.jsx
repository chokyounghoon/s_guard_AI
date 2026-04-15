import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 🔒 Global Fetch Interceptor for Security
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [url, config = {}] = args;
  const prodBase = 'https://sguardai.khcho0421.workers.dev';
  const localBase = 'http://127.0.0.1:8000';
  
  const isApiRequest = typeof url === 'string' && (url.startsWith(prodBase) || url.startsWith(localBase) || url.startsWith('/ai/') || url.startsWith('/sms/') || url.startsWith('/auth/'));
  
  if (isApiRequest) {
    // 🛡️ Robust & Verified Token Extraction
    let jwt = localStorage.getItem('sguard_jwt');
    
    // Fallback: If direct key is missing, look inside the user object
    if (!jwt) {
      const savedUser = localStorage.getItem('sguard_user');
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          jwt = userObj.jwt || userObj.token;
        } catch (e) {}
      }
    }

    // 🔍 Hard Check: Is this actually a JWT? (must have 3 parts separated by dots)
    const isActuallyJwt = jwt && typeof jwt === 'string' && jwt.split('.').length === 3;

    if (isActuallyJwt) {
      const headers = new Headers(config.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${jwt}`);
      }
      config.headers = headers;
    }
  }
  
  const response = await originalFetch(url, config);
  
  // ⛔ Handle 401 Unauthorized Globally (except login/public endpoints)
  if (response.status === 401) {
    const isAuthRoute = typeof url === 'string' && (url.includes('/auth/init') || url.includes('/auth/verify') || url.includes('/auth/login'));
    
    if (!isAuthRoute) {
      try {
        const data = await response.clone().json();
        console.warn(`[Security] 401 Unauthorized (${data.code || 'UNKNOWN'}): ${data.detail || 'Access denied'}`);
        
        // Only clear and redirect on definitive token errors (not missing—could be a race condition)
        if (data.code === 'AUTH_INVALID_TOKEN' || data.code === 'AUTH_TOKEN_EXPIRED') {
          localStorage.removeItem('sguard_jwt');
          localStorage.removeItem('sguard_user');
          localStorage.removeItem('sguard_token');
          if (!window.location.hash.includes('/login') && window.location.pathname !== '/') {
            window.location.href = '/#/';
          }
        }
      } catch (e) {
        console.warn('[Security] Unauthorized access detected.');
      }
    }
  }
  
  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
