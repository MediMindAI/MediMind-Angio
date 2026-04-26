// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 1.4 + 1.5 + 1.6 — Area 03 CRITICAL + Area 05 BLOCKER+CRITICAL+HIGH.
 *
 * Covers:
 *   - VASCULAR_LOINC table is exhaustive over StudyType (compile-time guarantee).
 *   - buildFhirBundle does not throw for any StudyType.
 *   - Patient.identifier emits Georgian personal ID when set.
 *   - DiagnosticReport.identifier emits accession number when set.
 *   - DiagnosticReport.effectiveDateTime + Encounter.period.start honor
 *     header.studyDate (not always nowIso).
 *   - SNOMED catalog: no '-' codes, perv != pera (the original BLOCKER).
 */

import { describe, expect, it } from 'vitest';
import { buildFhirBundle } from './fhirBuilder';
import {
  IDENTIFIER_SYSTEMS,
  VASCULAR_LOINC,
  VASCULAR_SEGMENTS_SNOMED,
  CEAP_SNOMED,
} from '../constants/fhir-systems';
import type { FormState, StudyHeader } from '../types/form';
import type { StudyType } from '../types/study';
import type { DiagnosticReport, Patient, Encounter } from '../types/fhir';

const ALL_STUDY_TYPES: ReadonlyArray<StudyType> = [
  'venousLEBilateral',
  'venousLERight',
  'venousLELeft',
  'arterialLE',
  'carotid',
  'ivcDuplex',
];

function baseHeader(overrides: Partial<StudyHeader> = {}): StudyHeader {
  return {
    patientName: 'Test Patient',
    studyDate: '2026-04-23',
    ...overrides,
  };
}

function minimalForm(studyType: StudyType, headerOverrides: Partial<StudyHeader> = {}): FormState {
  // The discriminated union just tags by studyType; FormStateBase is uniform.
  return {
    studyType,
    header: baseHeader(headerOverrides),
    segments: [],
    narrative: {},
    recommendations: [],
    parameters: {},
  } as FormState;
}

describe('VASCULAR_LOINC table', () => {
  it('has an entry for every StudyType', () => {
    for (const studyType of ALL_STUDY_TYPES) {
      const entry = VASCULAR_LOINC[studyType];
      expect(entry).toBeDefined();
      expect(entry.code).toMatch(/^\d+-\d$/);
      expect(entry.display.length).toBeGreaterThan(0);
    }
  });
});

describe('SNOMED catalog integrity (Area 05 BLOCKER + CRITICAL)', () => {
  it('has no placeholder "-" codes in VASCULAR_SEGMENTS_SNOMED', () => {
    for (const [key, entry] of Object.entries(VASCULAR_SEGMENTS_SNOMED)) {
      expect(entry.code, `placeholder for ${key}`).not.toBe('-');
    }
  });

  it('has no placeholder "-" codes in CEAP_SNOMED', () => {
    for (const [key, entry] of Object.entries(CEAP_SNOMED)) {
      expect(entry.code, `placeholder for ${key}`).not.toBe('-');
    }
  });

  it('peroneal artery (pera) does NOT share a SNOMED code with peroneal vein (perv) — BLOCKER guard', () => {
    const perv = VASCULAR_SEGMENTS_SNOMED.perv;
    const pera = VASCULAR_SEGMENTS_SNOMED.pera;
    expect(perv).toBeDefined();
    expect(pera).toBeDefined();
    expect(perv!.code).not.toBe(pera!.code);
  });
});

describe('buildFhirBundle', () => {
  it.each(ALL_STUDY_TYPES)('does not throw for studyType %s', (studyType) => {
    expect(() => buildFhirBundle(minimalForm(studyType))).not.toThrow();
  });

  it('emits Patient.identifier with PERSONAL_ID system when header.patientId is set', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', { patientId: '12345678901' }),
    );
    const patient = bundle.entry?.find((e) => e.resource?.resourceType === 'Patient')
      ?.resource as Patient;
    expect(patient).toBeDefined();
    expect(patient.identifier).toBeDefined();
    expect(patient.identifier?.[0]?.system).toBe(IDENTIFIER_SYSTEMS.PERSONAL_ID);
    expect(patient.identifier?.[0]?.value).toBe('12345678901');
  });

  it('omits Patient.identifier when header.patientId is unset', () => {
    const bundle = buildFhirBundle(minimalForm('venousLEBilateral'));
    const patient = bundle.entry?.find((e) => e.resource?.resourceType === 'Patient')
      ?.resource as Patient;
    expect(patient.identifier).toBeUndefined();
  });

  it('emits DiagnosticReport.identifier with STUDY_ID system when header.accessionNumber is set', () => {
    const bundle = buildFhirBundle(
      minimalForm('arterialLE', { accessionNumber: 'ACC-2026-001' }),
    );
    const report = bundle.entry?.find((e) => e.resource?.resourceType === 'DiagnosticReport')
      ?.resource as DiagnosticReport;
    expect(report).toBeDefined();
    expect(report.identifier).toBeDefined();
    expect(report.identifier?.[0]?.system).toBe(IDENTIFIER_SYSTEMS.STUDY_ID);
    expect(report.identifier?.[0]?.value).toBe('ACC-2026-001');
  });

  it('uses header.studyDate for DiagnosticReport.effectiveDateTime (Area 05 HIGH)', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', { studyDate: '2026-04-20' }),
    );
    const report = bundle.entry?.find((e) => e.resource?.resourceType === 'DiagnosticReport')
      ?.resource as DiagnosticReport;
    expect(report.effectiveDateTime).toBe('2026-04-20');
  });

  it('uses header.studyDate for Encounter.period.start when an Encounter is built (with ICD-10)', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', {
        studyDate: '2026-04-20',
        icd10Codes: [{ code: 'I83.90', display: 'Asymptomatic varicose veins of unspecified lower extremity' }],
      }),
    );
    const encounter = bundle.entry?.find((e) => e.resource?.resourceType === 'Encounter')
      ?.resource as Encounter | undefined;
    expect(encounter).toBeDefined();
    expect(encounter?.period?.start).toBe('2026-04-20');
  });
});
