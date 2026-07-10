import { TextDecoder, TextEncoder } from 'util';

class TestHeaders {}

class TestRequest {
  readonly url: string;
  readonly method: string;
  readonly signal: AbortSignal | null;

  constructor(input: string | URL, init?: { method?: string; signal?: AbortSignal }) {
    this.url = String(input);
    this.method = init?.method ?? 'GET';
    this.signal = init?.signal ?? null;
  }
}

Object.assign(globalThis, {
  Headers: globalThis.Headers ?? TestHeaders,
  Request: globalThis.Request ?? TestRequest,
  TextDecoder,
  TextEncoder,
});
