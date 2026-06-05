// SPDX-License-Identifier: Apache-2.0
/**
 * Narrative generator for iliac/pelvic venous duplex — emits the same
 * structured `NarrativeOutput` shape as the venous/arterial/carotid generators
 * (entries-first; param string values containing `.` are translation keys,
 * resolved by `narrativeService.resolveEntry`).
 *
 * Laterality-bearing findings (gonadal, plexus, per-side iliac, escape points)
 * fill the right/left slots; midline + syndrome-level rollups (nutcracker,
 * May-Thurner, pelvic congestion, "confirmatory imaging recommended") fill the
 * conclusions slot — they are diagnoses, not single-side findings.
 */

import type { NarrativeKeyEntry, NarrativeOutput } from '../venous-le/narrativeGenerator';
import {
  type IliacPelvicVenousFindings,
  type IliacCavalFullId,
  type Side,
  isNutcrackerScreenPositive,
  isCavalObstructive,
  isGonadalRefluxAbnormal,
  isPlexusCongested,
  isEscapePointSignificant,
} from './config';

export type { NarrativeKeyEntry, NarrativeOutput };

const NS = 'iliacPelvicVenous';

/** Round to 1 decimal so an un-stepped measured float doesn't render as a long
 * tail (e.g. 2.53333) in the prose (audit L5). */
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Per-side iliac/caval bases (IVC is midline → handled in conclusions). */
const PER_SIDE_CAVAL = ['civ', 'eiv', 'iiv', 'cfv'] as const;

export function generateIliacNarrative(findings: IliacPelvicVenousFindings): NarrativeOutput {
  const right = buildSide(findings, 'right');
  const left = buildSide(findings, 'left');
  const conclusions = buildConclusions(findings);

  return {
    rightFindings: '',
    leftFindings: '',
    conclusions: [],
    rightFindingsKeys: right.map((e) => e.key),
    leftFindingsKeys: left.map((e) => e.key),
    conclusionsKeys: conclusions.map((c) => c.key),
    rightFindingsEntries: right,
    leftFindingsEntries: left,
    conclusionsEntries: conclusions,
  };
}

function buildSide(findings: IliacPelvicVenousFindings, side: Side): NarrativeKeyEntry[] {
  const entries: NarrativeKeyEntry[] = [];
  const sideKey = `${NS}.side.${side}`;

  // Gonadal (ovarian) vein reflux
  const gonadal = findings.gonadal?.[side];
  if (gonadal && isGonadalRefluxAbnormal(gonadal)) {
    entries.push({
      key: `${NS}.narrative.ovarianReflux`,
      params: {
        side: sideKey,
        diameterMm: r1(gonadal.diameterMm ?? 0),
        durationS: r1(gonadal.refluxDurationS ?? 0),
      },
    });
  }

  // Pelvic plexus congestion
  const plexus = findings.plexus?.[side];
  if (plexus && isPlexusCongested(plexus)) {
    entries.push({
      key: `${NS}.narrative.plexusCongestion`,
      params: { side: sideKey, diameterMm: r1(plexus.largestDiameterMm ?? 0) },
    });
  }

  // Per-side iliac/caval obstruction
  for (const base of PER_SIDE_CAVAL) {
    const id = `${base}-${side}` as IliacCavalFullId;
    const f = findings.caval?.[id];
    if (f && isCavalObstructive(f)) {
      entries.push({
        key: `${NS}.narrative.cavalStenosis`,
        params: {
          vessel: `${NS}.vessel.${base}`,
          side: sideKey,
          pct: f.stenosisPct ?? 0,
          ratio: r1(f.velocityRatio ?? 0),
        },
      });
    }
  }

  // Escape points on this side
  for (const ep of findings.escapePoints ?? []) {
    if (ep.side === side && isEscapePointSignificant(ep)) {
      entries.push({
        key: `${NS}.narrative.escapePoint`,
        params: { side: sideKey, type: `${NS}.escapePoint.${ep.type}` },
      });
    }
  }

  if (entries.length === 0) {
    entries.push({ key: `${NS}.narrative.normalSide`, params: { side: sideKey } });
  }

  return entries;
}

function buildConclusions(findings: IliacPelvicVenousFindings): NarrativeKeyEntry[] {
  const conclusions: NarrativeKeyEntry[] = [];

  // Zone 1 — nutcracker (left renal vein)
  const renal = findings.renal;
  if (isNutcrackerScreenPositive(renal)) {
    conclusions.push({ key: `${NS}.conclusion.nutcracker` });
  }
  if (renal?.confirmatoryImagingRecommended) {
    conclusions.push({ key: `${NS}.conclusion.confirmRenal` });
  }

  // Zone 2 — IVC obstruction + per-side May-Thurner pattern (common iliac)
  if (isCavalObstructive(findings.caval?.['ivc'])) {
    conclusions.push({ key: `${NS}.conclusion.ivcObstruction` });
  }
  for (const side of ['left', 'right'] as const) {
    const civ = findings.caval?.[`civ-${side}` as IliacCavalFullId];
    if (isCavalObstructive(civ)) {
      conclusions.push({
        key: `${NS}.conclusion.mayThurner`,
        params: { side: `${NS}.side.${side}` },
      });
      if (civ?.confirmatoryImagingRecommended) {
        conclusions.push({ key: `${NS}.conclusion.confirmIliac` });
      }
    }
  }

  // Zones 3 + 4 — pelvic congestion (gonadal reflux and/or plexus congestion)
  const anyGonadal =
    isGonadalRefluxAbnormal(findings.gonadal?.left) ||
    isGonadalRefluxAbnormal(findings.gonadal?.right);
  const anyPlexus =
    isPlexusCongested(findings.plexus?.left) || isPlexusCongested(findings.plexus?.right);
  if (anyGonadal || anyPlexus) {
    conclusions.push({ key: `${NS}.conclusion.pelvicCongestion` });
  }

  if (conclusions.length === 0) {
    conclusions.push({ key: `${NS}.conclusion.normal` });
  }

  return conclusions;
}
