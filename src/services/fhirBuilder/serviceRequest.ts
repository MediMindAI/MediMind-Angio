/**
 * ServiceRequest resource builder (Phase 1.5).
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Emits a ServiceRequest only when the
 * header carries a CPT procedure code.
 */

import type { BundleEntry, ServiceRequest } from '../../types/fhir';
import { CPT_SYSTEM } from '../../constants/vascular-cpt';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildServiceRequestEntry(
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
    // Wave 3.4 — referring physician now flows into ServiceRequest.requester
    // as a typed Reference to the contained Practitioner instead of being
    // discarded after the QuestionnaireResponse copy (Area 05 HIGH).
    requester: ctx.referrerPractitionerRef
      ? { reference: ctx.referrerPractitionerRef }
      : undefined,
    occurrenceDateTime: ctx.nowIso,
  };
  return {
    fullUrl: urnRef(ctx.serviceRequestId),
    resource: sr,
    request: { method: 'POST', url: 'ServiceRequest' },
  };
}
