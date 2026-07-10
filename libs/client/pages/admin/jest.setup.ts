import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, {
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
});
