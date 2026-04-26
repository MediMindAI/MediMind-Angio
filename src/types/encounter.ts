// SPDX-License-Identifier: Apache-2.0
/**
 * Encounter — patient-visit-centric draft container.
 *
 * Phase 1 of the encounter-pivot plan introduces an encounter as the new
 * top-level draft entity. Today the app is study-centric: every study
 * carries its own copy of patient identity + visit context inside its
 * `<StudyHeader>` (see `StudyHeader` in `./form.ts`). When a clinician
 * scans the same patient for venous-LE bilateral + arterial-LE + carotid
 * in one visit they re-type every demographic three times.
 *
 * The encounter pivot consolidates that into:
 *   - One `EncounterHeader` per visit — patient identity + visit context.
 *   - Per-study state continues to carry only **study-clinical** fields
 *     (studyDate/studyTime/accessionNumber/cptCode/patientPosition/quality
 *     /protocol). The field-split table is the source of truth — see
 *     `/Users/toko/.claude/plans/create-the-detailed-plan-lucky-sparrow.md`.
 *
 * Phase 1 ships ADDITIVE types only. The existing `StudyHeader` is NOT
 * shrunk yet; that will land in Phase 3 alongside per-study form refactors.
 *
 * `schemaVersion: 2` reserves room: the per-study draft store (Wave 4.1)
 * already uses `v: 1` for its own envelope. Encounters get a fresh version
 * line so future migrations can target each independently.
 */

import type { StudyType } from './study';
import type { IndicationCode } from './form';

/** Opaque identifier — minted via `crypto.randomUUID()` at intake time. */
export type EncounterId = string;

/**
 * Encounter-level header — patient identity + visit context. One encounter
 * → one set of demographic fields, no matter how many studies are run.
 *
 * `encounterDate` doubles as the default for per-study `studyDate` when the
 * clinician doesn't override on the study page.
 */
export interface EncounterHeader {
  // Patient identity
  readonly patientName: string;
  readonly patientId?: string;
  readonly patientBirthDate?: string;
  readonly patientGender?: 'male' | 'female' | 'other' | 'unknown';
  // Visit context
  readonly operatorName?: string;
  readonly referringPhysician?: string;
  readonly institution?: string;
  readonly medications?: string;
  readonly informedConsent?: boolean;
  readonly informedConsentSignedAt?: string;
  readonly icd10Codes?: ReadonlyArray<IndicationCode>;
  readonly indicationNotes?: string;
  // Encounter-level metadata
  /** ISO YYYY-MM-DD; default for per-study `studyDate`. */
  readonly encounterDate: string;
}

/**
 * The persisted shape of an in-progress encounter. Per-study reducer
 * state lives under `studies[studyType]` as opaque `unknown` for Phase 1
 * — Phase 3 will narrow it to a discriminated union once the per-study
 * forms are refactored to drop their own headers.
 */
export interface EncounterDraft {
  readonly schemaVersion: 2;
  readonly encounterId: EncounterId;
  readonly header: EncounterHeader;
  readonly selectedStudyTypes: ReadonlyArray<StudyType>;
  /**
   * Per-study reducer snapshots, keyed by `StudyType`. Present only after
   * the user has navigated into the form. Phase 1 keeps the value type
   * `unknown` so this type can ship without touching per-study reducers;
   * Phase 3 will tighten it once forms migrate.
   */
  readonly studies: Readonly<Partial<Record<StudyType, unknown>>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Stable schema-version constant — bump when EncounterDraft's persisted
 * shape changes incompatibly so `loadEncounter` callers can route old
 * payloads through a migration step.
 */
export const ENCOUNTER_SCHEMA_VERSION = 2 as const;
