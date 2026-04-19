import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css'; // 공유 CSS (Tailwind)
import MobileApp from './App.mobile.jsx';

// 📱 S-Guard AI Mobile PWA Entry Point
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
