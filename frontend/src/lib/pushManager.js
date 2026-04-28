/**
 * 🛰️ S-Guard AI — Web Push Manager
 * Handles browser-side push subscription and sync with Cloudflare Worker.
 */

import { getAccessToken } from './authStore';

const VAPID_PUBLIC_KEY_URL = '/auth/push-vapid-public';
const SUBSCRIBE_URL        = '/auth/push-subscribe';
const UNSUBSCRIBE_URL      = '/auth/push-unsubscribe';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export const PushManager = {
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
   * 구독 등록 (기존 구독이 있으면 재사용, 없으면 신규 생성)
   * apiBase: 'https://sguardai.khcho0421.workers.dev'
   */
  async subscribe(apiBase) {
    try {
      // 1. 서비스워커 지원 확인
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { success: false, error: 'Push not supported in this browser' };
      }

      // 2. 알림 권한 확인/요청
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission denied' };
      }

      const registration = await navigator.serviceWorker.ready;

      // 3. 기존 구독 확인 — 있으면 재사용하여 서버 동기화만
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log('[PushManager] No existing subscription. Fetching VAPID key...');
        // 4. 신규 구독 생성을 위해 VAPID 공개키 조회 (인증 없이 공개 엔드포인트)
        const keyRes = await fetch(`${apiBase}${VAPID_PUBLIC_KEY_URL}`);
        if (!keyRes.ok) throw new Error(`VAPID key fetch failed: ${keyRes.status}`);
        const { publicKey } = await keyRes.json();
        if (!publicKey) throw new Error('VAPID public key missing in server response');

        console.log('[PushManager] Creating new subscription with VAPID key...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        console.log('[PushManager] New subscription created successfully');
      } else {
        console.log('[PushManager] Reusing existing subscription for sync');
      }

      // 5. 서버에 구독 정보 동기화 (인증 토큰 필요)
      const token = getAccessToken();
      console.log('[PushManager] Syncing to server. Token exists:', !!token);
      if (!token) return { success: false, error: 'No auth token — login first' };

      const syncRes = await fetch(`${apiBase}${SUBSCRIBE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription })
      });

      if (!syncRes.ok) {
        const err = await syncRes.json().catch(() => ({}));
        throw new Error(err.error || `Server sync failed: ${syncRes.status}`);
      }

      console.log('[PushManager] Subscription synced to server ✅');
      return { success: true, subscription };

    } catch (error) {
      console.error('[PushManager] Subscribe failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  async unsubscribe(apiBase) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const token = getAccessToken();
        if (token) {
          await fetch(`${apiBase}${UNSUBSCRIBE_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ endpoint })
          });
        }
      }
      return { success: true };
    } catch (error) {
      console.error('[PushManager] Unsubscribe failed:', error.message);
      return { success: false, error: error.message };
    }
  }
};
