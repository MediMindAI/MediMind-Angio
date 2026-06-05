// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac & Pelvic Venous Duplex — Study Configuration
 *
 * Clinical model for pelvic venous disorders (PeVD), female-focused. Unlike the
 * other studies (one uniform per-segment finding shape), this study spans FIVE
 * heterogeneous anatomical zones whose measurements diverge, so the findings are
 * modelled as ZONE-GROUPED objects rather than a single keyed segment map:
 *
 *   Zone 0 — context/technique (sex, symptoms, approaches, positions, Valsalva)
 *   Zone 1 — left renal vein / nutcracker screening   (RenalVeinFinding)
 *   Zone 2 — iliac & caval (May-Thurner + DVT)         (IliacCavalFindings, keyed)
 *   Zone 3 — gonadal/ovarian veins                     (per-side)
 *   Zone 4 — pelvic venous plexus                      (per-side)
 *   Zone 5 — escape points + extrapelvic varices       (list + booleans)
 *
 * The diagram for this study is a STATIC illustration the clinician free-draws +
 * text-labels on — there is NO segment-id → competency coloring, hence no
 * `deriveCompetency()`. Findings drive the narrative, FHIR Observations, and SVP
 * classification instead of diagram colors.
 *
 * Thresholds: SVP (Meissner 2021); Gavrilov pelvic reflux; Metzger/Labropoulos
 * iliac velocity ratio; nutcracker Doppler criteria (Kim 2024). See the audit
 * research dossier for citations.
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

/** Presenting symptoms — drive the SVP S-axis. */
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
] as const;
export type Symptom = (typeof SYMPTOM_VALUES)[number];

export const APPROACH_VALUES = ['transabdominal', 'transvaginal', 'transperineal'] as const;
export type Approach = (typeof APPROACH_VALUES)[number];

export const POSITION_VALUES = [
  'supine',
  'left-lateral',
  'reverse-trendelenburg',
  'standing',
] as const;
export type StudyPositionValue = (typeof POSITION_VALUES)[number];

export interface IliacContext {
  /** Defaults to 'female' (this study is female-focused). */
  readonly sex?: Sex;
  readonly symptoms?: ReadonlyArray<Symptom>;
  readonly approaches?: ReadonlyArray<Approach>;
  readonly positions?: ReadonlyArray<StudyPositionValue>;
  readonly valsalvaPerformed?: boolean;
}

// ============================================================================
// Zone 1 — left renal vein (nutcracker screening)
// ============================================================================

export interface RenalVeinFinding {
  /** Peak-velocity ratio (aortomesenteric:hilar). Abnormal ≥ 5. */
  readonly peakVelocityRatio?: number;
  /** AP-diameter ratio (hilar:aortomesenteric). Abnormal ≥ 5. */
  readonly apDiameterRatio?: number;
  /** Aorto-SMA angle in degrees. Abnormal ≤ 35°. */
  readonly aortoSmaAngleDeg?: number;
  readonly beakSign?: boolean;
  readonly hilarVarices?: boolean;
  /** US is screening for nutcracker → confirmatory CT/MR venography. */
  readonly confirmatoryImagingRecommended?: boolean;
  readonly note?: string;
}

// ============================================================================
// Zone 2 — iliac & caval (May-Thurner + DVT)
// ============================================================================

/** Segment bases. IVC is midline (no side); the rest are per-side. */
export const ILIAC_CAVAL_BASES = ['ivc', 'civ', 'eiv', 'iiv', 'cfv'] as const;
export type IliacCavalBase = (typeof ILIAC_CAVAL_BASES)[number];
export type IliacCavalFullId = 'ivc' | `${Exclude<IliacCavalBase, 'ivc'>}-${Side}`;

export const PATENCY_VALUES = ['patent', 'partial', 'occluded'] as const;
export type Patency = (typeof PATENCY_VALUES)[number];

export const CAVAL_COMPRESSIBILITY_VALUES = ['full', 'partial', 'non-compressible'] as const;
export type CavalCompressibility = (typeof CAVAL_COMPRESSIBILITY_VALUES)[number];

export const THROMBUS_CHRONICITY_VALUES = ['none', 'acute', 'chronic', 'acute-on-chronic'] as const;
export type ThrombusChronicity = (typeof THROMBUS_CHRONICITY_VALUES)[number];

export const CFV_PHASICITY_VALUES = ['phasic', 'reduced', 'monophasic'] as const;
export type CfvPhasicity = (typeof CFV_PHASICITY_VALUES)[number];

export const VALSALVA_RESPONSE_VALUES = ['normal', 'reduced', 'absent'] as const;
export type ValsalvaResponse = (typeof VALSALVA_RESPONSE_VALUES)[number];

