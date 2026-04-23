/**
 * FHIR Bundle builder.
 *
 * Takes a completed `FormState` and emits a FHIR R4 transaction Bundle
 * ready to POST to any FHIR-compliant server. The bundle contains:
 *
 *   - 1 × QuestionnaireResponse   (lossless form snapshot)
 *   - 1 × DiagnosticReport        (study-level wrapper, LOINC-coded)
 *   - 1 × Observation panel       (study-level, hasMember[] → per-segment obs)
 *   - N × Observation             (one per segment × side × parameter with a value)
 *   - 0..1 × Observation (CEAP)   (only if form.ceap is set)
 *
 * Every intra-bundle reference uses `urn:uuid:<id>` per FHIR R4
 * transaction semantics (https://hl7.org/fhir/R4/bundle.html#transaction).
 * Resource IDs come from `crypto.randomUUID()`.
 *
 * Pattern inspired by MediMind EMR's cultureResultService (DiagnosticReport →
 * Observations with hasMember[] tree) — same shape, narrower types.
 */

import type {
  FormState,
  StudyHeader,
  StudyNarrative,
} from '../types/form';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../components/studies/venous-le/config';
import { hasPathologicalReflux, VENOUS_LE_SEGMENTS } from '../components/studies/venous-le/config';
import type { SegmentState } from '../types/anatomy';
import type {
  Bundle,
  BundleEntry,
  CodeableConcept,
  Consent,
  DiagnosticReport,
  EmittedResource,
  Encounter,
  Observation,
  ObservationComponent,
  Patient,
  Quantity,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
  ServiceRequest,
} from '../types/fhir';
import {
  CEAP_SNOMED,
  MEDIMIND_EXTENSIONS,
  STANDARD_FHIR_SYSTEMS,
  VASCULAR_LOINC,
  VASCULAR_SEGMENTS_SNOMED,
} from '../constants/fhir-systems';
import { ICD10_SYSTEM } from '../constants/vascular-icd10';
import { CPT_SYSTEM } from '../constants/vascular-cpt';
import { ceapObservationComponents, formatCeapClassification } from './ceapService';
import { narrativeFromFormState } from './narrativeService';

// ============================================================================
// Public API
// ============================================================================

/**
 * Build the transaction Bundle for a form. Pure function — no network, no
 * side effects. Safe to call from anywhere.
 */
export function buildFhirBundle(form: FormState): Bundle {
  const ctx = createContext(form);

  const patientEntry = buildPatientEntry(ctx);
  const qrEntry = buildQuestionnaireResponseEntry(ctx);
  const encounterEntry = buildEncounterEntry(ctx);
  const serviceRequestEntry = buildServiceRequestEntry(ctx);
  const consentEntry = buildConsentEntry(ctx);
  const segmentObsEntries = buildSegmentObservationEntries(ctx);
  const positionObsEntry = buildPatientPositionObservationEntry(ctx);
  const sonographerObsEntry = buildSonographerCommentsObservationEntry(ctx);
  const clinicianObsEntry = buildClinicianImpressionObservationEntry(ctx);
  const panelEntry = buildPanelObservationEntry(ctx, segmentObsEntries);
  const ceapEntry = buildCeapObservationEntry(ctx);
  const reportEntry = buildDiagnosticReportEntry(
    ctx,
    panelEntry,
    segmentObsEntries,
    ceapEntry,
    positionObsEntry,
    sonographerObsEntry,
    clinicianObsEntry,
  );

  const entries: Array<BundleEntry<EmittedResource>> = [
    patientEntry,
    qrEntry,
  ];
  if (encounterEntry) entries.push(encounterEntry);
  if (serviceRequestEntry) entries.push(serviceRequestEntry);
  if (consentEntry) entries.push(consentEntry);
  entries.push(panelEntry);
  entries.push(...segmentObsEntries);
  if (positionObsEntry) entries.push(positionObsEntry);
  if (sonographerObsEntry) entries.push(sonographerObsEntry);
  if (clinicianObsEntry) entries.push(clinicianObsEntry);
  if (ceapEntry) entries.push(ceapEntry);
  entries.push(reportEntry);

  const bundle: Bundle<EmittedResource> = {
    resourceType: 'Bundle',
    type: 'transaction',
    timestamp: ctx.nowIso,
    entry: entries,
  };
  return bundle as Bundle;
}

