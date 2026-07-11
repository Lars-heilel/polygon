import { useCallback, useEffect, useRef } from 'react';

import { authedFetch, useLogger } from '@org/shared';

const VAPID_KEY_ENDPOINT = 'notifications/push/vapid-key';
const SUBSCRIBE_ENDPOINT = 'notifications/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = 'notifications/push/unsubscribe';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)));
}

type PushLogger = ReturnType<typeof useLogger>;

async function getVapidPublicKey(logger: PushLogger): Promise<string> {
  logger.debug('Fetching VAPID public key');
  try {
    const { publicKey } = await authedFetch<{ publicKey: string }>(VAPID_KEY_ENDPOINT);
    logger.debug('VAPID public key received', { keyLength: publicKey.length });
    return publicKey;
  } catch (err) {
    logger.error('Failed to fetch VAPID public key', { hasError: !!err });
    throw err;
  }
}

async function subscribePush(
  registration: ServiceWorkerRegistration,
  logger: PushLogger,
): Promise<PushSubscription | null> {
  try {
    const publicKey = await getVapidPublicKey(logger);
    logger.debug('Calling pushManager.subscribe with VAPID key');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    logger.debug('Browser subscription created', { hasEndpoint: !!subscription.endpoint });

    const sub = subscription.toJSON();
    logger.debug('Sending subscription to server');
    await authedFetch(SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh ?? '',
        auth: sub.keys?.auth ?? '',
      }),
    });
    logger.debug('Server subscription saved successfully');

    return subscription;
  } catch (err) {
    logger.error('Failed to subscribe to push', { hasError: !!err });
    return null;
  }
}

async function unsubscribePush(logger: PushLogger): Promise<void> {
  logger.debug('Unsubscribing from push');
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      logger.debug('No existing subscription found');
      return;
    }

    const endpoint = subscription.endpoint;
    logger.debug('Browser subscription found', { hasEndpoint: !!endpoint });
    await subscription.unsubscribe();
    logger.debug('Browser unsubscribed');

    await authedFetch(UNSUBSCRIBE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);
    logger.debug('Server unsubscribed');
  } catch (err) {
    logger.error('Failed to unsubscribe from push', { hasError: !!err });
  }
}

export function usePushSubscription(enabled: boolean) {
  const logger = useLogger('PushSubscribe');
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      logger.debug('Hook disabled, skipping push subscription setup');
      return;
    }

    logger.debug('Hook enabled, checking browser support');

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      logger.warn('ServiceWorker or PushManager not available');
      return;
    }

    if (Notification.permission === 'denied') {
      logger.warn('Notification permission denied');
      return;
    }

    const requestPermissionAndSubscribe = async () => {
      if (Notification.permission === 'default') {
        logger.debug('Notification permission default, requesting permission');
        const permission = await Notification.requestPermission();
        logger.debug('Notification permission request completed', { permission });
        if (permission !== 'granted') {
          logger.warn('Notification permission not granted');
          return;
        }
      }

      try {
        logger.debug('Waiting for service worker readiness');
        const registration = await navigator.serviceWorker.ready;
        logger.debug('Service worker ready', { hasScope: !!registration.scope });

        const existing = await registration.pushManager.getSubscription();
        logger.debug('Existing subscription lookup completed', { found: !!existing });

        if (existing) {
          logger.debug('Re-registering existing subscription with server');
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
            logger.debug('Existing subscription re-registered successfully');
          } catch (err) {
            logger.error('Failed to re-register existing subscription', { hasError: !!err });
          }
          return;
        }

        logger.debug('No existing subscription, creating new one');
        const result = await subscribePush(registration, logger);
        if (result) {
          logger.debug('New push subscription created successfully');
        } else {
          logger.error('Failed to create push subscription');
        }
      } catch (err) {
        logger.error('Push subscription error', { hasError: !!err });
      }
    };

    requestPermissionAndSubscribe();
  }, [enabled, logger]);

  const unsubscribe = useCallback(async () => {
    logger.debug('Unsubscribe requested');
    await unsubscribePush(logger);
  }, [logger]);

  return { unsubscribe };
}
