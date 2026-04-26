/**
 * Encounter resource builder (Phase 1.5).
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Emits an Encounter only when the
 * header carries one or more ICD-10 codes.
 */

import type { BundleEntry, CodeableConcept, Encounter } from '../../types/fhir';
import { STANDARD_FHIR_SYSTEMS } from '../../constants/fhir-systems';
import { ICD10_SYSTEM } from '../../constants/vascular-icd10';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildEncounterEntry(
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
    // Wave 3.4 — institution flows into Encounter.serviceProvider as a typed
    // Reference to the contained Organization instead of dead-ending in the
    // QuestionnaireResponse free-text answers (Area 05 HIGH).
    serviceProvider: ctx.institutionOrganizationRef
      ? { reference: ctx.institutionOrganizationRef }
      : undefined,
  };
  return {
    fullUrl: urnRef(ctx.encounterId),
    resource: encounter,
    request: { method: 'POST', url: 'Encounter' },
  };
}
