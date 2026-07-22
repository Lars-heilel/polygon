import { expect, type Page, test } from '@playwright/test';

const me = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'tester',
  displayName: 'Tester',
  avatarUrl: null,
  bio: null,
  role: 'USER',
};

const other = {
  id: 'user-2',
  email: 'other@example.com',
  name: 'other',
  displayName: 'Other User',
  avatarUrl: null,
  bio: null,
  role: 'USER',
};

function iso(index: number) {
  return new Date(Date.UTC(2026, 6, 14, 10, index, 0)).toISOString();
}

function message(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `message-${index}`,
    chatId: 'chat-1',
    senderId: index % 2 === 0 ? me.id : other.id,
    type: 'TEXT',
    text: `Text message ${index}`,
    fileId: null,
    fileBucket: null,
    fileKey: null,
    fileName: null,
    fileSize: null,
    fileMime: null,
    fileCategory: null,
    forwardedFromId: null,
    forwardedFromSenderId: null,
    forwardedFromCreatedAt: null,
    forwardedFromSender: null,
    createdAt: iso(index),
    updatedAt: iso(index),
    ...overrides,
  };
}

const baseMessages = Array.from({ length: 72 }, (_, index) => message(index + 1));

const mixedMessages = [
  ...baseMessages,
  message(73, {
    text: 'Long text ' + 'superlongunbrokenword'.repeat(18),
  }),
  message(74, {
    type: 'IMAGE',
    text: null,
    fileId: 'file-image',
    fileName: 'wide-image.png',
    fileSize: 1024,
    fileMime: 'image/png',
    fileCategory: 'IMAGE',
  }),
  message(75, {
    type: 'AUDIO',
    text: null,
    fileId: 'file-audio',
    fileName: 'audio.mp3',
    fileSize: 4096,
    fileMime: 'audio/mpeg',
    fileCategory: 'AUDIO',
  }),
  message(76, {
    type: 'VOICE',
    text: null,
    fileId: 'file-voice',
    fileName: 'voice.webm',
    fileSize: 4096,
    fileMime: 'audio/webm',
    fileCategory: 'VOICE',
  }),
  message(77, {
    type: 'VIDEO',
    text: null,
    fileId: 'file-video',
    fileName: 'video.mp4',
    fileSize: 8192,
    fileMime: 'video/mp4',
    fileCategory: 'VIDEO',
  }),
  message(78, {
    type: 'VIDEO',
    text: null,
    fileId: 'file-circle',
    fileName: 'circle.mp4',
    fileSize: 8192,
    fileMime: 'video/mp4',
    fileCategory: 'CIRCLE',
  }),
  message(79, {
    type: 'FILE',
    text: null,
    fileId: 'file-doc',
    fileName: 'document.pdf',
    fileSize: 8192,
    fileMime: 'application/pdf',
    fileCategory: 'FILE',
  }),
  message(80, {
    text: 'Latest message 080',
  }),
];

function buildMessagesWithLatest(latestMessage: ReturnType<typeof message>) {
  return [...baseMessages, latestMessage];
}

function silentWavBuffer(durationSeconds = 0.25) {
  const sampleRate = 8_000;
  const channelCount = 1;
  const bytesPerSample = 2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(8 * bytesPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function chatFor(chatMessages: Array<ReturnType<typeof message>>) {
  return {
    id: 'chat-1',
    type: 'DIRECT',
    name: null,
    avatarUrl: null,
    createdAt: iso(1),
    updatedAt: chatMessages.at(-1)?.createdAt ?? iso(1),
    lastMessage: chatMessages.at(-1),
    members: [
      {
        id: 'member-1',
        chatId: 'chat-1',
        userId: me.id,
        role: 'MEMBER',
        joinedAt: iso(1),
        profile: me,
      },
      {
        id: 'member-2',
        chatId: 'chat-1',
        userId: other.id,
        role: 'MEMBER',
        joinedAt: iso(1),
        profile: other,
      },
    ],
  };
}

async function mockChatApis(page: Page, chatMessages = mixedMessages) {
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/notifications/push/vapid-key', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ publicKey: 'test-key' }),
    }),
  );
  await page.route('**/api/notifications/push/subscribe', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/notifications/push/unsubscribe', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 201 }));
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  );
  await page.route('**/api/search/users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/api/media/link-preview**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://example.com/',
        canonicalUrl: null,
        title: 'Example',
        description: 'Preview',
        imageUrl: null,
        siteName: 'Example',
        hostname: 'example.com',
      }),
    }),
  );
  await page.route('**/api/media/files/**/content', (route) => {
    const url = route.request().url();
    if (url.includes('audio') || url.includes('voice')) {
      return route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: silentWavBuffer(),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
  await page.route('**/api/chats/chat-1/messages**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: chatMessages, nextCursor: null }),
    }),
  );
  await page.route('**/api/chats/chat-1/read', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/chats**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/chats') {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([chatFor(chatMessages)]),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.locator('body *').evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim().slice(0, 80) ?? '',
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: window.innerWidth,
        };
      })
      .filter(({ width, left, right, viewportWidth }) => width > 0 && (left < -1 || right > viewportWidth + 1)),
  );

  expect(overflowing).toEqual([]);
}

async function getScrollSnapshot(page: Page) {
  return page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll<HTMLElement>('[data-virtuoso-scroller], [style*="overflow"]'));
    const scroller = containers.find((element) => {
      const style = window.getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
    });

    if (!scroller) {
      return null;
    }

    return {
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });
}

