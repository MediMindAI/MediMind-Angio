/**
 * validate-sample-bundle.ts — standalone sanity check for `buildFhirBundle`.
 *
 * Builds a bundle with mock findings covering every pathological case
 * (normal, partial, non-compressible, reflux, chronic thrombosis), then
 * asserts:
 *   1. Bundle is a transaction with an `entry[]`
 *   2. Every resource carries a valid `resourceType` + `id`
 *   3. Every intra-bundle reference (`urn:uuid:*`) resolves to a fullUrl
 *   4. Required FHIR fields are present (status, code, subject, etc.)
 *   5. Interpretation codes, when set, are valid v3-ObservationInterpretation codes
 *
 * Exits 0 on success, 1 on any failure (with a one-line explanation).
 */

import type {
  Bundle,
  BundleEntry,
  DiagnosticReport,
  EmittedResource,
  Observation,
  Patient,
  QuestionnaireResponse,
} from '../src/types/fhir';
import type { FormState } from '../src/types/form';
import type {
  VenousLEFullSegmentId,
  VenousSegmentFinding,
} from '../src/components/studies/venous-le/config';
import { buildFhirBundle } from '../src/services/fhirBuilder';

// ---------------------------------------------------------------------------
// Mock form state
// ---------------------------------------------------------------------------

const findings: Partial<Record<VenousLEFullSegmentId, VenousSegmentFinding>> = {
  // Normal deep
  'cfv-right': { compressibility: 'normal', spontaneity: 'normal', phasicity: 'normal', augmentation: 'normal', apDiameterMm: 10.2 },
  'fv-prox-right': { compressibility: 'normal', spontaneity: 'normal', phasicity: 'normal', augmentation: 'normal' },
  'pop-ak-right': { compressibility: 'normal', spontaneity: 'normal', phasicity: 'normal', augmentation: 'normal' },

  // Pathological reflux — superficial GSV
  'gsv-ak-right': {
    compressibility: 'normal',
    refluxDurationMs: 1800,
    apDiameterMm: 7.4,
    transDiameterMm: 6.8,
    depthMm: 8.2,
  },

  // Acute DVT — non-compressible left popliteal
  'pop-ak-left': { compressibility: 'non-compressible', thrombosis: 'acute' },

  // Chronic post-thrombotic — partial compressibility
  'cfv-left': { compressibility: 'partial', thrombosis: 'chronic' },

  // Inconclusive — study limitation
  'ptv-left': { compressibility: 'inconclusive' },
};

const form: FormState = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: 'Mock Patient',
    patientId: '12345678901',
    patientBirthDate: '1978-03-14',
    patientGender: 'female',
    studyDate: '2026-04-23',
    operatorName: 'Dr. Mock',
    referringPhysician: 'Dr. Referrer',
    institution: 'MediMind Angio Clinic',
    accessionNumber: 'ACC-2026-00042',
    // Phase 1.5 Corestudycast parity
    informedConsent: true,
    informedConsentSignedAt: '2026-04-23',
    patientPosition: 'reverse-trendelenburg-30',
    medications: 'Apixaban 5 mg BID',
    icd10Codes: [
      { code: 'I83.91', display: 'Symptomatic varicose veins of lower extremities' },
      { code: 'I87.2', display: 'Venous insufficiency (chronic) (peripheral)' },
    ],
    cptCode: {
      code: '93970',
      display: 'Duplex scan of extremity veins, complete bilateral study',
    },
  },
  segments: [],
  narrative: {
    indication: 'Leg pain + visible varicose veins.',
    technique:
      'Bilateral lower-extremity venous duplex ultrasound per IAC/SVU/AIUM protocol.',
    findings: '',
    impression: '',
    comments: '',
    sonographerComments:
      'Scanner settings: 9 MHz linear, harmonic compound imaging enabled.',
    clinicianComments:
      'Pattern consistent with primary superficial venous insufficiency.',
  },
  ceap: {
    c: 'C2',
    e: 'Ep',
    a: 'As',
    p: 'Pr',
    modifiers: ['s'],
  },
  recommendations: [
    { id: 'r1', text: 'Compression stockings 20-30 mmHg', priority: 'routine' },
    { id: 'r2', text: 'Consider endovenous ablation of right GSV', priority: 'routine' },
  ],
  parameters: { segmentFindings: findings as unknown as string },
  // ^ parameters is typed string|number|boolean|undefined; the narrativeService
  //   and fhirBuilder both cast on read. Safe here because we own the shape.
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

