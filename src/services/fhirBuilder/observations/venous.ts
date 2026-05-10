/**
 * Venous-LE per-segment Observation emitters.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Owns the venous-specific categorical
 * + numeric helpers (which predate the shared coded-categorical helpers and
 * embed venous-specific abnormal logic) plus the `extractVenousFindings`
 * read-side type guard.
 */

import type { FormState } from '../../../types/form';
import { isVenousFindings } from '../../../types/parameters';
import type {
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../../../components/studies/venous-le/config';
import { hasPathologicalReflux } from '../../../components/studies/venous-le/config';
import type {
  BundleEntry,
  CodeableConcept,
  Observation,
  Quantity,
} from '../../../types/fhir';
import { STANDARD_FHIR_SYSTEMS } from '../../../constants/fhir-systems';
import type { BuildContext } from '../context';
import {
  bodySiteForSegment,
  interpretationAbnormal,
  medimindParamSystem,
  newUuid,
  observationCategory,
  urnRef,
} from '../context';
import { buildParameterCoding } from './shared';

export function extractVenousFindings(form: FormState): VenousSegmentFindings | undefined {
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

export function appendVenousFindingObservations(
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
    'phasicity',
    'Phasicity',
    finding.phasicity,
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
    (paramId === 'phasicity' && (value === 'monophasic' || value === 'reduced'));

  const obs: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    category: [observationCategory('imaging')],
    code: {
      coding: buildParameterCoding(ctx, paramId),
      text: `${sideText} ${paramLabel}: ${value}`,
    },
    subject: { reference: ctx.patientRef },
    effectiveDateTime: ctx.nowIso,
    issued: ctx.nowIso,
    bodySite,
    valueCodeableConcept: {
      text: value,
      coding: [
        { system: medimindParamSystem(ctx, paramId), code: value, display: value },
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
      coding: buildParameterCoding(ctx, paramId),
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
