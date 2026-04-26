/**
 * Study-level panel Observation builder (LOINC-coded wrapper with
 * `hasMember[]` pointing at every per-segment Observation).
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change.
 */

import type {
  BundleEntry,
  Observation,
  Reference,
} from '../../../types/fhir';
import { STANDARD_FHIR_SYSTEMS } from '../../../constants/fhir-systems';
import type { BuildContext } from '../context';
import { observationCategory, urnRef } from '../context';

export function buildPanelObservationEntry(
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
