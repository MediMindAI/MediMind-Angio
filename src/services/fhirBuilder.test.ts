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
  PARAMETER_LOINC,
  STANDARD_FHIR_SYSTEMS,
  VASCULAR_LOINC,
  VASCULAR_SEGMENTS_SNOMED,
  CEAP_SNOMED,
} from '../constants/fhir-systems';
import type { FormState, StudyHeader } from '../types/form';
import type { StudyType } from '../types/study';
import type {
  DiagnosticReport,
  Encounter,
  Observation,
  Organization,
  Patient,
  Practitioner,
  ServiceRequest,
} from '../types/fhir';

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

// ============================================================================
// Wave 2.5 — `parameters` widening + type-guard read boundary
//
// FormStateBase.parameters is now `Readonly<Record<string, unknown>>`. The
// fhirBuilder read sites use `is*Findings` / `isCarotidNascet` /
// `isArterialPressures` from `types/parameters.ts` instead of `as unknown as`
// casts. These tests confirm:
//   1. Real per-segment findings flow through the new typed boundary.
//   2. Wrong-shape `segmentFindings` (string instead of object) does NOT crash
//      the bundle build — the type guard fails open and the build proceeds
//      with no segment-level Observations.
// ============================================================================

describe('Wave 2.5 — parameters type-guard read boundary', () => {
  it('reads venous findings via the type guard (object payload)', () => {
    const form = {
      ...minimalForm('venousLEBilateral'),
      parameters: {
        segmentFindings: {
          'cfv-left': { compressibility: 'non-compressible' },
        },
      },
    } as FormState;
    expect(() => buildFhirBundle(form)).not.toThrow();
  });

  it('reads arterial findings + pressures via the type guards', () => {
    const form = {
      ...minimalForm('arterialLE'),
      parameters: {
        segmentFindings: { 'sfa-left': { stenosisCategory: '50-69' } },
        pressures: { ankleLeft: 120, brachialLeft: 130 },
      },
    } as FormState;
    expect(() => buildFhirBundle(form)).not.toThrow();
  });

  it('reads carotid findings + nascet via the type guards', () => {
    const form = {
      ...minimalForm('carotid'),
      parameters: {
        segmentFindings: { 'ica-left': { plaqueMorphology: 'soft' } },
        nascet: { left: '50-69%', right: '<50%' },
      },
    } as FormState;
    expect(() => buildFhirBundle(form)).not.toThrow();
  });

  it('handles wrong-shape parameters gracefully (string instead of object)', () => {
    // Type guard rejects "a string, not an object" → extract* returns undefined
    // → bundle still builds (no segment Observations, no crash).
    const malformed = {
      ...minimalForm('venousLEBilateral'),
      parameters: { segmentFindings: 'a string, not an object' },
    } as FormState;
    expect(() => buildFhirBundle(malformed)).not.toThrow();
  });

  it('handles array-shaped parameters gracefully (arrays are not plain objects)', () => {
    // The type guard explicitly rejects arrays — `parameters['segmentFindings']`
    // should always be a keyed map, never a positional array.
    const malformed = {
      ...minimalForm('arterialLE'),
      parameters: { segmentFindings: ['not', 'a', 'map'], pressures: null },
    } as FormState;
    expect(() => buildFhirBundle(malformed)).not.toThrow();
  });

  it('handles missing parameters keys gracefully (undefined payload)', () => {
    const sparse = {
      ...minimalForm('carotid'),
      parameters: {}, // no segmentFindings, no nascet
    } as FormState;
    expect(() => buildFhirBundle(sparse)).not.toThrow();
  });
});

// ============================================================================
// Wave 3.4 — Practitioner / Organization references
//
// Before 3.4, `header.operatorName`, `header.referringPhysician`, and
// `header.institution` were copied into a `QuestionnaireResponse` answer (free
// text) and a per-Observation `note: 'performer=...'` annotation, but never
// landed in a typed FHIR slot. Cross-system queries like "all reports
// performed by Dr. X" returned nothing. These tests pin the new wiring:
//
//   header.operatorName       → contained Practitioner referenced from
//                               DiagnosticReport.performer
//   header.referringPhysician → contained Practitioner referenced from
//                               ServiceRequest.requester (only when
//                               header.cptCode is also set, since the
//                               ServiceRequest itself is gated on CPT)
//   header.institution        → contained Organization referenced from
//                               Encounter.serviceProvider (only when an
//                               Encounter is built — i.e. ICD-10 present)
//
// Each test also asserts the negative case (slot stays undefined when the
// source field is empty) so byte-compatibility with pre-3.4 bundles is
// guaranteed for forms that don't supply these headers.
// ============================================================================

