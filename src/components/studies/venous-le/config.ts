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
 * Segment IDs come from /scripts/segment-catalog.ts (canonical 15 venous-LE
 * segments × 2 sides = 30 FullSegmentIds). Matches the tagged SVG paths
 * in /public/anatomy/le-anterior.svg and /public/anatomy/le-posterior.svg.
 */

import type { ParameterDef, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';

// ============================================================================
// Segment catalog (mirrors scripts/segment-catalog.ts — duplicated so runtime
// bundles never pull script files)
// ============================================================================

/** Canonical 15-segment IAC/SVU lower-extremity venous duplex catalog. */
export const VENOUS_LE_SEGMENTS = [
  'cfv', // Common femoral vein
  'eiv', // External iliac vein
  'fv-prox', // Femoral vein proximal
  'fv-mid', // Femoral vein mid
  'fv-dist', // Femoral vein distal
  'pfv', // Profunda (deep) femoral vein
  'gsv-ak', // Great saphenous vein, above knee
  'gsv-prox-calf', // GSV proximal calf
  'gsv-mid-calf', // GSV mid calf
  'gsv-dist-calf', // GSV distal calf
  'pop-ak', // Popliteal above knee
  'pop-fossa', // Popliteal fossa
  'pop-bk', // Popliteal below knee
  'ptv', // Posterior tibial vein
  'per', // Peroneal vein
  'ssv', // Small saphenous vein
  'gastroc', // Gastrocnemius vein
  'soleal', // Soleal vein
  'sfj', // Saphenofemoral junction
  'spj', // Saphenopopliteal junction
] as const;

export type VenousLESegmentBase = (typeof VENOUS_LE_SEGMENTS)[number];
export type Side = 'left' | 'right';
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

export const SPONTANEITY_VALUES = ['normal', 'reduced', 'absent', 'inconclusive'] as const;
export type Spontaneity = (typeof SPONTANEITY_VALUES)[number];

export const PHASICITY_VALUES = [
  'normal',
  'continuous',
  'pulsatile',
  'absent',
  'inconclusive',
] as const;
export type Phasicity = (typeof PHASICITY_VALUES)[number];

export const AUGMENTATION_VALUES = ['normal', 'reduced', 'absent', 'inconclusive'] as const;
export type Augmentation = (typeof AUGMENTATION_VALUES)[number];

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
  readonly spontaneity?: Spontaneity;
  readonly phasicity?: Phasicity;
  readonly augmentation?: Augmentation;

  /** Reflux duration in ms (positive = retrograde flow duration). */
  readonly refluxDurationMs?: number;
  /** AP diameter in mm. */
  readonly apDiameterMm?: number;
  /** Transverse diameter in mm (alongside AP — Corestudycast parity). */
  readonly transDiameterMm?: number;
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
    segment === 'eiv' ||
    segment === 'fv-prox' ||
    segment === 'fv-mid' ||
    segment === 'fv-dist' ||
    segment === 'pfv' ||
    segment === 'pop-ak' ||
    segment === 'pop-fossa' ||
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
    id: 'spontaneity',
    label: 'venousLE.param.spontaneity',
    kind: 'select',
    options: SPONTANEITY_VALUES.map((v) => ({ value: v, label: `venousLE.spontaneity.${v}` })),
  },
  {
    id: 'phasicity',
    label: 'venousLE.param.phasicity',
    kind: 'select',
    options: PHASICITY_VALUES.map((v) => ({ value: v, label: `venousLE.phasicity.${v}` })),
  },
  {
    id: 'augmentation',
    label: 'venousLE.param.augmentation',
    kind: 'select',
    options: AUGMENTATION_VALUES.map((v) => ({ value: v, label: `venousLE.augmentation.${v}` })),
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
    id: 'transDiameterMm',
    label: 'venousLE.param.transDiameterMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 50,
    step: 0.1,
    help: 'venousLE.help.transDiameterMm',
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
 * Derive the anatomy-diagram competency color for a segment from its findings.
 *
 * Rules (ordered — first match wins):
 *  1. thrombosis acute/chronic → 'incompetent' (red)
 *  2. compressibility non-compressible/partial → 'incompetent' (red)
 *  3. pathological reflux per threshold → 'incompetent' (red)
 *  4. compressibility normal + no pathological reflux → 'normal' (black)
 *  5. compressibility inconclusive → 'inconclusive' (gray)
 *  6. no finding at all → 'normal' (safe default — silhouette only)
 *
 * Ablated is set via manual user action in the UI (not derived from findings).
 */
export function deriveCompetency(
  segment: VenousLESegmentBase,
  finding: VenousSegmentFinding | undefined
): Competency {
  if (!finding) return 'normal';

  // Manual override wins over all auto-derivation rules.
  if (finding.competencyOverride !== undefined) {
    return finding.competencyOverride;
  }

  if (finding.thrombosis === 'acute' || finding.thrombosis === 'chronic') {
    return 'incompetent';
  }

  if (
    finding.compressibility === 'non-compressible' ||
    finding.compressibility === 'partial'
  ) {
    return 'incompetent';
  }

  if (hasPathologicalReflux(segment, finding)) {
    return 'incompetent';
  }

  if (finding.compressibility === 'inconclusive') {
    return 'inconclusive';
  }

  return 'normal';
}
