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
// Shared — per-level vessel measurement
// ============================================================================

/**
 * One anatomical level's capture, shared by the caval veins (Zone 2) and the
 * left renal vein (Zone 1). `velocityCmS` is the absolute spectral peak velocity
 * the protocol records at each level; `diameterMm` is the B-mode diameter, only
 * meaningful where the protocol captures it (CFV SFJ-level, IVC, LRV hilum).
 */
export interface VesselLevelMeasurement {
  readonly velocityCmS?: number;
  readonly diameterMm?: number;
}

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

/** Risk factors (Pelvic Venous Duplex protocol). */
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
  /** Defaults to 'female' (this study is female-focused). */
  readonly sex?: Sex;
  readonly symptoms?: ReadonlyArray<Symptom>;
  readonly riskFactors?: ReadonlyArray<RiskFactor>;
  readonly approaches?: ReadonlyArray<Approach>;
  readonly positions?: ReadonlyArray<StudyPositionValue>;
  readonly valsalvaPerformed?: boolean;
}

// ============================================================================
// Zone 1 — left renal vein (nutcracker screening)
// ============================================================================

/**
 * LRV interrogation levels (proximal = closest to IVC; mid = pre-aortic /
 * aortomesenteric; distal = renal hilum). Mirrors the caval multi-level keys.
 */
export const LRV_LEVELS = ['proximal', 'mid', 'distal'] as const;
export type LrvLevel = (typeof LRV_LEVELS)[number];

export interface RenalVeinFinding {
  /**
   * Peak-velocity ratio (aortomesenteric:hilar). Significant LRV compression
   * ≥ 7.0 per the Pelvic Venous Duplex protocol. (OLD: ≥ 5, Kim 2024 screening
   * cut-off — superseded.)
   */
  readonly peakVelocityRatio?: number;
  /** AP-diameter ratio (hilar:aortomesenteric). Abnormal ≥ 5. */
  readonly apDiameterRatio?: number;
  /** Per-level LRV velocity (cm/s) + diameter (mm), keyed proximal/mid/distal. */
  readonly levels?: Readonly<Partial<Record<LrvLevel, VesselLevelMeasurement>>>;
  readonly beakSign?: boolean;
  readonly hilarVarices?: boolean;
  /** Retro-aortic left renal vein variant — sought when the LRV is not seen in
   * the standard pre-aortic plane. */
  readonly retroAortic?: boolean;
  /** US is screening for nutcracker → confirmatory CT/MR venography. */
  readonly confirmatoryImagingRecommended?: boolean;
  readonly note?: string;
  // NOTE: `aortoSmaAngleDeg` REMOVED — the SMA–aorta angle is now classed under
  // SMA Syndrome (specialConsiderations.smas), per protocol.
}

// ============================================================================
// Zone 2 — iliac & caval (May-Thurner + DVT)
// ============================================================================

/** Segment bases. IVC is midline (no side); the rest are per-side. */
export const ILIAC_CAVAL_BASES = ['ivc', 'civ', 'eiv', 'iiv', 'cfv'] as const;
export type IliacCavalBase = (typeof ILIAC_CAVAL_BASES)[number];
export type IliacCavalFullId = 'ivc' | `${Exclude<IliacCavalBase, 'ivc'>}-${Side}`;

/** Anatomical levels a vein base captures, in acquisition order (per protocol). */
export const CAVAL_LEVEL_VALUES = ['sfj', 'distal', 'mid', 'proximal'] as const;
export type CavalLevel = (typeof CAVAL_LEVEL_VALUES)[number];

