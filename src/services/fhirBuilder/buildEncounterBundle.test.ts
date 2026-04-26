// SPDX-License-Identifier: Apache-2.0
/**
 * Phase 4a — buildEncounterBundle multi-study orchestrator tests.
 *
 * Asserts the encounter-level Bundle invariants:
 *   - 1-study encounter mirrors the single-study buildFhirBundle counts.
 *   - 2-study encounter (venous + arterial) emits ONE Patient, ONE Encounter,
 *     ONE Organization, TWO DiagnosticReports with distinct LOINC codes, all
 *     Observations referencing the shared Patient + Encounter, CEAP present.
 *   - 3-study encounter (venous + arterial + carotid) emits ONE Patient, ONE
 *     Encounter, THREE DiagnosticReports with three distinct LOINC codes,
 *     observation count = sum of per-study observations (no merging).
 *   - Practitioner de-dup: 2 forms with same operatorName → 1 Practitioner.
 *   - Bundle reference integrity: every urn:uuid: Reference in the bundle
 *     resolves to a fullUrl on some entry (no dangling refs).
 *   - No CEAP when only arterial+carotid (no venous selected).
 *   - One Consent per encounter, regardless of study count.
 */

import { describe, expect, it } from 'vitest';
import { buildEncounterBundle } from './buildEncounterBundle';
import { buildFhirBundle } from './buildBundle';
import {
  IDENTIFIER_SYSTEMS,
  VASCULAR_LOINC,
} from '../../constants/fhir-systems';
import type { EncounterDraft } from '../../types/encounter';
import type { FormState, StudyHeader } from '../../types/form';
import type {
  DiagnosticReport,
  Encounter,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Reference,
} from '../../types/fhir';
import type { StudyType } from '../../types/study';
import type { CeapClassification } from '../../types/ceap';

// ============================================================================
// Fixtures — minimal builders that mirror src/services/fhirBuilder.test.ts.
// ============================================================================

function minimalEncounter(overrides: Partial<EncounterDraft['header']> = {}): EncounterDraft {
  return {
    schemaVersion: 2,
    encounterId: 'enc-test-fixture',
    header: {
      patientName: 'Tamar Beridze',
      patientId: '12345678901',
      patientBirthDate: '1985-03-12',
      patientGender: 'female',
      operatorName: 'Dr. Operator',
      referringPhysician: 'Dr. Referrer',
      institution: 'MediMind Tbilisi',
      icd10Codes: [
        { code: 'I83.90', display: 'Asymptomatic varicose veins of unspecified lower extremity' },
      ],
      indicationNotes: 'Routine screening',
      informedConsent: true,
      informedConsentSignedAt: '2026-04-25T08:30:00Z',
      encounterDate: '2026-04-25',
      ...overrides,
    },
    selectedStudyTypes: [],
    studies: {},
    createdAt: '2026-04-25T08:00:00Z',
    updatedAt: '2026-04-25T08:30:00Z',
  };
}

/**
 * Build a "merged" FormState that simulates Phase 3b's `stateToFormState`
 * projection — encounter-level fields flow into the form's header so the
 * orchestrator's per-study sub-context can read them through the existing
 * Wave 2.6 builders unchanged.
 */
function projectedForm(
  encounter: EncounterDraft,
  studyType: StudyType,
  perStudy: Partial<StudyHeader> & { ceap?: CeapClassification } = {},
): FormState {
  const eh = encounter.header;
  const { ceap, ...perStudyHeader } = perStudy;
  return {
    studyType,
    header: {
      // Encounter-level
      patientName: eh.patientName,
      patientId: eh.patientId,
      patientBirthDate: eh.patientBirthDate,
      patientGender: eh.patientGender,
      operatorName: eh.operatorName,
      referringPhysician: eh.referringPhysician,
      institution: eh.institution,
      informedConsent: eh.informedConsent,
      informedConsentSignedAt: eh.informedConsentSignedAt,
      medications: eh.medications,
      icd10Codes: eh.icd10Codes,
      // Per-study fields (all default-overridable)
      studyDate: perStudyHeader.studyDate ?? eh.encounterDate,
      ...perStudyHeader,
    },
    segments: [],
    narrative: { indication: eh.indicationNotes },
    recommendations: [],
    parameters: {},
    ceap,
  } as FormState;
}

// ============================================================================
// Helpers used inside test bodies.
// ============================================================================

function findFirst<R>(
  bundle: ReturnType<typeof buildEncounterBundle>,
  resourceType: string,
): R | undefined {
  return bundle.entry?.find((e) => e.resource?.resourceType === resourceType)?.resource as
    | R
    | undefined;
}