/**
 * Trigger a browser download of the bundle as a JSON file. Falls back to a
 * no-op in non-browser environments — callers running under node should
 * stringify the bundle themselves.
 */
export function downloadFhirBundle(form: FormState, filename?: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const bundle = buildFhirBundle(form);
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ??
    `medimind-angio-${form.studyType}-${form.header.studyDate || new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Build context — all IDs + derived refs live here, built once per bundle
// ============================================================================

interface BuildContext {
  readonly form: FormState;
  readonly nowIso: string;
  readonly patientId: string;
  readonly patientRef: string;
  readonly panelId: string;
  readonly panelRef: string;
  readonly qrId: string;
  readonly qrRef: string;
  readonly reportId: string;
  readonly reportRef: string;
  readonly ceapObsId: string | null;
  readonly ceapObsRef: string | null;
  readonly encounterId: string | null;
  readonly encounterRef: string | null;
  readonly serviceRequestId: string | null;
  readonly serviceRequestRef: string | null;
  readonly consentId: string | null;
  readonly consentRef: string | null;
  readonly positionObsId: string | null;
  readonly sonographerObsId: string | null;
  readonly clinicianObsId: string | null;
  readonly loincCode: string;
  readonly loincDisplay: string;
}

function createContext(form: FormState): BuildContext {
  const nowIso = new Date().toISOString();
  const loinc = VASCULAR_LOINC[form.studyType];
  const patientId = newUuid();
  const panelId = newUuid();
  const qrId = newUuid();
  const reportId = newUuid();
  const hasCeap = !!form.ceap;
  const ceapObsId = hasCeap ? newUuid() : null;

  // Phase 1.5 optional resources — allocate IDs only if inputs are present.
  const header = form.header;
  const hasIcd10 = Array.isArray(header.icd10Codes) && header.icd10Codes.length > 0;
  const hasCpt = !!header.cptCode;
  const hasConsent = header.informedConsent === true;
  const hasPosition = !!header.patientPosition;
  const hasSonographer =
    typeof form.narrative.sonographerComments === 'string' &&
    form.narrative.sonographerComments.trim().length > 0;
  const hasClinician =
    typeof form.narrative.clinicianComments === 'string' &&
    form.narrative.clinicianComments.trim().length > 0;

  const encounterId = hasIcd10 ? newUuid() : null;
  const serviceRequestId = hasCpt ? newUuid() : null;
  const consentId = hasConsent ? newUuid() : null;
  const positionObsId = hasPosition ? newUuid() : null;
  const sonographerObsId = hasSonographer ? newUuid() : null;
  const clinicianObsId = hasClinician ? newUuid() : null;

  return {
    form,
    nowIso,
    patientId,
    patientRef: urnRef(patientId),
    panelId,
    panelRef: urnRef(panelId),
    qrId,
    qrRef: urnRef(qrId),
    reportId,
    reportRef: urnRef(reportId),
    ceapObsId,
    ceapObsRef: ceapObsId ? urnRef(ceapObsId) : null,
    encounterId,
    encounterRef: encounterId ? urnRef(encounterId) : null,
    serviceRequestId,
    serviceRequestRef: serviceRequestId ? urnRef(serviceRequestId) : null,
    consentId,
    consentRef: consentId ? urnRef(consentId) : null,
    positionObsId,
    sonographerObsId,
    clinicianObsId,
    loincCode: loinc.code,
    loincDisplay: loinc.display,
  };
}

// ============================================================================
// Resource builders
// ============================================================================

function buildPatientEntry(ctx: BuildContext): BundleEntry<Patient> {
  const header: StudyHeader = ctx.form.header;
  const nameParts = header.patientName.split(/\s+/).filter(Boolean);
  const family = nameParts.length > 0 ? (nameParts[nameParts.length - 1] ?? '') : '';
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [];

  const patient: Patient = {
    resourceType: 'Patient',
    id: ctx.patientId,
    active: true,
    name: header.patientName
      ? [
          {
            use: 'official',
            text: header.patientName,
            family: family || undefined,
            given: given.length > 0 ? given : undefined,
          },
        ]
      : undefined,
    gender: header.patientGender,
    birthDate: header.patientBirthDate,
  };

  return {
    fullUrl: urnRef(ctx.patientId),
    resource: patient,
    request: { method: 'POST', url: 'Patient' },
  };
}

function buildQuestionnaireResponseEntry(
  ctx: BuildContext
): BundleEntry<QuestionnaireResponse> {
  const items = buildQuestionnaireItems(ctx.form);
  const qr: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    id: ctx.qrId,
    status: 'completed',
    subject: { reference: ctx.patientRef },
    authored: ctx.nowIso,
    item: items,
  };
  return {
    fullUrl: urnRef(ctx.qrId),
    resource: qr,
    request: { method: 'POST', url: 'QuestionnaireResponse' },
  };
}

function buildQuestionnaireItems(form: FormState): ReadonlyArray<QuestionnaireResponseItem> {
  const items: QuestionnaireResponseItem[] = [];

  items.push({
    linkId: 'studyType',
    text: 'Study type',
    answer: [{ valueString: form.studyType }],
  });

  items.push(headerToItem(form.header));
  items.push(narrativeToItem(form.narrative));

  if (form.segments.length > 0) {
    items.push({
      linkId: 'segments',
      text: 'Segments',
      item: form.segments.map((s) => segmentStateToItem(s)),
    });
  }

  if (form.recommendations.length > 0) {
    items.push({
      linkId: 'recommendations',
      text: 'Recommendations',
      item: form.recommendations.map((r) => ({
        linkId: r.id,
        text: r.text,
        answer: [
          { valueString: r.text },
          ...(r.priority ? [{ valueString: `priority:${r.priority}` }] : []),
          ...(r.followUpInterval ? [{ valueString: `followUp:${r.followUpInterval}` }] : []),
        ],
      })),
    });
  }

  if (form.ceap) {
    items.push({
      linkId: 'ceap',
      text: 'CEAP classification',
      answer: [{ valueString: formatCeapClassification(form.ceap) }],
    });
  }

  // Segment-findings table (venous studies): stored under `parameters.segmentFindings`
  // by the form UI — serialize as a JSON blob so nothing is lost in the QR snapshot.
  const segFindings = form.parameters['segmentFindings'];
  if (segFindings && typeof segFindings === 'object') {
    items.push({
      linkId: 'segmentFindings',
      text: 'Per-segment findings',
      answer: [{ valueString: JSON.stringify(segFindings) }],
    });
  }

  return items;
}

function headerToItem(header: StudyHeader): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'patientName', 'Patient name', header.patientName);
  pushString(fields, 'patientId', 'Patient ID', header.patientId);
  pushString(fields, 'patientBirthDate', 'Birth date', header.patientBirthDate);
  pushString(fields, 'patientGender', 'Gender', header.patientGender);
  pushString(fields, 'studyDate', 'Study date', header.studyDate);
  pushString(fields, 'operatorName', 'Operator', header.operatorName);
  pushString(fields, 'referringPhysician', 'Referring physician', header.referringPhysician);
  pushString(fields, 'institution', 'Institution', header.institution);
  pushString(fields, 'accessionNumber', 'Accession number', header.accessionNumber);
  // Phase 1.5 additions
  if (header.informedConsent !== undefined) {
    fields.push({
      linkId: 'informedConsent',
      text: 'Informed consent',
      answer: [{ valueBoolean: header.informedConsent }],
    });
  }
  pushString(fields, 'informedConsentSignedAt', 'Consent signed at', header.informedConsentSignedAt);
  pushString(fields, 'patientPosition', 'Patient position', header.patientPosition);
  pushString(fields, 'medications', 'Medications', header.medications);
  if (header.icd10Codes && header.icd10Codes.length > 0) {
    fields.push({
      linkId: 'icd10Codes',
      text: 'ICD-10 indications',
      answer: header.icd10Codes.map((c) => ({ valueString: `${c.code} ${c.display}` })),
    });
  }
  if (header.cptCode) {
    fields.push({
      linkId: 'cptCode',
      text: 'CPT procedure code',
      answer: [{ valueString: `${header.cptCode.code} ${header.cptCode.display}` }],
    });
  }
  return { linkId: 'header', text: 'Study header', item: fields };
}

function narrativeToItem(narrative: StudyNarrative): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'indication', 'Indication', narrative.indication);
  pushString(fields, 'technique', 'Technique', narrative.technique);
  pushString(fields, 'findings', 'Findings', narrative.findings);
  pushString(fields, 'impression', 'Impression', narrative.impression);
  pushString(fields, 'comments', 'Comments', narrative.comments);
  pushString(fields, 'sonographerComments', 'Sonographer comments', narrative.sonographerComments);
  pushString(fields, 'clinicianComments', 'Clinician comments', narrative.clinicianComments);
  return { linkId: 'narrative', text: 'Narrative', item: fields };
}

function segmentStateToItem(s: SegmentState): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'segmentId', 'Segment ID', s.segmentId);
  pushString(fields, 'side', 'Side', s.side);
  pushString(fields, 'competency', 'Competency', s.competency);
  pushString(fields, 'stenosis', 'Stenosis', s.stenosis);
  pushNumber(fields, 'refluxDurationMs', 'Reflux duration (ms)', s.refluxDurationMs);
  pushNumber(fields, 'diameterMm', 'Diameter (mm)', s.diameterMm);
  pushNumber(fields, 'peakSystolicVelocityCmS', 'Peak systolic velocity (cm/s)', s.peakSystolicVelocityCmS);
  pushString(fields, 'note', 'Note', s.note);
  return { linkId: `seg-${s.segmentId}-${s.side}`, item: fields };
}

// ---------------------------------------------------------------------------

function buildSegmentObservationEntries(ctx: BuildContext): Array<BundleEntry<Observation>> {
  const entries: Array<BundleEntry<Observation>> = [];

  // Prefer the venous table (`parameters.segmentFindings`) when the study
  // is a venous variant and the table is populated; fall back to `segments[]`.
  const venousFindings = extractVenousFindings(ctx.form);
  if (venousFindings) {
    for (const segment of VENOUS_LE_SEGMENTS) {
      for (const side of ['left', 'right'] as const) {
        const fullId = `${segment}-${side}` as VenousLEFullSegmentId;
        const finding = venousFindings[fullId];
        if (!finding) continue;
        appendVenousFindingObservations(ctx, entries, segment, side, finding);
      }
    }
    return entries;
  }

  // Generic fallback: one Observation per numeric measurement on a SegmentState.
  for (const s of ctx.form.segments) {
    appendGenericSegmentObservations(ctx, entries, s);
  }
  return entries;
}

function appendVenousFindingObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  segmentBase: VenousLESegmentBase,
  side: 'left' | 'right',
  finding: VenousSegmentFinding
): void {
  const bodySite = bodySiteForSegment(segmentBase);
  const sideText = side === 'right' ? 'Right' : 'Left';

  // Categorical fields — one Observation each.
  pushVenousCategorical(
    ctx,
    out,
    bodySite,
    sideText,
    'compressibility',
    'Vein compressibility',
    finding.compressibility,
    segmentBase,
    side
  );
  pushVenousCategorical(
    ctx,
    out,
    bodySite,
    sideText,
    'thrombosis',
    'Thrombosis',
    finding.thrombosis,
    segmentBase,
    side
  );
  pushVenousCategorical(
    ctx,
    out,
    bodySite,
    sideText,
    'spontaneity',
    'Spontaneity',
    finding.spontaneity,
    segmentBase,
    side
  );
  pushVenousCategorical(
    ctx,
    out,
    bodySite,
    sideText,
    'phasicity',
    'Phasicity',
    finding.phasicity,
    segmentBase,
    side
  );
  pushVenousCategorical(
    ctx,
    out,
    bodySite,
    sideText,
    'augmentation',
    'Augmentation',
    finding.augmentation,
    segmentBase,
    side
  );

  // Numeric fields — one Observation each (with UCUM).
  pushVenousNumeric(
    ctx,
    out,
    bodySite,
    sideText,
    'refluxDurationMs',
    'Reflux duration',
    finding.refluxDurationMs,
    'ms',
    hasPathologicalReflux(segmentBase, finding),
    segmentBase,
    side
  );
  pushVenousNumeric(
    ctx,
    out,
    bodySite,
    sideText,
    'apDiameterMm',
    'Vein AP diameter',
    finding.apDiameterMm,
    'mm',
    false,
    segmentBase,
    side
  );
  pushVenousNumeric(
    ctx,
    out,
    bodySite,
    sideText,
    'transDiameterMm',
    'Vein transverse diameter',
    finding.transDiameterMm,
    'mm',
    false,
    segmentBase,
    side
  );
  pushVenousNumeric(
    ctx,
    out,
    bodySite,
    sideText,
    'depthMm',
    'Vein depth from skin',
    finding.depthMm,
    'mm',
    false,
    segmentBase,
    side
  );
}

function pushVenousCategorical(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  bodySite: CodeableConcept,
  sideText: string,
  paramId: string,
  paramLabel: string,
  value: string | undefined,
  segmentBase: VenousLESegmentBase,
  side: 'left' | 'right'
): void {
  if (!value) return;
  const obsId = newUuid();
  const isAbnormal =
    (paramId === 'compressibility' && value !== 'normal' && value !== 'inconclusive') ||
    (paramId === 'thrombosis' && (value === 'acute' || value === 'chronic')) ||
    (paramId === 'spontaneity' && value === 'absent') ||
    (paramId === 'phasicity' && (value === 'absent' || value === 'continuous')) ||
    (paramId === 'augmentation' && value === 'absent');

  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${sideText} ${paramLabel}: ${value}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite,
    valueCodeableConcept: {
      text: value,
      coding: [
        { system: medimindParamSystem(paramId), code: value, display: value },
      ],
    },
    interpretation: isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [
      {
        text: `segment=${segmentBase};side=${side};parameter=${paramId}`,
      },
    ],
  };

  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

function pushVenousNumeric(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  bodySite: CodeableConcept,
  sideText: string,
  paramId: string,
  paramLabel: string,
  value: number | undefined,
  unit: 'ms' | 'mm',
  isAbnormal: boolean,
  segmentBase: VenousLESegmentBase,
  side: 'left' | 'right'
): void {
  if (value === undefined || Number.isNaN(value)) return;
  const obsId = newUuid();
  const quantity: Quantity = {
    value,
    unit,
    system: STANDARD_FHIR_SYSTEMS.UCUM,
    code: unit,
  };

  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${sideText} ${paramLabel}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite,
    valueQuantity: quantity,
    interpretation: isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [
      {
        text: `segment=${segmentBase};side=${side};parameter=${paramId}`,
      },
    ],
  };

  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

function appendGenericSegmentObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  s: SegmentState
): void {
  const bodySite = bodySiteForSegment(s.segmentId);
  // Competency — single categorical Observation.
  const obsId = newUuid();
  const isAbnormal = s.competency === 'incompetent';
  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${s.segmentId} competency`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite,
    valueCodeableConcept: {
      text: s.competency,
      coding: [
        {
          system: MEDIMIND_EXTENSIONS.COMPETENCY,
          code: s.competency,
          display: s.competency,
        },
      ],
    },
    interpretation: isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [{ text: `segment=${s.segmentId};side=${s.side}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });

  // Optional numerics.
  pushGenericNumeric(
    ctx,
    out,
    bodySite,
    s.segmentId,
    'refluxDurationMs',
    s.refluxDurationMs,
    'ms'
  );
  pushGenericNumeric(ctx, out, bodySite, s.segmentId, 'diameterMm', s.diameterMm, 'mm');
  pushGenericNumeric(
    ctx,
    out,
    bodySite,
    s.segmentId,
    'peakSystolicVelocityCmS',
    s.peakSystolicVelocityCmS,
    'cm/s'
  );
}

function pushGenericNumeric(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  bodySite: CodeableConcept,
  segmentId: string,
  paramId: string,
  value: number | undefined,
  unit: 'ms' | 'mm' | 'cm/s'
): void {
  if (value === undefined || Number.isNaN(value)) return;
  const obsId = newUuid();
  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${segmentId} ${paramId}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite,
    valueQuantity: { value, unit, system: STANDARD_FHIR_SYSTEMS.UCUM, code: unit },
    note: [{ text: `segment=${segmentId};parameter=${paramId}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

// ---------------------------------------------------------------------------
// Phase 1.5 additions — Encounter, ServiceRequest, Consent, per-performer Obs
// ---------------------------------------------------------------------------

function buildEncounterEntry(
  ctx: BuildContext
): BundleEntry<Encounter> | null {
  if (!ctx.encounterId) return null;
  const codes = ctx.form.header.icd10Codes ?? [];
  const reasonCodes: CodeableConcept[] = codes.map((c) => ({
    coding: [{ system: ICD10_SYSTEM, code: c.code, display: c.display }],
    text: c.display,
  }));
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: ctx.encounterId,
    status: 'finished',
    class: {
      system: STANDARD_FHIR_SYSTEMS.ENCOUNTER_CLASS,
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: ctx.patientRef },
    period: { start: ctx.nowIso, end: ctx.nowIso },
    reasonCode: reasonCodes.length > 0 ? reasonCodes : undefined,
  };
  return {
    fullUrl: urnRef(ctx.encounterId),
    resource: encounter,
    request: { method: 'POST', url: 'Encounter' },
  };
}

function buildServiceRequestEntry(
  ctx: BuildContext
): BundleEntry<ServiceRequest> | null {
  if (!ctx.serviceRequestId) return null;
  const cpt = ctx.form.header.cptCode;
  if (!cpt) return null;
  const sr: ServiceRequest = {
    resourceType: 'ServiceRequest',
    id: ctx.serviceRequestId,
    status: 'completed',
    intent: 'order',
    code: {
      coding: [{ system: CPT_SYSTEM, code: cpt.code, display: cpt.display }],
      text: cpt.display,
    },
    subject: { reference: ctx.patientRef },
    encounter: ctx.encounterRef ? { reference: ctx.encounterRef } : undefined,
    authoredOn: ctx.nowIso,
    occurrenceDateTime: ctx.nowIso,
  };
  return {
    fullUrl: urnRef(ctx.serviceRequestId),
    resource: sr,
    request: { method: 'POST', url: 'ServiceRequest' },
  };
}

function buildConsentEntry(ctx: BuildContext): BundleEntry<Consent> | null {
  if (!ctx.consentId) return null;
  const signedAt =
    ctx.form.header.informedConsentSignedAt ?? ctx.nowIso;

  const consent: Consent = {
    resourceType: 'Consent',
    id: ctx.consentId,
    status: 'active',
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Privacy Consent',
        },
      ],
      text: 'Privacy Consent',
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
            code: 'dch',
            display: 'Disclosure to Consumer/Healthcare Provider',
          },
        ],
        text: 'Informed consent for imaging study',
      },
    ],
    patient: { reference: ctx.patientRef },
    dateTime: signedAt,
    provision: { type: 'permit' },
  };
  return {
    fullUrl: urnRef(ctx.consentId),
    resource: consent,
    request: { method: 'POST', url: 'Consent' },
  };
}

