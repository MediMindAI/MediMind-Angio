// SPDX-License-Identifier: Apache-2.0
/**
 * Narrative generator for iliac/pelvic venous duplex — emits the same
 * structured `NarrativeOutput` shape as the venous/arterial/carotid generators
 * (entries-first; param string values containing `.` are translation keys,
 * resolved by `narrativeService.resolveEntry`).
 *
 * Per-side vein rows + the left renal vein (LRV) + the left gonadal vein fill
 * the right/left slots; midline (IVC) + syndrome-level rollups (IVC / LRV /
 * iliac obstruction, pelvic congestion) fill the conclusions slot — they are
 * diagnoses, not single-side findings.
 */

import type { NarrativeKeyEntry, NarrativeOutput } from '../venous-le/narrativeGenerator';
import {
  type IliacPelvicVenousFindings,
  type IliacCavalFullId,
  type Side,
  SIDE_ROW_BASES,
  IVC_ROWS,
  LRV_ROW,
  isCavalObstructive,
  isCavalIncompetent,
  isGonadalRefluxAbnormal,
} from './config';

export type { NarrativeKeyEntry, NarrativeOutput };

const NS = 'iliacPelvicVenous';

/** Round to 1 decimal so an un-stepped measured float doesn't render as a long
 * tail (e.g. 2.53333) in the prose (audit L5). */
const r1 = (n: number): number => Math.round(n * 10) / 10;

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

  // Per-row thrombosis / poor filling, then incompetence (reflux). The left
  // renal vein is a left-side vein, so it leads the left slot.
  const rows: ReadonlyArray<{ base: string; id: IliacCavalFullId }> = [
    ...(side === 'left' ? [{ base: LRV_ROW, id: LRV_ROW }] : []),
    ...SIDE_ROW_BASES.map((base) => ({ base, id: `${base}-${side}` as const })),
  ];
  for (const { base, id } of rows) {
    const f = findings.caval?.[id];
    if (isCavalObstructive(f)) {
      entries.push({
        key: `${NS}.narrative.rowObstruction`,
        params: { side: sideKey, row: `${NS}.row.${base}` },
      });
    }
    if (isCavalIncompetent(f)) {
      entries.push({
        key: `${NS}.narrative.rowIncompetent`,
        params: { side: sideKey, row: `${NS}.row.${base}` },
      });
    }
  }

  // Left gonadal (ovarian) vein — the only gonadal side captured
  const gonadal = side === 'left' ? findings.gonadal?.left : undefined;
  if (gonadal && isGonadalRefluxAbnormal(gonadal)) {
    entries.push({
      key: `${NS}.narrative.ovarianReflux`,
      params: { side: sideKey, diameterMm: r1(gonadal.diameterMm ?? 0) },
    });
  }

  if (entries.length === 0) {
    entries.push({ key: `${NS}.narrative.normalSide`, params: { side: sideKey } });
  }

  return entries;
}

function buildConclusions(findings: IliacPelvicVenousFindings): NarrativeKeyEntry[] {
  const conclusions: NarrativeKeyEntry[] = [];

  if (IVC_ROWS.some((id) => isCavalObstructive(findings.caval?.[id]))) {
    conclusions.push({ key: `${NS}.conclusion.ivcObstruction` });
  }
  if (isCavalObstructive(findings.caval?.[LRV_ROW])) {
    conclusions.push({ key: `${NS}.conclusion.lrvObstruction` });
  }
  for (const side of ['right', 'left'] as const) {
    if (SIDE_ROW_BASES.some((b) => isCavalObstructive(findings.caval?.[`${b}-${side}`]))) {
      conclusions.push({
        key: `${NS}.conclusion.iliacObstruction`,
        params: { side: `${NS}.side.${side}` },
      });
    }
  }
  if (isGonadalRefluxAbnormal(findings.gonadal?.left)) {
    conclusions.push({ key: `${NS}.conclusion.pelvicCongestion` });
  }
  // Reflux (incompetence) is a finding of its own: without these a row marked
  // only "incompetent" fell through to the "no reflux or obstruction" sentence.
  if ([...IVC_ROWS, LRV_ROW].some((id) => isCavalIncompetent(findings.caval?.[id]))) {
    conclusions.push({ key: `${NS}.conclusion.cavalReflux` });
  }
  for (const side of ['right', 'left'] as const) {
    if (SIDE_ROW_BASES.some((b) => isCavalIncompetent(findings.caval?.[`${b}-${side}`]))) {
      conclusions.push({
        key: `${NS}.conclusion.iliacReflux`,
        params: { side: `${NS}.side.${side}` },
      });
    }
  }

  if (conclusions.length === 0) {
    conclusions.push({ key: `${NS}.conclusion.normal` });
  }

  return conclusions;
}
