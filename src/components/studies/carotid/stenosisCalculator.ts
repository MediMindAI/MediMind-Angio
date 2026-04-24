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

  return 'lt50';
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
