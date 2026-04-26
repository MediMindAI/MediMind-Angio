// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 2.5 — type guards for `FormStateBase.parameters` payloads.
 *
 * Each guard accepts `unknown` and narrows to the matching study payload type.
 * The runtime check is deliberately minimal ("non-null, non-array object") —
 * deep-field validation is a Wave 4 hardening task. These tests pin the
 * boundary semantics so future tightening is intentional.
 */

import { describe, expect, it } from 'vitest';
import {
  isArterialFindings,
  isArterialPressures,
  isCarotidFindings,
  isCarotidNascet,
  isVenousFindings,
} from './parameters';

const guards = [
  ['isVenousFindings', isVenousFindings],
  ['isArterialFindings', isArterialFindings],
  ['isArterialPressures', isArterialPressures],
  ['isCarotidFindings', isCarotidFindings],
  ['isCarotidNascet', isCarotidNascet],
] as const;

describe('parameters type guards (Wave 2.5)', () => {
  describe.each(guards)('%s', (_name, guard) => {
    it('returns true for a plain object', () => {
      expect(guard({})).toBe(true);
      expect(guard({ foo: 'bar' })).toBe(true);
    });

    it('returns true for a Readonly-shaped findings map', () => {
      // Concrete payload shapes (sourced from the study configs).
      expect(guard({ 'pop-left': { compressibility: 'compressible' } })).toBe(true);
    });

    it('returns false for null', () => {
      expect(guard(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(guard(undefined)).toBe(false);
    });

    it('returns false for primitives', () => {
      expect(guard('string')).toBe(false);
      expect(guard(42)).toBe(false);
      expect(guard(true)).toBe(false);
    });

    it('returns false for arrays (arrays are not plain objects)', () => {
      // The boundary ALWAYS receives keyed maps — never positional arrays.
      // Keeping arrays out is the one drift we deliberately catch here.
      expect(guard([])).toBe(false);
      expect(guard(['not', 'a', 'map'])).toBe(false);
    });
  });

  it('narrowing works in TS — guard return type is honored', () => {
    const x: unknown = { 'cfa-left': { stenosisCategory: '50-69' } };
    if (isArterialFindings(x)) {
      // After the guard, TS knows `x` is `ArterialSegmentFindings`. Reading
      // a per-segment finding by key is now type-safe (no `as` needed).
      expect(x['cfa-left']?.stenosisCategory).toBe('50-69');
    } else {
      throw new Error('guard should have narrowed');
    }
  });
});
