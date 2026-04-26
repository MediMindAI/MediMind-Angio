/**
 * Arterial-LE per-segment Observation emitters + segmental pressures + ABI/TBI.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Owns the arterial-specific extractors
 * (`extractArterialFindings`, `extractArterialPressures`) plus the per-segment
 * + per-pressure-cuff observation appenders.
 */

import type { FormState } from '../../../types/form';
import { isArterialFindings, isArterialPressures } from '../../../types/parameters';
import type {
  ArterialLESegmentBase,
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  SegmentalPressures,
} from '../../../components/studies/arterial-le/config';
import { computeAbi, computeTbi } from '../../../components/studies/arterial-le/abiCalculator';
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

export function extractArterialFindings(form: FormState): ArterialSegmentFindings | undefined {
  const raw = form.parameters['segmentFindings'];
  return isArterialFindings(raw) ? raw : undefined;
}

export function extractArterialPressures(form: FormState): SegmentalPressures | undefined {
  const raw = form.parameters['pressures'];
  return isArterialPressures(raw) ? raw : undefined;
}

export function appendArterialFindingObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  segmentBase: ArterialLESegmentBase,
  side: 'left' | 'right',
  finding: ArterialSegmentFinding
): void {
  const bodySite = bodySiteForSegment(arterialSnomedKey(segmentBase));
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `segment=${segmentBase};side=${side}`;
  const isAbnormalStenosis =
    finding.stenosisCategory === 'moderate' ||
    finding.stenosisCategory === 'severe' ||
    finding.stenosisCategory === 'occluded' ||
    (typeof finding.stenosisPct === 'number' && finding.stenosisPct >= 50);
  const isAbnormalWaveform =
    finding.waveform === 'monophasic-damped' || finding.waveform === 'absent';

  // Categorical: waveform
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'waveform',
    paramLabel: 'Arterial waveform',
    value: finding.waveform,
    system: MEDIMIND_CODESYSTEMS.WAVEFORM_MORPHOLOGY,
    tag,
    isAbnormal: isAbnormalWaveform,
  });
  // Categorical: stenosis category
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'stenosisCategory',
    paramLabel: 'Stenosis category',
    value: finding.stenosisCategory,
    system: MEDIMIND_CODESYSTEMS.STENOSIS_CATEGORY,
    tag,
    isAbnormal: isAbnormalStenosis,
  });
  // Categorical: plaque morphology (emit even when "none" — explicit negative)
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

  // Numeric: PSV (LOINC 11556-8, cm/s)
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
    isAbnormal: typeof finding.psvCmS === 'number' && finding.psvCmS >= 200,
  });
  // Numeric: velocity ratio (custom system, unit `1`)
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'velocityRatio',
    paramLabel: 'Velocity ratio',
    value: finding.velocityRatio,
    system: MEDIMIND_CODESYSTEMS.VELOCITY_RATIO,
    unit: '1',
    tag,
    isAbnormal: typeof finding.velocityRatio === 'number' && finding.velocityRatio >= 2,
  });
  // Numeric: stenosis percentage
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'stenosisPct',
    paramLabel: 'Stenosis percent',
    value: finding.stenosisPct,
    system: medimindParamSystem(ctx, 'stenosisPct'),
    unit: '%',
    tag,
    isAbnormal: typeof finding.stenosisPct === 'number' && finding.stenosisPct >= 50,
  });
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
  // Boolean: occluded (only emit when true)
  if (finding.occluded === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'occluded',
      paramLabel: 'Occluded',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
}

/**
 * Map arterial segment bases to the VASCULAR_SEGMENTS_SNOMED table (which
 * only has coarse keys like `sfa` for all SFA subsegments).
 */
function arterialSnomedKey(base: ArterialLESegmentBase): string {
  if (base === 'sfa-prox' || base === 'sfa-mid' || base === 'sfa-dist') return 'sfa';
  if (base === 'pop-ak' || base === 'pop-bk') return 'popa';
  if (base === 'cia' || base === 'eia') return base; // no SNOMED entry; falls through to text
  if (base === 'tpt' || base === 'pfa') return base; // no SNOMED entry; falls through to text
  if (base === 'ata') return 'ata';
  if (base === 'pta') return 'pta';
  if (base === 'per') return 'pera';
  if (base === 'dp') return 'dpa';
  if (base === 'cfa') return 'cfa';
  return base;
}