export const CAVAL_LEVELS_FOR_BASE = {
  ivc: ['distal', 'proximal'],
  civ: ['distal', 'mid', 'proximal'],
  eiv: ['distal', 'mid', 'proximal'],
  iiv: ['distal'], // sampled at the distal IIV only (per protocol)
  cfv: ['proximal', 'sfj'], // proximal CFV + SFJ-level (diameter captured at sfj)
} as const satisfies Record<IliacCavalBase, ReadonlyArray<CavalLevel>>;

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
  /**
   * Peak-velocity ratio across the stenosis. Graded by `cavalStenosisSeverity`
   * (Moderate 2.0–2.49 · Significant ≥ 2.5). Auto-derived from `levels` when ≥ 2
   * level velocities exist (read-only in the UI); retained as a writable slot for
   * manual override / legacy drafts — see `effectiveCavalVelocityRatio`.
   */
  readonly velocityRatio?: number;
  /** % stenosis. ≥ 50% significant. */
  readonly stenosisPct?: number;
  /** Per-level velocity (cm/s) + diameter (mm), keyed by anatomical level. */
  readonly levels?: Readonly<Partial<Record<CavalLevel, VesselLevelMeasurement>>>;
  /** CFV waveform phasicity (most relevant to the cfv rows). */
  readonly phasicity?: CfvPhasicity;
  readonly valsalvaResponse?: ValsalvaResponse;
  readonly collateralsPresent?: boolean;
  readonly reflux?: boolean;
  /**
   * EIV only — a high-velocity color bruit in the proximal EIV with a distended
   * bladder suggests intrinsic compression; `remeasuredAfterVoiding` marks that
   * the level velocities reflect the post-void remeasurement.
   */
  readonly bladderArtifactSuspected?: boolean;
  readonly remeasuredAfterVoiding?: boolean;
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
// Zone 6 — arterial special considerations (SMAS / MALS)
// ============================================================================

export interface SmasFinding {
  /** SMA–aorta angle (degrees). SMA Syndrome highly suspected < 25° (almost
   * always with LRV compression). Replaces the old nutcracker aorto-SMA marker. */
  readonly smaAortaAngleDeg?: number;
  readonly note?: string;
}

export interface MalsFinding {
  /** Celiac artery PSV at INSPIRATION (cm/s). */
  readonly caInspiratoryPsvCmS?: number;
  /** Celiac artery PSV at EXPIRATION (cm/s). MALS if > 200 or > 2× inspiratory. */
  readonly caExpiratoryPsvCmS?: number;
  /** Classic 'hook-shaped' celiac artery on sagittal imaging (supportive). */
  readonly hookSign?: boolean;
  /** Common hepatic artery PSV (cm/s) — post-stenotic / collateral assessment. */
  readonly chaPsvCmS?: number;
  /** Splenic artery PSV (cm/s) — post-stenotic / collateral assessment. */
  readonly splenicPsvCmS?: number;
  readonly note?: string;
}

export interface SpecialConsiderationsFindings {
  readonly smas?: SmasFinding;
  readonly mals?: MalsFinding;
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
  readonly specialConsiderations?: SpecialConsiderationsFindings;
}

/** Data-bearing zone keys, in report order. */
export const ILIAC_PELVIC_VENOUS_ZONES = [
  'renal',
  'caval',
  'gonadal',
  'plexus',
  'escapePoints',
  'extrapelvic',
  'specialConsiderations',
] as const;
export type IliacZoneKey = (typeof ILIAC_PELVIC_VENOUS_ZONES)[number];

// ============================================================================
// Thresholds + pure abnormality helpers (drive narrative + inline warnings)
// ============================================================================

export const ILIAC_THRESHOLDS = {
  /** Nutcracker: LRV peak-velocity ratio significant ≥ 7.0 (Pelvic Venous Duplex
   *  protocol). OLD: 5 (Kim 2024 aortomesenteric:hilar screening) — superseded. */
  renalPeakVelocityRatio: 7,
  renalApDiameterRatio: 5,
  /** SMA Syndrome: SMA–aorta angle < 25° (protocol). OLD nutcracker angle ≤ 35°
   *  (Kim 2024) — reframed as SMAS and superseded. */
  smasAortaAngleDeg: 25,
  /** MALS: celiac expiratory PSV > 200 cm/s, or expiratory > 2× inspiratory. */
  malsExpiratoryPsvCmS: 200,
  malsInspToExpRatio: 2,
  cavalVelocityRatio: 2.5,
  cavalStenosisPct: 50,
  /** Gonadal/ovarian vein significant > 5 mm (protocol, strict greater-than).
   *  OLD: ≥ 6 mm (Gavrilov) — superseded. */
  gonadalDiameterMm: 5,
  refluxDurationS: 1,
  plexusDiameterMm: 5,
  plexusSevereDiameterMm: 8,
  plexusCongestedVelocityCmS: 3,
  escapePointDiameterMm: 3.5,
} as const;

