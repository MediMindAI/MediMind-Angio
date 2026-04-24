// SPDX-License-Identifier: Apache-2.0
/**
 * Arterial LE Duplex — Study Configuration
 *
 * Canonical per-segment parameter matrix for bilateral lower-extremity
 * arterial duplex ultrasound. Mirrors the structure of venous-le/config.ts
 * but captures waveform morphology, peak systolic velocity, stenosis
 * category, plaque characteristics, and occlusion state instead of
 * compressibility/reflux.
 *
 * Segment catalog derived from IAC Vascular Testing Standards + ESVS 2024
 * lower-extremity arterial practice parameter. 14 segments × 2 sides = 28
 * FullSegmentIds.
 */

import type { ParameterDef, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';

// ============================================================================
// Segment catalog — anatomical order proximal → distal
// ============================================================================

export const ARTERIAL_LE_SEGMENTS = [
  'cia',        // Common iliac artery
  'eia',        // External iliac artery
  'cfa',        // Common femoral artery
  'pfa',        // Profunda femoris artery
  'sfa-prox',   // Superficial femoral, proximal
  'sfa-mid',    // Superficial femoral, mid
  'sfa-dist',   // Superficial femoral, distal (adductor canal)
  'pop-ak',     // Popliteal above knee
  'pop-bk',     // Popliteal below knee
  'tpt',        // Tibioperoneal trunk
  'ata',        // Anterior tibial artery
  'pta',        // Posterior tibial artery
  'per',        // Peroneal artery
  'dp',         // Dorsalis pedis artery
] as const;

export type ArterialLESegmentBase = (typeof ARTERIAL_LE_SEGMENTS)[number];
export type Side = 'left' | 'right';
export type ArterialLEFullSegmentId = `${ArterialLESegmentBase}-${Side}`;

export function allArterialLEFullIds(): ReadonlyArray<ArterialLEFullSegmentId> {
  const out: ArterialLEFullSegmentId[] = [];
  for (const s of ARTERIAL_LE_SEGMENTS) {
    out.push(`${s}-left` as ArterialLEFullSegmentId);
    out.push(`${s}-right` as ArterialLEFullSegmentId);
  }
  return out;
}

// ============================================================================
// Categorical parameter value enums
// ============================================================================

export const WAVEFORM_VALUES = [
  'triphasic',
  'biphasic',
  'monophasic-phasic',
  'monophasic-damped',
  'absent',
] as const;
export type Waveform = (typeof WAVEFORM_VALUES)[number];

export const STENOSIS_CATEGORY_VALUES = [
  'none',        // < 30 %
  'mild',        // 30–49 %
  'moderate',    // 50–69 %
  'severe',      // 70–99 %
  'occluded',
] as const;
export type StenosisCategory = (typeof STENOSIS_CATEGORY_VALUES)[number];

export const PLAQUE_MORPHOLOGY_VALUES = [
  'none',
  'calcified',
  'mixed',
  'soft',
] as const;
export type PlaqueMorphology = (typeof PLAQUE_MORPHOLOGY_VALUES)[number];

// ============================================================================
// Per-segment findings shape
// ============================================================================

export interface ArterialSegmentFinding {
  readonly waveform?: Waveform;
  /** Peak systolic velocity (UCUM `cm/s`). */
  readonly psvCmS?: number;
  /** Velocity ratio (Vr = PSV_stenosis / PSV_prestenosis). Optional. */
  readonly velocityRatio?: number;
  /** Stenosis percentage (0–100). Auto-categorized via `stenosisCategoryFromPct()`. */
  readonly stenosisPct?: number;
  /** Explicit stenosis category (overrides auto-derivation if set). */
  readonly stenosisCategory?: StenosisCategory;
  /** Occluded = no flow signal. */
  readonly occluded?: boolean;
  readonly plaqueMorphology?: PlaqueMorphology;
  /** Plaque length in mm. */
  readonly plaqueLengthMm?: number;
  readonly note?: string;
}

export type ArterialSegmentFindings = Readonly<
  Partial<Record<ArterialLEFullSegmentId, ArterialSegmentFinding>>
>;

// ============================================================================
// Segmental pressures (separate table, not per-segment)
// ============================================================================

export const PRESSURE_LEVELS = [
  'brachial',
  'high-thigh',
  'low-thigh',
  'calf',
  'ankle-dp',
  'ankle-pt',
  'toe',
] as const;
export type PressureLevel = (typeof PRESSURE_LEVELS)[number];

export interface SegmentalPressures {
  readonly brachialL?: number;
  readonly brachialR?: number;
  readonly highThighL?: number;
  readonly highThighR?: number;
  readonly lowThighL?: number;
  readonly lowThighR?: number;
  readonly calfL?: number;
  readonly calfR?: number;
  readonly ankleDpL?: number;
  readonly ankleDpR?: number;
  readonly anklePtL?: number;
  readonly anklePtR?: number;
  readonly toeL?: number;
  readonly toeR?: number;
}

// ============================================================================
// ABI / TBI classification bands
// ============================================================================

export type AbiBand =
  | 'non-compressible'   // >1.30
  | 'normal'             // 0.90–1.30
  | 'mild'               // 0.70–0.89
  | 'moderate'           // 0.40–0.69
  | 'severe'             // <0.40
  | 'unknown';

export const ABI_THRESHOLDS = {
  nonCompressible: 1.30,
  normalLower: 0.90,
  mildLower: 0.70,
  moderateLower: 0.40,
} as const;

// ============================================================================
// Derivation helpers
// ============================================================================

/** Category from a numeric stenosis percentage. */
export function stenosisCategoryFromPct(
  pct: number | undefined,
  occluded?: boolean,
): StenosisCategory {
  if (occluded) return 'occluded';
  if (pct === undefined || Number.isNaN(pct)) return 'none';
  if (pct >= 100) return 'occluded';
  if (pct >= 70) return 'severe';
  if (pct >= 50) return 'moderate';
  if (pct >= 30) return 'mild';
  return 'none';
}

/** Hemodynamically significant = moderate or worse OR occluded. */
export function isHemodynamicallySignificant(
  finding: ArterialSegmentFinding | undefined,
): boolean {
  if (!finding) return false;
  const category = finding.stenosisCategory
    ?? stenosisCategoryFromPct(finding.stenosisPct, finding.occluded);
  return category === 'moderate' || category === 'severe' || category === 'occluded';
}

// ============================================================================
// Parameter definitions (for dynamic form renderer / FHIR builder)
// ============================================================================

export const CATEGORICAL_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'waveform',
    label: 'arterialLE.param.waveform',
    kind: 'select',
    options: WAVEFORM_VALUES.map((v) => ({ value: v, label: `arterialLE.waveform.${v}` })),
  },
  {
    id: 'stenosisCategory',
    label: 'arterialLE.param.stenosisCategory',
    kind: 'select',
    options: STENOSIS_CATEGORY_VALUES.map((v) => ({
      value: v,
      label: `arterialLE.stenosis.${v}`,
    })),
  },
  {
    id: 'plaqueMorphology',
    label: 'arterialLE.param.plaqueMorphology',
    kind: 'select',
    options: PLAQUE_MORPHOLOGY_VALUES.map((v) => ({
      value: v,
      label: `arterialLE.plaque.${v}`,
    })),
  },
];