interface ArterialPressureSpec {
  readonly paramId: string;
  readonly paramLabel: string;
  readonly leftProp: keyof SegmentalPressures;
  readonly rightProp: keyof SegmentalPressures;
  readonly snomedKey: string;
}

const ARTERIAL_PRESSURE_SPECS: ReadonlyArray<ArterialPressureSpec> = [
  { paramId: 'brachialPressure',  paramLabel: 'Brachial pressure',   leftProp: 'brachialL',  rightProp: 'brachialR',  snomedKey: 'brachial' },
  { paramId: 'highThighPressure', paramLabel: 'High-thigh pressure', leftProp: 'highThighL', rightProp: 'highThighR', snomedKey: 'high-thigh' },
  { paramId: 'lowThighPressure',  paramLabel: 'Low-thigh pressure',  leftProp: 'lowThighL',  rightProp: 'lowThighR',  snomedKey: 'low-thigh' },
  { paramId: 'calfPressure',      paramLabel: 'Calf pressure',       leftProp: 'calfL',      rightProp: 'calfR',      snomedKey: 'calf' },
  { paramId: 'ankleDpPressure',   paramLabel: 'Ankle DP pressure',   leftProp: 'ankleDpL',   rightProp: 'ankleDpR',   snomedKey: 'dpa' },
  { paramId: 'anklePtPressure',   paramLabel: 'Ankle PT pressure',   leftProp: 'anklePtL',   rightProp: 'anklePtR',   snomedKey: 'pta' },
  { paramId: 'toePressure',       paramLabel: 'Toe pressure',        leftProp: 'toeL',       rightProp: 'toeR',       snomedKey: 'toe' },
];

export function appendArterialPressureObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  pressures: SegmentalPressures
): void {
  for (const spec of ARTERIAL_PRESSURE_SPECS) {
    const bodySite = bodySiteForSegment(spec.snomedKey);
    const leftVal = pressures[spec.leftProp];
    const rightVal = pressures[spec.rightProp];
    if (typeof leftVal === 'number') {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText: 'Left',
        paramId: spec.paramId,
        paramLabel: spec.paramLabel,
        value: leftVal,
        system: medimindParamSystem(ctx, spec.paramId),
        unit: 'mm[Hg]',
        tag: `parameter=${spec.paramId};side=left`,
        isAbnormal: false,
      });
    }
    if (typeof rightVal === 'number') {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText: 'Right',
        paramId: spec.paramId,
        paramLabel: spec.paramLabel,
        value: rightVal,
        system: medimindParamSystem(ctx, spec.paramId),
        unit: 'mm[Hg]',
        tag: `parameter=${spec.paramId};side=right`,
        isAbnormal: false,
      });
    }
  }
}

export function appendArterialComputedObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  pressures: SegmentalPressures
): void {
  // ABI: LOINC 76497-9, unit `1`. TBI: custom system.
  const sides: ReadonlyArray<{ side: 'L' | 'R'; text: string }> = [
    { side: 'L', text: 'Left' },
    { side: 'R', text: 'Right' },
  ];
  for (const { side, text } of sides) {
    const abi = computeAbi(pressures, side);
    if (abi.abi !== null && Number.isFinite(abi.abi)) {
      pushLoincNumeric(ctx, out, {
        bodySite: { text: 'Ankle-brachial index' },
        sideText: text,
        paramId: 'abi',
        paramLabel: 'Ankle-brachial index',
        value: abi.abi,
        loincCode: '76497-9',
        loincDisplay: 'Ankle-brachial index',
        unit: '1',
        tag: `parameter=abi;side=${side === 'L' ? 'left' : 'right'};band=${abi.band}`,
        isAbnormal: abi.band !== 'normal' && abi.band !== 'unknown',
      });
    }
    const tbi = computeTbi(pressures, side);
    if (tbi.tbi !== null && Number.isFinite(tbi.tbi)) {
      pushCustomNumeric(ctx, out, {
        bodySite: { text: 'Toe-brachial index' },
        sideText: text,
        paramId: 'tbi',
        paramLabel: 'Toe-brachial index',
        value: tbi.tbi,
        system: MEDIMIND_CODESYSTEMS.TBI,
        unit: '1',
        tag: `parameter=tbi;side=${side === 'L' ? 'left' : 'right'};band=${tbi.band}`,
        isAbnormal: tbi.band !== 'normal' && tbi.band !== 'unknown',
      });
    }
  }
}
