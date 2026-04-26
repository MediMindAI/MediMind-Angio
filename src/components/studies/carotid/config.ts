// SPDX-License-Identifier: Apache-2.0
/**
 * Carotid Duplex — Study Configuration
 *
 * Bilateral carotid-vertebral-subclavian duplex per SRU 2003 consensus +
 * ESVS 2023 + AHA/ASA 2021. Captures PSV, EDV, flow direction, plaque
 * characterization, NASCET stenosis category, and subclavian-steal phase
 * on vertebrals.
 */

import type { ParameterDef, Side, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';

// Re-export the canonical `Side` type so existing consumers
// (`import { Side } from '.../carotid/config'`) keep working.
export type { Side };

// ============================================================================
// Vessel catalog
// ============================================================================

export const CAROTID_VESSELS = [
  'cca-prox',
  'cca-mid',
  'cca-dist',
  'bulb',
  'ica-prox',
  'ica-mid',
  'ica-dist',
  'eca',
  'vert-v1',
  'vert-v2',
  'vert-v3',
  'subclav-prox',
  'subclav-dist',
] as const;

export type CarotidVesselBase = (typeof CAROTID_VESSELS)[number];
export type CarotidVesselFullId = `${CarotidVesselBase}-${Side}`;

export function allCarotidFullIds(): ReadonlyArray<CarotidVesselFullId> {
  const out: CarotidVesselFullId[] = [];
  for (const v of CAROTID_VESSELS) {
    out.push(`${v}-left` as CarotidVesselFullId);
    out.push(`${v}-right` as CarotidVesselFullId);
  }
  return out;
}

/** True when the vessel is a vertebral segment (steal evaluation relevant). */
export function isVertebral(v: CarotidVesselBase): boolean {
  return v === 'vert-v1' || v === 'vert-v2' || v === 'vert-v3';
}

/** True when the vessel is an ICA segment. */
export function isIca(v: CarotidVesselBase): boolean {
  return v === 'ica-prox' || v === 'ica-mid' || v === 'ica-dist';
}

// ============================================================================
// Enums
// ============================================================================

export const FLOW_DIRECTION_VALUES = [
  'antegrade',
  'retrograde',
  'bidirectional',
  'absent',
] as const;
export type FlowDirection = (typeof FLOW_DIRECTION_VALUES)[number];

export const PLAQUE_MORPHOLOGY_VALUES = ['none', 'calcified', 'mixed', 'soft'] as const;
export type PlaqueMorphology = (typeof PLAQUE_MORPHOLOGY_VALUES)[number];

export const PLAQUE_SURFACE_VALUES = ['smooth', 'irregular'] as const;
export type PlaqueSurface = (typeof PLAQUE_SURFACE_VALUES)[number];

export const NASCET_CATEGORY_VALUES = [
  'lt50',             // < 50 %
  '50to69',           // 50–69 %
  'ge70',             // ≥ 70 %
  'near-occlusion',
  'occluded',
] as const;
export type NascetCategory = (typeof NASCET_CATEGORY_VALUES)[number];

export const SUBCLAVIAN_STEAL_PHASES = [0, 1, 2, 3] as const;
export type SubclavianStealPhase = (typeof SUBCLAVIAN_STEAL_PHASES)[number];

// ============================================================================
// Per-vessel findings shape
// ============================================================================

export interface CarotidVesselFinding {
  readonly psvCmS?: number;
  readonly edvCmS?: number;
  readonly flowDirection?: FlowDirection;
  readonly plaquePresent?: boolean;
  readonly plaqueMorphology?: PlaqueMorphology;
  readonly plaqueLengthMm?: number;
  readonly plaqueSurface?: PlaqueSurface;
  readonly plaqueUlceration?: boolean;
  /** 0 = normal, 1–3 = steal phases (vertebrals only). */
  readonly subclavianStealPhase?: SubclavianStealPhase;
  readonly note?: string;
  /**
   * Manual override for the diagram severity band. Mirrors
   * `VenousSegmentFinding.competencyOverride` and the new arterial parity
   * field. When set, `deriveCarotidCompetency()` returns this value without
   * running the rule-based derivation (Wave 4.6 — Part 01 MEDIUM parity).
   */
  readonly competencyOverride?: CarotidCompetency;
}

export type CarotidFindings = Readonly<
  Partial<Record<CarotidVesselFullId, CarotidVesselFinding>>
>;

/** NASCET classification — user-selected per side, auto-suggested from SRU. */
export interface CarotidNascetClassification {
  readonly right?: NascetCategory;
  readonly left?: NascetCategory;
}

// ============================================================================
// SRU consensus velocity thresholds
// ============================================================================

export const SRU_THRESHOLDS = {
  psvLt50: 125,       // ICA PSV < 125 → < 50 %
  psvGe50: 125,       // 125 ≤ PSV → ≥ 50 %
  psv50to69Upper: 230,
  psvGe70: 230,       // PSV ≥ 230 → ≥ 70 % (one of the three criteria)
  edvGe70: 100,       // EDV ≥ 100 → ≥ 70 %
  ratioGe70: 4.0,     // ICA/CCA ≥ 4 → ≥ 70 %
} as const;

// ============================================================================
// Seed findings
// ============================================================================

// Wave 3.7 (Part 03 HIGH) — `Object.freeze` prevents an in-place mutation of
// this template seed from corrupting every slot that referenced the same
// object (templates currently share the reference across 26+ vessel slots).
// Combined with per-slot cloning in `templates.ts:allVessels`, this defends
// against cross-template corruption today and silent corruption tomorrow.
export const CAROTID_NORMAL_FINDING: CarotidVesselFinding = Object.freeze({
  flowDirection: 'antegrade',
  plaquePresent: false,
  plaqueMorphology: 'none',
}) as CarotidVesselFinding;

// ============================================================================
// Parameter definitions (for FHIR builder)
// ============================================================================

export const CATEGORICAL_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'flowDirection',
    label: 'carotid.param.flowDirection',
    kind: 'select',
    options: FLOW_DIRECTION_VALUES.map((v) => ({
      value: v,
      label: `carotid.flow.${v}`,
    })),
  },
  {
    id: 'plaqueMorphology',
    label: 'carotid.param.plaqueMorphology',
    kind: 'select',
    options: PLAQUE_MORPHOLOGY_VALUES.map((v) => ({
      value: v,
      label: `carotid.plaque.${v}`,
    })),
  },
];

