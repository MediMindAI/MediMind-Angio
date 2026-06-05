// SPDX-License-Identifier: Apache-2.0
/**
 * SVP classification Observation builder. Mirrors `observations/ceap.ts` —
 * emits a single Observation only when the form carries an SVP record;
 * component-level encoding (one component per P-row) lives in `svpService`.
 */

import type { BundleEntry, Observation, ObservationComponent } from '../../../types/fhir';
import { SVP_SNOMED, STANDARD_FHIR_SYSTEMS } from '../../../constants/fhir-systems';
import { svpObservationComponents, formatSvpClassification } from '../../svpService';
import type { BuildContext } from '../context';
import { observationCategory, urnRef } from '../context';

export function buildSvpObservationEntry(ctx: BuildContext): BundleEntry<Observation> | null {
  if (!ctx.form.svp || !ctx.svpObsId) return null;
  const components: ReadonlyArray<ObservationComponent> = svpObservationComponents(ctx.form.svp);
  const formatted = formatSvpClassification(ctx.form.svp);

  const obs: Observation = {
    resourceType: 'Observation',
    id: ctx.svpObsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: [
        {
          system: STANDARD_FHIR_SYSTEMS.SNOMED,
          code: SVP_SNOMED.PELVIC_CONGESTION_SYNDROME.code,
          display: SVP_SNOMED.PELVIC_CONGESTION_SYNDROME.display,
        },
      ],
      text: 'SVP Classification (Meissner 2021)',
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    valueString: formatted,
    component: components,
    note: [{ text: `SVP: ${formatted}` }],
  };
  return {
    fullUrl: urnRef(ctx.svpObsId),
    resource: obs,
    request: { method: 'POST', url: 'Observation' },
  };
}