function findAll<R>(
  bundle: ReturnType<typeof buildEncounterBundle>,
  resourceType: string,
): R[] {
  return (
    (bundle.entry
      ?.filter((e) => e.resource?.resourceType === resourceType)
      .map((e) => e.resource as R) ?? []) as R[]
  );
}

function collectReferences(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) collectReferences(item, out);
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'reference' && typeof value === 'string') {
        out.push(value);
      } else {
        collectReferences(value, out);
      }
    }
  }
}

// ============================================================================
// 1-study sanity check: orchestrator path produces the expected entry counts.
// ============================================================================

describe('buildEncounterBundle — 1-study sanity', () => {
  it('produces exactly one Patient / Encounter / DiagnosticReport when one study is supplied', () => {
    const encounter = minimalEncounter();
    const form = projectedForm(encounter, 'venousLEBilateral');
    const bundle = buildEncounterBundle({ encounter, studyForms: [form] });

    expect(findAll<Patient>(bundle, 'Patient')).toHaveLength(1);
    expect(findAll<Encounter>(bundle, 'Encounter')).toHaveLength(1);
    expect(findAll<DiagnosticReport>(bundle, 'DiagnosticReport')).toHaveLength(1);
  });

  it('emits the venous LOINC code on the single DiagnosticReport', () => {
    const encounter = minimalEncounter();
    const form = projectedForm(encounter, 'venousLEBilateral');
    const bundle = buildEncounterBundle({ encounter, studyForms: [form] });
    const dr = findFirst<DiagnosticReport>(bundle, 'DiagnosticReport');
    expect(dr?.code?.coding?.[0]?.code).toBe(VASCULAR_LOINC.venousLEBilateral.code);
  });

  it('matches the single-study buildFhirBundle counts for Patient + DiagnosticReport', () => {
    // For a one-study encounter, the orchestrator and the legacy
    // buildFhirBundle path should produce structurally equivalent counts —
    // single-study byte-parity is the back-compat gate.
    const encounter = minimalEncounter();
    const form = projectedForm(encounter, 'venousLEBilateral');
    const orchestratorBundle = buildEncounterBundle({ encounter, studyForms: [form] });
    const legacyBundle = buildFhirBundle(form);

    expect(findAll<Patient>(orchestratorBundle, 'Patient').length).toBe(
      findAll<Patient>(legacyBundle, 'Patient').length,
    );
    expect(findAll<DiagnosticReport>(orchestratorBundle, 'DiagnosticReport').length).toBe(
      findAll<DiagnosticReport>(legacyBundle, 'DiagnosticReport').length,
    );
    expect(findAll<Encounter>(orchestratorBundle, 'Encounter').length).toBe(
      findAll<Encounter>(legacyBundle, 'Encounter').length,
    );
  });
});

// ============================================================================
// 2-study encounter — venous + arterial.
// ============================================================================