function buildPatientPositionObservationEntry(
  ctx: BuildContext
): BundleEntry<Observation> | null {
  if (!ctx.positionObsId) return null;
  const pos = ctx.form.header.patientPosition;
  if (!pos) return null;

  const obs: Observation = {
    resourceType: 'Observation',
    id: ctx.positionObsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: '8361-8',
          display: 'Patient position',
        },
      ],
      text: 'Patient position',
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    valueCodeableConcept: {
      text: pos,
      coding: [
        {
          system: `${MEDIMIND_EXTENSIONS.STUDY_TYPE.replace('angio-study-type', 'patient-position')}`,
          code: pos,
          display: pos,
        },
      ],
    },
  };
  return {
    fullUrl: urnRef(ctx.positionObsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  };
}

function buildSonographerCommentsObservationEntry(
  ctx: BuildContext
): BundleEntry<Observation> | null {
  if (!ctx.sonographerObsId) return null;
  const text = ctx.form.narrative.sonographerComments;
  if (!text || text.trim().length === 0) return null;

  const obs: Observation = {
    resourceType: 'Observation',
    id: ctx.sonographerObsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: '59776-5',
          display: 'Procedure findings Narrative',
        },
      ],
      text: 'Sonographer comments',
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    valueString: text,
    note: [{ text: 'performer=sonographer' }],
  };
  return {
    fullUrl: urnRef(ctx.sonographerObsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  };
}

