// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac & Pelvic Venous Duplex — Study Configuration
 *
 * Clinical model for pelvic venous disorders (PeVD), female-focused. Shaped
 * like a standard pelvic venous duplex report (clinician feedback 2026-11):
 *
 *   Context    — sex, symptoms, comorbidities, approaches, positions, Valsalva
 *   Caval table — IVC + LRV, RIGHT, LEFT, one row per vein level, same columns
 *   Gonadal    — LEFT ovarian vein only (diameter + reflux); no ovarian table rows
 *
 * The diagram for this study is a STATIC illustration the clinician free-draws +
 * text-labels on — there is NO segment-id → competency coloring. Findings drive
 * the narrative and FHIR Observations instead of diagram colors. SVP and CEAP
 * are optional.
 */

import type { ParameterDef, Side, StudyConfig } from '../../../types/study';
import { VASCULAR_LOINC } from '../../../constants/fhir-systems';

// Re-export the canonical `Side` so consumers can `import { Side } from '.../config'`.
export type { Side };

// ============================================================================
// Zone 0 — context / technique
// ============================================================================

export const SEX_VALUES = ['female', 'male', 'other'] as const;
export type Sex = (typeof SEX_VALUES)[number];

/**
 * Presenting symptoms / indications — drive the SVP S-axis. The first nine are
 * the original SVP-oriented set; the remainder are the Pelvic Venous Duplex
 * protocol's indication list (folded in here rather than a parallel enum, since
 * every consumer already iterates `SYMPTOM_VALUES`).
 */
export const SYMPTOM_VALUES = [
  'chronic-pelvic-pain',
  'dyspareunia',
  'post-coital-ache',
  'dysuria-urgency',
  'flank-pain',
  'hematuria',
  'vulvar-varices',
  'leg-varices',
  'recurrent-varices',
  // Pelvic Venous Duplex protocol indications
  'pelvic-pain',
  'cold-feet',
  'limb-swelling',
  'leg-aching',
  'hip-pain',
  'ibs',
  'hemorrhoids',
  'menstrual-leg-pain',
  'lower-abdominal-pain',
  'lower-back-pain',
  'venous-claudication',
] as const;
export type Symptom = (typeof SYMPTOM_VALUES)[number];

/** Comorbidities (shown as "Comorbidities"; data key stays `riskFactors`). */
export const RISK_FACTOR_VALUES = [
  'endometriosis',
  'back-surgery-hardware',
  'adenomyosis',
  'nerve-injury',
  'chronic-pid',
  'ovarian-remnant',
  'fibroids',
  'ibs',
  'polycystic-ovaries',
  'retroverted-uterus',
] as const;
export type RiskFactor = (typeof RISK_FACTOR_VALUES)[number];

export const APPROACH_VALUES = ['transabdominal', 'transvaginal', 'transperineal'] as const;
export type Approach = (typeof APPROACH_VALUES)[number];

export const POSITION_VALUES = [
  'supine',
  'left-lateral',
  'reverse-trendelenburg',
  'standing',
  // Protocol alternatives
  'prone',
  'decubitus',
] as const;
export type StudyPositionValue = (typeof POSITION_VALUES)[number];

export interface IliacContext {
  /** From the intake patient details; blank when not entered (sign-off S8). */
  readonly sex?: Sex;
  readonly symptoms?: ReadonlyArray<Symptom>;
  readonly riskFactors?: ReadonlyArray<RiskFactor>;
  readonly approaches?: ReadonlyArray<Approach>;
  readonly positions?: ReadonlyArray<StudyPositionValue>;
  readonly valsalvaPerformed?: boolean;
}

// ============================================================================
// Iliac & caval table (clinician feedback 2026-11: Studycast-style rows)
// ============================================================================

/**
 * One row per vein level. IVC rows + the left renal vein (LRV) sit in the first
 * (IVC) section; every other row exists per side. Every row carries the SAME
 * columns (patency/thrombosis · filling · phasicity · competency · AP diameter ·
 * peak velocity), all optional.
 */
export const IVC_ROWS = ['ivc-prox', 'ivc-mid', 'ivc-dist'] as const;
export type IvcRow = (typeof IVC_ROWS)[number];

/** Left renal vein — one row, printed after the IVC rows in the IVC section. */
export const LRV_ROW = 'lrv' as const;

