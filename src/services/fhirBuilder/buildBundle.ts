/**
 * FHIR Bundle builder — public entry point.
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
 *
 * Wave 2.6: extracted from the original 2,000-line `fhirBuilder.ts` into
 * per-resource modules. Public API unchanged.
 */

import type { FormState } from '../../types/form';
import type {
  Bundle,
  BundleEntry,
  EmittedResource,
} from '../../types/fhir';
import { createContext } from './context';
import { buildPatientEntry } from './patient';
import { buildQuestionnaireResponseEntry } from './questionnaireResponse';
import { buildEncounterEntry } from './encounter';
import { buildServiceRequestEntry } from './serviceRequest';
import { buildConsentEntry } from './consent';
import { buildSegmentObservationEntries } from './observations/segments';
import {
  buildClinicianImpressionObservationEntry,
  buildPatientPositionObservationEntry,
  buildSonographerCommentsObservationEntry,
} from './observations/perPerformer';
import { buildPanelObservationEntry } from './observations/panel';
import { buildCeapObservationEntry } from './observations/ceap';
import { buildDiagnosticReportEntry } from './diagnosticReport';

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
