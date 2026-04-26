/**
 * Per-performer free-text Observation builders (Phase 1.5).
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Emits at most one Observation each
 * for: patient position (LOINC 8361-8), sonographer comments (LOINC 59776-5),
 * and clinician impression (LOINC 81230-8). Each is optional; the entry is
 * skipped when the source field is empty.
 */

import type { BundleEntry, Observation } from '../../../types/fhir';
import { STANDARD_FHIR_SYSTEMS } from '../../../constants/fhir-systems';
import type { BuildContext } from '../context';
import { MEDIMIND_EXTENSIONS, observationCategory, urnRef } from '../context';

export function buildPatientPositionObservationEntry(
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

export function buildSonographerCommentsObservationEntry(
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

export function buildClinicianImpressionObservationEntry(
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
