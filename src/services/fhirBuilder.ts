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
import {
  isArterialFindings,
  isArterialPressures,
  isCarotidFindings,
  isCarotidNascet,
  isVenousFindings,
} from '../types/parameters';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../components/studies/venous-le/config';
import { hasPathologicalReflux, VENOUS_LE_SEGMENTS } from '../components/studies/venous-le/config';
import type {
  ArterialLEFullSegmentId,
  ArterialLESegmentBase,
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  SegmentalPressures,
} from '../components/studies/arterial-le/config';
import { ARTERIAL_LE_SEGMENTS } from '../components/studies/arterial-le/config';
import { computeAbi, computeTbi } from '../components/studies/arterial-le/abiCalculator';
import type {
  CarotidFindings,
  CarotidNascetClassification,
  CarotidVesselBase,
  CarotidVesselFinding,
  CarotidVesselFullId,
} from '../components/studies/carotid/config';
import { CAROTID_VESSELS, isVertebral } from '../components/studies/carotid/config';
import { icaCcaRatio } from '../components/studies/carotid/stenosisCalculator';
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
  IDENTIFIER_SYSTEMS,
  MEDIMIND_CODESYSTEMS,
  MEDIMIND_EXTENSIONS,
  STANDARD_FHIR_SYSTEMS,
} from '../constants/fhir-systems';
import { ICD10_SYSTEM } from '../constants/vascular-icd10';
import { CPT_SYSTEM } from '../constants/vascular-cpt';
import { ceapObservationComponents, formatCeapClassification } from './ceapService';
import { narrativeFromFormState } from './narrativeService';
import {
  type BuildContext,
  bodySiteForSegment,
  createContext,
  interpretationAbnormal,
  medimindParamSystem,
  newUuid,
  observationCategory,
  urnRef,
} from './fhirBuilder/context';

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
// Resource builders
// ============================================================================