/** Rows of the first table section, in order: IVC prox/mid/dist, then LRV. */
export const MIDLINE_ROWS = [...IVC_ROWS, LRV_ROW] as const;

export const SIDE_ROW_BASES = [
  'civ-prox',
  'civ-mid',
  'civ-dist',
  'eiv-prox',
  'eiv-mid',
  'eiv-dist',
  'iiv',
  'cfv',
] as const;
export type SideRowBase = (typeof SIDE_ROW_BASES)[number];

export type IliacCavalFullId = IvcRow | typeof LRV_ROW | `${SideRowBase}-${Side}`;

/**
 * Every row id in report order: IVC + LRV, then RIGHT, then LEFT. Old drafts'
 * removed rows (`ov-left` / `ov-right`, old keys) are not listed, so readers
 * that walk this order never print or export them.
 */
export const ILIAC_CAVAL_ROW_ORDER: ReadonlyArray<IliacCavalFullId> = [
  ...MIDLINE_ROWS,
  ...SIDE_ROW_BASES.map((b) => `${b}-right` as const),
  ...SIDE_ROW_BASES.map((b) => `${b}-left` as const),
];

/** Vessel base (`civ-prox-left` → `civ`, `ivc-mid` → `ivc`, `lrv` → `lrv`). */
export function vesselOfRow(id: IliacCavalFullId): string {
  const dash = id.indexOf('-');
  return dash === -1 ? id : id.slice(0, dash);
}

/** Side of a row; undefined for the IVC-section rows (IVC + LRV). */
export function sideOfRow(id: IliacCavalFullId): Side | undefined {
  if (id.endsWith('-left')) return 'left';
  if (id.endsWith('-right')) return 'right';
  return undefined;
}

/** Row label key without the side (`civ-prox-left` → `civ-prox`). */
export function rowBaseOf(id: IliacCavalFullId): string {
  const side = sideOfRow(id);
  return side ? id.slice(0, -(side.length + 1)) : id;
}

export const PATENCY_VALUES = ['patent', 'partial', 'occluded', 'thrombosis'] as const;
export type Patency = (typeof PATENCY_VALUES)[number];

/** Spontaneity / color filling (replaces compressibility). */
export const FILLING_VALUES = ['full', 'partial', 'none'] as const;
export type Filling = (typeof FILLING_VALUES)[number];

export const PHASICITY_VALUES = ['respirophasic', 'monophasic', 'pulsatile'] as const;
export type Phasicity = (typeof PHASICITY_VALUES)[number];

export const COMPETENCY_VALUES = ['competent', 'incompetent'] as const;
export type CavalCompetency = (typeof COMPETENCY_VALUES)[number];

export interface IliacCavalFinding {
  readonly patency?: Patency;
  readonly filling?: Filling;
  readonly phasicity?: Phasicity;
  readonly competency?: CavalCompetency;
  /** AP diameter (mm) — optional, any row. */
  readonly apDiameterMm?: number;
  /** Peak velocity PV (cm/s). */
  readonly peakVelocityCmS?: number;
}

export type IliacCavalFindings = Readonly<Partial<Record<IliacCavalFullId, IliacCavalFinding>>>;

// ============================================================================
// Gonadal vein — LEFT only (diameter + reflux)
// ============================================================================

export interface GonadalVeinFinding {
  /** Vein diameter (mm). Significant > 5. */
  readonly diameterMm?: number;
  readonly refluxPresent?: boolean;
}

// ============================================================================
// Top-level findings
// ============================================================================

/**
 * Old drafts may still carry removed zones (renal, plexus, escapePoints,
 * extrapelvic, specialConsiderations) or old caval keys (`ivc`, `civ-left` …).
 * Every reader walks `ILIAC_CAVAL_ROW_ORDER` / `gonadal.left` only, so those
 * leftovers are ignored instead of crashing.
 */
export interface IliacPelvicVenousFindings {
  readonly caval?: IliacCavalFindings;
  readonly gonadal?: Partial<Record<Side, GonadalVeinFinding>>;
}

function isCavalRowId(id: string): id is IliacCavalFullId {
  return (ILIAC_CAVAL_ROW_ORDER as ReadonlyArray<string>).includes(id);
}

