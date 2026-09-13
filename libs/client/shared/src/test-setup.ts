import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

// The jsdom environment used here exposes no Web Storage (probe: both
// `localStorage` and `window.localStorage` are undefined). Provide a minimal
// in-memory stub so specs can use the Web Storage API. Guarded: a real
// implementation always wins.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const stub = {
    get length(): number {
      return store.size;
    },
    key(index: number): string | null {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
  vi.stubGlobal('localStorage', stub);
}
