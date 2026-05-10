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
import type {
  ArterialLEFullSegmentId,
  ArterialSegmentFinding,
  SegmentalPressures,
} from '../src/components/studies/arterial-le/config';
import type {
  CarotidFindings,
  CarotidNascetClassification,
} from '../src/components/studies/carotid/config';
import { buildEncounterBundle, buildFhirBundle } from '../src/services/fhirBuilder';
import type { EncounterDraft } from '../src/types/encounter';

// ---------------------------------------------------------------------------
// Mock form state
// ---------------------------------------------------------------------------

const findings: Partial<Record<VenousLEFullSegmentId, VenousSegmentFinding>> = {
  // Normal deep
  'cfv-right': { compressibility: 'normal', phasicity: 'respirophasic', apDiameterMm: 10.2 },
  'fv-prox-right': { compressibility: 'normal', phasicity: 'respirophasic' },
  'pop-ak-right': { compressibility: 'normal', phasicity: 'respirophasic' },

  // Pathological reflux — superficial GSV
  'gsv-prox-thigh-right': {
    compressibility: 'normal',
    refluxDurationMs: 1800,
    apDiameterMm: 7.4,
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
// Summary
// ---------------------------------------------------------------------------

function countByType(entryList: ReadonlyArray<BundleEntry<EmittedResource>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entryList) {
    const rt = e.resource.resourceType;
    out[rt] = (out[rt] ?? 0) + 1;
  }
  return out;
}

const counts = countByType(entries as ReadonlyArray<BundleEntry<EmittedResource>>);

console.log('PASS: venous-LE Bundle');
console.log(`  total entries: ${entries.length}`);
for (const [rt, n] of Object.entries(counts)) {
  console.log(`    ${rt.padEnd(24)} × ${n}`);
}
console.log(`  abnormal interpretations: ${interpretationCount}`);
console.log(`  CEAP formatted: ${ceapObs.valueString}`);
console.log(`  DiagnosticReport conclusion: ${report.conclusion ? 'present' : 'absent'}`);

// ---------------------------------------------------------------------------
// Arterial LE smoke test
// ---------------------------------------------------------------------------

const arterialFindings: Partial<Record<ArterialLEFullSegmentId, ArterialSegmentFinding>> = {
  'cfa-right': { waveform: 'triphasic', psvCmS: 110, stenosisCategory: 'none', plaqueMorphology: 'none' },
  'sfa-mid-right': {
    waveform: 'biphasic',
    psvCmS: 240,
    velocityRatio: 2.8,
    stenosisCategory: 'moderate',
    stenosisPct: 60,
    plaqueMorphology: 'mixed',
    plaqueLengthMm: 22,
  },
  'sfa-dist-right': {
    waveform: 'absent',
    stenosisCategory: 'occluded',
    occluded: true,
  },
  'cfa-left': { waveform: 'triphasic', psvCmS: 105, stenosisCategory: 'none', plaqueMorphology: 'none' },
};

const arterialPressures: SegmentalPressures = {
  brachialL: 130, brachialR: 135,
  highThighR: 160, highThighL: 150,
  lowThighR: 145, lowThighL: 140,
  calfR: 140, calfL: 135,
  ankleDpR: 130, ankleDpL: 80,   // left ankle low → ABI band should be mild or moderate
  anklePtR: 128, anklePtL: 75,
  toeR: 110, toeL: 60,
};

const arterialForm: FormState = {
  studyType: 'arterialLE',
  header: {
    patientName: 'Mock Arterial Patient',
    patientId: '22345678901',
    patientBirthDate: '1962-07-01',
    patientGender: 'male',
    studyDate: '2026-04-24',
    operatorName: 'Dr. Mock',
    referringPhysician: 'Dr. Referrer',
    institution: 'MediMind Angio Clinic',
    accessionNumber: 'ACC-ART-00001',
    informedConsent: true,
    patientPosition: 'supine',
  },
  segments: [],
  narrative: {
    indication: 'Left calf claudication at 100 m.',
    technique: 'Bilateral arterial duplex + segmental pressures.',
    findings: '',
    impression: '',
    comments: '',
    sonographerComments: '',
    clinicianComments: 'Severe left SFA disease with occluded distal segment.',
  },
  recommendations: [],
  parameters: {
    segmentFindings: arterialFindings as unknown as string,
    pressures: arterialPressures as unknown as string,
  },
};

const arterialBundle: Bundle = buildFhirBundle(arterialForm);
const arterialEntries = (arterialBundle.entry ?? []) as ReadonlyArray<BundleEntry<EmittedResource>>;
assert(arterialBundle.resourceType === 'Bundle', 'arterial bundle resourceType');
assert(arterialEntries.length > 5, 'arterial bundle entries too few');

const arterialObs = arterialEntries
  .filter((e) => isObservation(e.resource))
  .map((e) => e.resource as Observation);

// Spot-check: PSV observation (LOINC 11556-8) on right sfa-mid.
const sfaMidPsv = arterialObs.find((o) =>
  (o.code.coding ?? []).some((c) => c.code === '11556-8') &&
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=sfa-mid') && n.text.includes('side=right') && n.text.includes('parameter=psvCmS'))
);
assert(sfaMidPsv !== undefined, 'arterial: expected PSV observation for right sfa-mid');
assert(sfaMidPsv.valueQuantity?.value === 240, 'arterial: sfa-mid PSV value mismatch');

// Stenosis category coded value.
const stenosisObs = arterialObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=sfa-mid') && n.text.includes('side=right') && n.text.includes('parameter=stenosisCategory'))
);
assert(stenosisObs !== undefined, 'arterial: expected stenosisCategory observation for right sfa-mid');
assert(
  (stenosisObs.valueCodeableConcept?.coding ?? []).some((c) => c.code === 'moderate'),
  'arterial: stenosisCategory should be moderate'
);

