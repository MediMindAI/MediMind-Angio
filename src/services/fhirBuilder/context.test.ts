// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 5.1 — Dead-code removal regression tests.
 *
 * `newUuid()` previously had a `Math.random()` fallback that papered over a
 * missing `crypto.randomUUID`. The fallback was dead in practice (every
 * supported runtime — Node 19+, modern browsers — provides WebCrypto). We
 * replaced it with an explicit `throw` so an unsupported environment fails
 * loudly instead of silently emitting non-cryptographic IDs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUuid } from './context';

describe('newUuid (Wave 5.1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a uuid string when crypto.randomUUID is available', () => {
    const id = newUuid();
    expect(typeof id).toBe('string');
    // RFC 4122 UUID shape — 36 chars, four dashes.
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('throws a clear error when crypto.randomUUID is missing', () => {
    // Stub `crypto.randomUUID` to undefined for this test only. We use
    // `vi.spyOn` so `afterEach` cleanly restores the real implementation.
    vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue({
      ...globalThis.crypto,
      // Force the typeof check to fail without deleting the property.
      randomUUID: undefined as unknown as Crypto['randomUUID'],
    });

    expect(() => newUuid()).toThrow(/crypto\.randomUUID not available/);
  });
});
