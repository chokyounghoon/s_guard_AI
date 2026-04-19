/**
 * 🛰️ S-Guard AI — Web Push Manager
 * Handles browser-side push subscription and sync with Cloudflare Worker.
 */

const VAPID_PUBLIC_KEY_URL = '/auth/push-vapid-public';
const SUBSCRIBE_URL = '/auth/push-subscribe';
const UNSUBSCRIBE_URL = '/auth/push-unsubscribe';

/**
 * Convert VAPID key to Uint8Array for subscribe function
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushManager = {
  /**
   * Check if push is supported and current status
   */
  async getStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { supported: false };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    return {
      supported: true,
      enabled: !!subscription,
      permission: Notification.permission
    };
  },

  /**
   * Request permission and subscribe to push
   */
  async subscribe(apiBase) {
    try {
      // 1. Request Browser Permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const registration = await navigator.serviceWorker.ready;

      // 2. Clear existing subscription if any
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // 3. Get Public VAPID Key from Server
      const keyRes = await fetch(`${apiBase}${VAPID_PUBLIC_KEY_URL}`);
      const { publicKey } = await keyRes.json();
      
      if (!publicKey) throw new Error('VAPID public key not found on server');

      // 4. Subscribe to Push Service
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Sync with Backend
      const token = localStorage.getItem('sguard_token');
      const syncRes = await fetch(`${apiBase}${SUBSCRIBE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription })
      });

      if (!syncRes.ok) throw new Error('Failed to sync subscription with server');

      return { success: true, subscription };
    } catch (error) {
      console.error('[PushManager] Subscribe failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Unsubscribe from push
   */
  async unsubscribe(apiBase) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Sync with backend
        const token = localStorage.getItem('sguard_token');
        await fetch(`${apiBase}${UNSUBSCRIBE_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ endpoint })
        });
      }
      return { success: true };
    } catch (error) {
      console.error('[PushManager] Unsubscribe failed:', error.message);
      return { success: false, error: error.message };
    }
  }
};
