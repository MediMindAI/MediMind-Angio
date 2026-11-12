// SPDX-License-Identifier: Apache-2.0
/**
 * Boundary + classification tests for the carotid SRU-2003 NASCET auto-suggest.
 *
 * Pins the SRU 2003 consensus table (PSV + plaque estimate primary; ICA/CCA
 * ratio + EDV as tie-breakers), the occlusion-first rule, and the lt50-vs-normal
 * disease gate so a threshold typo can't silently re-grade a stenosis. Mirrors
 * the gold-standard coverage of `arterial-le/abiCalculator.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { suggestNascetCategory, icaCcaRatio, effectiveNascet } from './stenosisCalculator';
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

  describe('SRU 2003 consensus table — one case per row', () => {
    it('Normal: PSV <125, no plaque, ratio <2.0, EDV <40', () => {
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 90, edvCmS: 25, plaqueStenosisPct: 0 }, 'cca-dist': { psvCmS: 80 },
      }), 'right')).toBe('normal');
    });
    it('<50%: PSV <125, plaque <50, ratio <2.0, EDV <40', () => {
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 110, edvCmS: 30, plaqueStenosisPct: 30 }, 'cca-dist': { psvCmS: 80 },
      }), 'right')).toBe('lt50');
    });
    it('50–69%: PSV 125–230, plaque ≥50, ratio 2.0–4.0, EDV 40–100', () => {
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 180, edvCmS: 60, plaqueStenosisPct: 60 }, 'cca-dist': { psvCmS: 60 },
      }), 'right')).toBe('50to69');
    });
    it('≥70%: PSV >230, plaque ≥50, ratio >4.0, EDV >100', () => {
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 300, edvCmS: 130, plaqueStenosisPct: 80 }, 'cca-dist': { psvCmS: 60 },
      }), 'right')).toBe('ge70');
    });
    it('Near occlusion: velocities variable — never auto-filled (manual pick)', () => {
      // A very tight lesion with a collapsed (low) PSV must not read as
      // near-occlusion on its own; the clinician selects it.
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 40, plaqueStenosisPct: 95 },
      }), 'right')).not.toBe('near-occlusion');
    });
    it('Total occlusion: undetectable ICA flow', () => {
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { flowDirection: 'absent', plaqueStenosisPct: 100 },
      }), 'right')).toBe('occluded');
    });
  });

  describe('range boundaries (50–69% band is inclusive at both ends)', () => {
    it('PSV 125 → 50–69, 230 → 50–69, 231 → ≥70', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 125 } }), 'right')).toBe('50to69');
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 230 } }), 'right')).toBe('50to69');
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 231 } }), 'right')).toBe('ge70');
    });
    it('EDV / ratio alone never upgrade when the primaries agree', () => {
      // PSV 150 + plaque 60 % agree on 50–69; EDV 120 + ratio 5 are only additional.
      expect(suggestNascetCategory(rightFindings({
        'ica-prox': { psvCmS: 150, edvCmS: 120, plaqueStenosisPct: 60 }, 'cca-dist': { psvCmS: 30 },
      }), 'right')).toBe('50to69');
    });
  });

  describe('primaries disagree → ratio + EDV break the tie', () => {
    it('PSV <125 but plaque ≥50: EDV ≥40 → 50–69, EDV <40 → <50', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 110, plaqueStenosisPct: 60, edvCmS: 45 } }), 'right')).toBe('50to69');
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 110, plaqueStenosisPct: 60, edvCmS: 30 } }), 'right')).toBe('lt50');
    });
    it('PSV >230 but plaque <50: ratio >4.0 → ≥70, ratio 2.0–4.0 → 50–69', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 260, plaqueStenosisPct: 40 }, 'cca-dist': { psvCmS: 60 } }), 'right')).toBe('ge70');
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 260, plaqueStenosisPct: 40 }, 'cca-dist': { psvCmS: 100 } }), 'right')).toBe('50to69');
    });
    it('no additional values entered → keeps the PSV call', () => {
      expect(suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 180, plaqueStenosisPct: 30 } }), 'right')).toBe('50to69');
    });
  });

  describe('sub-threshold velocity — lt50 vs normal disease gate', () => {
    it('plaque present → lt50', () => {
      expect(
        suggestNascetCategory(rightFindings({ 'ica-prox': { psvCmS: 100, plaquePresent: true } }), 'right'),
      ).toBe('lt50');
    });

    it('non-antegrade flow on the ICA → lt50', () => {
      expect(
        suggestNascetCategory(
          rightFindings({ 'ica-prox': { psvCmS: 100 }, 'ica-mid': { flowDirection: 'retrograde' } }),
          'right',
        ),
      ).toBe('lt50');
    });

    it('disease on a NON-ICA vessel does NOT flip the ICA to lt50 (NASCET is ICA-only)', () => {
      // Retrograde ECA / vertebral steal must not contaminate the ICA stenosis
      // grade — the ICA itself is hemodynamically normal here.
      expect(
        suggestNascetCategory(
          rightFindings({ 'ica-prox': { psvCmS: 100 }, eca: { flowDirection: 'retrograde' } }),
          'right',
        ),
      ).toBe('normal');
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

describe('effectiveNascet', () => {
  it('falls back to the SRU velocity suggestion when no explicit pick exists', () => {
    // ICA PSV 240 → ≥70%; no explicit nascet on the right.
    const findings = rightFindings({ 'ica-prox': { psvCmS: 240 } });
    expect(effectiveNascet(findings, {})).toEqual({ right: 'ge70', left: undefined });
  });

  it('explicit selection always wins over the velocity suggestion', () => {
    // Velocity would suggest ≥70%, but the clinician downgraded to 50–69%.
    const findings = rightFindings({ 'ica-prox': { psvCmS: 230 } });
    expect(effectiveNascet(findings, { right: '50to69' }).right).toBe('50to69');
  });

  it('stays undefined for a side with neither a pick nor enough velocity data', () => {
    expect(effectiveNascet({}, {})).toEqual({ right: undefined, left: undefined });
  });
});