/**
 * Derive the peak-velocity ratio from captured level velocities:
 *   ratio = max(level velocities) / min(level velocities)
 * The min is the reference (least-stenotic) level, the max the peak/stenotic
 * level — the Metzger/Labropoulos cross-stenosis method. Returns undefined when
 * fewer than two levels carry a velocity (no ratio computable).
 */
export function deriveCavalVelocityRatio(f: IliacCavalFinding | undefined): number | undefined {
  const vels = f?.levels
    ? Object.values(f.levels)
        .map((m) => m?.velocityCmS)
        .filter((v): v is number => typeof v === 'number' && v > 0)
    : [];
  if (vels.length < 2) return undefined;
  const max = Math.max(...vels);
  const min = Math.min(...vels);
  return min > 0 ? max / min : undefined;
}

/**
 * Effective ratio for display/diagnosis: prefer the derived value (source of
 * truth when ≥ 2 levels measured), else the stored/legacy/override `velocityRatio`.
 * Single accessor so every consumer agrees.
 */
export function effectiveCavalVelocityRatio(f: IliacCavalFinding | undefined): number | undefined {
  return deriveCavalVelocityRatio(f) ?? f?.velocityRatio;
}

export const CAVAL_SEVERITY_VALUES = ['none', 'moderate', 'significant'] as const;
export type CavalStenosisSeverity = (typeof CAVAL_SEVERITY_VALUES)[number];

/**
 * Graded iliac/caval cross-stenosis severity (protocol):
 *   Significant ≥ 2.5 · Moderate 2.0–2.49 · Tandem (serial) lesion significant > 2.0.
 * A tandem lesion is flagged significant once the ratio exceeds 2.0 (a serial
 * pressure drop is haemodynamically additive). Replaces the single binary ≥ 2.5.
 */
export function cavalStenosisSeverity(
  velocityRatio: number | undefined,
  opts?: { readonly tandem?: boolean },
): CavalStenosisSeverity {
  const r = velocityRatio ?? 0;
  if (opts?.tandem) return r > 2.0 ? 'significant' : 'none';
  if (r >= ILIAC_THRESHOLDS.cavalVelocityRatio) return 'significant';
  if (r >= 2.0) return 'moderate';
  return 'none';
}

export function isNutcrackerScreenPositive(r: RenalVeinFinding | undefined): boolean {
  if (!r) return false;
  // Driven by velocity ratio ≥ 7.0, AP-diameter ratio ≥ 5, or beak sign. Hilar
  // varices are recorded but supportive (not an independent trigger). The SMA
  // angle is no longer a nutcracker term — it now drives SMAS.
  return (
    (r.peakVelocityRatio ?? 0) >= ILIAC_THRESHOLDS.renalPeakVelocityRatio ||
    (r.apDiameterRatio ?? 0) >= ILIAC_THRESHOLDS.renalApDiameterRatio ||
    r.beakSign === true
  );
}