function buildPatientEntry(ctx: BuildContext): BundleEntry<Patient> {
  const header: StudyHeader = ctx.form.header;
  const nameParts = header.patientName.split(/\s+/).filter(Boolean);
  const family = nameParts.length > 0 ? (nameParts[nameParts.length - 1] ?? '') : '';
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [];

  // Emit identifier(s) for the patient. Without these, every bundle creates
  // a fresh anonymous Patient on import — re-importing the same patient
  // would never match an existing record (Area 05 CRITICAL).
  const identifier = header.patientId
    ? [{ system: IDENTIFIER_SYSTEMS.PERSONAL_ID, value: header.patientId }]
    : undefined;

  const patient: Patient = {
    resourceType: 'Patient',
    id: ctx.patientId,
    active: true,
    identifier,
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

  // Arterial LE — per-segment findings + segmental pressures + computed ABI/TBI.
  if (ctx.form.studyType === 'arterialLE') {
    const findings = extractArterialFindings(ctx.form);
    if (findings) {
      for (const segment of ARTERIAL_LE_SEGMENTS) {
        for (const side of ['left', 'right'] as const) {
          const fullId = `${segment}-${side}` as ArterialLEFullSegmentId;
          const finding = findings[fullId];
          if (!finding) continue;
          appendArterialFindingObservations(ctx, entries, segment, side, finding);
        }
      }
    }
    const pressures = extractArterialPressures(ctx.form);
    if (pressures) {
      appendArterialPressureObservations(ctx, entries, pressures);
      appendArterialComputedObservations(ctx, entries, pressures);
    }
    return entries;
  }

  // Carotid duplex — per-vessel findings + NASCET classification + ICA/CCA.
  if (ctx.form.studyType === 'carotid') {
    const findings = extractCarotidFindings(ctx.form);
    if (findings) {
      for (const vessel of CAROTID_VESSELS) {
        for (const side of ['left', 'right'] as const) {
          const fullId = `${vessel}-${side}` as CarotidVesselFullId;
          const finding = findings[fullId];
          if (!finding) continue;
          appendCarotidFindingObservations(ctx, entries, vessel, side, finding);
        }
      }
      appendCarotidComputedObservations(ctx, entries, findings);
    }
    const nascet = extractCarotidNascet(ctx.form);
    if (nascet) {
      appendCarotidNascetObservations(ctx, entries, nascet);
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

// ---------------------------------------------------------------------------
// Arterial LE per-segment builders
// ---------------------------------------------------------------------------

function appendArterialFindingObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  segmentBase: ArterialLESegmentBase,
  side: 'left' | 'right',
  finding: ArterialSegmentFinding
): void {
  const bodySite = bodySiteForSegment(arterialSnomedKey(segmentBase));
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `segment=${segmentBase};side=${side}`;
  const isAbnormalStenosis =
    finding.stenosisCategory === 'moderate' ||
    finding.stenosisCategory === 'severe' ||
    finding.stenosisCategory === 'occluded' ||
    (typeof finding.stenosisPct === 'number' && finding.stenosisPct >= 50);
  const isAbnormalWaveform =
    finding.waveform === 'monophasic-damped' || finding.waveform === 'absent';

  // Categorical: waveform
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'waveform',
    paramLabel: 'Arterial waveform',
    value: finding.waveform,
    system: MEDIMIND_CODESYSTEMS.WAVEFORM_MORPHOLOGY,
    tag,
    isAbnormal: isAbnormalWaveform,
  });
  // Categorical: stenosis category
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'stenosisCategory',
    paramLabel: 'Stenosis category',
    value: finding.stenosisCategory,
    system: MEDIMIND_CODESYSTEMS.STENOSIS_CATEGORY,
    tag,
    isAbnormal: isAbnormalStenosis,
  });
  // Categorical: plaque morphology (emit even when "none" — explicit negative)
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueMorphology',
    paramLabel: 'Plaque morphology',
    value: finding.plaqueMorphology,
    system: MEDIMIND_CODESYSTEMS.PLAQUE_MORPHOLOGY,
    tag,
    isAbnormal: finding.plaqueMorphology === 'soft' || finding.plaqueMorphology === 'mixed',
  });

  // Numeric: PSV (LOINC 11556-8, cm/s)
  pushLoincNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'psvCmS',
    paramLabel: 'Peak systolic velocity',
    value: finding.psvCmS,
    loincCode: '11556-8',
    loincDisplay: 'Peak systolic velocity',
    unit: 'cm/s',
    tag,
    isAbnormal: typeof finding.psvCmS === 'number' && finding.psvCmS >= 200,
  });
  // Numeric: velocity ratio (custom system, unit `1`)
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'velocityRatio',
    paramLabel: 'Velocity ratio',
    value: finding.velocityRatio,
    system: MEDIMIND_CODESYSTEMS.VELOCITY_RATIO,
    unit: '1',
    tag,
    isAbnormal: typeof finding.velocityRatio === 'number' && finding.velocityRatio >= 2,
  });
  // Numeric: stenosis percentage
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'stenosisPct',
    paramLabel: 'Stenosis percent',
    value: finding.stenosisPct,
    system: medimindParamSystem('stenosisPct'),
    unit: '%',
    tag,
    isAbnormal: typeof finding.stenosisPct === 'number' && finding.stenosisPct >= 50,
  });
  // Numeric: plaque length
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueLengthMm',
    paramLabel: 'Plaque length',
    value: finding.plaqueLengthMm,
    system: medimindParamSystem('plaqueLengthMm'),
    unit: 'mm',
    tag,
    isAbnormal: false,
  });
  // Boolean: occluded (only emit when true)
  if (finding.occluded === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'occluded',
      paramLabel: 'Occluded',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
}

/**
 * Map arterial segment bases to the VASCULAR_SEGMENTS_SNOMED table (which
 * only has coarse keys like `sfa` for all SFA subsegments).
 */