describe('buildEncounterBundle — 2-study encounter (venous + arterial)', () => {
  function build2Study(): ReturnType<typeof buildEncounterBundle> {
    const encounter = minimalEncounter();
    const venousForm = projectedForm(encounter, 'venousLEBilateral', {
      ceap: { c: 'C2', e: 'Ep', a: 'As', p: 'Pr', modifiers: [] },
      accessionNumber: 'ACC-V-001',
    });
    const arterialForm = projectedForm(encounter, 'arterialLE', {
      accessionNumber: 'ACC-A-001',
      cptCode: {
        code: '93925',
        display: 'Duplex scan, arterial, lower extremity, complete bilateral',
      },
    });
    return buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm],
    });
  }

  it('emits exactly one Patient (not two)', () => {
    const bundle = build2Study();
    expect(findAll<Patient>(bundle, 'Patient')).toHaveLength(1);
  });

  it('emits exactly one Encounter', () => {
    const bundle = build2Study();
    expect(findAll<Encounter>(bundle, 'Encounter')).toHaveLength(1);
  });

  it('emits exactly one Organization (encounter-level institution)', () => {
    const bundle = build2Study();
    const orgs = findAll<Organization>(bundle, 'Organization');
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.name).toBe('MediMind Tbilisi');
  });

  it('emits exactly two DiagnosticReports with distinct LOINC codes', () => {
    const bundle = build2Study();
    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    expect(drs).toHaveLength(2);
    const loincCodes = drs.map((d) => d.code?.coding?.[0]?.code).filter(Boolean);
    expect(new Set(loincCodes).size).toBe(2);
    expect(loincCodes).toContain(VASCULAR_LOINC.venousLEBilateral.code); // 39420-5
    expect(loincCodes).toContain(VASCULAR_LOINC.arterialLE.code); // 39068-8
  });

  it('all DiagnosticReports reference the shared Patient + shared Encounter', () => {
    const bundle = build2Study();
    const patient = findFirst<Patient>(bundle, 'Patient');
    const encounter = findFirst<Encounter>(bundle, 'Encounter');
    expect(patient).toBeDefined();
    expect(encounter).toBeDefined();
    const patientFullUrl = bundle.entry?.find((e) => e.resource === patient)?.fullUrl;
    const encounterFullUrl = bundle.entry?.find((e) => e.resource === encounter)?.fullUrl;
    expect(patientFullUrl).toMatch(/^urn:uuid:/);
    expect(encounterFullUrl).toMatch(/^urn:uuid:/);

    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    for (const dr of drs) {
      expect(dr.subject?.reference).toBe(patientFullUrl);
      expect(dr.encounter?.reference).toBe(encounterFullUrl);
    }
  });

  it('all per-segment Observations reference the shared Patient', () => {
    const bundle = build2Study();
    const patient = findFirst<Patient>(bundle, 'Patient');
    const patientFullUrl = bundle.entry?.find((e) => e.resource === patient)?.fullUrl;
    const observations = findAll<Observation>(bundle, 'Observation');
    for (const obs of observations) {
      expect(obs.subject?.reference).toBe(patientFullUrl);
    }
  });

  it('emits a CEAP Observation when venous study carries CEAP', () => {
    const bundle = build2Study();
    const ceapObs = findAll<Observation>(bundle, 'Observation').find(
      (o) => o.code?.text === 'CEAP 2020 Classification',
    );
    expect(ceapObs).toBeDefined();
  });
});

// ============================================================================
// 3-study encounter — venous + arterial + carotid.
// ============================================================================

describe('buildEncounterBundle — 3-study encounter (venous + arterial + carotid)', () => {
  function build3Study(): ReturnType<typeof buildEncounterBundle> {
    const encounter = minimalEncounter();
    const venousForm = projectedForm(encounter, 'venousLEBilateral');
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const carotidForm = projectedForm(encounter, 'carotid');
    return buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm, carotidForm],
    });
  }

  it('emits one Patient, one Encounter, three DiagnosticReports', () => {
    const bundle = build3Study();
    expect(findAll<Patient>(bundle, 'Patient')).toHaveLength(1);
    expect(findAll<Encounter>(bundle, 'Encounter')).toHaveLength(1);
    expect(findAll<DiagnosticReport>(bundle, 'DiagnosticReport')).toHaveLength(3);
  });

  it('emits three distinct LOINC codes across the three DiagnosticReports', () => {
    const bundle = build3Study();
    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    const loincCodes = drs
      .map((d) => d.code?.coding?.[0]?.code)
      .filter((c): c is string => typeof c === 'string');
    expect(new Set(loincCodes).size).toBe(3);
    expect(loincCodes).toContain(VASCULAR_LOINC.venousLEBilateral.code);
    expect(loincCodes).toContain(VASCULAR_LOINC.arterialLE.code);
    expect(loincCodes).toContain(VASCULAR_LOINC.carotid.code);
  });

  it('observation count equals the sum of per-study observation counts (no merging)', () => {
    const encounter = minimalEncounter();
    const venousForm = projectedForm(encounter, 'venousLEBilateral');
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const carotidForm = projectedForm(encounter, 'carotid');

    const venousAlone = buildFhirBundle(venousForm);
    const arterialAlone = buildFhirBundle(arterialForm);
    const carotidAlone = buildFhirBundle(carotidForm);
    const combined = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm, carotidForm],
    });

    const sumAlone =
      findAll<Observation>(venousAlone, 'Observation').length +
      findAll<Observation>(arterialAlone, 'Observation').length +
      findAll<Observation>(carotidAlone, 'Observation').length;
    const combinedCount = findAll<Observation>(combined, 'Observation').length;
    expect(combinedCount).toBe(sumAlone);
  });
});

// ============================================================================
// Practitioner / Organization de-dup.
// ============================================================================