// Occluded boolean
const occludedObs = arterialObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=sfa-dist') && n.text.includes('parameter=occluded'))
);
assert(occludedObs !== undefined, 'arterial: expected occluded observation for right sfa-dist');
assert(occludedObs.valueBoolean === true, 'arterial: occluded value must be true');

// Segmental pressure
const anklePressureL = arterialObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=ankleDpPressure') && n.text.includes('side=left'))
);
assert(anklePressureL !== undefined, 'arterial: expected left ankle DP pressure observation');
assert(anklePressureL.valueQuantity?.value === 80, 'arterial: ankle DP pressure value mismatch');
assert(anklePressureL.valueQuantity?.code === 'mm[Hg]', 'arterial: pressure unit should be mm[Hg]');

// ABI observation (LOINC 76497-9)
const abiL = arterialObs.find((o) =>
  (o.code.coding ?? []).some((c) => c.code === '76497-9') &&
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=abi') && n.text.includes('side=left'))
);
assert(abiL !== undefined, 'arterial: expected left ABI observation (LOINC 76497-9)');

// TBI observation (custom system)
const tbiL = arterialObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=tbi') && n.text.includes('side=left'))
);
assert(tbiL !== undefined, 'arterial: expected left TBI observation');

const arterialCounts = countByType(arterialEntries as ReadonlyArray<BundleEntry<EmittedResource>>);
console.log('\nPASS: arterial-LE Bundle');
console.log(`  total entries: ${arterialEntries.length}`);
for (const [rt, n] of Object.entries(arterialCounts)) {
  console.log(`    ${rt.padEnd(24)} × ${n}`);
}

// ---------------------------------------------------------------------------
// Carotid smoke test
// ---------------------------------------------------------------------------

const carotidFindings: CarotidFindings = {
  'cca-dist-right': { psvCmS: 85, edvCmS: 25, flowDirection: 'antegrade', plaquePresent: false, plaqueMorphology: 'none' },
  'ica-prox-right': {
    psvCmS: 250, edvCmS: 110, flowDirection: 'antegrade',
    plaquePresent: true, plaqueMorphology: 'mixed', plaqueSurface: 'irregular',
    plaqueUlceration: true, plaqueLengthMm: 14,
  },
  'cca-dist-left': { psvCmS: 90, edvCmS: 28, flowDirection: 'antegrade', plaquePresent: false, plaqueMorphology: 'none' },
  'ica-prox-left': {
    psvCmS: 110, edvCmS: 30, flowDirection: 'antegrade',
    plaquePresent: true, plaqueMorphology: 'calcified', plaqueSurface: 'smooth',
    plaqueLengthMm: 8,
  },
  'vert-v2-right': { psvCmS: 45, flowDirection: 'antegrade', subclavianStealPhase: 0 },
  'vert-v2-left': { psvCmS: 22, flowDirection: 'bidirectional', subclavianStealPhase: 2 },
};

