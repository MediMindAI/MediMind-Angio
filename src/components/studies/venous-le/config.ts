/**
 * Venous LE Duplex — Study Configuration
 *
 * The canonical parameter matrix for bilateral lower-extremity venous
 * duplex ultrasound, following IAC Vascular Testing Standards + SVU
 * Professional Performance Guideline + AIUM/ACR Practice Parameter.
 *
 * Five categorical parameters per segment:
 *   - Compressibility  (primary DVT sign)
 *   - Thrombosis       (if present, characterize)
 *   - Spontaneity      (spontaneous venous flow)
 *   - Phasicity        (respiratory variation)
 *   - Augmentation     (response to distal compression)
 *
 * Plus three numeric measurements per segment (optional):
 *   - Reflux duration (ms)  — pathological: >1000 ms deep veins, >500 ms superficial
 *   - AP diameter (mm)       — transverse caliper in grey-scale
 *   - Depth from skin (mm)   — for procedural planning (ablation targets)
 *
 * Segment IDs come from /scripts/segment-catalog.ts (canonical 20 venous-LE
 * segments × 2 sides = 40 FullSegmentIds — anterior + posterior views, including
 * superficial saphenous + muscular branches). Matches the tagged SVG paths
 * in /public/anatomy/le-anterior.svg and /public/anatomy/le-posterior.svg.
 */

import type { ParameterDef, Side, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';

// Re-export the canonical `Side` type so existing consumers
// (`import { Side } from '.../venous-le/config'`) keep working.
export type { Side };

// ============================================================================
// Segment catalog (mirrors scripts/segment-catalog.ts — duplicated so runtime
// bundles never pull script files)
// ============================================================================

/** Canonical lower-extremity venous duplex catalog (deep + superficial + muscular). */
export const VENOUS_LE_SEGMENTS = [
  'cfv', // Common femoral vein
  'fv-prox', // Femoral vein proximal
  'fv-mid', // Femoral vein mid
  'fv-dist', // Femoral vein distal
  'pfv', // Profunda (deep) femoral vein
  'pop-ak', // Popliteal above knee
  'pop-bk', // Popliteal below knee
  'ptv', // Posterior tibial vein
  'per', // Peroneal vein
  'gastroc', // Gastrocnemius vein
  'soleal', // Soleal vein
  'sfj', // Saphenofemoral junction
  'gsv-prox-thigh', // GSV proximal thigh
  'gsv-mid-thigh', // GSV mid thigh
  'gsv-dist-thigh', // GSV distal thigh
  'gsv-knee', // GSV at the knee
  'gsv-calf', // GSV calf segment (merged)
  'spj', // Saphenopopliteal junction
  'ssv', // Small saphenous vein
] as const;

export type VenousLESegmentBase = (typeof VENOUS_LE_SEGMENTS)[number];
export type VenousLEFullSegmentId = `${VenousLESegmentBase}-${Side}`;

export function allVenousLEFullIds(): ReadonlyArray<VenousLEFullSegmentId> {
  const out: VenousLEFullSegmentId[] = [];
  for (const s of VENOUS_LE_SEGMENTS) {
    out.push(`${s}-left` as VenousLEFullSegmentId);
    out.push(`${s}-right` as VenousLEFullSegmentId);
  }
  return out;
}

// ============================================================================
// Categorical parameter value enums
// ============================================================================

export const COMPRESSIBILITY_VALUES = [
  'normal',
  'partial',
  'non-compressible',
  'inconclusive',
] as const;
export type Compressibility = (typeof COMPRESSIBILITY_VALUES)[number];

export const THROMBOSIS_VALUES = ['none', 'acute', 'chronic', 'indeterminate'] as const;
export type Thrombosis = (typeof THROMBOSIS_VALUES)[number];

export const PHASICITY_VALUES = [
  'respirophasic',
  'reduced',
  'pulsatile',
  'monophasic',
  'inconclusive',
] as const;
export type Phasicity = (typeof PHASICITY_VALUES)[number];

// ============================================================================
// Per-segment findings shape
// ============================================================================

/**
 * One row in the segment table — the complete finding set for a single
 * segment × side. All fields optional because the doctor may skip cells
 * (especially for segments they didn't insonate).
 */
export interface VenousSegmentFinding {
  readonly compressibility?: Compressibility;
  readonly thrombosis?: Thrombosis;
  readonly phasicity?: Phasicity;

  /** Reflux duration in ms (label displays as "სმ/წმ" but value remains time-based). */
  readonly refluxDurationMs?: number;
  /** Vein diameter in mm. */
  readonly apDiameterMm?: number;
  /** Depth from skin in mm (for ablation planning). */
  readonly depthMm?: number;

  /**
   * Manual override for diagram competency color.
   * When set, `deriveCompetency()` returns this value without running the
   * rule-based derivation.
   */
  readonly competencyOverride?: import('../../../types/anatomy').Competency;

  /** Free-text note for this segment. */
  readonly note?: string;

  /**
   * Per-encounter SVG path-d override for this segment. When set, the
   * anatomy diagram renders this string instead of the static `d`
   * shipped in `public/anatomy/le-*.svg`. Captured by the "Edit segment"
   * mode in the drawing toolbar.
   */
  readonly pathOverride?: string;
}

/** Form-level state for the per-segment table. Map segment-side → finding. */
export type VenousSegmentFindings = Readonly<
  Partial<Record<VenousLEFullSegmentId, VenousSegmentFinding>>
>;

// ============================================================================
// Pathological thresholds (IAC/SVU/ESVS)
// ============================================================================

/**
 * Reflux duration thresholds defining pathological venous reflux.
 * Source: Gloviczki et al., J Vasc Surg 2011; ESVS 2022.
 */
export const REFLUX_THRESHOLDS = {
  /** > 1000 ms in deep veins (femoral, popliteal) = pathological. */
  deepMs: 1000,
  /** > 500 ms in superficial veins (GSV, SSV, perforators) = pathological. */
  superficialMs: 500,
} as const;

/** Classify a segment as deep vs superficial. */
export function isDeepSegment(segment: VenousLESegmentBase): boolean {
  return (
    segment === 'cfv' ||
    segment === 'fv-prox' ||
    segment === 'fv-mid' ||
    segment === 'fv-dist' ||
    segment === 'pfv' ||
    segment === 'pop-ak' ||
    segment === 'pop-bk' ||
    segment === 'ptv' ||
    segment === 'per' ||
    segment === 'gastroc' ||
    segment === 'soleal'
  );
}

/** Return true if a segment finding meets the reflux threshold. */
export function hasPathologicalReflux(
  segment: VenousLESegmentBase,
  finding: VenousSegmentFinding
): boolean {
  const ms = finding.refluxDurationMs;
  if (ms === undefined || Number.isNaN(ms)) return false;
  const threshold = isDeepSegment(segment)
    ? REFLUX_THRESHOLDS.deepMs
    : REFLUX_THRESHOLDS.superficialMs;
  return ms > threshold;
}

// ============================================================================
// Parameter definitions (for dynamic form-renderer)
// ============================================================================

/** Categorical columns of the segment table. */
export const CATEGORICAL_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'compressibility',
    label: 'venousLE.param.compressibility',
    kind: 'select',
    options: COMPRESSIBILITY_VALUES.map((v) => ({
      value: v,
      label: `venousLE.compressibility.${v}`,
    })),
  },
  {
    id: 'thrombosis',
    label: 'venousLE.param.thrombosis',
    kind: 'select',
    options: THROMBOSIS_VALUES.map((v) => ({ value: v, label: `venousLE.thrombosis.${v}` })),
  },
  {
    id: 'phasicity',
    label: 'venousLE.param.phasicity',
    kind: 'select',
    options: PHASICITY_VALUES.map((v) => ({ value: v, label: `venousLE.phasicity.${v}` })),
  },
];

