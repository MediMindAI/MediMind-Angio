// SPDX-License-Identifier: Apache-2.0
/**
 * Boundary + classification tests for the carotid SRU-2003 NASCET auto-suggest.
 *
 * Pins the SRU velocity thresholds (PSV ≥230 / EDV ≥100 / ratio ≥4.0 for ≥70%,
 * PSV ≥125 for 50–69%), the occlusion-first rule, and the lt50-vs-normal
 * disease gate so a threshold typo can't silently re-grade a stenosis. Mirrors
 * the gold-standard coverage of `arterial-le/abiCalculator.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { suggestNascetCategory, icaCcaRatio } from './stenosisCalculator';
import type { CarotidFindings, CarotidVesselFinding } from './config';

/** Build a right-side findings map from per-vessel partials. */
function rightFindings(
  parts: Partial<Record<string, Partial<CarotidVesselFinding>>>,
): CarotidFindings {
  const out: Record<string, CarotidVesselFinding> = {};
  for (const [base, finding] of Object.entries(parts)) {
    out[`${base}-right`] = { ...(finding ?? {}) } as CarotidVesselFinding;
  }
  return out as CarotidFindings;
}

describe('suggestNascetCategory', () => {
  it('returns undefined when no ICA PSV is entered (too sparse to classify)', () => {
    expect(suggestNascetCategory(rightFindings({}), 'right')).toBeUndefined();
    // EDV alone (no PSV) is still insufficient.
    expect(
      suggestNascetCategory(rightFindings({ 'ica-prox': { edvCmS: 120 } }), 'right'),
    ).toBeUndefined();
  });

  it('occlusion wins regardless of velocities (absent ICA flow)', () => {
    expect(
      suggestNascetCategory(
        rightFindings({ 'ica-prox': { flowDirection: 'absent', psvCmS: 300 } }),
        'right',
      ),
    ).toBe('occluded');
  });

  describe('≥70% — any of three SRU criteria', () => {
    it('PSV ≥230 (inclusive boundary)', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 230 } }), 'right')).toBe('ge70');
      // 229 falls to 50–69 (still ≥125).
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 229 } }), 'right')).toBe('50to69');
    });

    it('EDV ≥100 (inclusive boundary) with sub-230 PSV', () => {
      expect(
        suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 150, edvCmS: 100 } }), 'right'),
      ).toBe('ge70');
      expect(
        suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 150, edvCmS: 99 } }), 'right'),
      ).toBe('50to69');
    });

    it('ICA/CCA ratio ≥4.0 (inclusive boundary) with sub-230 PSV', () => {
      // ICA 200 / CCA-dist 50 = 4.0 exactly.
      expect(
        suggestNascetCategory(
          rightFindings({ 'ica-prox': { psvCmS: 200 }, 'cca-dist': { psvCmS: 50 } }),
          'right',
        ),
      ).toBe('ge70');
      // 196 / 50 = 3.92 → just under, stays 50–69.
      expect(
        suggestNascetCategory(
          rightFindings({ 'ica-prox': { psvCmS: 196 }, 'cca-dist': { psvCmS: 50 } }),
          'right',
        ),
      ).toBe('50to69');
    });
  });

  describe('50–69% — PSV ≥125', () => {
    it('125 is the inclusive lower bound', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 125 } }), 'right')).toBe('50to69');
    });
  });

  describe('sub-threshold velocity — lt50 vs normal disease gate', () => {
    it('plaque present → lt50', () => {
      expect(
        suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 100, plaquePresent: true } }), 'right'),
      ).toBe('lt50');
    });

    it('non-antegrade flow on any vessel → lt50', () => {
      expect(
        suggestNascetCategory(
          rightFindings({ 'ica-prox': { psvCmS: 100 }, eca: { flowDirection: 'retrograde' } }),
          'right',
        ),
      ).toBe('lt50');
    });

    it('clean low-velocity study → normal', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 80 } }), 'right')).toBe('normal');
    });
  });

  it('uses the MAX PSV across ICA segments on the side', () => {
    expect(
      suggestNascetCategory(
        rightFindings({ 'ica-prox': { psvCmS: 100 }, 'ica-dist': { psvCmS: 240 } }),
        'right',
      ),
    ).toBe('ge70');
  });

  it('never auto-suggests near-occlusion (deliberate; manual override only)', () => {
    const cats = [80, 124, 125, 229, 230, 400].map((psv) =>
      suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: psv, plaquePresent: true } }), 'right'),
    );
    expect(cats).not.toContain('near-occlusion');
  });
});

describe('icaCcaRatio', () => {
  it('computes max-ICA-PSV / CCA-distal-PSV', () => {
    expect(
      icaCcaRatio(rightFindings({ 'ica-prox': { psvCmS: 200 }, 'cca-dist': { psvCmS: 50 } }), 'right'),
    ).toBe(4);
  });

  it('returns null when the CCA-distal denominator is 0, missing, or ICA is missing', () => {
    expect(icaCcaRatio(rightFindings({ 'ica-prox': { psvCmS: 200 }, 'cca-dist': { psvCmS: 0 } }), 'right')).toBeNull();
    expect(icaCcaRatio(rightFindings({ 'ica-prox': { psvCmS: 200 } }), 'right')).toBeNull();
    expect(icaCcaRatio(rightFindings({ 'cca-dist': { psvCmS: 50 } }), 'right')).toBeNull();
  });
});
