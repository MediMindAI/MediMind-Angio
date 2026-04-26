// SPDX-License-Identifier: Apache-2.0
/**
 * Narrative generator for carotid duplex — emits the same structured shape
 * as venous + arterial generators. Findings-first, em-dash, location.
 */

import type { NarrativeKeyEntry, NarrativeOutput } from '../venous-le/narrativeGenerator';
import {
  CAROTID_VESSELS,
  type CarotidFindings,
  type CarotidNascetClassification,
  type CarotidVesselFullId,
  type NascetCategory,
  isVertebral,
} from './config';
import { nascetCategoryFallback } from './stenosisCalculator';

export type { NarrativeKeyEntry, NarrativeOutput };

interface SideBuild {
  prose: string;
  proseKeys: string[];
  proseEntries: NarrativeKeyEntry[];
  conclusions: string[];
  conclusionsKeys: string[];
  conclusionsEntries: NarrativeKeyEntry[];
}

export function generateCarotidNarrative(
  findings: CarotidFindings,
  nascet: CarotidNascetClassification,
): NarrativeOutput {
  const right = buildSide(findings, 'right', nascet.right);
  const left = buildSide(findings, 'left', nascet.left);
  return {
    rightFindings: '',
    leftFindings: '',
    rightFindingsKeys: right.proseKeys,
    leftFindingsKeys: left.proseKeys,
    conclusions: [],
    conclusionsKeys: [...right.conclusionsKeys, ...left.conclusionsKeys],
    rightFindingsEntries: right.proseEntries,
    leftFindingsEntries: left.proseEntries,
    conclusionsEntries: [...right.conclusionsEntries, ...left.conclusionsEntries],
  };
}

function buildSide(
  findings: CarotidFindings,
  side: 'left' | 'right',
  nascetCat: NascetCategory | undefined,
): SideBuild {
  const entries: NarrativeKeyEntry[] = [];
  const conclusions: NarrativeKeyEntry[] = [];

  let anyPlaque = false;
  let anyStealPhase3 = false;
  let anyAbsent = false;

  for (const base of CAROTID_VESSELS) {
    const id = `${base}-${side}` as CarotidVesselFullId;
    const f = findings[id];
    if (!f) continue;

    if (f.flowDirection === 'absent') {
      anyAbsent = true;
      entries.push({
        key: 'carotid.narrative.occluded',
        params: { vessel: `carotid.vessel.${base}` },
      });
      conclusions.push({
        key: 'carotid.conclusion.occluded',
        params: {
          side: `carotid.side.${side}`,
          vessel: `carotid.vessel.${base}`,
        },
      });
      continue;
    }

    if (isVertebral(base) && f.subclavianStealPhase && f.subclavianStealPhase >= 1) {
      if (f.subclavianStealPhase === 3) anyStealPhase3 = true;
      entries.push({
        key: 'carotid.narrative.stealPhase',
        params: {
          vessel: `carotid.vessel.${base}`,
          phase: f.subclavianStealPhase,
        },
      });
    }

    if (f.plaquePresent) {
      anyPlaque = true;
      entries.push({
        key: 'carotid.narrative.plaque',
        params: {
          vessel: `carotid.vessel.${base}`,
          morphology: f.plaqueMorphology
            ? `carotid.plaque.${f.plaqueMorphology}`
            : 'carotid.plaque.mixed',
          length: f.plaqueLengthMm ?? 0,
        },
      });
    }
  }

  if (nascetCat) {
    conclusions.push({
      key: 'carotid.conclusion.nascet',
      params: {
        side: `carotid.side.${side}`,
        category: `carotid.nascet.${nascetCat}`,
      },
    });
  }

  if (!anyPlaque && !anyAbsent && entries.length === 0) {
    entries.push({
      key: 'carotid.narrative.normalSide',
      params: { side: `carotid.side.${side}` },
    });
  }

  if (anyStealPhase3) {
    conclusions.push({
      key: 'carotid.conclusion.subclavianSteal',
      params: { side: `carotid.side.${side}` },
    });
  }

  return {
    prose: '',
    proseKeys: entries.map((e) => e.key),
    proseEntries: entries,
    conclusions: [],
    conclusionsKeys: conclusions.map((c) => c.key),
    conclusionsEntries: conclusions,
  };
}

// Kept for compatibility if fallback resolvers need them directly.
export { nascetCategoryFallback };