export interface IliacCavalFinding {
  readonly patency?: Patency;
  readonly compressibility?: CavalCompressibility;
  readonly thrombusChronicity?: ThrombusChronicity;
  /** Peak-velocity ratio across the stenosis. Abnormal ≥ 2.5. */
  readonly velocityRatio?: number;
  /** % stenosis. ≥ 50% significant. */
  readonly stenosisPct?: number;
  /** CFV waveform phasicity (most relevant to the cfv rows). */
  readonly phasicity?: CfvPhasicity;
  readonly valsalvaResponse?: ValsalvaResponse;
  readonly collateralsPresent?: boolean;
  readonly reflux?: boolean;
  /** Obstruction is US-screening → confirmatory IVUS/CT venography. */
  readonly confirmatoryImagingRecommended?: boolean;
  readonly note?: string;
}

export type IliacCavalFindings = Readonly<Partial<Record<IliacCavalFullId, IliacCavalFinding>>>;

// ============================================================================
// Zone 3 — gonadal / ovarian veins (per side)
// ============================================================================

export const REFLUX_TRIGGER_VALUES = ['spontaneous', 'valsalva-only'] as const;
export type RefluxTrigger = (typeof REFLUX_TRIGGER_VALUES)[number];

/** Gavrilov reflux-duration type: I 1–2 s · II 2.1–5 s · III >5 s or spontaneous. */
export const REFLUX_TYPE_VALUES = ['I', 'II', 'III'] as const;
export type RefluxType = (typeof REFLUX_TYPE_VALUES)[number];

export const FLOW_DIRECTION_VALUES = ['antegrade', 'retrograde', 'to-and-fro'] as const;
export type FlowDirection = (typeof FLOW_DIRECTION_VALUES)[number];

export interface GonadalVeinFinding {
  /** Vein diameter (mm). Abnormal ≥ 6. */
  readonly diameterMm?: number;
  readonly refluxPresent?: boolean;
  readonly refluxTrigger?: RefluxTrigger;
  /** Reflux duration (seconds). Abnormal > 1. */
  readonly refluxDurationS?: number;
  readonly refluxType?: RefluxType;
  readonly flowDirection?: FlowDirection;
  readonly note?: string;
}

// ============================================================================
// Zone 4 — pelvic venous plexus (per side)
// ============================================================================

export const TORTUOSITY_VALUES = ['none', 'moderate', 'severe'] as const;
export type Tortuosity = (typeof TORTUOSITY_VALUES)[number];

export interface PelvicPlexusFinding {
  /** Largest plexus vein diameter (mm). Abnormal ≥ 5; severe ≥ 8. */
  readonly largestDiameterMm?: number;
  readonly refluxDurationS?: number;
  readonly refluxType?: RefluxType;
  /** Flow velocity (cm/s). < 3 = congested. */
  readonly flowVelocityCmS?: number;
  /** Arcuate / myometrial crossing veins present. */
  readonly crossingVeins?: boolean;
  readonly crossPelvicCollateral?: boolean;
  readonly tortuosity?: Tortuosity;
  readonly note?: string;
}

// ============================================================================
// Zone 5 — escape points + extrapelvic varices
// ============================================================================

export const ESCAPE_POINT_VALUES = ['perineal', 'inguinal', 'gluteal', 'obturator'] as const;
export type EscapePointType = (typeof ESCAPE_POINT_VALUES)[number];

export interface EscapePoint {
  /** Stable id (crypto.randomUUID) for React keys + update/remove actions. */
  readonly id: string;
  readonly type: EscapePointType;
  readonly side: Side;
  /** Diameter (mm). Significant > 3.5. */
  readonly diameterMm?: number;
}

export interface ExtrapelvicVarices {
  readonly vulvar?: boolean;
  readonly perineal?: boolean;
  readonly gluteal?: boolean;
  readonly posteromedialThigh?: boolean;
  readonly sciatic?: boolean;
}

// ============================================================================
// Top-level zone-grouped findings
// ============================================================================

export interface IliacPelvicVenousFindings {
  readonly renal?: RenalVeinFinding;
  readonly caval?: IliacCavalFindings;
  readonly gonadal?: Partial<Record<Side, GonadalVeinFinding>>;
  readonly plexus?: Partial<Record<Side, PelvicPlexusFinding>>;
  readonly escapePoints?: ReadonlyArray<EscapePoint>;
  readonly extrapelvic?: ExtrapelvicVarices;
}

/** Data-bearing zone keys, in report order. */
export const ILIAC_PELVIC_VENOUS_ZONES = [
  'renal',
  'caval',
  'gonadal',
  'plexus',
  'escapePoints',
  'extrapelvic',
] as const;
export type IliacZoneKey = (typeof ILIAC_PELVIC_VENOUS_ZONES)[number];

