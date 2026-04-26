/**
 * Per-segment Observation orchestrator.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Picks the right emitter family based
 * on the form's `studyType` (venous / arterial / carotid) and falls back to
 * the generic SegmentState path for any other study.
 */

import type { BundleEntry, Observation } from '../../../types/fhir';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
} from '../../../components/studies/venous-le/config';
import { VENOUS_LE_SEGMENTS } from '../../../components/studies/venous-le/config';
import type {
  ArterialLEFullSegmentId,
  ArterialLESegmentBase,
} from '../../../components/studies/arterial-le/config';
import { ARTERIAL_LE_SEGMENTS } from '../../../components/studies/arterial-le/config';
import type {
  CarotidVesselBase,
  CarotidVesselFullId,
} from '../../../components/studies/carotid/config';
import { CAROTID_VESSELS } from '../../../components/studies/carotid/config';
import type { BuildContext } from '../context';
import {
  appendVenousFindingObservations,
  extractVenousFindings,
} from './venous';
import {
  appendArterialComputedObservations,
  appendArterialFindingObservations,
  appendArterialPressureObservations,
  extractArterialFindings,
  extractArterialPressures,
} from './arterial';
import {
  appendCarotidComputedObservations,
  appendCarotidFindingObservations,
  appendCarotidNascetObservations,
  extractCarotidFindings,
  extractCarotidNascet,
} from './carotid';
import { appendGenericSegmentObservations } from './generic';

export function buildSegmentObservationEntries(ctx: BuildContext): Array<BundleEntry<Observation>> {
  const entries: Array<BundleEntry<Observation>> = [];

  // Prefer the venous table (`parameters.segmentFindings`) when the study
  // is a venous variant and the table is populated; fall back to `segments[]`.
  const venousFindings = extractVenousFindings(ctx.form);
  if (venousFindings) {
    for (const segment of VENOUS_LE_SEGMENTS) {
      for (const side of ['left', 'right'] as const) {
        const fullId = `${segment}-${side}` as VenousLEFullSegmentId;
        const finding = venousFindings[fullId];
        if (!finding) continue;
        appendVenousFindingObservations(ctx, entries, segment as VenousLESegmentBase, side, finding);
      }
    }
    return entries;
  }

  // Arterial LE — per-segment findings + segmental pressures + computed ABI/TBI.
  if (ctx.form.studyType === 'arterialLE') {
    const findings = extractArterialFindings(ctx.form);
    if (findings) {
      for (const segment of ARTERIAL_LE_SEGMENTS) {
        for (const side of ['left', 'right'] as const) {
          const fullId = `${segment}-${side}` as ArterialLEFullSegmentId;
          const finding = findings[fullId];
          if (!finding) continue;
          appendArterialFindingObservations(ctx, entries, segment as ArterialLESegmentBase, side, finding);
        }
      }
    }
    const pressures = extractArterialPressures(ctx.form);
    if (pressures) {
      appendArterialPressureObservations(ctx, entries, pressures);
      appendArterialComputedObservations(ctx, entries, pressures);
    }
    return entries;
  }

  // Carotid duplex — per-vessel findings + NASCET classification + ICA/CCA.
  if (ctx.form.studyType === 'carotid') {
    const findings = extractCarotidFindings(ctx.form);
    if (findings) {
      for (const vessel of CAROTID_VESSELS) {
        for (const side of ['left', 'right'] as const) {
          const fullId = `${vessel}-${side}` as CarotidVesselFullId;
          const finding = findings[fullId];
          if (!finding) continue;
          appendCarotidFindingObservations(ctx, entries, vessel as CarotidVesselBase, side, finding);
        }
      }
      appendCarotidComputedObservations(ctx, entries, findings);
    }
    const nascet = extractCarotidNascet(ctx.form);
    if (nascet) {
      appendCarotidNascetObservations(ctx, entries, nascet);
    }
    return entries;
  }

  // Generic fallback: one Observation per numeric measurement on a SegmentState.
  for (const s of ctx.form.segments) {
    appendGenericSegmentObservations(ctx, entries, s);
  }
  return entries;
}
