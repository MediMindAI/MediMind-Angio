// SPDX-License-Identifier: Apache-2.0
/**
 * Carotid Duplex — Study Configuration
 *
 * Bilateral carotid-vertebral-subclavian duplex per SRU 2003 consensus +
 * ESVS 2023 + AHA/ASA 2021. Captures PSV, EDV, IMT, flow direction, plaque
 * characterization, and the NASCET stenosis category (auto-graded from the
 * SRU 2003 criteria in `stenosisCalculator.ts`, with a manual override).
 */

import type { ParameterDef, Side, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';
import { COMPETENCY_COLORS } from '../../../constants/theme-colors';
import { severityBandColor } from '../../anatomy/severityColor';

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
  // Carotid bifurcation ("BIF"). The id matches the diagram's `bulb-*` path so
  // the table row and the drawn bulb are the same segment.
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

/** True when the vessel is a vertebral segment. */
export function isVertebral(v: CarotidVesselBase): boolean {
  return v === 'vert-v1' || v === 'vert-v2' || v === 'vert-v3';
}

/** True when the vessel is an ICA segment. */
export function isIca(v: CarotidVesselBase): boolean {
  return v === 'ica-prox' || v === 'ica-mid' || v === 'ica-dist';
}

/**
 * True when the vessel is a common-carotid segment. Intima-media thickness
 * (IMT) is only clinically measured on the CCA, so the IMT input + PDF cell
 * render exclusively on these rows.
 */
export function isCca(v: CarotidVesselBase): boolean {
  return v === 'cca-prox' || v === 'cca-mid' || v === 'cca-dist';
}

/**
 * True when the row takes an IMT measurement: the common carotid plus the
 * bifurcation (BIF) row — every other vessel shows a dash.
 */
export function hasImt(v: CarotidVesselBase): boolean {
  return isCca(v) || v === 'bulb';
}

// ============================================================================
// Enums
// ============================================================================

export const FLOW_DIRECTION_VALUES = [
  'antegrade',
  'retrograde',
  'absent',
] as const;
export type FlowDirection = (typeof FLOW_DIRECTION_VALUES)[number];

/**
 * Gray-Weale plaque echogenicity classification (Types I–V). Replaces the
 * former free morphology enum (none/calcified/mixed/soft) per clinician
 * request — the five echogenicity types are the standard carotid descriptor:
 *   type1 — fully hypoechoic (soft)
 *   type2 — predominantly hypoechoic
 *   type3 — predominantly echogenic
 *   type4 — fully echogenic
 *   type5 — calcified, non-identifiable
 */
export const PLAQUE_MORPHOLOGY_VALUES = [
  'none',
  'type1',
  'type2',
  'type3',
  'type4',
  'type5',
] as const;
export type PlaqueMorphology = (typeof PLAQUE_MORPHOLOGY_VALUES)[number];

export const PLAQUE_SURFACE_VALUES = ['smooth', 'irregular'] as const;
export type PlaqueSurface = (typeof PLAQUE_SURFACE_VALUES)[number];

export const NASCET_CATEGORY_VALUES = [
  'normal',           // no stenosis (PSV < 125, no plaque)
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
  /** Intima-media thickness (mm) — common-carotid segments only. */
  readonly imtMm?: number;
  readonly flowDirection?: FlowDirection;
  readonly plaquePresent?: boolean;
  readonly plaqueMorphology?: PlaqueMorphology;
  readonly plaqueLengthMm?: number;
  /**
   * Gray-scale / color-Doppler plaque estimate — % diameter reduction (ICA
   * rows). A primary SRU 2003 criterion alongside ICA PSV.
   */
  readonly plaqueStenosisPct?: number;
  readonly plaqueSurface?: PlaqueSurface;
  /**
   * Retired per clinician request (ULC removed). Kept optional only so old
   * drafts still hydrate — diagram, narrative, PDF and FHIR ignore it.
   */
  readonly plaqueUlceration?: boolean;
  /**
   * Retired per clinician request (subclavian steal removed). Kept optional
   * only so old drafts still hydrate — diagram, narrative, PDF and FHIR
   * ignore it.
   */
  readonly subclavianStealPhase?: SubclavianStealPhase;
  readonly note?: string;
  /**
   * Manual override for the diagram severity band. Mirrors
   * `VenousSegmentFinding.competencyOverride` and the new arterial parity
   * field. When set, `deriveCarotidCompetency()` returns this value without
   * running the rule-based derivation (Wave 4.6 — Part 01 MEDIUM parity).
   */
  readonly competencyOverride?: CarotidCompetency;
  /**
   * User-redrawn SVG path-d for this vessel's diagram overlay (anatomy
   * "Edit segment" mode). Mirrors `VenousSegmentFinding.pathOverride`; when
   * set, the diagram renders this geometry instead of the static SVG path.
   */
  readonly pathOverride?: string;
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

/**
 * SRU Consensus Panel (Grant 2003) gray-scale + Doppler criteria.
 *   Degree   | ICA PSV  | Plaque est. | ICA/CCA  | ICA EDV
 *   normal   | < 125    | none        | < 2.0    | < 40
 *   < 50 %   | < 125    | < 50 %      | < 2.0    | < 40
 *   50–69 %  | 125–230  | ≥ 50 %      | 2.0–4.0  | 40–100
 *   ≥ 70 %   | > 230    | ≥ 50 %      | > 4.0    | > 100
 * PSV + plaque estimate are primary; ratio + EDV are additional (tie-break).
 * Range ends are inclusive in the 50–69 % band, so ≥ 70 % is strictly above.
 */
export const SRU_THRESHOLDS = {
  psvGe50: 125,       // PSV ≥ 125 → ≥ 50 %
  psvGt70: 230,       // PSV > 230 → ≥ 70 %
  plaqueGe50: 50,     // plaque estimate ≥ 50 % → ≥ 50 %
  ratioGe50: 2.0,     // ICA/CCA ≥ 2.0 → ≥ 50 %
  ratioGt70: 4.0,     // ICA/CCA > 4.0 → ≥ 70 %
  edvGe50: 40,        // EDV ≥ 40 → ≥ 50 %
  edvGt70: 100,       // EDV > 100 → ≥ 70 %
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
  { id: 'imtMm', label: 'carotid.param.imtMm', kind: 'diameter-mm', unit: 'mm', min: 0, max: 3, step: 0.1 },
  { id: 'plaqueStenosisPct', label: 'carotid.param.plaqueStenosisPct', kind: 'number', unit: '%', min: 0, max: 100, step: 5 },
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
  // A retrograde waveform (e.g. a reversed vertebral) colors moderate so the
  // vessel doesn't stay green.
  if (nascetCat === '50to69' || finding.flowDirection === 'retrograde') return 'moderate';
  // A chosen plaque morphology implies plaque is present even when the
  // explicit `plaquePresent` flag was never set (the segment-table Plaque
  // column writes morphology only). Either signal colors the vessel mild.
  const hasPlaque =
    finding.plaquePresent === true ||
    (finding.plaqueMorphology !== undefined && finding.plaqueMorphology !== 'none');
  if (hasPlaque) return 'mild';
  return 'normal';
}

/**
 * Resolve the diagram severity band for ANY segment id, including the
 * `bulb-*` (bifurcation) segments. The carotid bulb IS the bifurcation where
 * the NASCET stenosis is graded, so it always takes the side's NASCET grade
 * (below), and when it has no finding of its own (BIF row never filled) it
 * mirrors the **proximal ICA** finding of the same side instead of staying
 * stuck on "normal". A bulb finding of its own (BIF table row or a click
 * override) wins over the ICA mirror.
 */
export function resolveCarotidBand(
  findings: CarotidFindings,
  nascet: CarotidNascetClassification,
  id: string,
): CarotidCompetency {
  const side = id.endsWith('-left') ? 'left' : id.endsWith('-right') ? 'right' : null;
  let finding = findings[id as CarotidVesselFullId];
  if (!finding && side && id.startsWith('bulb-')) {
    finding = findings[`ica-prox-${side}` as CarotidVesselFullId];
  }
  // NASCET/SRU grade is a property of the ICA bifurcation only — apply it to
  // the ICA segments and the bulb (the bifurcation) alone. CCA, ECA, vertebral,
  // and subclavian color from their own flow/plaque so an ICA stenosis grade no
  // longer "bleeds" across every vessel on the side.
  const nascetGraded = id.startsWith('ica-') || id.startsWith('bulb-');
  const nascetCat = side && nascetGraded ? nascet[side] : undefined;
  return deriveCarotidCompetency(finding, nascetCat);
}

/** Strip to {fill,stroke} (palette constants also carry an `overlay` field). */
const fs = (c: { fill: string; stroke: string }): { fill: string; stroke: string } => ({
  fill: c.fill,
  stroke: c.stroke,
});

/**
 * Severity band → diagram color. There is no mandated clinical color standard
 * for carotid stenosis (SRU/NASCET/ESVS define velocity criteria, not colors);
 * the universal de-facto convention is the traffic-light / heat scale —
 * green (normal) → amber (mild) → orange (moderate) → red (severe) →
 * dark-red (occluded). That is exactly the shared arterial `SEVERITY_COLORS`,
 * so carotid + arterial-LE stay consistent. Used by both the form-side diagram
 * (`colorFn`) and the PDF (`competencyFn`) so they always agree.
 */
export function carotidBandColor(band: CarotidCompetency): { fill: string; stroke: string } {
  // Delegates to the shared severity→color helper so carotid + arterial-LE
  // stay in lock-step (single source of truth in anatomy/severityColor.ts).
  return severityBandColor(band);
}

/**
 * Fill for any diagram path id — handles the one non-graded static shape
 * (`aorta` = neutral grey context) before falling back to the severity band
 * for the graded segments.
 */
export function carotidDiagramColor(
  id: string,
  band: CarotidCompetency,
): { fill: string; stroke: string } {
  if (id === 'aorta') return fs(COMPETENCY_COLORS.normal);
  return carotidBandColor(band);
}
