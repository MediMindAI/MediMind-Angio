// SPDX-License-Identifier: Apache-2.0
/**
 * PatientPosition — the patient's physical positioning during the vascular study.
 *
 * Vascular duplex protocols vary required positioning by segment:
 *   - Reverse Trendelenburg 30° — increases venous filling, preferred for deep DVT screening
 *   - Standing — gravitational loading, mandatory for reflux assessment
 *   - Supine — baseline, required for abdominal + arterial studies
 *   - Seated — alternative for limited-mobility patients, acceptable for distal GSV reflux
 *   - Side-lying — used for popliteal fossa imaging when prone cannot be tolerated
 *
 * The chosen position is captured on StudyHeader and emitted as an Observation
 * with LOINC 8361-8 "Patient Position" so downstream consumers can reproduce
 * the insonation geometry.
 */

export const PATIENT_POSITIONS = [
  'supine',
  'reverse-trendelenburg-30',
  'standing',
  'seated',
  'side-lying',
] as const;

export type PatientPosition = (typeof PATIENT_POSITIONS)[number];