describe('buildEncounterBundle — Practitioner de-dup', () => {
  it('emits one Practitioner when two forms carry the same operatorName as the encounter header', () => {
    const encounter = minimalEncounter({ operatorName: 'Dr. Maia Lomidze' });
    const venousForm = projectedForm(encounter, 'venousLEBilateral');
    const arterialForm = projectedForm(encounter, 'arterialLE');
    // Both projected forms inherit operatorName='Dr. Maia Lomidze' from the
    // encounter header, so de-dup must collapse them to ONE Practitioner.
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm],
    });
    const practitioners = findAll<Practitioner>(bundle, 'Practitioner');
    // The encounter has one operator + one referrer = two distinct Practitioners
    // (operator and referrer never collapse — different roles, different IDs),
    // but BOTH forms point at the SAME operator → no third Practitioner.
    expect(practitioners).toHaveLength(2);
    const operatorIds = new Set(practitioners.map((p) => p.id));
    expect(operatorIds.size).toBe(2);

    // The DiagnosticReports.performer[0] must point at the SAME Practitioner.
    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    const performerRefs = drs
      .map((d) => d.performer?.[0]?.reference)
      .filter((r): r is string => typeof r === 'string');
    expect(performerRefs).toHaveLength(2);
    expect(new Set(performerRefs).size).toBe(1);
  });

  it('case- and whitespace-insensitive de-dup ("Dr. Maia Lomidze" === "  dr. maia lomidze ")', () => {
    const encounter = minimalEncounter({ operatorName: 'Dr. Maia Lomidze' });
    const venousForm = projectedForm(encounter, 'venousLEBilateral');
    // Override the second form's operatorName with a whitespace/casing variant
    // that should still de-dup to the encounter's primary Practitioner.
    const arterialFormBase = projectedForm(encounter, 'arterialLE');
    const arterialForm: FormState = {
      ...arterialFormBase,
      header: {
        ...arterialFormBase.header,
        operatorName: '  dr. maia lomidze ',
      },
    };
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm],
    });
    const operatorPractitioners = findAll<Practitioner>(bundle, 'Practitioner').filter(
      (p) => p.name?.[0]?.text?.toLowerCase().includes('lomidze'),
    );
    expect(operatorPractitioners).toHaveLength(1);
  });
});

// ============================================================================
// Bundle reference integrity — no dangling refs.
// ============================================================================

describe('buildEncounterBundle — bundle reference integrity', () => {
  it('every urn:uuid: Reference in a 2-study bundle resolves to a fullUrl entry', () => {
    const encounter = minimalEncounter();
    const venousForm = projectedForm(encounter, 'venousLEBilateral', {
      ceap: { c: 'C2', e: 'Ep', a: 'As', p: 'Pr', modifiers: [] },
    });
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm],
    });

    const fullUrls = new Set(
      bundle.entry?.map((e) => e.fullUrl).filter((u): u is string => typeof u === 'string') ?? [],
    );
    expect(fullUrls.size).toBe(bundle.entry?.length ?? 0);

    const refs: string[] = [];
    collectReferences(bundle.entry, refs);
    const urnRefs = refs.filter((r) => r.startsWith('urn:uuid:'));
    expect(urnRefs.length).toBeGreaterThan(0);
    for (const ref of urnRefs) {
      expect(
        fullUrls.has(ref),
        `dangling reference ${ref} — not present as fullUrl on any bundle entry`,
      ).toBe(true);
    }
  });

  it('every DiagnosticReport.result reference resolves to an in-bundle Observation', () => {
    const encounter = minimalEncounter();
    const venousForm: FormState = {
      ...projectedForm(encounter, 'venousLEBilateral'),
      parameters: {
        segmentFindings: {
          'cfv-left': { compressibility: 'non-compressible' },
          'fv-right': { compressibility: 'compressible' },
        },
      },
    } as FormState;
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const carotidForm = projectedForm(encounter, 'carotid');
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm, carotidForm],
    });

    const fullUrls = new Set(
      bundle.entry?.map((e) => e.fullUrl).filter((u): u is string => typeof u === 'string') ?? [],
    );
    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    expect(drs).toHaveLength(3);
    for (const dr of drs) {
      // Every DR must reference at least its panel Observation.
      expect((dr.result?.length ?? 0)).toBeGreaterThanOrEqual(1);
      for (const ref of dr.result ?? []) {
        const r = (ref as Reference).reference;
        if (typeof r === 'string' && r.startsWith('urn:uuid:')) {
          expect(fullUrls.has(r)).toBe(true);
        }
      }
    }

    // Each panel's hasMember references must also resolve (where present).
    const observations = findAll<Observation>(bundle, 'Observation');
    for (const obs of observations) {
      for (const member of obs.hasMember ?? []) {
        const r = (member as Reference).reference;
        if (typeof r === 'string' && r.startsWith('urn:uuid:')) {
          expect(fullUrls.has(r)).toBe(true);
        }
      }
    }
  });
});