function buildClinicianImpressionObservationEntry(
  ctx: BuildContext
): BundleEntry<Observation> | null {
  if (!ctx.clinicianObsId) return null;
  const text = ctx.form.narrative.clinicianComments;
  if (!text || text.trim().length === 0) return null;

  const obs: Observation = {
    resourceType: 'Observation',
    id: ctx.clinicianObsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: '81230-8',
          display: 'Imaging interpretation by clinician Narrative',
        },
      ],
      text: 'Clinician impression',
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    valueString: text,
    note: [{ text: 'performer=clinician' }],
  };
  return {
    fullUrl: urnRef(ctx.clinicianObsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  };
}

// ---------------------------------------------------------------------------

function buildPanelObservationEntry(
  ctx: BuildContext,
  segmentEntries: ReadonlyArray<BundleEntry<Observation>>
): BundleEntry<Observation> {
  const panel: Observation = {
    resourceType: 'Observation',
    id: ctx.panelId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: ctx.loincDisplay,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    hasMember: segmentEntries.map<Reference>((e) => ({
      reference: e.fullUrl ?? (e.resource.id ? `Observation/${e.resource.id}` : undefined),
    })),
  };
  return {
    fullUrl: urnRef(ctx.panelId),
    resource: panel,
    request: { method: 'POST', url: 'Observation' },
  };
}

