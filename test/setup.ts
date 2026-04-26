import '@testing-library/jest-dom/vitest';
// jsdom doesn't implement IndexedDB. fake-indexeddb installs a Pure-JS
// shim on the global so `idb-keyval` and any direct IDBFactory consumers
// can run under Vitest. Importing the auto-install entry point is enough.
import 'fake-indexeddb/auto';

// jsdom doesn't implement matchMedia. Mantine's color-scheme manager calls
// it in a useEffect on mount, which throws in jsdom without this stub.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},        // legacy API still called by some libs
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom doesn't implement ResizeObserver. Mantine's ScrollArea (used inside
// MultiSelect dropdowns) calls it in a layout effect, which throws under
// jsdom without this stub. Phase 2.b — landed alongside EncounterIntake's
// ICD-10 multiselect; reusable for any future Mantine dropdown.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  // @ts-expect-error - assign minimal stub on the test global
  globalThis.ResizeObserver = ResizeObserverStub;
}

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
