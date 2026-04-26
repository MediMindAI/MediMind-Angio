// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.7 (Part 03 HIGH) — abiCalculator boundary + classification tests.
 *
 * Pins the ABI band-classification semantics so the inclusive-bound fix at
 * 1.30 cannot silently regress. Adding band coverage at every threshold
 * boundary protects against off-by-one errors at any future threshold edit.
 */

import { describe, expect, it } from 'vitest';
import { bandForRatio, computeAbi, computeTbi } from './abiCalculator';
import { ARTERIAL_NORMAL_FINDING, ARTERIAL_OCCLUSION_FINDING } from './config';
import type { SegmentalPressures } from './config';

describe('bandForRatio (Wave 3.7)', () => {
  // ---- Boundary fix: ABI 1.30 must classify as 'non-compressible' ----------
  it('classifies ABI = 1.30 as non-compressible (inclusive bound)', () => {
    expect(bandForRatio(1.30)).toBe('non-compressible');
  });

  it('classifies ABI = 1.29 as normal (just below the non-compressible bound)', () => {
    expect(bandForRatio(1.29)).toBe('normal');
  });

  // ---- Other band boundaries ----------------------------------------------
  it('classifies ABI = 0.90 as normal (lower normal bound)', () => {
    expect(bandForRatio(0.90)).toBe('normal');
  });

  it('classifies ABI = 0.89 as mild', () => {
    expect(bandForRatio(0.89)).toBe('mild');
  });

  it('classifies ABI = 0.70 as mild (lower mild bound)', () => {
    expect(bandForRatio(0.70)).toBe('mild');
  });

  it('classifies ABI = 0.69 as moderate', () => {
    expect(bandForRatio(0.69)).toBe('moderate');
  });

  it('classifies ABI = 0.40 as moderate (lower moderate bound)', () => {
    expect(bandForRatio(0.40)).toBe('moderate');
  });

  it('classifies ABI = 0.39 as severe', () => {
    expect(bandForRatio(0.39)).toBe('severe');
  });

  it('classifies ABI = 0 as severe', () => {
    expect(bandForRatio(0)).toBe('severe');
  });

  // ---- Spot checks above & below ------------------------------------------
  it('classifies ABI = 1.50 as non-compressible (well above bound)', () => {
    expect(bandForRatio(1.50)).toBe('non-compressible');
  });

  it('classifies ABI = 1.05 as normal (typical healthy)', () => {
    expect(bandForRatio(1.05)).toBe('normal');
  });

  // ---- Defensive cases ----------------------------------------------------
  it('returns unknown for null', () => {
    expect(bandForRatio(null)).toBe('unknown');
  });

  it('returns unknown for NaN', () => {
    expect(bandForRatio(Number.NaN)).toBe('unknown');
  });

  it('returns unknown for Infinity', () => {
    expect(bandForRatio(Number.POSITIVE_INFINITY)).toBe('unknown');
  });
});

describe('computeAbi integration (Wave 3.7)', () => {
  it('classifies a calcinosis pressure profile (ABI exactly 1.30) as non-compressible', () => {
    // brachial 100, ankle 130 → ABI = 1.30 exactly.
    const p: SegmentalPressures = {
      brachialL: 100,
      brachialR: 100,
      ankleDpL: 130,
      anklePtL: 125,
    };
    const r = computeAbi(p, 'L');
    expect(r.abi).toBe(1.30);
    expect(r.band).toBe('non-compressible');
  });

  it('classifies a healthy patient (ABI 1.05) as normal', () => {
    const p: SegmentalPressures = {
      brachialL: 130,
      brachialR: 130,
      ankleDpR: 137,
      anklePtR: 135,
    };
    const r = computeAbi(p, 'R');
    expect(r.band).toBe('normal');
  });

  it('returns unknown when no ankle pressure is captured for that side', () => {
    const p: SegmentalPressures = {
      brachialL: 130,
      brachialR: 130,
    };
    expect(computeAbi(p, 'L').band).toBe('unknown');
  });
});

describe('computeTbi (Wave 3.7)', () => {
  it('classifies a non-compressible patient using TBI fallback', () => {
    // ABI is non-diagnostic; TBI 0.50 → moderate.
    const p: SegmentalPressures = {
      brachialL: 130,
      brachialR: 130,
      ankleDpR: 220,
      toeR: 65,
    };
    const r = computeTbi(p, 'R');
    expect(r.tbi).toBeCloseTo(0.50, 2);
    expect(r.band).toBe('moderate');
  });

  it('returns unknown when no toe pressure is captured', () => {
    const p: SegmentalPressures = {
      brachialL: 130,
      brachialR: 130,
    };
    expect(computeTbi(p, 'L').band).toBe('unknown');
  });
});

describe('ARTERIAL_*_FINDING constants are frozen (Wave 3.7)', () => {
  it('ARTERIAL_NORMAL_FINDING is frozen so a single mutation cannot corrupt every shared template slot', () => {
    expect(Object.isFrozen(ARTERIAL_NORMAL_FINDING)).toBe(true);
  });

  it('ARTERIAL_OCCLUSION_FINDING is frozen so a single mutation cannot corrupt every shared template slot', () => {
    expect(Object.isFrozen(ARTERIAL_OCCLUSION_FINDING)).toBe(true);
  });

  it('attempting to mutate ARTERIAL_NORMAL_FINDING throws in strict mode (or silently no-ops)', () => {
    // In strict mode (ESM modules are strict by default) writing to a frozen
    // property throws a TypeError. Outside strict it silently no-ops. Either
    // way, the constant must not change.
    const before = ARTERIAL_NORMAL_FINDING.waveform;
    try {
      // @ts-expect-error — intentionally probing the frozen guarantee
      ARTERIAL_NORMAL_FINDING.waveform = 'absent';
    } catch {
      /* expected in strict mode */
    }
    expect(ARTERIAL_NORMAL_FINDING.waveform).toBe(before);
  });
});
