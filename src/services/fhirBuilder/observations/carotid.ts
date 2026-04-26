/**
 * Carotid duplex per-vessel Observation emitters + NASCET + ICA/CCA ratio.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Owns the carotid extractors
 * (`extractCarotidFindings`, `extractCarotidNascet`) plus the per-vessel and
 * per-side observation appenders.
 */

import type { FormState } from '../../../types/form';
import { isCarotidFindings, isCarotidNascet } from '../../../types/parameters';
import type {
  CarotidFindings,
  CarotidNascetClassification,
  CarotidVesselBase,
  CarotidVesselFinding,
} from '../../../components/studies/carotid/config';
import { isVertebral } from '../../../components/studies/carotid/config';
import { icaCcaRatio } from '../../../components/studies/carotid/stenosisCalculator';
import type { BundleEntry, Observation } from '../../../types/fhir';
import { MEDIMIND_CODESYSTEMS } from '../../../constants/fhir-systems';
import type { BuildContext } from '../context';
import { bodySiteForSegment, medimindParamSystem } from '../context';
import {
  pushBooleanObservation,
  pushCodedCategorical,
  pushCustomNumeric,
  pushLoincNumeric,
} from './shared';

export function extractCarotidFindings(form: FormState): CarotidFindings | undefined {
  const raw = form.parameters['segmentFindings'];
  return isCarotidFindings(raw) ? raw : undefined;
}

export function extractCarotidNascet(form: FormState): CarotidNascetClassification | undefined {
  const raw = form.parameters['nascet'];
  return isCarotidNascet(raw) ? raw : undefined;
}

export function appendCarotidFindingObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  vesselBase: CarotidVesselBase,
  side: 'left' | 'right',
  finding: CarotidVesselFinding
): void {
  const bodySite = bodySiteForSegment(carotidSnomedKey(vesselBase));
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `segment=${vesselBase};side=${side}`;
  const isAbnormalFlow =
    finding.flowDirection === 'retrograde' ||
    finding.flowDirection === 'bidirectional' ||
    finding.flowDirection === 'absent';

  // Numeric: PSV
  pushLoincNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'psvCmS',
    paramLabel: 'Peak systolic velocity',
    value: finding.psvCmS,
    loincCode: '11556-8',
    loincDisplay: 'Peak systolic velocity',
    unit: 'cm/s',
    tag,
    isAbnormal: typeof finding.psvCmS === 'number' && finding.psvCmS >= 125,
  });
  // Numeric: EDV
  pushLoincNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'edvCmS',
    paramLabel: 'End diastolic velocity',
    value: finding.edvCmS,
    loincCode: '20352-4',
    loincDisplay: 'End diastolic velocity',
    unit: 'cm/s',
    tag,
    isAbnormal: typeof finding.edvCmS === 'number' && finding.edvCmS >= 100,
  });
  // Categorical: flow direction
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'flowDirection',
    paramLabel: 'Flow direction',
    value: finding.flowDirection,
    system: MEDIMIND_CODESYSTEMS.FLOW_DIRECTION,
    tag,
    isAbnormal: isAbnormalFlow,
  });
  // Boolean: plaque present
  if (finding.plaquePresent !== undefined) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'plaquePresent',
      paramLabel: 'Plaque present',
      value: finding.plaquePresent,
      tag,
      isAbnormal: finding.plaquePresent === true,
    });
  }
  // Categorical: plaque morphology (emit for explicit negative too)
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueMorphology',
    paramLabel: 'Plaque morphology',
    value: finding.plaqueMorphology,
    system: MEDIMIND_CODESYSTEMS.PLAQUE_MORPHOLOGY,
    tag,
    isAbnormal: finding.plaqueMorphology === 'soft' || finding.plaqueMorphology === 'mixed',
  });
  // Categorical: plaque surface
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueSurface',
    paramLabel: 'Plaque surface',
    value: finding.plaqueSurface,
    system: MEDIMIND_CODESYSTEMS.PLAQUE_SURFACE,
    tag,
    isAbnormal: finding.plaqueSurface === 'irregular',
  });
  // Boolean: plaque ulceration (only emit when true — negative implicit)
  if (finding.plaqueUlceration === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'plaqueUlceration',
      paramLabel: 'Plaque ulceration',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  // Numeric: plaque length
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plaqueLengthMm',
    paramLabel: 'Plaque length',
    value: finding.plaqueLengthMm,
    system: medimindParamSystem(ctx, 'plaqueLengthMm'),
    unit: 'mm',
    tag,
    isAbnormal: false,
  });
  // Categorical: subclavian steal phase (vertebrals only; numeric 0..3 → string)
  if (isVertebral(vesselBase) && finding.subclavianStealPhase !== undefined) {
    const phase = String(finding.subclavianStealPhase);
    pushCodedCategorical(ctx, out, {
      bodySite,
      sideText,
      paramId: 'subclavianStealPhase',
      paramLabel: 'Subclavian steal phase',
      value: phase,
      system: MEDIMIND_CODESYSTEMS.SUBCLAVIAN_STEAL_PHASE,
      tag,
      isAbnormal: finding.subclavianStealPhase >= 1,
    });
  }
}

function carotidSnomedKey(base: CarotidVesselBase): string {
  if (base === 'cca-prox' || base === 'cca-mid' || base === 'cca-dist') return 'cca';
  if (base === 'ica-prox' || base === 'ica-mid' || base === 'ica-dist') return 'ica';
  if (base === 'bulb') return 'carotid-bulb';
  if (base === 'eca') return 'eca';
  if (base === 'vert-v1' || base === 'vert-v2' || base === 'vert-v3') return 'va';
  // subclav-prox / subclav-dist — no SNOMED entry in VASCULAR_SEGMENTS_SNOMED;
  // the body-site will fall through to text-only encoding.
  return base;
}

export function appendCarotidNascetObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  nascet: CarotidNascetClassification
): void {
  const bodySite = bodySiteForSegment('ica');
  for (const side of ['left', 'right'] as const) {
    const cat = nascet[side];
    if (!cat) continue;
    const sideText = side === 'right' ? 'Right' : 'Left';
    pushCodedCategorical(ctx, out, {
      bodySite,
      sideText,
      paramId: 'nascetCategory',
      paramLabel: 'NASCET category',
      value: cat,
      system: MEDIMIND_CODESYSTEMS.NASCET_CATEGORY,
      tag: `parameter=nascet;side=${side}`,
      isAbnormal: cat === 'ge70' || cat === 'near-occlusion' || cat === 'occluded',
    });
  }
}

export function appendCarotidComputedObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  findings: CarotidFindings
): void {
  for (const side of ['left', 'right'] as const) {
    const ratio = icaCcaRatio(findings, side);
    if (ratio === null || !Number.isFinite(ratio)) continue;
    const sideText = side === 'right' ? 'Right' : 'Left';
    pushCustomNumeric(ctx, out, {
      bodySite: bodySiteForSegment('ica'),
      sideText,
      paramId: 'icaCcaRatio',
      paramLabel: 'ICA/CCA ratio',
      value: ratio,
      system: medimindParamSystem(ctx, 'icaCcaRatio'),
      unit: '1',
      tag: `parameter=icaCcaRatio;side=${side}`,
      isAbnormal: ratio >= 4,
    });
  }
}
