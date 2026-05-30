// SPDX-License-Identifier: Apache-2.0
/**
 * stenosisCalculator — pure-fn SRU 2003 NASCET category auto-suggest.
 *
 * Looks at ICA PSV, EDV, and the ICA/CCA ratio (when CCA-distal PSV is
 * known) to suggest a category. Returns `undefined` when inputs are
 * insufficient — caller shows no suggestion rather than guessing.
 */

import {
  CAROTID_VESSELS,
  SRU_THRESHOLDS,
  type CarotidFindings,
  type CarotidNascetClassification,
  type CarotidVesselFullId,
  type NascetCategory,
} from './config';

/** Max PSV across ICA segments on one side. */
function maxIcaPsv(findings: CarotidFindings, side: 'left' | 'right'): number | undefined {
  let max: number | undefined;
  for (const base of ['ica-prox', 'ica-mid', 'ica-dist'] as const) {
    const id = `${base}-${side}` as CarotidVesselFullId;
    const f = findings[id];
    if (f?.psvCmS !== undefined) {
      max = max === undefined ? f.psvCmS : Math.max(max, f.psvCmS);
    }
  }
  return max;
}

/** Max EDV across ICA segments on one side. */
function maxIcaEdv(findings: CarotidFindings, side: 'left' | 'right'): number | undefined {
  let max: number | undefined;
  for (const base of ['ica-prox', 'ica-mid', 'ica-dist'] as const) {
    const id = `${base}-${side}` as CarotidVesselFullId;
    const f = findings[id];
    if (f?.edvCmS !== undefined) {
      max = max === undefined ? f.edvCmS : Math.max(max, f.edvCmS);
    }
  }
  return max;
}

/** PSV at the distal CCA on one side — used as ICA/CCA ratio denominator. */
function ccaDistalPsv(findings: CarotidFindings, side: 'left' | 'right'): number | undefined {
  const f = findings[`cca-dist-${side}` as CarotidVesselFullId];
  return f?.psvCmS;
}

/**
 * True when the ICA on this side carries plaque or a non-antegrade flow.
 * NASCET grades the ICA only, so the lt50-vs-normal gate must look at ICA
 * segments alone — disease on the ECA/vertebral/subclavian must not flip a
 * hemodynamically normal ICA to "< 50 %".
 */
function anyIcaDiseaseOnSide(findings: CarotidFindings, side: 'left' | 'right'): boolean {
  for (const base of ['ica-prox', 'ica-mid', 'ica-dist'] as const) {
    const f = findings[`${base}-${side}` as CarotidVesselFullId];
    if (!f) continue;
    if (f.plaquePresent) return true;
    if (f.plaqueMorphology !== undefined && f.plaqueMorphology !== 'none') return true;
    if (f.flowDirection === 'retrograde' || f.flowDirection === 'absent') return true;
  }
  return false;
}

/**
 * Auto-suggest a NASCET category for one side. `undefined` when inputs
 * are too sparse to classify.
 */
export function suggestNascetCategory(
  findings: CarotidFindings,
  side: 'left' | 'right',
): NascetCategory | undefined {
  // Check occlusion first — any ICA segment with flow='absent'.
  for (const base of ['ica-prox', 'ica-mid', 'ica-dist'] as const) {
    const id = `${base}-${side}` as CarotidVesselFullId;
    const f = findings[id];
    if (f?.flowDirection === 'absent') return 'occluded';
  }

  const psv = maxIcaPsv(findings, side);
  if (psv === undefined) return undefined;

  const edv = maxIcaEdv(findings, side);
  const ccaPsv = ccaDistalPsv(findings, side);
  const ratio = ccaPsv && ccaPsv > 0 ? psv / ccaPsv : undefined;

  // ≥ 70 % triggers on any of three criteria per SRU 2003.
  if (
    psv >= SRU_THRESHOLDS.psvGe70 ||
    (edv !== undefined && edv >= SRU_THRESHOLDS.edvGe70) ||
    (ratio !== undefined && ratio >= SRU_THRESHOLDS.ratioGe70)
  ) {
    return 'ge70';
  }

  if (psv >= SRU_THRESHOLDS.psvGe50) {
    return '50to69';
  }

  // Sub-threshold velocity. Distinguish a truly normal ICA from mild
  // (< 50 %) atherosclerosis: only call it < 50 % when ICA plaque or a
  // non-antegrade ICA waveform is present, otherwise report it as normal.
  return anyIcaDiseaseOnSide(findings, side) ? 'lt50' : 'normal';
}

/**
 * Effective per-side NASCET used to color the diagram: the clinician's explicit
 * selection when present, otherwise the live SRU velocity suggestion. This makes
 * typed ICA velocities color the ICA/bulb immediately (the NASCET picker stays an
 * override). Returns `undefined` for a side with neither an explicit pick nor
 * enough velocity data, so vessels with no measurements stay normal.
 */
export function effectiveNascet(
  findings: CarotidFindings,
  nascet: CarotidNascetClassification,
): CarotidNascetClassification {
  return {
    right: nascet.right ?? suggestNascetCategory(findings, 'right'),
    left: nascet.left ?? suggestNascetCategory(findings, 'left'),
  };
}

/** Compute the ICA/CCA ratio on one side. Returns `null` when not computable. */
export function icaCcaRatio(
  findings: CarotidFindings,
  side: 'left' | 'right',
): number | null {
  const icaPsv = maxIcaPsv(findings, side);
  const ccaPsv = ccaDistalPsv(findings, side);
  if (icaPsv === undefined || ccaPsv === undefined || ccaPsv === 0) return null;
  return icaPsv / ccaPsv;
}

/** Human-friendly label for a NASCET category. */
export function nascetCategoryFallback(cat: NascetCategory): string {
  switch (cat) {
    case 'normal':         return 'Normal';
    case 'lt50':           return '< 50 %';
    case '50to69':         return '50–69 %';
    case 'ge70':           return '≥ 70 %';
    case 'near-occlusion': return 'Near-occlusion';
    case 'occluded':       return 'Occluded';
  }
}

/** Severity role for a NASCET category. */
export function nascetCategoryColorRole(
  cat: NascetCategory | undefined,
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (cat) {
    case 'normal':         return 'success';
    case 'lt50':           return 'success';
    case '50to69':         return 'warning';
    case 'ge70':
    case 'near-occlusion':
    case 'occluded':       return 'error';
    default:               return 'neutral';
  }
}

// Unused but exported for future import from FHIR builder.
export { CAROTID_VESSELS };
