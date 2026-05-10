/**
 * 🛰️ S-Guard AI — Service Worker
 * Faster loads, offline support, and native app experience.
 */

const CACHE_NAME = 'sguard-v33'; // Push payload fix - SubtleCrypto RFC 8291
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.mobile.html',
  '/manifest.json',
  '/sguard-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap'
];

// 🔧 INSTALL: Pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching critical assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 🧹 ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 🚀 FETCH: Stale-While-Revalidate Strategy (Async/Await)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // 🛡️ SECURITY & STABILITY: Only handle http/https requests
  if (!url.protocol.startsWith('http')) return;
  
  // ⚡ DEV OPTIMIZATION: Skip caching for local dev server assets (Vite/HMR)
  // This prevents 'promise rejected' errors during development
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    if (url.pathname.includes('/src/') || url.search.includes('t=')) {
      return; 
    }
  }

  // Skip API requests (Cloudflare Workers) to ensure fresh data
  if (url.hostname.includes('workers.dev') || url.hostname.includes('api.chokerslab.store')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(event.request);
        
        // Network fetch promise (to update cache)
        const fetchPromise = fetch(event.request).then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If both fail, return fallback response
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });

        // Stale-While-Revalidate: Return cache if available, but still update it in background
        return cachedResponse || fetchPromise;
      } catch (err) {
        console.error('[SW] Fetch handler error:', err);
        return fetch(event.request);
      }
    })()
  );
});

// 🚀 [SW-v33] Push Notification Handler
self.addEventListener('push', (event) => {
  let pushData = {
    title: 'S-Guard AI',
    body: '새로운 알림이 수신되었습니다.',
    url: '/',
    tag: 'sguard-alert',
    vibrate: [100, 50, 100]
  };

  if (event.data) {
    try {
      const data = JSON.parse(event.data.text());
      if (data && typeof data === 'object') {
        pushData.title = data.title || pushData.title;
        pushData.body  = data.body  || data.message || pushData.body;
        pushData.url   = data.url   || data.link    || pushData.url;
        pushData.tag   = data.tag   || pushData.tag;
        if (Array.isArray(data.vibrate)) pushData.vibrate = data.vibrate;
      }
    } catch (e) {
      const text = event.data.text();
      if (text) pushData.body = text;
    }
  }

  const options = {
    body: pushData.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: pushData.vibrate,
    tag: `${pushData.tag}-${Date.now()}`,
    renotify: true,
    data: { url: pushData.url }
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title, options)
      .catch(err => console.error('[SW] Notification error:', err))
  );
});

// 🖥️ NOTIFICATION CLICK: Handle actions and redirection
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear app badge when user interacts
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const notifData = event.notification.data;
  let urlToOpen = notifData.url || '/';

  // Handle action buttons
  if (event.action === 'close') return;
  if (event.action === 'dispatch') {
    // 📍 현장출동: Record action and navigate to incident
    urlToOpen = notifData.url || '/';
  } else if (event.action === 'open_chat') {
    urlToOpen = notifData.url || '/';
  }
  // 'open' action and default click: just navigate to url

  const absoluteUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open at the target URL, focus it
      for (const client of windowClients) {
        if (client.url === absoluteUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