export function isCavalObstructive(f: IliacCavalFinding | undefined): boolean {
  if (!f) return false;
  return (
    f.patency === 'occluded' ||
    f.patency === 'partial' ||
    (effectiveCavalVelocityRatio(f) ?? 0) >= ILIAC_THRESHOLDS.cavalVelocityRatio ||
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
    (f.diameterMm ?? 0) > ILIAC_THRESHOLDS.gonadalDiameterMm ||
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

export function isSmasPositive(s: SmasFinding | undefined): boolean {
  return (
    !!s &&
    s.smaAortaAngleDeg !== undefined &&
    s.smaAortaAngleDeg < ILIAC_THRESHOLDS.smasAortaAngleDeg
  );
}

export function isMalsPositive(m: MalsFinding | undefined): boolean {
  if (!m) return false;
  const { caExpiratoryPsvCmS: exp, caInspiratoryPsvCmS: insp } = m;
  const highExp = exp !== undefined && exp > ILIAC_THRESHOLDS.malsExpiratoryPsvCmS;
  const ratioHigh =
    exp !== undefined &&
    insp !== undefined &&
    insp > 0 &&
    exp / insp > ILIAC_THRESHOLDS.malsInspToExpRatio;
  // Hook sign is recorded but supportive — not an independent positivity trigger.
  return highExp || ratioHigh;
}

// ============================================================================
// V1 → V2 schema migration (findings shape)
// ============================================================================

function migrateCavalFindingV1toV2(f: IliacCavalFinding): IliacCavalFinding {
  // Already V2-shaped (carries a levels record) → no-op.
  return f.levels !== undefined ? f : { ...f, levels: {} };
}

function migrateCavalFindingsV1toV2(
  caval: IliacCavalFindings | undefined,
): IliacCavalFindings | undefined {
  if (!caval) return caval;
  let mutated = false;
  const out: Record<string, IliacCavalFinding> = {};
  for (const [id, f] of Object.entries(caval)) {
    if (!f) continue;
    const next = migrateCavalFindingV1toV2(f);
    if (next !== f) mutated = true;
    out[id] = next;
  }
  return mutated ? (out as IliacCavalFindings) : caval;
}

/**
 * V1→V2 findings migration. V1 carried a single composite per caval vein with a
 * flat `velocityRatio` (preserved as the override/legacy slot), and stored the
 * SMA–aorta angle on the renal finding. V2 adds per-level `levels` and classes
 * the SMA angle under SMAS. Idempotent and pure (returns the same reference when
 * nothing changes), so re-hydrating a V2 draft is a no-op.
 */
export function migrateIliacFindingsV1toV2(
  findings: IliacPelvicVenousFindings,
): IliacPelvicVenousFindings {
  let next = findings;

  const caval = migrateCavalFindingsV1toV2(findings.caval);
  if (caval !== findings.caval) next = { ...next, caval };

  // Relocate a legacy renal aorto-SMA angle into SMAS (the key is no longer on
  // RenalVeinFinding, so read it through a widened view).
  const legacyRenal = next.renal as
    | (RenalVeinFinding & { aortoSmaAngleDeg?: number })
    | undefined;
  const legacyAngle = legacyRenal?.aortoSmaAngleDeg;
  if (
    legacyAngle !== undefined &&
    next.specialConsiderations?.smas?.smaAortaAngleDeg === undefined
  ) {
    const renalCopy: RenalVeinFinding & { aortoSmaAngleDeg?: number } = { ...legacyRenal };
    delete renalCopy.aortoSmaAngleDeg;
    next = {
      ...next,
      renal: renalCopy,
      specialConsiderations: {
        ...next.specialConsiderations,
        smas: { ...next.specialConsiderations?.smas, smaAortaAngleDeg: legacyAngle },
      },
    };
  }

  return next;
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
    id: 'peakVelocityRatio',
    label: 'iliacPelvicVenous.param.peakVelocityRatio',
    kind: 'number',
    unit: '1',
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    id: 'smaAortaAngleDeg',
    label: 'iliacPelvicVenous.param.smaAortaAngleDeg',
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
  {
    id: 'velocityCmS',
    label: 'iliacPelvicVenous.param.velocityCmS',
    kind: 'velocity-cm-s',
    unit: 'cm/s',
    min: 0,
    max: 400,
    step: 1,
  },
  {
    id: 'caPsvCmS',
    label: 'iliacPelvicVenous.param.caPsvCmS',
    kind: 'velocity-cm-s',
    unit: 'cm/s',
    min: 0,
    max: 600,
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