function arterialSnomedKey(base: ArterialLESegmentBase): string {
  if (base === 'sfa-prox' || base === 'sfa-mid' || base === 'sfa-dist') return 'sfa';
  if (base === 'pop-ak' || base === 'pop-bk') return 'popa';
  if (base === 'cia' || base === 'eia') return base; // no SNOMED entry; falls through to text
  if (base === 'tpt' || base === 'pfa') return base; // no SNOMED entry; falls through to text
  if (base === 'ata') return 'ata';
  if (base === 'pta') return 'pta';
  if (base === 'per') return 'pera';
  if (base === 'dp') return 'dpa';
  if (base === 'cfa') return 'cfa';
  return base;
}

interface ArterialPressureSpec {
  readonly paramId: string;
  readonly paramLabel: string;
  readonly leftProp: keyof SegmentalPressures;
  readonly rightProp: keyof SegmentalPressures;
  readonly snomedKey: string;
}

const ARTERIAL_PRESSURE_SPECS: ReadonlyArray<ArterialPressureSpec> = [
  { paramId: 'brachialPressure',  paramLabel: 'Brachial pressure',   leftProp: 'brachialL',  rightProp: 'brachialR',  snomedKey: 'brachial' },
  { paramId: 'highThighPressure', paramLabel: 'High-thigh pressure', leftProp: 'highThighL', rightProp: 'highThighR', snomedKey: 'high-thigh' },
  { paramId: 'lowThighPressure',  paramLabel: 'Low-thigh pressure',  leftProp: 'lowThighL',  rightProp: 'lowThighR',  snomedKey: 'low-thigh' },
  { paramId: 'calfPressure',      paramLabel: 'Calf pressure',       leftProp: 'calfL',      rightProp: 'calfR',      snomedKey: 'calf' },
  { paramId: 'ankleDpPressure',   paramLabel: 'Ankle DP pressure',   leftProp: 'ankleDpL',   rightProp: 'ankleDpR',   snomedKey: 'dpa' },
  { paramId: 'anklePtPressure',   paramLabel: 'Ankle PT pressure',   leftProp: 'anklePtL',   rightProp: 'anklePtR',   snomedKey: 'pta' },
  { paramId: 'toePressure',       paramLabel: 'Toe pressure',        leftProp: 'toeL',       rightProp: 'toeR',       snomedKey: 'toe' },
];

function appendArterialPressureObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  pressures: SegmentalPressures
): void {
  for (const spec of ARTERIAL_PRESSURE_SPECS) {
    const bodySite = bodySiteForSegment(spec.snomedKey);
    const leftVal = pressures[spec.leftProp];
    const rightVal = pressures[spec.rightProp];
    if (typeof leftVal === 'number') {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText: 'Left',
        paramId: spec.paramId,
        paramLabel: spec.paramLabel,
        value: leftVal,
        system: medimindParamSystem(spec.paramId),
        unit: 'mm[Hg]',
        tag: `parameter=${spec.paramId};side=left`,
        isAbnormal: false,
      });
    }
    if (typeof rightVal === 'number') {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText: 'Right',
        paramId: spec.paramId,
        paramLabel: spec.paramLabel,
        value: rightVal,
        system: medimindParamSystem(spec.paramId),
        unit: 'mm[Hg]',
        tag: `parameter=${spec.paramId};side=right`,
        isAbnormal: false,
      });
    }
  }
}

function appendArterialComputedObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  pressures: SegmentalPressures
): void {
  // ABI: LOINC 76497-9, unit `1`. TBI: custom system.
  const sides: ReadonlyArray<{ side: 'L' | 'R'; text: string }> = [
    { side: 'L', text: 'Left' },
    { side: 'R', text: 'Right' },
  ];
  for (const { side, text } of sides) {
    const abi = computeAbi(pressures, side);
    if (abi.abi !== null && Number.isFinite(abi.abi)) {
      pushLoincNumeric(ctx, out, {
        bodySite: { text: 'Ankle-brachial index' },
        sideText: text,
        paramId: 'abi',
        paramLabel: 'Ankle-brachial index',
        value: abi.abi,
        loincCode: '76497-9',
        loincDisplay: 'Ankle-brachial index',
        unit: '1',
        tag: `parameter=abi;side=${side === 'L' ? 'left' : 'right'};band=${abi.band}`,
        isAbnormal: abi.band !== 'normal' && abi.band !== 'unknown',
      });
    }
    const tbi = computeTbi(pressures, side);
    if (tbi.tbi !== null && Number.isFinite(tbi.tbi)) {
      pushCustomNumeric(ctx, out, {
        bodySite: { text: 'Toe-brachial index' },
        sideText: text,
        paramId: 'tbi',
        paramLabel: 'Toe-brachial index',
        value: tbi.tbi,
        system: MEDIMIND_CODESYSTEMS.TBI,
        unit: '1',
        tag: `parameter=tbi;side=${side === 'L' ? 'left' : 'right'};band=${tbi.band}`,
        isAbnormal: tbi.band !== 'normal' && tbi.band !== 'unknown',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Carotid per-vessel builders
// ---------------------------------------------------------------------------

function appendCarotidFindingObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  vesselBase: CarotidVesselBase,
  side: 'left' | 'right',
  finding: CarotidVesselFinding
): void {
  const bodySite = bodySiteForSegment(carotidSnomedKey(vesselBase));
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `segment=${vesselBase};side=${side}`;
  const isAbnormalFlow =
    finding.flowDirection === 'retrograde' ||
    finding.flowDirection === 'bidirectional' ||
    finding.flowDirection === 'absent';

  // Numeric: PSV
  pushLoincNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'psvCmS',
    paramLabel: 'Peak systolic velocity',
    value: finding.psvCmS,
    loincCode: '11556-8',
    loincDisplay: 'Peak systolic velocity',
    unit: 'cm/s',
    tag,
    isAbnormal: typeof finding.psvCmS === 'number' && finding.psvCmS >= 125,
  });
  // Numeric: EDV
  pushLoincNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'edvCmS',
    paramLabel: 'End diastolic velocity',
    value: finding.edvCmS,
    loincCode: '20352-4',
    loincDisplay: 'End diastolic velocity',
    unit: 'cm/s',
    tag,
    isAbnormal: typeof finding.edvCmS === 'number' && finding.edvCmS >= 100,
  });
  // Categorical: flow direction
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'flowDirection',
    paramLabel: 'Flow direction',
    value: finding.flowDirection,
    system: MEDIMIND_CODESYSTEMS.FLOW_DIRECTION,
    tag,
    isAbnormal: isAbnormalFlow,
  });
  // Boolean: plaque present
  if (finding.plaquePresent !== undefined) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'plaquePresent',
      paramLabel: 'Plaque present',
      value: finding.plaquePresent,
      tag,
      isAbnormal: finding.plaquePresent === true,
    });
  }
  // Categorical: plaque morphology (emit for explicit negative too)
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueMorphology',
    paramLabel: 'Plaque morphology',
    value: finding.plaqueMorphology,
    system: MEDIMIND_CODESYSTEMS.PLAQUE_MORPHOLOGY,
    tag,
    isAbnormal: finding.plaqueMorphology === 'soft' || finding.plaqueMorphology === 'mixed',
  });
  // Categorical: plaque surface
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueSurface',
    paramLabel: 'Plaque surface',
    value: finding.plaqueSurface,
    system: MEDIMIND_CODESYSTEMS.PLAQUE_SURFACE,
    tag,
    isAbnormal: finding.plaqueSurface === 'irregular',
  });
  // Boolean: plaque ulceration (only emit when true — negative implicit)
  if (finding.plaqueUlceration === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'plaqueUlceration',
      paramLabel: 'Plaque ulceration',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  // Numeric: plaque length
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueLengthMm',
    paramLabel: 'Plaque length',
    value: finding.plaqueLengthMm,
    system: medimindParamSystem('plaqueLengthMm'),
    unit: 'mm',
    tag,
    isAbnormal: false,
  });
  // Categorical: subclavian steal phase (vertebrals only; numeric 0..3 → string)
  if (isVertebral(vesselBase) && finding.subclavianStealPhase !== undefined) {
    const phase = String(finding.subclavianStealPhase);
    pushCodedCategorical(ctx, out, {
      bodySite,
      sideText,
      paramId: 'subclavianStealPhase',
      paramLabel: 'Subclavian steal phase',
      value: phase,
      system: MEDIMIND_CODESYSTEMS.SUBCLAVIAN_STEAL_PHASE,
      tag,
      isAbnormal: finding.subclavianStealPhase >= 1,
    });
  }
}