const nascet: CarotidNascetClassification = {
  right: 'ge70',
  left: 'lt50',
};

const carotidForm: FormState = {
  studyType: 'carotid',
  header: {
    patientName: 'Mock Carotid Patient',
    patientId: '32345678901',
    patientBirthDate: '1955-11-20',
    patientGender: 'male',
    studyDate: '2026-04-24',
    operatorName: 'Dr. Mock',
    referringPhysician: 'Dr. Referrer',
    institution: 'MediMind Angio Clinic',
    accessionNumber: 'ACC-CAR-00001',
    informedConsent: true,
    patientPosition: 'supine',
  },
  segments: [],
  narrative: {
    indication: 'TIA workup.',
    technique: 'Bilateral carotid-vertebral duplex.',
    findings: '',
    impression: '',
    comments: '',
    sonographerComments: '',
    clinicianComments: 'Severe right ICA stenosis ≥ 70 % (NASCET).',
  },
  recommendations: [],
  parameters: {
    segmentFindings: carotidFindings as unknown as string,
    nascet: nascet as unknown as string,
  },
};

const carotidBundle: Bundle = buildFhirBundle(carotidForm);
const carotidEntries = (carotidBundle.entry ?? []) as ReadonlyArray<BundleEntry<EmittedResource>>;
assert(carotidBundle.resourceType === 'Bundle', 'carotid bundle resourceType');
assert(carotidEntries.length > 5, 'carotid bundle entries too few');

const carotidObs = carotidEntries
  .filter((e) => isObservation(e.resource))
  .map((e) => e.resource as Observation);

// PSV on right ica-prox
const icaPsv = carotidObs.find((o) =>
  (o.code.coding ?? []).some((c) => c.code === '11556-8') &&
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=ica-prox') && n.text.includes('side=right') && n.text.includes('parameter=psvCmS'))
);
assert(icaPsv !== undefined, 'carotid: expected right ICA PSV observation');
assert(icaPsv.valueQuantity?.value === 250, 'carotid: right ICA PSV value mismatch');

// EDV on right ica-prox (LOINC 20352-4)
const icaEdv = carotidObs.find((o) =>
  (o.code.coding ?? []).some((c) => c.code === '20352-4') &&
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=ica-prox') && n.text.includes('side=right'))
);
assert(icaEdv !== undefined, 'carotid: expected right ICA EDV observation (LOINC 20352-4)');
assert(icaEdv.valueQuantity?.value === 110, 'carotid: right ICA EDV value mismatch');

// Plaque ulceration (boolean)
const ulcerObs = carotidObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=plaqueUlceration'))
);
assert(ulcerObs !== undefined, 'carotid: expected plaqueUlceration observation');
assert(ulcerObs.valueBoolean === true, 'carotid: plaqueUlceration should be true');

// Subclavian steal phase on left vertebral
const stealObs = carotidObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('segment=vert-v2') && n.text.includes('side=left') && n.text.includes('parameter=subclavianStealPhase'))
);
assert(stealObs !== undefined, 'carotid: expected left vertebral subclavian-steal observation');
assert(
  (stealObs.valueCodeableConcept?.coding ?? []).some((c) => c.code === '2'),
  'carotid: subclavian steal phase should be 2'
);

// NASCET category right side
const nascetR = carotidObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=nascet') && n.text.includes('side=right'))
);
assert(nascetR !== undefined, 'carotid: expected right NASCET observation');
assert(
  (nascetR.valueCodeableConcept?.coding ?? []).some((c) => c.code === 'ge70'),
  'carotid: right NASCET category should be ge70'
);