/** Numeric columns shown in the reflux-time table. */
export const NUMERIC_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'refluxDurationMs',
    label: 'venousLE.param.refluxDurationMs',
    kind: 'duration-ms',
    unit: 'ms',
    min: 0,
    max: 10000,
    step: 100,
    help: 'venousLE.help.refluxDurationMs',
  },
  {
    id: 'apDiameterMm',
    label: 'venousLE.param.apDiameterMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 50,
    step: 0.1,
    help: 'venousLE.help.apDiameterMm',
  },
  {
    id: 'depthMm',
    label: 'venousLE.param.depthMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 100,
    step: 0.1,
    help: 'venousLE.help.depthMm',
  },
];

// ============================================================================
// Full StudyConfig for bilateral venous LE duplex
// ============================================================================

export const VENOUS_LE_BILATERAL_CONFIG: StudyConfig = {
  type: 'venousLEBilateral',
  loincCode: VASCULAR_LOINC.venousLEBilateral.code,
  loincDisplay: VASCULAR_LOINC.venousLEBilateral.display,
  segments: allVenousLEFullIds() as ReadonlyArray<string>,
  parameters: [...CATEGORICAL_PARAMETERS, ...NUMERIC_PARAMETERS],
};

// ============================================================================
// Competency derivation — drives the anatomical diagram coloring
// ============================================================================

import type { Competency } from '../../../types/anatomy';

/**
 * Return the diagram competency color for a segment.
 *
 * `competencyOverride` is the manual escape hatch — when the clinician
 * picks a color from the dropdown, that wins. Otherwise the color is
 * derived from the clinical fields the form already captures
 * (compressibility, thrombosis, reflux duration, phasicity). This is
 * what makes templates like "Acute DVT" colour the involved veins red
 * without any per-template glue code: the template sets
 * `compressibility: 'non-compressible'` + `thrombosis: 'acute'`, this
 * function reads them and returns `'occluded'`.
 */
export function deriveCompetency(
  _segment: VenousLESegmentBase,
  finding: VenousSegmentFinding | undefined
): Competency {
  if (!finding) return 'normal';
  if (finding.competencyOverride) return finding.competencyOverride;
  // Occlusion — thrombus (acute or chronic) or a non-compressible vein.
  if (finding.thrombosis === 'acute' || finding.thrombosis === 'chronic') return 'occluded';
  if (finding.compressibility === 'non-compressible' || finding.compressibility === 'partial') return 'occluded';
  // Reflux — duration >500 ms is a conservative pan-segment cutoff
  // (deep ≥1000 ms, superficial ≥500 ms in current ACUG guidance; we
  // use 500 here so a single threshold catches both).
  if ((finding.refluxDurationMs ?? 0) > 500) return 'incompetent';
  // Inconclusive markers — any clinical field explicitly flagged
  // "inconclusive" / "indeterminate" means the segment couldn't be
  // assessed cleanly.
  if (
    finding.compressibility === 'inconclusive' ||
    finding.phasicity === 'inconclusive' ||
    finding.thrombosis === 'indeterminate'
  ) return 'inconclusive';
  return 'normal';
}
