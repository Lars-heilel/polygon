import { describe, expect, it } from 'vitest';

import { mergeDeltaIntoPages } from '../../message-cache.js';

interface TestPage {
  nextCursor: string | null;
  messages: { id: string; text: string | null }[];
}

interface TestData {
  pages: TestPage[];
  pageParams: unknown[];
}

const data = (messages: { id: string; text: string | null }[]): TestData => ({
  pages: [{ nextCursor: null, messages }],
  pageParams: [undefined],
});

describe('mergeDeltaIntoPages', () => {
  it('updates the cached entry when the delta contains an edited message', () => {
    const next = mergeDeltaIntoPages(
      data([{ id: 'm1', text: 'original' }]),
      [{ id: 'm1', text: 'edited' }],
      [],
    );

    expect(next?.pages.flatMap((p) => p.messages)).toEqual([{ id: 'm1', text: 'edited' }]);
  });

  it('appends new delta messages without duplicating existing ids', () => {
    const next = mergeDeltaIntoPages(
      data([{ id: 'm1', text: 'hi' }]),
      [
        { id: 'm1', text: 'hi' },
        { id: 'm2', text: 'new' },
      ],
      [],
    );

    expect(next?.pages.flatMap((p) => p.messages).map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