function buildCeapObservationEntry(
  ctx: BuildContext
): BundleEntry<Observation> | null {
  if (!ctx.form.ceap || !ctx.ceapObsId) return null;
  const components: ReadonlyArray<ObservationComponent> = ceapObservationComponents(ctx.form.ceap);
  const formatted = formatCeapClassification(ctx.form.ceap);

  const obs: Observation = {
    resourceType: 'Observation',
    id: ctx.ceapObsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.SNOMED,
          code: CEAP_SNOMED.CHRONIC_VENOUS_INSUFFICIENCY.code,
          display: CEAP_SNOMED.CHRONIC_VENOUS_INSUFFICIENCY.display,
        },
      ],
      text: 'CEAP 2020 Classification',
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    valueString: formatted,
    component: components,
    note: [{ text: `CEAP: ${formatted}` }],
  };
  return {
    fullUrl: urnRef(ctx.ceapObsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  };
}

function buildDiagnosticReportEntry(
  ctx: BuildContext,
  panelEntry: BundleEntry<Observation>,
  segmentEntries: ReadonlyArray<BundleEntry<Observation>>,
  ceapEntry: BundleEntry<Observation> | null,
  positionEntry: BundleEntry<Observation> | null,
  sonographerEntry: BundleEntry<Observation> | null,
  clinicianEntry: BundleEntry<Observation> | null
): BundleEntry<DiagnosticReport> {
  const narrative = narrativeFromFormState(ctx.form);
  const conclusionParts: string[] = [];
  if (ctx.form.narrative.impression) {
    conclusionParts.push(ctx.form.narrative.impression);
  }
  if (ctx.form.narrative.clinicianComments) {
    conclusionParts.push(ctx.form.narrative.clinicianComments);
  }
  if (narrative.conclusions.length > 0) {
    conclusionParts.push(...narrative.conclusions);
  }

  const results: Reference[] = [];
  results.push({ reference: panelEntry.fullUrl ?? `Observation/${ctx.panelId}` });
  for (const e of segmentEntries) {
    results.push({
      reference:
        e.fullUrl ?? (e.resource.id ? `Observation/${e.resource.id}` : undefined),
    });
  }
  if (positionEntry) {
    results.push({ reference: positionEntry.fullUrl ?? `Observation/${ctx.positionObsId}` });
  }
  if (sonographerEntry) {
    results.push({ reference: sonographerEntry.fullUrl ?? `Observation/${ctx.sonographerObsId}` });
  }
  if (clinicianEntry) {
    results.push({ reference: clinicianEntry.fullUrl ?? `Observation/${ctx.clinicianObsId}` });
  }
  if (ceapEntry) {
    results.push({ reference: ceapEntry.fullUrl ?? `Observation/${ctx.ceapObsId}` });
  }

  const conclusionCodes: CodeableConcept[] = [];
  if (ctx.form.ceap) {
    conclusionCodes.push({
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.SNOMED,
          code: CEAP_SNOMED.CHRONIC_VENOUS_INSUFFICIENCY.code,
          display: CEAP_SNOMED.CHRONIC_VENOUS_INSUFFICIENCY.display,
        },
      ],
      text: formatCeapClassification(ctx.form.ceap),
    });
  }

  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: ctx.reportId,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: STANDARD_FHIR_SYSTEMS.DIAGNOSTIC_SERVICE_SECTION,
            code: 'US',
            display: 'Ultrasound',
          },
        ],
        text: 'Ultrasound',
      },
    ],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: ctx.loincDisplay,
    },
    subject: { reference: ctx.patientRef },
    encounter: ctx.encounterRef ? { reference: ctx.encounterRef } : undefined,
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    result: results,
    conclusion: conclusionParts.length > 0 ? conclusionParts.join('\n') : undefined,
    conclusionCode: conclusionCodes.length > 0 ? conclusionCodes : undefined,
  };

  return {
    fullUrl: urnRef(ctx.reportId),
    resource: report,
    request: { method: 'POST', url: 'DiagnosticReport' },
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Pull the venous findings map out of the form, if this is a venous form. */
function extractVenousFindings(form: FormState): VenousSegmentFindings | undefined {
  if (
    form.studyType !== 'venousLEBilateral' &&
    form.studyType !== 'venousLERight' &&
    form.studyType !== 'venousLELeft'
  ) {
    return undefined;
  }
  const raw = form.parameters['segmentFindings'];
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as unknown as VenousSegmentFindings;
}

function bodySiteForSegment(segment: string): CodeableConcept {
  const entry = VASCULAR_SEGMENTS_SNOMED[segment];
  if (!entry || entry.code === '-') {
    // Unmapped segment — still return the text so the Observation carries the site.
    return { text: segment };
  }
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: entry.code,
        display: entry.display,
      },
    ],
    text: entry.display,
  };
}