export const NUMERIC_PARAMETERS: ReadonlyArray<ParameterDef> = [
  { id: 'psvCmS', label: 'carotid.param.psvCmS', kind: 'velocity-cm-s', unit: 'cm/s', min: 0, max: 700, step: 10 },
  { id: 'edvCmS', label: 'carotid.param.edvCmS', kind: 'velocity-cm-s', unit: 'cm/s', min: 0, max: 300, step: 5 },
  { id: 'plaqueLengthMm', label: 'carotid.param.plaqueLengthMm', kind: 'diameter-mm', unit: 'mm', min: 0, max: 100, step: 1 },
];

// ============================================================================
// StudyConfig
// ============================================================================

export const CAROTID_CONFIG: StudyConfig = {
  type: 'carotid',
  loincCode: VASCULAR_LOINC.carotid.code,
  loincDisplay: VASCULAR_LOINC.carotid.display,
  segments: allCarotidFullIds() as ReadonlyArray<string>,
  parameters: [...CATEGORICAL_PARAMETERS, ...NUMERIC_PARAMETERS],
};

// ============================================================================
// Anatomy-diagram competency mapping
// ============================================================================

/**
 * 5-band severity used to color the schematic neck-carotid diagram on
 * both the PDF and the form-side diagram. Shares its palette key with
 * `SEVERITY_COLORS` in `theme-colors.ts`.
 */
export type CarotidCompetency = 'normal' | 'mild' | 'moderate' | 'severe' | 'occluded';

/**
 * Derive a severity band from a vessel's finding + (optional) side-scoped
 * NASCET category. NASCET takes precedence when supplied, otherwise we
 * fall back to flow-direction / plaque presence.
 */
export function deriveCarotidCompetency(
  finding: CarotidVesselFinding | undefined,
  nascetCat?: NascetCategory,
): CarotidCompetency {
  if (!finding) return 'normal';
  // Manual override wins over all auto-derivation rules (Wave 4.6 parity
  // with venous `deriveCompetency`).
  if (finding.competencyOverride !== undefined) return finding.competencyOverride;
  if (finding.flowDirection === 'absent' || nascetCat === 'occluded') return 'occluded';
  if (nascetCat === 'ge70' || nascetCat === 'near-occlusion') return 'severe';
  if (nascetCat === '50to69') return 'moderate';
  if (finding.plaquePresent) return 'mild';
  return 'normal';
}
