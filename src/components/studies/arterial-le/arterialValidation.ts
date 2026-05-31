// SPDX-License-Identifier: Apache-2.0
/**
 * arterialValidation — pure, non-blocking consistency checks for the arterial
 * LE form. These never prevent a save; they surface yellow advisory badges so
 * the clinician can reconcile findings that are internally contradictory or
 * incomplete (e.g. a ≥50 % stenosis paired with a triphasic waveform, or an
 * ABI computed from a side missing its ankle pressures).
 *
 * Each warning carries an i18n `key` + `params` so the form renders it through
 * `t()`; `fallback` is the English text for environments without translations.
 */

import {
  ARTERIAL_LE_SEGMENTS,
  isHemodynamicallySignificant,
  type ArterialLEFullSegmentId,
  type ArterialSegmentFindings,
  type SegmentalPressures,
} from './config';

export interface ArterialWarning {
  readonly id: string;
  readonly key: string;
  readonly fallback: string;
  readonly params?: Record<string, string | number>;
}

const SIDES = ['right', 'left'] as const;

/** Highest ankle pressure present for a side, or null if neither cuff filled. */
function ankleFor(p: SegmentalPressures, side: 'left' | 'right'): number | null {
  const dp = side === 'left' ? p.ankleDpL : p.ankleDpR;
  const pt = side === 'left' ? p.anklePtL : p.anklePtR;
  const vals = [dp, pt].filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}

function brachialRef(p: SegmentalPressures): number | null {
  const vals = [p.brachialL, p.brachialR].filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}

export function validateArterial(
  findings: ArterialSegmentFindings,
  pressures: SegmentalPressures,
): ReadonlyArray<ArterialWarning> {
  const out: ArterialWarning[] = [];

  for (const side of SIDES) {
    for (const base of ARTERIAL_LE_SEGMENTS) {
      const id = `${base}-${side}` as ArterialLEFullSegmentId;
      const f = findings[id];
      if (!f) continue;

      // A hemodynamically significant stenosis should not co-exist with a fully
      // triphasic waveform at the same segment — one of the two is likely wrong.
      if (f.waveform === 'triphasic' && isHemodynamicallySignificant(f)) {
        out.push({
          id: `${id}-stenosis-triphasic`,
          key: 'arterialLE.validation.stenosisTriphasic',
          fallback: 'Significant stenosis recorded with a triphasic waveform — please reconcile.',
          params: { segment: `arterialLE.segment.${base}`, side: `arterialLE.side.${side}` },
        });
      }

      // Occluded but a flow signal (PSV) was entered.
      if ((f.occluded || f.stenosisCategory === 'occluded') && (f.psvCmS ?? 0) > 0) {
        out.push({
          id: `${id}-occluded-psv`,
          key: 'arterialLE.validation.occludedWithFlow',
          fallback: 'Segment marked occluded but a flow velocity was entered.',
          params: { segment: `arterialLE.segment.${base}`, side: `arterialLE.side.${side}` },
        });
      }
    }

    // ABI relies on a brachial reference + an ankle pressure for the side. If a
    // side carries other findings/pressures but is missing ankle cuffs, the ABI
    // silently reads "unknown" — warn so the clinician knows it wasn't computed.
    const hasSidePressure =
      ankleFor(pressures, side) !== null ||
      (side === 'left' ? pressures.toeL : pressures.toeR) !== undefined ||
      (side === 'left' ? pressures.highThighL : pressures.highThighR) !== undefined;
    if (hasSidePressure && (ankleFor(pressures, side) === null || brachialRef(pressures) === null)) {
      out.push({
        id: `${side}-abi-incomplete`,
        key: 'arterialLE.validation.abiIncomplete',
        fallback: 'ABI cannot be computed — a brachial and an ankle pressure are required.',
        params: { side: `arterialLE.side.${side}` },
      });
    }
  }

  return out;
}