function carotidSnomedKey(base: CarotidVesselBase): string {
  if (base === 'cca-prox' || base === 'cca-mid' || base === 'cca-dist') return 'cca';
  if (base === 'ica-prox' || base === 'ica-mid' || base === 'ica-dist') return 'ica';
  if (base === 'bulb') return 'carotid-bulb';
  if (base === 'eca') return 'eca';
  if (base === 'vert-v1' || base === 'vert-v2' || base === 'vert-v3') return 'va';
  // subclav-prox / subclav-dist — no SNOMED entry in VASCULAR_SEGMENTS_SNOMED;
  // the body-site will fall through to text-only encoding.
  return base;
}

function appendCarotidNascetObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  nascet: CarotidNascetClassification
): void {
  const bodySite = bodySiteForSegment('ica');
  for (const side of ['left', 'right'] as const) {
    const cat = nascet[side];
    if (!cat) continue;
    const sideText = side === 'right' ? 'Right' : 'Left';
    pushCodedCategorical(ctx, out, {
      bodySite,
      sideText,
      paramId: 'nascetCategory',
      paramLabel: 'NASCET category',
      value: cat,
      system: MEDIMIND_CODESYSTEMS.NASCET_CATEGORY,
      tag: `parameter=nascet;side=${side}`,
      isAbnormal: cat === 'ge70' || cat === 'near-occlusion' || cat === 'occluded',
    });
  }
}

function appendCarotidComputedObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  findings: CarotidFindings
): void {
  for (const side of ['left', 'right'] as const) {
    const ratio = icaCcaRatio(findings, side);
    if (ratio === null || !Number.isFinite(ratio)) continue;
    const sideText = side === 'right' ? 'Right' : 'Left';
    pushCustomNumeric(ctx, out, {
      bodySite: bodySiteForSegment('ica'),
      sideText,
      paramId: 'icaCcaRatio',
      paramLabel: 'ICA/CCA ratio',
      value: ratio,
      system: medimindParamSystem('icaCcaRatio'),
      unit: '1',
      tag: `parameter=icaCcaRatio;side=${side}`,
      isAbnormal: ratio >= 4,
    });
  }
}

// ---------------------------------------------------------------------------
// Shared observation push helpers (used by arterial + carotid branches)
// ---------------------------------------------------------------------------

interface CodedCategoricalArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: string | undefined;
  readonly system: string;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

