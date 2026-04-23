/**
 * FormState — the in-memory representation of a study report during editing.
 *
 * `FormState` is a *discriminated union* on `studyType`. Each variant
 * re-declares the type tag so TS can pattern-match on it. This is the
 * same pattern FHIR uses for polymorphic types (value[x]) but in a way
 * TS can actually prove exhaustive.
 *
 * Shape (common):
 *   header      — identifying metadata (patient, date, operator)
 *   segments    — per-segment findings keyed by SegmentId
 *   narrative   — free-text sections (findings, impression)
 *   ceap        — optional CEAP classification (venous studies only, but
 *                 the field is present on all variants to keep the shape
 *                 uniform; it's ignored on arterial/carotid/IVC)
 *   recommendations — clinician's follow-up list
 */

import type { CeapClassification } from './ceap';
import type { SegmentState } from './anatomy';
import type { StudyType } from './study';
import type { PatientPosition } from './patient-position';

// ============================================================================
// Shared sub-shapes
// ============================================================================

/** An ICD-10-CM indication code, as captured on the StudyHeader. */
export interface IndicationCode {
  readonly code: string;
  readonly display: string;
}

/** A CPT procedure code, as captured on the StudyHeader. */
export interface CptCode {
  readonly code: string;
  readonly display: string;
}

/** Patient + encounter header shown at the top of the report. */
export interface StudyHeader {
  readonly patientName: string;
  readonly patientId?: string;
  readonly patientBirthDate?: string; // ISO date
  readonly patientGender?: 'male' | 'female' | 'other' | 'unknown';
  readonly studyDate: string; // ISO date
  readonly operatorName?: string;
  readonly referringPhysician?: string;
  readonly institution?: string;
  readonly accessionNumber?: string;

  // --- Phase 1.5 Corestudycast-parity additions ---
  /** Informed consent obtained from patient for the imaging study. */
  readonly informedConsent?: boolean;
  /** ISO date-time when the patient signed informed consent. */
  readonly informedConsentSignedAt?: string;
  /** Patient's physical position during the study. */
  readonly patientPosition?: PatientPosition;
  /** Medications taken by the patient at time of study (free text). */
  readonly medications?: string;
  /** Structured ICD-10 indications (replaces free-text `indication`). */
  readonly icd10Codes?: ReadonlyArray<IndicationCode>;
  /** CPT procedure code billed for the study. */
  readonly cptCode?: CptCode;
}

/** Free-text sections of the report. */
export interface StudyNarrative {
  /** Indication for the study (why it was ordered). */
  readonly indication?: string;
  /** Description of technique used. */
  readonly technique?: string;
  /** Narrative findings. */
  readonly findings?: string;
  /** Clinician's impression / assessment. */
  readonly impression?: string;
  /** Additional comments (deprecated — use `sonographerComments` / `clinicianComments`). */
  readonly comments?: string;
  /** Comments written by the sonographer/technologist performing the study. */
  readonly sonographerComments?: string;
  /** Comments / impression written by the interpreting clinician. */
  readonly clinicianComments?: string;
}

/** One structured recommendation entry. */
export interface Recommendation {
  readonly id: string;
  /**
   * Persisted English fallback text — always present. When `textKey` is set,
   * the UI localizes by looking up `textKey` with `text` as the fallback so
   * unresolved keys never surface raw. User edits clear `textKey` and write
   * the new value to `text`.
   */
  readonly text: string;
  /** Optional translation key for localization of template-seeded recs. */
  readonly textKey?: string;
  /** Optional priority: e.g. 'routine' | 'urgent' | 'stat'. */
  readonly priority?: 'routine' | 'urgent' | 'stat';
  /** Optional follow-up interval (e.g. "6 months"). */
  readonly followUpInterval?: string;
}

// ============================================================================
// Discriminated-union variants
// ============================================================================

/** Fields shared by every form variant. */
interface FormStateBase {
  readonly header: StudyHeader;
  readonly segments: ReadonlyArray<SegmentState>;
  readonly narrative: StudyNarrative;
  readonly ceap?: CeapClassification;
  readonly recommendations: ReadonlyArray<Recommendation>;
  /** Free-form parameter bag — indexed by ParameterDef.id, study-specific. */
  readonly parameters: Readonly<Record<string, string | number | boolean | undefined>>;
}

export interface VenousLEBilateralFormState extends FormStateBase {
  readonly studyType: 'venousLEBilateral';
}

export interface VenousLERightFormState extends FormStateBase {
  readonly studyType: 'venousLERight';
}

export interface VenousLELeftFormState extends FormStateBase {
  readonly studyType: 'venousLELeft';
}

export interface ArterialLEFormState extends FormStateBase {
  readonly studyType: 'arterialLE';
}

export interface CarotidFormState extends FormStateBase {
  readonly studyType: 'carotid';
}

export interface IvcDuplexFormState extends FormStateBase {
  readonly studyType: 'ivcDuplex';
}

/**
 * The complete form shape — union over every supported `StudyType`.
 * Consumers `switch (form.studyType) { ... }` to get exhaustive narrowing.
 */
export type FormState =
  | VenousLEBilateralFormState
  | VenousLERightFormState
  | VenousLELeftFormState
  | ArterialLEFormState
  | CarotidFormState
  | IvcDuplexFormState;

/** Type guard: narrows to any venous variant. */
export function isVenousForm(
  form: FormState
): form is VenousLEBilateralFormState | VenousLERightFormState | VenousLELeftFormState {
  return (
    form.studyType === 'venousLEBilateral' ||
    form.studyType === 'venousLERight' ||
    form.studyType === 'venousLELeft'
  );
}

/** Type guard for arterial studies (LE + carotid). */
export function isArterialForm(form: FormState): form is ArterialLEFormState | CarotidFormState {
  return form.studyType === 'arterialLE' || form.studyType === 'carotid';
}

/** Sanity: re-exporting StudyType here keeps consumers on one import. */
export type { StudyType };
