const CACHE_NAME = 'polygon-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon/favicon.ico',
  '/favicon/favicon-96x96.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/web-app-manifest-192x192.png',
  '/favicon/web-app-manifest-512x512.png',
  '/favicon/site.webmanifest',
  '/sounds/pda_4LbLWWH.mp3',
];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); }));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname === '/' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/favicon/') || url.pathname.startsWith('/sounds/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, tag, data, eventType } = payload;

    const isMessage = eventType === 'MESSAGE' || !eventType;

    const options: NotificationOptions = {
      body: body ?? '',
      icon: icon ?? '/favicon/favicon-96x96.png',
      badge: '/favicon/favicon-96x96.png',
      tag: tag ?? 'default',
      data: data ?? {},
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: isMessage
        ? [
            { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
            { action: 'open', title: 'Open chat' },
          ]
        : [{ action: 'open', title: 'Open' }],
    };

    event.waitUntil(self.registration.showNotification(title ?? 'Polygon', options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Polygon', {
        body: text,
        icon: '/favicon/favicon-96x96.png',
        badge: '/favicon/favicon-96x96.png',
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: 'Open' }],
      }),
    );
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  const { notification, action } = event;
  notification.close();

  const data = notification.data ?? {};
  const chatId = data.chatId as string | undefined;
  const messageId = data.messageId as string | undefined;

  if (action === 'reply') {
    const replyText = (event as NotificationEvent & { reply?: string }).reply;
    if (replyText && chatId) {
      event.waitUntil(sendReply(chatId, replyText, messageId));
    }
    return;
  }

  const url = chatId ? `/chats/${chatId}` : '/chats';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

async function sendReply(chatId: string, text: string, replyToMessageId?: string): Promise<void> {
  try {
    const body: Record<string, unknown> = { text };
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }

    await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    self.registration.showNotification('Sent!', {
      body: `"${text.length > 50 ? text.slice(0, 50) + '…' : text}"`,
      icon: '/favicon/favicon-96x96.png',
      tag: `reply-${Date.now()}`,
      silent: true,
    });
  } catch {
    self.registration.showNotification('Failed to send', {
      body: 'Could not send your reply. Open the app to retry.',
      icon: '/favicon/favicon-96x96.png',
      tag: `reply-fail-${Date.now()}`,
    });
  }
}