function isObservation(r: EmittedResource): r is Observation {
  return r.resourceType === 'Observation';
}
function isPatient(r: EmittedResource): r is Patient {
  return r.resourceType === 'Patient';
}
function isDiagnosticReport(r: EmittedResource): r is DiagnosticReport {
  return r.resourceType === 'DiagnosticReport';
}
function isQuestionnaireResponse(r: EmittedResource): r is QuestionnaireResponse {
  return r.resourceType === 'QuestionnaireResponse';
}

const bundle: Bundle = buildFhirBundle(form);

assert(bundle.resourceType === 'Bundle', 'bundle.resourceType must be "Bundle"');
assert(bundle.type === 'transaction', 'bundle.type must be "transaction"');
assert(Array.isArray(bundle.entry) && bundle.entry.length > 0, 'bundle.entry must be non-empty');

const entries = bundle.entry ?? [];

// ---------------------------------------------------------------------------
// 1. every resource has resourceType + id, every entry has fullUrl + request
// ---------------------------------------------------------------------------

const fullUrlSet = new Set<string>();
for (const e of entries as ReadonlyArray<BundleEntry<EmittedResource>>) {
  assert(e.resource !== undefined, 'entry.resource missing');
  assert(typeof e.resource.resourceType === 'string', 'entry.resource.resourceType missing');
  assert(typeof e.resource.id === 'string' && e.resource.id.length > 0, 'entry.resource.id missing');
  assert(typeof e.fullUrl === 'string', 'entry.fullUrl missing');
  assert(e.fullUrl.startsWith('urn:uuid:'), `entry.fullUrl must be urn:uuid:*, got ${e.fullUrl}`);
  assert(e.request !== undefined, 'entry.request missing');
  assert(e.request.method === 'POST', 'entry.request.method must be POST for transaction');
  fullUrlSet.add(e.fullUrl);
}

// ---------------------------------------------------------------------------
// 2. exactly one Patient + one DiagnosticReport + one QuestionnaireResponse
// ---------------------------------------------------------------------------

const patients = entries.filter((e) => isPatient(e.resource)).length;
const reports = entries.filter((e) => isDiagnosticReport(e.resource)).length;
const qrs = entries.filter((e) => isQuestionnaireResponse(e.resource)).length;
assert(patients === 1, `expected 1 Patient, got ${patients}`);
assert(reports === 1, `expected 1 DiagnosticReport, got ${reports}`);
assert(qrs === 1, `expected 1 QuestionnaireResponse, got ${qrs}`);

// ---------------------------------------------------------------------------
// 3. all references resolve to an in-bundle fullUrl
// ---------------------------------------------------------------------------

const checkRef = (ref: string | undefined, ctx: string): void => {
  if (!ref) return; // optional references tolerate undefined
  if (!ref.startsWith('urn:uuid:')) return; // absolute URL / canonical — skip
  assert(fullUrlSet.has(ref), `dangling reference ${ref} in ${ctx}`);
};

for (const e of entries as ReadonlyArray<BundleEntry<EmittedResource>>) {
  const r = e.resource;
  if (isObservation(r)) {
    checkRef(r.subject.reference, `Observation(${r.id}).subject`);
    if (r.hasMember) {
      for (const h of r.hasMember) {
        checkRef(h.reference, `Observation(${r.id}).hasMember`);
      }
    }
  } else if (isDiagnosticReport(r)) {
    checkRef(r.subject.reference, `DiagnosticReport(${r.id}).subject`);
    if (r.result) {
      for (const res of r.result) {
        checkRef(res.reference, `DiagnosticReport(${r.id}).result`);
      }
    }
  } else if (isQuestionnaireResponse(r)) {
    checkRef(r.subject?.reference, `QuestionnaireResponse(${r.id}).subject`);
  }
}

// ---------------------------------------------------------------------------
// 4. required FHIR fields
// ---------------------------------------------------------------------------

const reportEntry = entries.find((e) => isDiagnosticReport(e.resource));
assert(reportEntry !== undefined, 'no DiagnosticReport entry');
const report = reportEntry.resource as DiagnosticReport;
assert(report.status === 'final', 'DiagnosticReport.status must be final for this mock');
assert(Array.isArray(report.code.coding) && (report.code.coding ?? []).length > 0, 'DiagnosticReport.code.coding missing');
assert(report.result !== undefined && report.result.length > 0, 'DiagnosticReport.result empty');