/**
 * Keeps only what the form shows today: table rows listed in
 * `ILIAC_CAVAL_ROW_ORDER` + the left gonadal vein. Removed zones (renal, plexus,
 * escape points …), old caval keys and the removed ovarian rows are dropped so
 * an old draft can't carry them into the PDF or the FHIR snapshot.
 */
export function pickCurrentIliacFindings(raw: unknown): IliacPelvicVenousFindings {
  if (typeof raw !== 'object' || raw === null) return {};
  const f = raw as IliacPelvicVenousFindings;
  const caval: Partial<Record<IliacCavalFullId, IliacCavalFinding>> = {};
  for (const [id, row] of Object.entries(f.caval ?? {})) {
    if (row && isCavalRowId(id)) caval[id] = row;
  }
  const left = f.gonadal?.left;
  return {
    ...(Object.keys(caval).length > 0 ? { caval } : {}),
    ...(left ? { gonadal: { left } } : {}),
  };
}

/** Joins free-text fragments (trimmed, blanks dropped) into the one comments box. */
export function joinIliacComments(parts: ReadonlyArray<string | undefined>): string {
  return parts
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

// ============================================================================
// Thresholds + pure abnormality helpers (drive narrative + FHIR flags)
// ============================================================================

export const ILIAC_THRESHOLDS = {
  /** Gonadal/ovarian vein significant > 5 mm (strict greater-than). */
  gonadalDiameterMm: 5,
} as const;

/** Thrombosis / flow obstruction in a row (partial, occluded, thrombosis, or poor filling). */
export function isCavalObstructive(f: IliacCavalFinding | undefined): boolean {
  if (!f) return false;
  return (
    f.patency === 'occluded' ||
    f.patency === 'partial' ||
    f.patency === 'thrombosis' ||
    f.filling === 'partial' ||
    f.filling === 'none'
  );
}

export function isCavalIncompetent(f: IliacCavalFinding | undefined): boolean {
  return f?.competency === 'incompetent';
}

export function isGonadalRefluxAbnormal(f: GonadalVeinFinding | undefined): boolean {
  if (!f) return false;
  return f.refluxPresent === true || (f.diameterMm ?? 0) > ILIAC_THRESHOLDS.gonadalDiameterMm;
}

// ============================================================================
// Segment catalog (feeds FHIR Observation.bodySite — NOT diagram coloring)
// ============================================================================

/**
 * Body-site segment ids spanning the zones. The diagram does not color these;
 * they exist so per-zone FHIR Observations carry a SNOMED-coded body site.
 * Side is post-coordinated via SNOMED laterality at build time.
 */
export const ILIAC_PELVIC_VENOUS_SEGMENTS = [
  'renal-vein',
  'ivc',
  'iliac-vein-left',
  'iliac-vein-right',
  'external-iliac-vein-left',
  'external-iliac-vein-right',
  'internal-iliac-vein-left',
  'internal-iliac-vein-right',
  'cfv-left',
  'cfv-right',
  'gonadal-vein-left',
  'gonadal-vein-right',
  'pelvic-plexus-left',
  'pelvic-plexus-right',
  // Arterial special considerations (SMAS / MALS) — unpaired midline vessels.
  'celiac-artery',
  'superior-mesenteric-artery',
  'common-hepatic-artery',
  'splenic-artery',
] as const;

// ============================================================================
// Parameter definitions (StudyConfig completeness + i18n label anchors)
// ============================================================================

export const ILIAC_PELVIC_VENOUS_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'diameterMm',
    label: 'iliacPelvicVenous.param.diameterMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 40,
    step: 0.1,
  },
  {
    id: 'velocityCmS',
    label: 'iliacPelvicVenous.param.velocityCmS',
    kind: 'velocity-cm-s',
    unit: 'cm/s',
    min: 0,
    max: 400,
    step: 1,
  },
];

export const ILIAC_PELVIC_VENOUS_CONFIG: StudyConfig = {
  type: 'iliacPelvicVenous',
  loincCode: VASCULAR_LOINC.iliacPelvicVenous.code,
  loincDisplay: VASCULAR_LOINC.iliacPelvicVenous.display,
  segments: ILIAC_PELVIC_VENOUS_SEGMENTS as ReadonlyArray<string>,
  parameters: ILIAC_PELVIC_VENOUS_PARAMETERS,
};