// ============================================================================
// CEAP semantics — only emitted when a venous study is selected.
// ============================================================================

describe('buildEncounterBundle — CEAP semantics', () => {
  it('does NOT emit CEAP when only arterial+carotid are selected (no venous)', () => {
    const encounter = minimalEncounter();
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const carotidForm = projectedForm(encounter, 'carotid');
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [arterialForm, carotidForm],
    });
    const ceapObs = findAll<Observation>(bundle, 'Observation').find(
      (o) => o.code?.text === 'CEAP 2020 Classification',
    );
    expect(ceapObs).toBeUndefined();
  });

  it('emits exactly one CEAP Observation when one venous study carries CEAP', () => {
    const encounter = minimalEncounter();
    const venousForm = projectedForm(encounter, 'venousLEBilateral', {
      ceap: { c: 'C3', e: 'Ep', a: 'As', p: 'Pr', modifiers: [] },
    });
    const arterialForm = projectedForm(encounter, 'arterialLE');
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venousForm, arterialForm],
    });
    const ceapObs = findAll<Observation>(bundle, 'Observation').filter(
      (o) => o.code?.text === 'CEAP 2020 Classification',
    );
    expect(ceapObs).toHaveLength(1);
  });
});

// ============================================================================
// Consent semantics — one per encounter, not per study.
// ============================================================================

describe('buildEncounterBundle — Consent semantics', () => {
  it('emits exactly one Consent for a 3-study encounter when patient has consented', () => {
    const encounter = minimalEncounter({ informedConsent: true });
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [
        projectedForm(encounter, 'venousLEBilateral'),
        projectedForm(encounter, 'arterialLE'),
        projectedForm(encounter, 'carotid'),
      ],
    });
    const consents = bundle.entry?.filter((e) => e.resource?.resourceType === 'Consent') ?? [];
    expect(consents).toHaveLength(1);
  });

  it('emits zero Consent when informedConsent is not set', () => {
    const encounter = minimalEncounter({
      informedConsent: false,
      informedConsentSignedAt: undefined,
    });
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [projectedForm(encounter, 'venousLEBilateral')],
    });
    const consents = bundle.entry?.filter((e) => e.resource?.resourceType === 'Consent') ?? [];
    expect(consents).toHaveLength(0);
  });
});

// ============================================================================
// Patient identity & encounter period.
// ============================================================================

describe('buildEncounterBundle — Patient identity + Encounter period', () => {
  it('emits Patient.identifier with PERSONAL_ID system from encounter header', () => {
    const encounter = minimalEncounter({ patientId: '01001011116' });
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [projectedForm(encounter, 'venousLEBilateral')],
    });
    const patient = findFirst<Patient>(bundle, 'Patient');
    expect(patient?.identifier?.[0]?.system).toBe(IDENTIFIER_SYSTEMS.PERSONAL_ID);
    expect(patient?.identifier?.[0]?.value).toBe('01001011116');
  });

  it('Encounter.period.start uses encounter.encounterDate (not a per-study studyDate)', () => {
    const encounter = minimalEncounter({ encounterDate: '2026-04-25' });
    // Force the venous form to carry a different studyDate so we can detect
    // accidental bleed-through.
    const venous = projectedForm(encounter, 'venousLEBilateral', { studyDate: '2026-04-26' });
    const bundle = buildEncounterBundle({ encounter, studyForms: [venous] });
    const enc = findFirst<Encounter>(bundle, 'Encounter');
    expect(enc?.period?.start).toBe('2026-04-25');
  });

  it('per-study DiagnosticReport.effectiveDateTime keeps each study\'s own studyDate', () => {
    const encounter = minimalEncounter({ encounterDate: '2026-04-25' });
    const venous = projectedForm(encounter, 'venousLEBilateral', { studyDate: '2026-04-25' });
    const arterial = projectedForm(encounter, 'arterialLE', { studyDate: '2026-04-26' });
    const bundle = buildEncounterBundle({
      encounter,
      studyForms: [venous, arterial],
    });
    const drs = findAll<DiagnosticReport>(bundle, 'DiagnosticReport');
    const venousDr = drs.find(
      (d) => d.code?.coding?.[0]?.code === VASCULAR_LOINC.venousLEBilateral.code,
    );
    const arterialDr = drs.find(
      (d) => d.code?.coding?.[0]?.code === VASCULAR_LOINC.arterialLE.code,
    );
    expect(venousDr?.effectiveDateTime).toBe('2026-04-25');
    expect(arterialDr?.effectiveDateTime).toBe('2026-04-26');
  });
});