// ICA/CCA ratio on right (computed)
const ratioR = carotidObs.find((o) =>
  (o.note ?? []).some((n) => typeof n.text === 'string' && n.text.includes('parameter=icaCcaRatio') && n.text.includes('side=right'))
);
assert(ratioR !== undefined, 'carotid: expected right ICA/CCA ratio observation');
assert(
  typeof ratioR.valueQuantity?.value === 'number' && ratioR.valueQuantity.value > 2.9,
  'carotid: right ICA/CCA ratio should be ~2.94'
);

const carotidCounts = countByType(carotidEntries as ReadonlyArray<BundleEntry<EmittedResource>>);
console.log('\nPASS: carotid Bundle');
console.log(`  total entries: ${carotidEntries.length}`);
for (const [rt, n] of Object.entries(carotidCounts)) {
  console.log(`    ${rt.padEnd(24)} × ${n}`);
}

// ----------------------------------------------------------------------------
// SNOMED catalog integrity (Wave 1.4 — Area 05 BLOCKER + CRITICAL)
// ----------------------------------------------------------------------------
import { VASCULAR_SEGMENTS_SNOMED, CEAP_SNOMED } from '../src/constants/fhir-systems';

// Defensive runtime check — types prove no '-' codes exist today, but this
// catches regressions if a placeholder is added back in a future PR.
for (const [key, entry] of Object.entries(VASCULAR_SEGMENTS_SNOMED)) {
  assert(
    (entry.code as string) !== '-',
    `VASCULAR_SEGMENTS_SNOMED has placeholder code for "${key}"`
  );
}
for (const [key, entry] of Object.entries(CEAP_SNOMED)) {
  assert(
    (entry.code as string) !== '-',
    `CEAP_SNOMED has placeholder code for "${key}"`
  );
}
// Peroneal artery + peroneal vein must NOT share a code (the original BLOCKER).
const perv = VASCULAR_SEGMENTS_SNOMED.perv;
const pera = VASCULAR_SEGMENTS_SNOMED.pera;
assert(perv !== undefined && pera !== undefined, 'perv and pera entries must exist');
assert(
  perv.code !== pera.code,
  'perv (peroneal vein) and pera (peroneal artery) MUST have different SNOMED codes'
);
console.log('\nPASS: SNOMED catalog integrity (no placeholders, perv != pera)');

// ---------------------------------------------------------------------------
// Phase 4a — multi-study encounter Bundle (venous + arterial + carotid).
// ---------------------------------------------------------------------------
//
// One Patient, one Encounter, three DiagnosticReports. Reuses the same form
// fixtures above — just rebinds them to one EncounterDraft and pumps them
// through buildEncounterBundle.

const sharedEncounter: EncounterDraft = {
  schemaVersion: 2,
  encounterId: 'enc-validate-sample',
  header: {
    patientName: 'Mock Patient',
    patientId: '12345678901',
    patientBirthDate: '1978-03-14',
    patientGender: 'female',
    operatorName: 'Dr. Mock',
    referringPhysician: 'Dr. Referrer',
    institution: 'MediMind Angio Clinic',
    medications: 'Apixaban 5 mg BID',
    informedConsent: true,
    informedConsentSignedAt: '2026-04-25T08:30:00Z',
    icd10Codes: [
      { code: 'I83.91', display: 'Symptomatic varicose veins of lower extremities' },
      { code: 'I87.2', display: 'Venous insufficiency (chronic) (peripheral)' },
    ],
    indicationNotes: 'Routine vascular workup, multiple territories.',
    encounterDate: '2026-04-25',
  },
  selectedStudyTypes: ['venousLEBilateral', 'arterialLE', 'carotid'],
  studies: {},
  createdAt: '2026-04-25T08:00:00Z',
  updatedAt: '2026-04-25T08:30:00Z',
};

const encounterBundle: Bundle = buildEncounterBundle({
  encounter: sharedEncounter,
  studyForms: [form, arterialForm, carotidForm],
});
const encounterEntries = (encounterBundle.entry ?? []) as ReadonlyArray<BundleEntry<EmittedResource>>;

assert(encounterBundle.resourceType === 'Bundle', 'multi-study bundle resourceType');
assert(encounterBundle.type === 'transaction', 'multi-study bundle type must be transaction');