function observationCategory(code: 'imaging' | 'laboratory'): CodeableConcept {
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.OBSERVATION_CATEGORY,
        code,
        display: code === 'imaging' ? 'Imaging' : 'Laboratory',
      },
    ],
    text: code === 'imaging' ? 'Imaging' : 'Laboratory',
  };
}

function interpretationAbnormal(): CodeableConcept {
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.OBSERVATION_INTERPRETATION,
        code: 'A',
        display: 'Abnormal',
      },
    ],
    text: 'Abnormal',
  };
}

function medimindParamSystem(paramId: string): string {
  // A lightweight per-parameter CodeSystem under the MediMind namespace — lets
  // the downstream consumer distinguish e.g. compressibility values from
  // phasicity values even though we reuse tokens like `normal`/`absent`.
  return `http://medimind.ge/fhir/CodeSystem/venous-${paramId}`;
}

function urnRef(id: string): string {
  return `urn:uuid:${id}`;
}

function newUuid(): string {
  // `crypto.randomUUID` exists in Node >=19 and all modern browsers. The
  // runtime target for this app is both.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Minimal fallback — only used in the vanishingly rare env without
  // WebCrypto. Not cryptographically strong; acceptable for bundle IDs.
  return Array.from({ length: 36 }, (_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return '-';
    if (i === 14) return '4';
    const r = (Math.random() * 16) | 0;
    const v = i === 19 ? (r & 0x3) | 0x8 : r;
    return v.toString(16);
  }).join('');
}

// ============================================================================
// QR helpers (small, boring)
// ============================================================================

function pushString(
  out: QuestionnaireResponseItem[],
  linkId: string,
  text: string,
  value: string | undefined
): void {
  if (!value) return;
  out.push({ linkId, text, answer: [{ valueString: value }] });
}

function pushNumber(
  out: QuestionnaireResponseItem[],
  linkId: string,
  text: string,
  value: number | undefined
): void {
  if (value === undefined || Number.isNaN(value)) return;
  out.push({ linkId, text, answer: [{ valueDecimal: value }] });
}

// Re-export the types so callers importing from `fhirBuilder` don't have to
// reach into the narrow fhir types file separately.
export type { Bundle, DiagnosticReport, Observation } from '../types/fhir';
