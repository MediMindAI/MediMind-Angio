/**
 * DiagnosticReport builder — the study-level wrapper resource.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Aggregates references to every
 * Observation produced by the per-segment + per-performer + CEAP modules
 * and writes the structured conclusion / conclusionCode using the narrative
 * service output.
 */

import type {
  BundleEntry,
  CodeableConcept,
  DiagnosticReport,
  Observation,
  Reference,
} from '../../types/fhir';
import {
  CEAP_SNOMED,
  IDENTIFIER_SYSTEMS,
  STANDARD_FHIR_SYSTEMS,
} from '../../constants/fhir-systems';
import { formatCeapClassification } from '../ceapService';
import { narrativeFromFormState } from '../narrativeService';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildDiagnosticReportEntry(
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
    // Wave 3.4 — operator/sonographer now flows into DiagnosticReport.performer
    // as a typed Reference instead of being trapped in per-Observation note
    // strings, so cross-system queries like "all reports performed by Dr. X"
    // resolve (Area 05 HIGH).
    performer: ctx.operatorPractitionerRef
      ? [{ reference: ctx.operatorPractitionerRef }]
      : undefined,
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
