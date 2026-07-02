import { useCallback, useEffect, useRef } from 'react';

import { authedFetch } from '@org/shared';

const VAPID_KEY_ENDPOINT = 'notifications/push/vapid-key';
const SUBSCRIBE_ENDPOINT = 'notifications/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = 'notifications/push/unsubscribe';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey(): Promise<string> {
  console.log('[PushSubscribe] Fetching VAPID public key from', VAPID_KEY_ENDPOINT);
  try {
    const { publicKey } = await authedFetch<{ publicKey: string }>(VAPID_KEY_ENDPOINT);
    console.log('[PushSubscribe] VAPID public key received, length=' + publicKey.length);
    return publicKey;
  } catch (err) {
    console.error('[PushSubscribe] Failed to fetch VAPID public key:', err);
    throw err;
  }
}

async function subscribePush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    const publicKey = await getVapidPublicKey();
    console.log('[PushSubscribe] Calling pushManager.subscribe() with VAPID key...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    console.log('[PushSubscribe] Browser subscription created, endpoint=' + (subscription.endpoint ?? '').slice(0, 50) + '...');

    const sub = subscription.toJSON();
    console.log('[PushSubscribe] Sending subscription to server POST', SUBSCRIBE_ENDPOINT);
    await authedFetch(SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh ?? '',
        auth: sub.keys?.auth ?? '',
      }),
    });
    console.log('[PushSubscribe] Server subscription saved successfully');

    return subscription;
  } catch (err) {
    console.error('[PushSubscribe] Failed to subscribe to push:', err);
    return null;
  }
}

async function unsubscribePush(): Promise<void> {
  console.log('[PushSubscribe] Unsubscribing from push...');
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log('[PushSubscribe] No existing subscription found');
      return;
    }

    const endpoint = subscription.endpoint;
    console.log('[PushSubscribe] Browser subscription found, endpoint=' + (endpoint ?? '').slice(0, 50) + '...');
    await subscription.unsubscribe();
    console.log('[PushSubscribe] Browser unsubscribed');

    await authedFetch(UNSUBSCRIBE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);
    console.log('[PushSubscribe] Server unsubscribed');
  } catch (err) {
    console.error('[PushSubscribe] Failed to unsubscribe from push:', err);
  }
}

export function usePushSubscription(enabled: boolean) {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      console.log('[PushSubscribe] Hook: disabled, skipping');
      return;
    }

    console.log('[PushSubscribe] Hook: enabled, checking browser support');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PushSubscribe] Hook: ServiceWorker or PushManager not available');
      return;
    }

    if (Notification.permission === 'denied') {
      console.warn('[PushSubscribe] Hook: Notification permission denied');
      return;
    }

    const requestPermissionAndSubscribe = async () => {
      if (Notification.permission === 'default') {
        console.log('[PushSubscribe] Hook: Permission default, requesting...');
        const permission = await Notification.requestPermission();
        console.log('[PushSubscribe] Hook: Permission result =', permission);
        if (permission !== 'granted') {
          console.warn('[PushSubscribe] Hook: Permission not granted');
          return;
        }
      }

      try {
        console.log('[PushSubscribe] Hook: Waiting for service worker to be ready...');
        const registration = await navigator.serviceWorker.ready;
        console.log('[PushSubscribe] Hook: Service worker ready, scope=' + registration.scope);

        const existing = await registration.pushManager.getSubscription();
        console.log('[PushSubscribe] Hook: Existing subscription =', existing ? 'found' : 'none');

        if (existing) {
          console.log('[PushSubscribe] Hook: Re-registering existing subscription with server');
          const existingSub = existing.toJSON();
          try {
            await authedFetch(SUBSCRIBE_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: existingSub.endpoint,
                p256dh: existingSub.keys?.p256dh ?? '',
                auth: existingSub.keys?.auth ?? '',
              }),
            });
            console.log('[PushSubscribe] Hook: Existing subscription re-registered successfully');
          } catch (err) {
            console.error('[PushSubscribe] Hook: Failed to re-register existing subscription:', err);
          }
          return;
        }

        console.log('[PushSubscribe] Hook: No existing subscription, creating new one...');
        const result = await subscribePush(registration);
        if (result) {
          console.log('[PushSubscribe] Hook: New push subscription created successfully');
        } else {
          console.error('[PushSubscribe] Hook: Failed to create push subscription');
        }
      } catch (err) {
        console.error('[PushSubscribe] Hook: Push subscription error:', err);
      }
    };

    requestPermissionAndSubscribe();
  }, [enabled]);

  const unsubscribe = useCallback(async () => {
    console.log('[PushSubscribe] Hook: Unsubscribe called');
    await unsubscribePush();
  }, []);

  return { unsubscribe };
}