describe('Wave 3.4 — Practitioner / Organization references', () => {
  it('emits a Practitioner referenced by DiagnosticReport.performer when operatorName is set', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', { operatorName: 'Dr. Maia Lomidze' }),
    );
    const report = bundle.entry?.find((e) => e.resource?.resourceType === 'DiagnosticReport')
      ?.resource as DiagnosticReport;
    expect(report.performer).toBeDefined();
    expect(report.performer?.[0]?.reference).toMatch(/^urn:uuid:/);

    // The reference must resolve to a Practitioner entry in the same bundle.
    const performerRef = report.performer?.[0]?.reference;
    const practitionerEntry = bundle.entry?.find(
      (e) => e.fullUrl === performerRef && e.resource?.resourceType === 'Practitioner',
    );
    expect(practitionerEntry).toBeDefined();
    const practitioner = practitionerEntry?.resource as Practitioner;
    expect(practitioner.name?.[0]?.text).toBe('Dr. Maia Lomidze');
    expect(practitioner.name?.[0]?.family).toBe('Lomidze');
  });

  it('emits a Practitioner referenced by ServiceRequest.requester when referringPhysician + cptCode are set', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', {
        referringPhysician: 'Dr. Smith',
        cptCode: { code: '93970', display: 'Duplex scan, lower extremity, complete bilateral' },
      }),
    );
    const sr = bundle.entry?.find((e) => e.resource?.resourceType === 'ServiceRequest')
      ?.resource as ServiceRequest;
    expect(sr).toBeDefined();
    expect(sr.requester?.reference).toMatch(/^urn:uuid:/);

    const requesterRef = sr.requester?.reference;
    const practitionerEntry = bundle.entry?.find(
      (e) => e.fullUrl === requesterRef && e.resource?.resourceType === 'Practitioner',
    );
    expect(practitionerEntry).toBeDefined();
    const practitioner = practitionerEntry?.resource as Practitioner;
    expect(practitioner.name?.[0]?.text).toBe('Dr. Smith');
  });

  it('emits an Organization referenced by Encounter.serviceProvider when institution + ICD-10 are set', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', {
        institution: 'MediMind Tbilisi',
        icd10Codes: [{ code: 'I83.90', display: 'Asymptomatic varicose veins' }],
      }),
    );
    const enc = bundle.entry?.find((e) => e.resource?.resourceType === 'Encounter')
      ?.resource as Encounter;
    expect(enc).toBeDefined();
    expect(enc.serviceProvider?.reference).toMatch(/^urn:uuid:/);

    const orgRef = enc.serviceProvider?.reference;
    const orgEntry = bundle.entry?.find(
      (e) => e.fullUrl === orgRef && e.resource?.resourceType === 'Organization',
    );
    expect(orgEntry).toBeDefined();
    const org = orgEntry?.resource as Organization;
    expect(org.name).toBe('MediMind Tbilisi');
  });

  it('does NOT emit Practitioner / Organization entries when header fields are absent (pre-3.4 byte-compat)', () => {
    const bundle = buildFhirBundle(minimalForm('venousLEBilateral'));
    const practitioners = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Practitioner',
    );
    const organizations = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Organization',
    );
    expect(practitioners?.length ?? 0).toBe(0);
    expect(organizations?.length ?? 0).toBe(0);

    const report = bundle.entry?.find((e) => e.resource?.resourceType === 'DiagnosticReport')
      ?.resource as DiagnosticReport;
    expect(report.performer).toBeUndefined();
  });

  it('does NOT emit Practitioner / Organization entries when header fields are blank/whitespace', () => {
    const bundle = buildFhirBundle(
      minimalForm('venousLEBilateral', {
        operatorName: '   ',
        referringPhysician: '',
        institution: '\t\n',
      }),
    );
    const practitioners = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Practitioner',
    );
    const organizations = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Organization',
    );
    expect(practitioners?.length ?? 0).toBe(0);
    expect(organizations?.length ?? 0).toBe(0);
  });

  it('emits all three resources at once when every header field is set', () => {
    const bundle = buildFhirBundle(
      minimalForm('arterialLE', {
        operatorName: 'Dr. Operator',
        referringPhysician: 'Dr. Referrer',
        institution: 'Some Hospital',
        cptCode: { code: '93925', display: 'Duplex scan, arterial, lower extremity, complete bilateral' },
        icd10Codes: [{ code: 'I70.209', display: 'Atherosclerosis of native arteries of extremities' }],
      }),
    );
    const practitioners = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Practitioner',
    );
    const organizations = bundle.entry?.filter(
      (e) => e.resource?.resourceType === 'Organization',
    );
    expect(practitioners?.length).toBe(2);
    expect(organizations?.length).toBe(1);

    // Distinct Practitioners — the operator and the referrer must not collapse
    // into the same resource even when both are emitted in the same bundle.
    const operatorIds = practitioners?.map((p) => p.resource.id);
    expect(new Set(operatorIds).size).toBe(2);
  });
});

// ============================================================================
// Wave 3.5 — per-segment Observation parameter-specific LOINC at coding[0]
//
// Audit Part 05 HIGH. Before Wave 3.5 every per-segment Observation set
// `code.coding[0]` to the study-level LOINC (e.g. 39420-5 venous LE
// bilateral) regardless of which parameter the row carried, so a query like
// `GET Observation?code=loinc|39420-5` returned 50+ identical-looking rows.
//
// The fix:
//   coding[0] = parameter-specific (LOINC if registered in PARAMETER_LOINC,
//               MediMind per-parameter CodeSystem otherwise)
//   coding[1] = study-level LOINC (preserves cross-aggregation queries)
// ============================================================================

