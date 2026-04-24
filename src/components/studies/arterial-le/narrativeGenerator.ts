// SPDX-License-Identifier: Apache-2.0
/**
 * Narrative generator for bilateral lower-extremity arterial duplex studies.
 *
 * Mirrors the venous generator's shape (`NarrativeOutput` with side-specific
 * findings prose + conclusion bullets + translation-ready key entries) so
 * downstream consumers (PDF, form narrative block) stay study-agnostic.
 *
 * Style follows Phase 1.9 radiology-report format: finding first, em-dash,
 * location. Auto-generates prose from segment findings + pressures.
 */

import type { NarrativeKeyEntry, NarrativeOutput } from '../venous-le/narrativeGenerator';
import {
  ARTERIAL_LE_SEGMENTS,
  type ArterialLEFullSegmentId,
  type ArterialSegmentFindings,
  type SegmentalPressures,
  stenosisCategoryFromPct,
  isHemodynamicallySignificant,
} from './config';
import { computeAbi, computeTbi, type AbiResult, type TbiResult } from './abiCalculator';

export type { NarrativeKeyEntry, NarrativeOutput };

interface SideBuild {
  prose: string;
  proseKeys: string[];
  proseEntries: NarrativeKeyEntry[];
  conclusions: string[];
  conclusionsKeys: string[];
  conclusionsEntries: NarrativeKeyEntry[];
}

export function generateArterialNarrative(
  findings: ArterialSegmentFindings,
  pressures: SegmentalPressures,
): NarrativeOutput {
  const right = buildSide(findings, 'right', pressures);
  const left = buildSide(findings, 'left', pressures);

  return {
    rightFindings: right.prose,
    leftFindings: left.prose,
    rightFindingsKeys: right.proseKeys,
    leftFindingsKeys: left.proseKeys,
    conclusions: [...right.conclusions, ...left.conclusions],
    conclusionsKeys: [...right.conclusionsKeys, ...left.conclusionsKeys],
    rightFindingsEntries: right.proseEntries,
    leftFindingsEntries: left.proseEntries,
    conclusionsEntries: [...right.conclusionsEntries, ...left.conclusionsEntries],
  };
}

function buildSide(
  findings: ArterialSegmentFindings,
  side: 'left' | 'right',
  pressures: SegmentalPressures,
): SideBuild {
  const sentences: NarrativeKeyEntry[] = [];
  const conclusions: NarrativeKeyEntry[] = [];

  let allTriphasic = true;
  let anySignificant = false;
  let anyOccluded = false;

  for (const base of ARTERIAL_LE_SEGMENTS) {
    const id = `${base}-${side}` as ArterialLEFullSegmentId;
    const f = findings[id];
    if (!f) continue;

    if (f.waveform && f.waveform !== 'triphasic') allTriphasic = false;

    if (f.occluded || f.stenosisCategory === 'occluded') {
      anyOccluded = true;
      sentences.push({
        key: 'arterialLE.narrative.occluded',
        params: { vein: `arterialLE.segment.${base}` },
      });
      conclusions.push({
        key: 'arterialLE.conclusion.occluded',
        params: {
          side: `arterialLE.side.${side}`,
          vein: `arterialLE.segment.${base}`,
        },
      });
      continue;
    }

    if (isHemodynamicallySignificant(f)) {
      anySignificant = true;
      const category = f.stenosisCategory
        ?? stenosisCategoryFromPct(f.stenosisPct, f.occluded);
      sentences.push({
        key: 'arterialLE.narrative.stenosis',
        params: {
          severity: `arterialLE.stenosis.${category}`,
          vein: `arterialLE.segment.${base}`,
          psv: f.psvCmS ?? 0,
        },
      });
      conclusions.push({
        key: 'arterialLE.conclusion.significantStenosis',
        params: {
          side: `arterialLE.side.${side}`,
          severity: `arterialLE.stenosis.${category}`,
          vein: `arterialLE.segment.${base}`,
        },
      });
      continue;
    }

    if (f.waveform && f.waveform !== 'triphasic' && f.waveform !== 'biphasic') {
      sentences.push({
        key: 'arterialLE.narrative.dampedWaveform',
        params: {
          waveform: `arterialLE.waveform.${f.waveform}`,
          vein: `arterialLE.segment.${base}`,
        },
      });
    }
  }

  // Add ABI / TBI summary bullet
  const abi = computeAbi(pressures, side === 'left' ? 'L' : 'R');
  const tbi = computeTbi(pressures, side === 'left' ? 'L' : 'R');
  const abiBullet = buildAbiBullet(abi, tbi, side);
  if (abiBullet) conclusions.push(abiBullet);

  // Add a "normal" sentence if no abnormal findings at all
  if (!anySignificant && !anyOccluded && allTriphasic && sentences.length === 0) {
    sentences.push({
      key: 'arterialLE.narrative.normalSide',
      params: { side: `arterialLE.side.${side}` },
    });
  }

  return {
    prose: '',  // UI renders via entries; kept for backcompat
    proseKeys: sentences.map((s) => s.key),
    proseEntries: sentences,
    conclusions: [],
    conclusionsKeys: conclusions.map((c) => c.key),
    conclusionsEntries: conclusions,
  };
}

function buildAbiBullet(
  abi: AbiResult,
  tbi: TbiResult,
  side: 'left' | 'right',
): NarrativeKeyEntry | null {
  if (abi.abi === null && tbi.tbi === null) return null;
  return {
    key: 'arterialLE.conclusion.abiSummary',
    params: {
      side: `arterialLE.side.${side}`,
      abi: abi.abi !== null ? abi.abi.toFixed(2) : '—',
      abiBand: `arterialLE.abi.band.${abi.band}`,
      tbi: tbi.tbi !== null ? tbi.tbi.toFixed(2) : '—',
    },
  };
}

/**
 * For compatibility with the existing `narrativeService` dispatcher signature,
 * expose a passthrough that matches the venous `generateNarrative` contract.
 * Callers that need pressures call `generateArterialNarrative` directly.
 */
export function generateNarrativeNoPressures(
  findings: ArterialSegmentFindings,
): NarrativeOutput {
  return generateArterialNarrative(findings, {});
}