// Panel + CEAP observations
const observations = entries
  .filter((e) => isObservation(e.resource))
  .map((e) => e.resource as Observation);
assert(observations.length >= 3, 'expected several Observations');

// Find the panel (hasMember non-empty) and at least one segment Observation.
const panel = observations.find((o) => Array.isArray(o.hasMember) && (o.hasMember ?? []).length > 0);
assert(panel !== undefined, 'no panel Observation (hasMember[])');
assert(Array.isArray(panel.code.coding) && (panel.code.coding ?? []).length > 0, 'panel.code.coding missing');

// ---------------------------------------------------------------------------
// 5. interpretation codes, when set, are valid
// ---------------------------------------------------------------------------

const VALID_INTERP = new Set(['N', 'A', 'H', 'L', 'HH', 'LL']);
let interpretationCount = 0;
for (const o of observations) {
  if (!o.interpretation) continue;
  for (const cc of o.interpretation) {
    for (const c of cc.coding ?? []) {
      if (c.code !== undefined) {
        assert(
          VALID_INTERP.has(c.code),
          `invalid interpretation code ${c.code} on Observation(${o.id})`
        );
        interpretationCount++;
      }
    }
  }
}
assert(interpretationCount > 0, 'expected at least one abnormal interpretation given the mock findings');

// CEAP observation present
const ceapObs = observations.find((o) => typeof o.valueString === 'string' && /^C\d/.test(o.valueString));
assert(ceapObs !== undefined, 'no CEAP Observation emitted');
assert(Array.isArray(ceapObs.component) && (ceapObs.component ?? []).length === 4, 'CEAP Observation must have 4 components (C,E,A,P)');

// ---------------------------------------------------------------------------
// Phase 1.5 parity — Consent, Encounter (ICD-10), ServiceRequest (CPT),
// Trans diameter Observation, Patient Position Observation.
// ---------------------------------------------------------------------------

const consentCount = entries.filter((e) => e.resource.resourceType === 'Consent').length;
assert(consentCount === 1, `expected 1 Consent resource, got ${consentCount}`);

const encounterEntry = entries.find((e) => e.resource.resourceType === 'Encounter');
assert(encounterEntry !== undefined, 'no Encounter resource emitted');
const encounterRes = encounterEntry.resource as unknown as {
  reasonCode?: ReadonlyArray<{ coding?: ReadonlyArray<{ system?: string; code?: string }> }>;
};
const icd10Count = (encounterRes.reasonCode ?? []).filter((cc) =>
  (cc.coding ?? []).some((c) => c.system === 'http://hl7.org/fhir/sid/icd-10'),
).length;
assert(icd10Count >= 1, 'Encounter.reasonCode must include at least one ICD-10 coding');

const serviceRequestEntry = entries.find((e) => e.resource.resourceType === 'ServiceRequest');
assert(serviceRequestEntry !== undefined, 'no ServiceRequest resource emitted');
const srRes = serviceRequestEntry.resource as unknown as {
  code?: { coding?: ReadonlyArray<{ system?: string }> };
};
assert(
  (srRes.code?.coding ?? []).some((c) => c.system === 'http://www.ama-assn.org/go/cpt'),
  'ServiceRequest.code.coding must include a CPT code',
);

const transObs = observations.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=transDiameterMm')),
);
assert(transObs !== undefined, 'expected a transverse-diameter Observation');

const positionObs = observations.find((o) =>
  (o.code.coding ?? []).some((c) => c.code === '8361-8'),
);
assert(positionObs !== undefined, 'expected a Patient Position Observation (LOINC 8361-8)');

// ---------------------------------------------------------------------------
// Summary + exit
// ---------------------------------------------------------------------------

const counts: Record<string, number> = {};
for (const e of entries as ReadonlyArray<BundleEntry<EmittedResource>>) {
  const rt = e.resource.resourceType;
  counts[rt] = (counts[rt] ?? 0) + 1;
}

console.log('PASS: FHIR Bundle validation');
console.log(`  total entries: ${entries.length}`);
for (const [rt, n] of Object.entries(counts)) {
  console.log(`    ${rt.padEnd(24)} × ${n}`);
}
console.log(`  abnormal interpretations: ${interpretationCount}`);
console.log(`  CEAP formatted: ${ceapObs.valueString}`);
console.log(`  DiagnosticReport conclusion: ${report.conclusion ? 'present' : 'absent'}`);

process.exit(0);