// ============================================================================
// Thresholds + pure abnormality helpers (drive narrative + inline warnings)
// ============================================================================

export const ILIAC_THRESHOLDS = {
  renalPeakVelocityRatio: 5,
  renalApDiameterRatio: 5,
  renalAortoSmaAngleDeg: 35,
  cavalVelocityRatio: 2.5,
  cavalStenosisPct: 50,
  gonadalDiameterMm: 6,
  refluxDurationS: 1,
  plexusDiameterMm: 5,
  plexusSevereDiameterMm: 8,
  plexusCongestedVelocityCmS: 3,
  escapePointDiameterMm: 3.5,
} as const;

export function isNutcrackerScreenPositive(r: RenalVeinFinding | undefined): boolean {
  if (!r) return false;
  return (
    (r.peakVelocityRatio ?? 0) >= ILIAC_THRESHOLDS.renalPeakVelocityRatio ||
    (r.apDiameterRatio ?? 0) >= ILIAC_THRESHOLDS.renalApDiameterRatio ||
    (r.aortoSmaAngleDeg !== undefined && r.aortoSmaAngleDeg <= ILIAC_THRESHOLDS.renalAortoSmaAngleDeg) ||
    r.beakSign === true
  );
}

export function isCavalObstructive(f: IliacCavalFinding | undefined): boolean {
  if (!f) return false;
  return (
    f.patency === 'occluded' ||
    f.patency === 'partial' ||
    (f.velocityRatio ?? 0) >= ILIAC_THRESHOLDS.cavalVelocityRatio ||
    (f.stenosisPct ?? 0) >= ILIAC_THRESHOLDS.cavalStenosisPct ||
    f.compressibility === 'non-compressible' ||
    f.compressibility === 'partial' ||
    f.thrombusChronicity === 'acute' ||
    f.thrombusChronicity === 'chronic' ||
    f.thrombusChronicity === 'acute-on-chronic'
  );
}

export function isGonadalRefluxAbnormal(f: GonadalVeinFinding | undefined): boolean {
  if (!f) return false;
  return (
    f.refluxPresent === true ||
    (f.diameterMm ?? 0) >= ILIAC_THRESHOLDS.gonadalDiameterMm ||
    (f.refluxDurationS ?? 0) > ILIAC_THRESHOLDS.refluxDurationS
  );
}

export function isPlexusCongested(f: PelvicPlexusFinding | undefined): boolean {
  if (!f) return false;
  return (
    (f.largestDiameterMm ?? 0) >= ILIAC_THRESHOLDS.plexusDiameterMm ||
    (f.flowVelocityCmS !== undefined && f.flowVelocityCmS < ILIAC_THRESHOLDS.plexusCongestedVelocityCmS) ||
    (f.refluxDurationS ?? 0) > ILIAC_THRESHOLDS.refluxDurationS
  );
}

export function isEscapePointSignificant(p: EscapePoint): boolean {
  return (p.diameterMm ?? 0) > ILIAC_THRESHOLDS.escapePointDiameterMm;
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
] as const;

// ============================================================================
// Parameter definitions (StudyConfig completeness + i18n label anchors)
// ============================================================================

export const ILIAC_PELVIC_VENOUS_PARAMETERS: ReadonlyArray<ParameterDef> = [
  {
    id: 'peakVelocityRatio',
    label: 'iliacPelvicVenous.param.peakVelocityRatio',
    kind: 'number',
    unit: '1',
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    id: 'aortoSmaAngleDeg',
    label: 'iliacPelvicVenous.param.aortoSmaAngleDeg',
    kind: 'number',
    unit: 'deg',
    min: 0,
    max: 180,
    step: 1,
  },
  {
    id: 'velocityRatio',
    label: 'iliacPelvicVenous.param.velocityRatio',
    kind: 'number',
    unit: '1',
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    id: 'stenosisPct',
    label: 'iliacPelvicVenous.param.stenosisPct',
    kind: 'number',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
  },
  {
    id: 'diameterMm',
    label: 'iliacPelvicVenous.param.diameterMm',
    kind: 'diameter-mm',
    unit: 'mm',
    min: 0,
    max: 30,
    step: 0.1,
  },
  {
    id: 'refluxDurationS',
    label: 'iliacPelvicVenous.param.refluxDurationS',
    kind: 'number',
    unit: 's',
    min: 0,
    max: 30,
    step: 0.1,
  },
  {
    id: 'flowVelocityCmS',
    label: 'iliacPelvicVenous.param.flowVelocityCmS',
    kind: 'velocity-cm-s',
    unit: 'cm/s',
    min: 0,
    max: 200,
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