function obsForParam(
  bundle: ReturnType<typeof buildFhirBundle>,
  paramId: string,
): Observation | undefined {
  // Tag-based lookup — every per-segment Observation includes
  // `parameter=<paramId>` in `note[0].text`, set by the push helpers.
  const entry = bundle.entry?.find((e) => {
    if (e.resource?.resourceType !== 'Observation') return false;
    const obs = e.resource as Observation;
    return obs.note?.some((n) => n.text?.includes(`parameter=${paramId}`));
  });
  return entry?.resource as Observation | undefined;
}

describe('Wave 3.5 — parameter-specific LOINC at coding[0]', () => {
  it('PARAMETER_LOINC contains at least the verified PSV/EDV/ABI entries', () => {
    expect(PARAMETER_LOINC['psvCmS']?.code).toBe('11556-8');
    expect(PARAMETER_LOINC['edvCmS']?.code).toBe('20352-4');
    expect(PARAMETER_LOINC['abi']?.code).toBe('76497-9');
  });

  it('venous categorical Observations get distinct coding[0] per parameter (not the study LOINC)', () => {
    const form = {
      ...minimalForm('venousLEBilateral'),
      parameters: {
        segmentFindings: {
          'cfv-left': {
            compressibility: 'non-compressible',
            phasicity: 'continuous',
          },
        },
      },
    } as FormState;
    const bundle = buildFhirBundle(form);

    const compress = obsForParam(bundle, 'compressibility');
    const phasicity = obsForParam(bundle, 'phasicity');
    expect(compress).toBeDefined();
    expect(phasicity).toBeDefined();

    const compressFirst = compress!.code.coding?.[0];
    const phasicityFirst = phasicity!.code.coding?.[0];
    // Distinct parameter codes — the bug under audit.
    expect(compressFirst?.code).not.toBe(phasicityFirst?.code);
    // Neither should be the study-level LOINC.
    expect(compressFirst?.code).not.toBe(VASCULAR_LOINC.venousLEBilateral.code);
    expect(phasicityFirst?.code).not.toBe(VASCULAR_LOINC.venousLEBilateral.code);
    // Study LOINC is preserved as coding[1] for cross-aggregation queries.
    expect(compress!.code.coding?.[1]?.system).toBe(STANDARD_FHIR_SYSTEMS.LOINC);
    expect(compress!.code.coding?.[1]?.code).toBe(VASCULAR_LOINC.venousLEBilateral.code);
    expect(phasicity!.code.coding?.[1]?.code).toBe(VASCULAR_LOINC.venousLEBilateral.code);
  });

  it('carotid PSV / EDV Observations emit verified LOINC codes at coding[0]', () => {
    const form = {
      ...minimalForm('carotid'),
      parameters: {
        segmentFindings: {
          'cca-prox-left': { psvCmS: 110, edvCmS: 30 },
        },
      },
    } as FormState;
    const bundle = buildFhirBundle(form);

    const psv = obsForParam(bundle, 'psvCmS');
    const edv = obsForParam(bundle, 'edvCmS');
    expect(psv?.code.coding?.[0]?.system).toBe(STANDARD_FHIR_SYSTEMS.LOINC);
    expect(psv?.code.coding?.[0]?.code).toBe('11556-8');
    expect(edv?.code.coding?.[0]?.system).toBe(STANDARD_FHIR_SYSTEMS.LOINC);
    expect(edv?.code.coding?.[0]?.code).toBe('20352-4');
    // Study LOINC preserved at coding[1].
    expect(psv?.code.coding?.[1]?.code).toBe(VASCULAR_LOINC.carotid.code);
    expect(edv?.code.coding?.[1]?.code).toBe(VASCULAR_LOINC.carotid.code);
    // PSV and EDV no longer share their primary code.
    expect(psv?.code.coding?.[0]?.code).not.toBe(edv?.code.coding?.[0]?.code);
  });

  it('parameters without a LOINC fall through to a per-parameter MediMind CodeSystem', () => {
    const form = {
      ...minimalForm('venousLEBilateral'),
      parameters: {
        segmentFindings: {
          'cfv-left': { phasicity: 'continuous' },
        },
      },
    } as FormState;
    const bundle = buildFhirBundle(form);
    const phasicity = obsForParam(bundle, 'phasicity');
    expect(phasicity).toBeDefined();
    const first = phasicity!.code.coding?.[0];
    // Fallback system — distinct from LOINC, distinct from study-level code.
    expect(first?.system).not.toBe(STANDARD_FHIR_SYSTEMS.LOINC);
    expect(first?.system).toContain('http://medimind.ge/fhir/CodeSystem/');
    expect(first?.code).toBe('phasicity');
  });
});
