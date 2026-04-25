import '@testing-library/jest-dom/vitest';

// jsdom doesn't always provide crypto.randomUUID — polyfill only when missing.
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - assign minimal stub on the test global
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  // RFC 4122 v4-ish stub — adequate for tests, NOT for production code.
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`,
  });
}
