/**
 * Shared Observation push helpers used by every per-study observation module.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. These four helpers (`pushCodedCategorical`,
 * `pushLoincNumeric`, `pushCustomNumeric`, `pushBooleanObservation`) emit a
 * single Observation each, encapsulating the boilerplate that the arterial,
 * carotid, and CEAP modules all share.
 */

import type { BundleEntry, CodeableConcept, Observation } from '../../../types/fhir';
import { STANDARD_FHIR_SYSTEMS } from '../../../constants/fhir-systems';
import type { BuildContext } from '../context';
import {
  interpretationAbnormal,
  newUuid,
  observationCategory,
  urnRef,
} from '../context';

export interface CodedCategoricalArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: string | undefined;
  readonly system: string;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

export function pushCodedCategorical(
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

export interface LoincNumericArgs {
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

export function pushLoincNumeric(
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

export interface CustomNumericArgs {
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

export function pushCustomNumeric(
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

export interface BooleanObsArgs {
  readonly bodySite: CodeableConcept;
  readonly sideText: string;
  readonly paramId: string;
  readonly paramLabel: string;
  readonly value: boolean;
  readonly tag: string;
  readonly isAbnormal: boolean;
}

export function pushBooleanObservation(
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