async function expectRowFullyVisibleAboveComposer(page: Page, messageId: string) {
  const row = page.locator(`[data-testid="message-row"][data-message-id="${messageId}"]`);
  await expect(row).toBeVisible();

  const visibility = await row.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const composer = document.querySelector<HTMLInputElement>('textarea[placeholder="Write a message..."]');
    const composerRect = composer?.getBoundingClientRect();
    const bottomLimit = composerRect ? composerRect.top : window.innerHeight;

    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      bottomLimit,
      fullyVisible: rect.top >= 0 && rect.bottom <= bottomLimit,
    };
  });

  expect(visibility.height).toBeGreaterThan(0);
  expect(visibility.fullyVisible).toBe(true);
}

test('chat message list opens at latest messages and does not overflow horizontally', async ({ page }) => {
  await mockChatApis(page);
  await page.goto('/chats/chat-1');

  await expect(page.locator('[data-testid="message-row"][data-message-id="message-80"]')).toBeVisible();
  await expect(page.getByTestId('message-bubble').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('chat message list keeps reader position when user is reading older messages', async ({ page }) => {
  await mockChatApis(page);
  await page.goto('/chats/chat-1');
  await expect(page.getByText('Latest message 080')).toBeVisible();

  await page.mouse.wheel(0, -2400);
  await page.waitForTimeout(250);

  const before = await getScrollSnapshot(page);
  expect(before).not.toBeNull();

  await page.waitForTimeout(750);
  const after = await getScrollSnapshot(page);

  expect(after).not.toBeNull();
  expect(Math.abs((after?.scrollTop ?? 0) - (before?.scrollTop ?? 0))).toBeLessThan(120);
  await expectNoHorizontalOverflow(page);
});

const latestMessageCases = [
  {
    name: 'text',
    latest: message(90, { id: 'latest-text', text: 'Latest sent text message' }),
  },
  {
    name: 'long text',
    latest: message(90, {
      id: 'latest-long-text',
      text: 'Latest long text ' + 'unbrokenlatestword'.repeat(24),
    }),
  },
  {
    name: 'image',
    latest: message(90, {
      id: 'latest-image',
      type: 'IMAGE',
      text: null,
      fileId: 'latest-image-file',
      fileName: 'latest-image.png',
      fileSize: 1024,
      fileMime: 'image/png',
      fileCategory: 'IMAGE',
    }),
  },
  {
    name: 'audio',
    latest: message(90, {
      id: 'latest-audio',
      type: 'AUDIO',
      text: null,
      fileId: 'latest-audio-file',
      fileName: 'latest-audio.mp3',
      fileSize: 4096,
      fileMime: 'audio/mpeg',
      fileCategory: 'AUDIO',
    }),
  },
  {
    name: 'voice',
    latest: message(90, {
      id: 'latest-voice',
      type: 'VOICE',
      text: null,
      fileId: 'latest-voice-file',
      fileName: 'latest-voice.webm',
      fileSize: 4096,
      fileMime: 'audio/webm',
      fileCategory: 'VOICE',
    }),
  },
  {
    name: 'video',
    latest: message(90, {
      id: 'latest-video',
      type: 'VIDEO',
      text: null,
      fileId: 'latest-video-file',
      fileName: 'latest-video.mp4',
      fileSize: 8192,
      fileMime: 'video/mp4',
      fileCategory: 'VIDEO',
    }),
  },
  {
    name: 'circle',
    latest: message(90, {
      id: 'latest-circle',
      type: 'VIDEO',
      text: null,
      fileId: 'latest-circle-file',
      fileName: 'latest-circle.mp4',
      fileSize: 8192,
      fileMime: 'video/mp4',
      fileCategory: 'CIRCLE',
    }),
  },
  {
    name: 'file',
    latest: message(90, {
      id: 'latest-file',
      type: 'FILE',
      text: null,
      fileId: 'latest-file-doc',
      fileName: 'latest-document.pdf',
      fileSize: 8192,
      fileMime: 'application/pdf',
      fileCategory: 'FILE',
    }),
  },
] as const;

for (const { name, latest } of latestMessageCases) {
  test(`keeps latest ${name} message fully visible at bottom without showing scroll-to-bottom`, async ({ page }) => {
    await mockChatApis(page, buildMessagesWithLatest(latest));
    await page.goto('/chats/chat-1');

    await expectRowFullyVisibleAboveComposer(page, latest.id);
    await expect(page.getByRole('button', { name: 'New messages' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test('uploaded audio file exposes waveform controls and responds to mobile tap', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile playback smoke runs only against mobile project');

  await mockChatApis(
    page,
    buildMessagesWithLatest(
      message(90, {
        id: 'latest-audio-mobile',
        type: 'AUDIO',
        text: null,
        fileId: 'latest-audio-mobile-file',
        fileName: 'latest-audio-mobile.wav',
        fileSize: 2048,
        fileMime: 'audio/wav',
        fileCategory: 'AUDIO',
      }),
    ),
  );
  await page.goto('/chats/chat-1');

  const row = page.locator('[data-testid="message-row"][data-message-id="latest-audio-mobile"]');
  await expect(row).toBeVisible();
  await expect(row.getByTestId('audio-waveform-message')).toBeVisible();
  await expect(row.getByTestId('audio-waveform')).toBeVisible();

  const playButton = row.getByRole('button', { name: /play audio/i });
  await expect(playButton).toBeVisible();
  await playButton.tap();

  await expect(page.getByTestId('floating-audio-player')).toBeVisible();
  await expect(page.getByTestId('floating-audio-player').getByText('latest-audio-mobile.wav')).toBeVisible();
});