const encounterCounts = countByType(encounterEntries);
assert(
  encounterCounts.Patient === 1,
  `multi-study: expected 1 Patient, got ${encounterCounts.Patient ?? 0}`,
);
assert(
  encounterCounts.Encounter === 1,
  `multi-study: expected 1 Encounter, got ${encounterCounts.Encounter ?? 0}`,
);
assert(
  encounterCounts.DiagnosticReport === 3,
  `multi-study: expected 3 DiagnosticReports, got ${encounterCounts.DiagnosticReport ?? 0}`,
);
assert(
  encounterCounts.Consent === 1,
  `multi-study: expected 1 Consent (encounter-level), got ${encounterCounts.Consent ?? 0}`,
);
assert(
  encounterCounts.Organization === 1,
  `multi-study: expected 1 Organization (encounter-level), got ${encounterCounts.Organization ?? 0}`,
);

// Practitioner de-dup: the three forms all share operator 'Dr. Mock' and
// referrer 'Dr. Referrer' from the encounter header → exactly 2 Practitioners.
assert(
  encounterCounts.Practitioner === 2,
  `multi-study: expected 2 Practitioners (operator + referrer, deduped), got ${encounterCounts.Practitioner ?? 0}`,
);

// Three distinct DR LOINC codes.
const encounterDrs = encounterEntries
  .filter((e) => isDiagnosticReport(e.resource))
  .map((e) => e.resource as DiagnosticReport);
const encounterLoincs = new Set(
  encounterDrs.map((d) => d.code?.coding?.[0]?.code).filter((c): c is string => typeof c === 'string'),
);
assert(
  encounterLoincs.size === 3,
  `multi-study: expected 3 distinct DR LOINC codes, got ${encounterLoincs.size}`,
);

// Reference integrity — every urn:uuid: ref resolves.
const encounterFullUrls = new Set<string>();
for (const e of encounterEntries) {
  if (typeof e.fullUrl === 'string') encounterFullUrls.add(e.fullUrl);
}
const collectRefs = (node: unknown, out: string[]): void => {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, out);
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'reference' && typeof value === 'string') out.push(value);
      else collectRefs(value, out);
    }
  }
};
const encounterRefs: string[] = [];
collectRefs(encounterEntries, encounterRefs);
const danglingRefs = encounterRefs
  .filter((r) => r.startsWith('urn:uuid:'))
  .filter((r) => !encounterFullUrls.has(r));
assert(
  danglingRefs.length === 0,
  `multi-study: dangling references (no fullUrl match): ${danglingRefs.slice(0, 3).join(', ')}`,
);

// All DiagnosticReports + Observations point at the same Patient + Encounter.
const sharedPatient = encounterEntries.find((e) => isPatient(e.resource));
const sharedEnc = encounterEntries.find((e) => e.resource.resourceType === 'Encounter');
assert(sharedPatient !== undefined, 'multi-study: no Patient entry');
assert(sharedEnc !== undefined, 'multi-study: no Encounter entry');
const sharedPatientUrl = sharedPatient.fullUrl as string;
const sharedEncUrl = sharedEnc.fullUrl as string;
for (const dr of encounterDrs) {
  assert(
    dr.subject?.reference === sharedPatientUrl,
    `multi-study: DR(${dr.id}) does not point at shared Patient`,
  );
  assert(
    dr.encounter?.reference === sharedEncUrl,
    `multi-study: DR(${dr.id}) does not point at shared Encounter`,
  );
}

console.log('\nPASS: multi-study encounter Bundle (venous + arterial + carotid)');
console.log(`  total entries: ${encounterEntries.length}`);
for (const [rt, n] of Object.entries(encounterCounts)) {
  console.log(`    ${rt.padEnd(24)} × ${n}`);
}
console.log(`  distinct DR LOINC codes: ${encounterLoincs.size}`);
console.log(`  Practitioner de-dup: 3 forms × 2 names → ${encounterCounts.Practitioner} Practitioner(s)`);

console.log('\nAll 3 study-type bundles + 1 multi-study encounter validated.');
process.exit(0);
