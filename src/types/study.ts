/**
 * Study types — the catalog of supported vascular ultrasound studies.
 *
 * Each `StudyType` maps 1:1 to a LOINC code (see constants/fhir-systems.ts →
 * VASCULAR_LOINC) and drives everything downstream:
 *   - Which anatomical diagram to render
 *   - Which `SegmentId`s are available
 *   - Which parameter fields show in the form
 *   - Which FHIR resources are emitted on finalize
 *
 * We prefer a discriminated-union on `StudyType` over OO inheritance because
 * the study list is fixed and small; pattern-matching in TS keeps all logic
 * exhaustive and mistake-resistant.
 */

import type { SegmentId } from './anatomy';

/**
 * Side discriminator for any per-side study artifact (segments, pressures,
 * narrative). Promoted out of per-study `config.ts` files in Wave 4.6 so
 * every form, builder, and test references the same primitive — drift
 * between three local declarations was an Area-03 MEDIUM finding.
 */
export type Side = 'left' | 'right';

/**
 * Supported study types (Phase 0). New entries must also have:
 *   1. A LOINC code in VASCULAR_LOINC
 *   2. A segment catalog in StudyConfig
 *   3. A parameter definition list
 */
export type StudyType =
  | 'venousLEBilateral' // Lower extremity vein US, bilateral
  | 'venousLERight' // Lower extremity vein US, right
  | 'venousLELeft' // Lower extremity vein US, left
  | 'arterialLE' // Lower extremity artery US
  | 'carotid' // Carotid duplex
  | 'ivcDuplex'; // IVC duplex

/**
 * Kind of input widget for a parameter. The form renderer switches on this.
 */
export type ParameterKind =
  | 'number'
  | 'text'
  | 'select'
  | 'boolean'
  | 'duration-ms'
  | 'diameter-mm'
  | 'velocity-cm-s';

/**
 * Definition of a single parameter field (e.g. "Reflux duration at SFJ").
 *
 * `unit` follows UCUM (https://ucum.org) — e.g. `ms`, `mm`, `cm/s`. UCUM is
 * the unit system FHIR expects for `Quantity.code`.
 */
export interface ParameterDef {
  readonly id: string;
  readonly label: string; // English label (i18n lookup key)
  readonly kind: ParameterKind;
  /** UCUM unit (e.g. `ms`, `mm`, `cm/s`). Optional for non-numeric kinds. */
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** For `select` kind. */
  readonly options?: ReadonlyArray<{ value: string; label: string }>;
  /** Help text shown under the field. */
  readonly help?: string;
}

/**
 * Full configuration for a study type — what segments exist, which params
 * apply, and which LOINC+SNOMED codes tag its outputs.
 */
export interface StudyConfig {
  readonly type: StudyType;
  readonly loincCode: string;
  readonly loincDisplay: string;
  readonly segments: ReadonlyArray<SegmentId>;
  readonly parameters: ReadonlyArray<ParameterDef>;
}
