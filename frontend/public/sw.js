/**
 * 🛰️ S-Guard AI — Service Worker
 * Faster loads, offline support, and native app experience.
 */

const CACHE_NAME = 'sguard-v1';
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

// 🚀 FETCH: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (except fonts) and non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip API requests (Cloudflare Workers) to ensure fresh data
  if (url.hostname.includes('workers.dev') || url.hostname.includes('api.chokerslab.store')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache the new response
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If offline and not in cache, returning undefined will trigger browser error
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// 🔔 PUSH: Web Push Notification Receiver
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'S-Guard AI';
    const priority = data.priority || 0; // 0.0 to 1.0
    const isChat = data.tag && data.tag.startsWith('chat-');
    
    // 🧠 Learning-based Vibration Patterns (incident only, not chat)
    let vibrationPattern = [100]; // Default
    if (!isChat) {
      if (priority >= 0.8) {
        // CRITICAL: Intense repeating pattern
        vibrationPattern = [300, 100, 300, 100, 300];
      } else if (priority >= 0.5) {
        // NORMAL: Double beat
        vibrationPattern = [200, 100, 200];
      }
    }

    // Actions: different for incidents vs chat
    const actions = isChat
      ? [
          { action: 'open_chat', title: '💬 입장' },
          { action: 'close', title: '닿e기' }
        ]
      : [
          { action: 'open', title: '🚨 확인' },
          { action: 'dispatch', title: '📍 현장출동' }
        ];

    const options = {
      body: data.body || '새로운 장맨 인시던트가 접수되었습니다.',
      icon: '/icons/icon-192.png',
      badge: '/sguard-icon.svg',
      vibrate: vibrationPattern,
      // 🍪 KAKAO-STYLE TAGGING: same tag = replace previous notification
      tag: data.tag || data.inc_id || 'sguard-push',
      renotify: true,
      data: {
        url: data.url || '/',
        inc_id: data.inc_id,
        action_type: isChat ? 'chat' : 'incident'
      },
      actions
    };

    event.waitUntil(
      (async () => {
        await self.registration.showNotification(title, options);

        // 🔔 BADGE API: Increment unread count on app icon
        if ('setAppBadge' in navigator) {
          try {
            const currentBadge = await self.registration.getNotifications();
            await navigator.setAppBadge(currentBadge.length + 1);
          } catch (e) { /* Badge API may not be available */ }
        }
      })()
    );
  } catch (err) {
    console.error('[SW] Push processing failed:', err);
  }
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