export const NUMERIC_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'psvCmS',
    label: 'arterialLE.param.psvCmS',
    kind: 'velocity-cm-s',
    unit: 'cm/s',
    min: 0,
    max: 800,
    step: 10,
    help: 'arterialLE.help.psvCmS',
  },
  {
    id: 'stenosisPct',
    label: 'arterialLE.param.stenosisPct',
    kind: 'number',
    unit: '%',
    min: 0,
    max: 100,
    step: 5,
    help: 'arterialLE.help.stenosisPct',
  },
  {
    id: 'plaqueLengthMm',
    label: 'arterialLE.param.plaqueLengthMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 200,
    step: 1,
    help: 'arterialLE.help.plaqueLengthMm',
  },
];

// ============================================================================
// Full StudyConfig
// ============================================================================

export const ARTERIAL_LE_BILATERAL_CONFIG: StudyConfig = {
  type: 'arterialLE',
  loincCode: VASCULAR_LOINC.arterialLE.code,
  loincDisplay: VASCULAR_LOINC.arterialLE.display,
  segments: allArterialLEFullIds() as ReadonlyArray<string>,
  parameters: [...CATEGORICAL_PARAMETERS, ...NUMERIC_PARAMETERS],
};

// ============================================================================
// Canonical seed findings for template authoring
// ============================================================================

export const ARTERIAL_NORMAL_FINDING: ArterialSegmentFinding = {
  waveform: 'triphasic',
  stenosisCategory: 'none',
  occluded: false,
  plaqueMorphology: 'none',
};

export const ARTERIAL_OCCLUSION_FINDING: ArterialSegmentFinding = {
  waveform: 'absent',
  stenosisCategory: 'occluded',
  occluded: true,
};
