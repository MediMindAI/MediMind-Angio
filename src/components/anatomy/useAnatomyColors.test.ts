// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 1.3 — Area 01 CRITICAL guard.
 *
 * colorForCompetency must NEVER throw when handed an unknown enum value.
 * A stale draft, a renamed enum after schema migration, or a hand-edited
 * localStorage payload would otherwise return undefined, the destructure
 * `{ fill, stroke } = ...` would throw, and the entire study screen would
 * unmount.
 */

import { describe, expect, it, vi } from 'vitest';
import { colorForCompetency } from './useAnatomyColors';
import { COMPETENCY_COLORS } from '../../constants/theme-colors';
import type { Competency } from '../../types/anatomy';

describe('colorForCompetency', () => {
  it('returns the expected palette for a known competency', () => {
    expect(colorForCompetency('normal')).toEqual(COMPETENCY_COLORS.normal);
    expect(colorForCompetency('incompetent')).toEqual(COMPETENCY_COLORS.incompetent);
  });

  it('falls back to the inconclusive palette for an unknown value (does NOT throw)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = colorForCompetency('garbage' as Competency);
    expect(result).toEqual(COMPETENCY_COLORS.inconclusive);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown competency'),
      'garbage',
    );
    warnSpy.mockRestore();
  });

  it('handles undefined input via the same fallback path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cast simulates a stale draft loaded from localStorage with a missing field.
    const result = colorForCompetency(undefined as unknown as Competency);
    expect(result).toEqual(COMPETENCY_COLORS.inconclusive);
    warnSpy.mockRestore();
  });
});
