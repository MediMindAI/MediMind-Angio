/**
 * CEAP 2020 classification Observation builder.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Emits one Observation only when the
 * form carries a CEAP record; component-level encoding lives in `ceapService`.
 */

import type {
  BundleEntry,
  Observation,
  ObservationComponent,
} from '../../../types/fhir';
import {
  CEAP_SNOMED,
  STANDARD_FHIR_SYSTEMS,
} from '../../../constants/fhir-systems';
import { ceapObservationComponents, formatCeapClassification } from '../../ceapService';
import type { BuildContext } from '../context';
import { observationCategory, urnRef } from '../context';

export function buildCeapObservationEntry(
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