function pushCodedCategorical(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  args: CodedCategoricalArgs
): void {
  if (!args.value) return;
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
      text: `${args.sideText} ${args.paramLabel}: ${args.value}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite: args.bodySite,
    valueCodeableConcept: {
      text: args.value,
      coding: [{ system: args.system, code: args.value, display: args.value }],
    },
    interpretation: args.isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [{ text: `${args.tag};parameter=${args.paramId}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

interface LoincNumericArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: number | undefined;
  readonly loincCode: string;
  readonly loincDisplay: string;
  readonly unit: string;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

function pushLoincNumeric(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  args: LoincNumericArgs
): void {
  if (args.value === undefined || Number.isNaN(args.value)) return;
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
          code: args.loincCode,
          display: args.loincDisplay,
        },
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${args.sideText} ${args.paramLabel}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite: args.bodySite,
    valueQuantity: {
      value: args.value,
      unit: args.unit,
      system: STANDARD_FHIR_SYSTEMS.UCUM,
      code: args.unit,
    },
    interpretation: args.isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [{ text: `${args.tag};parameter=${args.paramId}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

interface CustomNumericArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: number | undefined;
  readonly system: string;
  readonly unit: string;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

function pushCustomNumeric(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  args: CustomNumericArgs
): void {
  if (args.value === undefined || Number.isNaN(args.value)) return;
  const obsId = newUuid();
  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        { system: args.system, code: args.paramId, display: args.paramLabel },
        {
          system: STANDARD_FHIR_SYSTEMS.LOINC,
          code: ctx.loincCode,
          display: ctx.loincDisplay,
        },
      ],
      text: `${args.sideText} ${args.paramLabel}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite: args.bodySite,
    valueQuantity: {
      value: args.value,
      unit: args.unit,
      system: STANDARD_FHIR_SYSTEMS.UCUM,
      code: args.unit,
    },
    interpretation: args.isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [{ text: `${args.tag};parameter=${args.paramId}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

interface BooleanObsArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: boolean;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

function pushBooleanObservation(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  args: BooleanObsArgs
): void {
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
      text: `${args.sideText} ${args.paramLabel}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite: args.bodySite,
    valueBoolean: args.value,
    interpretation: args.isAbnormal ? [interpretationAbnormal()] : undefined,
    note: [{ text: `${args.tag};parameter=${args.paramId}` }],
  };
  out.push({
    fullUrl: urnRef(obsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  });
}

// ---------------------------------------------------------------------------

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
    period: {
      // Honor the user-supplied study date when available, else fall back to
      // bundle-build time. Without this, the report claimed "performed today"
      // even when written up the day after the actual scan (Area 05 HIGH).
      start: ctx.form.header.studyDate ?? ctx.nowIso,
      end: ctx.form.header.studyDate ?? ctx.nowIso,
    },
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

  // Emit identifier from accessionNumber so the report can be matched on
  // re-import / cross-system search (Area 05 CRITICAL).
  const reportIdentifier = ctx.form.header.accessionNumber
    ? [{ system: IDENTIFIER_SYSTEMS.STUDY_ID, value: ctx.form.header.accessionNumber }]
    : undefined;

  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: ctx.reportId,
    identifier: reportIdentifier,
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
    // effectiveDateTime is when the study was performed, NOT when the bundle
    // was generated. Use header.studyDate when set so a study written up the
    // next day reports the correct timeline (Area 05 HIGH).
    effectiveDateTime: ctx.form.header.studyDate ?? ctx.nowIso,
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

/**
 * Pull the venous findings map out of the form, if this is a venous form.
 *
 * Wave 2.5: `parameters` is now `Record<string, unknown>`; the read boundary
 * uses the `is*Findings` type guards from `types/parameters.ts` instead of
 * `as unknown as <Type>` casts. Soft failure (return undefined) on missing /
 * wrong-shape data so callers can render empty bundles without crashing.
 */
function extractVenousFindings(form: FormState): VenousSegmentFindings | undefined {
  if (
    form.studyType !== 'venousLEBilateral' &&
    form.studyType !== 'venousLERight' &&
    form.studyType !== 'venousLELeft'
  ) {
    return undefined;
  }
  const raw = form.parameters['segmentFindings'];
  return isVenousFindings(raw) ? raw : undefined;
}

function extractArterialFindings(form: FormState): ArterialSegmentFindings | undefined {
  const raw = form.parameters['segmentFindings'];
  return isArterialFindings(raw) ? raw : undefined;
}

function extractArterialPressures(form: FormState): SegmentalPressures | undefined {
  const raw = form.parameters['pressures'];
  return isArterialPressures(raw) ? raw : undefined;
}

function extractCarotidFindings(form: FormState): CarotidFindings | undefined {
  const raw = form.parameters['segmentFindings'];
  return isCarotidFindings(raw) ? raw : undefined;
}

function extractCarotidNascet(form: FormState): CarotidNascetClassification | undefined {
  const raw = form.parameters['nascet'];
  return isCarotidNascet(raw) ? raw : undefined;
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
