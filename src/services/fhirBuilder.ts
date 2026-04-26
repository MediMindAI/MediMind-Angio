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
} from '../types/form';
import type {
  VenousLEFullSegmentId,
} from '../components/studies/venous-le/config';
import { VENOUS_LE_SEGMENTS } from '../components/studies/venous-le/config';
import type {
  ArterialLEFullSegmentId,
} from '../components/studies/arterial-le/config';
import { ARTERIAL_LE_SEGMENTS } from '../components/studies/arterial-le/config';
import type {
  CarotidVesselFullId,
} from '../components/studies/carotid/config';
import { CAROTID_VESSELS } from '../components/studies/carotid/config';
import type { SegmentState } from '../types/anatomy';
import type {
  Bundle,
  BundleEntry,
  CodeableConcept,
  DiagnosticReport,
  EmittedResource,
  Observation,
  ObservationComponent,
  Reference,
} from '../types/fhir';
import {
  CEAP_SNOMED,
  IDENTIFIER_SYSTEMS,
  MEDIMIND_EXTENSIONS,
  STANDARD_FHIR_SYSTEMS,
} from '../constants/fhir-systems';
import { ceapObservationComponents, formatCeapClassification } from './ceapService';
import { narrativeFromFormState } from './narrativeService';
import {
  type BuildContext,
  bodySiteForSegment,
  createContext,
  interpretationAbnormal,
  newUuid,
  observationCategory,
  urnRef,
} from './fhirBuilder/context';
import { buildPatientEntry } from './fhirBuilder/patient';
import { buildQuestionnaireResponseEntry } from './fhirBuilder/questionnaireResponse';
import { buildEncounterEntry } from './fhirBuilder/encounter';
import { buildServiceRequestEntry } from './fhirBuilder/serviceRequest';
import { buildConsentEntry } from './fhirBuilder/consent';
import {
  appendVenousFindingObservations,
  extractVenousFindings,
} from './fhirBuilder/observations/venous';
import {
  appendArterialComputedObservations,
  appendArterialFindingObservations,
  appendArterialPressureObservations,
  extractArterialFindings,
  extractArterialPressures,
} from './fhirBuilder/observations/arterial';
import {
  appendCarotidComputedObservations,
  appendCarotidFindingObservations,
  appendCarotidNascetObservations,
  extractCarotidFindings,
  extractCarotidNascet,
} from './fhirBuilder/observations/carotid';

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

// Re-export the types so callers importing from `fhirBuilder` don't have to
// reach into the narrow fhir types file separately.
export type { Bundle, DiagnosticReport, Observation } from '../types/fhir';
