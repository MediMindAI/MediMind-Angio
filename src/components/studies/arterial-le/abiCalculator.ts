// SPDX-License-Identifier: Apache-2.0
/**
 * abiCalculator — pure-function ABI / TBI computation + classification.
 *
 * ABI (Ankle-Brachial Index) = highest ankle pressure on that side
 *                              ÷ higher of the two brachial pressures.
 * TBI (Toe-Brachial Index)  = toe pressure ÷ higher brachial.
 *
 * Rutherford / ESVS 2024 bands:
 *   > 1.30   non-compressible (medial calcinosis — common in DM/ESRD)
 *   0.90–1.30 normal
 *   0.70–0.89 mild PAD
 *   0.40–0.69 moderate PAD
 *   < 0.40   severe / CLI
 */

import {
  ABI_THRESHOLDS,
  type AbiBand,
  type SegmentalPressures,
} from './config';

export interface AbiResult {
  readonly abi: number | null;       // null when inputs insufficient
  readonly band: AbiBand;
}

export interface TbiResult {
  readonly tbi: number | null;
  readonly band: AbiBand;             // same bands apply
}

/** Reference brachial = higher of L vs R (per standard protocol). */
function referenceBrachial(p: SegmentalPressures): number | null {
  const l = p.brachialL;
  const r = p.brachialR;
  if ((l === undefined || !Number.isFinite(l)) && (r === undefined || !Number.isFinite(r))) {
    return null;
  }
  if (l === undefined || !Number.isFinite(l)) return r ?? null;
  if (r === undefined || !Number.isFinite(r)) return l;
  return Math.max(l, r);
}

/** Highest ankle pressure for a given side. */
function highestAnkle(p: SegmentalPressures, side: 'L' | 'R'): number | null {
  const dp = side === 'L' ? p.ankleDpL : p.ankleDpR;
  const pt = side === 'L' ? p.anklePtL : p.anklePtR;
  const candidates = [dp, pt].filter(
    (x): x is number => x !== undefined && Number.isFinite(x),
  );
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function bandForRatio(ratio: number | null): AbiBand {
  if (ratio === null || !Number.isFinite(ratio)) return 'unknown';
  if (ratio > ABI_THRESHOLDS.nonCompressible) return 'non-compressible';
  if (ratio >= ABI_THRESHOLDS.normalLower) return 'normal';
  if (ratio >= ABI_THRESHOLDS.mildLower) return 'mild';
  if (ratio >= ABI_THRESHOLDS.moderateLower) return 'moderate';
  return 'severe';
}

/** ABI for one side. */
export function computeAbi(p: SegmentalPressures, side: 'L' | 'R'): AbiResult {
  const ankle = highestAnkle(p, side);
  const brachial = referenceBrachial(p);
  if (ankle === null || brachial === null || brachial === 0) {
    return { abi: null, band: 'unknown' };
  }
  const abi = ankle / brachial;
  return { abi, band: bandForRatio(abi) };
}

/** TBI for one side. */
export function computeTbi(p: SegmentalPressures, side: 'L' | 'R'): TbiResult {
  const toe = side === 'L' ? p.toeL : p.toeR;
  const brachial = referenceBrachial(p);
  if (
    toe === undefined ||
    !Number.isFinite(toe) ||
    brachial === null ||
    brachial === 0
  ) {
    return { tbi: null, band: 'unknown' };
  }
  const tbi = toe / brachial;
  return { tbi, band: bandForRatio(tbi) };
}

/** Human-facing band translation key for i18n lookup. */
export function abiBandI18nKey(band: AbiBand): string {
  return `arterialLE.abi.band.${band}`;
}

/** Color role mapping for badge tint. */
export function abiBandColorRole(
  band: AbiBand,
): 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (band) {
    case 'normal':
      return 'success';
    case 'non-compressible':
      return 'info';
    case 'mild':
      return 'warning';
    case 'moderate':
    case 'severe':
      return 'error';
    default:
      return 'neutral';
  }
}
