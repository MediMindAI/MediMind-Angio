/**
 * Narrative generator for bilateral lower-extremity venous duplex studies.
 *
 * Given a map of per-segment findings, produce a radiology-style English
 * findings narrative (one paragraph per side) + a conclusions list. Each
 * emitted sentence also has a paired i18n *key entry* (`NarrativeKeyEntry`)
 * so the UI can translate the same output via `t(key, params)` — the
 * caller renders whichever suits them.
 *
 * Phrasing follows the reporting style common to the Corestudycast group:
 *   - "Normal compressibility of the deep veins in the right lower extremity."
 *   - "Marked reflux noted in the great saphenous vein, thigh (1800 ms)."
 *   - "Non-compressible segment suggestive of acute DVT in the common femoral vein."
 *   - "Partial compressibility noted in the popliteal vein, consistent with chronic post-thrombotic changes."
 *   - "Study limited — inconclusive compressibility of the posterior tibial vein."
 */

import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from './config';
import { VENOUS_LE_SEGMENTS, hasPathologicalReflux, isDeepSegment } from './config';

// ============================================================================
// Public surface
// ============================================================================

/**
 * A single translation-ready sentence record.
 *
 * `key` is a `venousLE.*` dot-path the caller runs through `t()`.
 * `params` carries interpolation values. `vein` is stored as a *key*
 * (`venousLE.segments.<base>`) so the caller can translate the vein name
 * before interpolating.
 */
export interface NarrativeKeyEntry {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

export interface NarrativeOutput {
  /** English narrative prose for the right side (empty if no findings). */
  readonly rightFindings: string;
  /** English narrative prose for the left side (empty if no findings). */
  readonly leftFindings: string;
  /** Bullet-style English conclusions across both sides. */
  readonly conclusions: ReadonlyArray<string>;
  /** Translation-ready template keys for each right-side sentence (legacy — bare keys). */
  readonly rightFindingsKeys: ReadonlyArray<string>;
  /** Translation-ready template keys for each left-side sentence (legacy — bare keys). */
  readonly leftFindingsKeys: ReadonlyArray<string>;
  /** Translation-ready template keys for each conclusion bullet (legacy — bare keys). */
  readonly conclusionsKeys: ReadonlyArray<string>;
  /** Translation-ready key + params for each right-side sentence. */
  readonly rightFindingsEntries: ReadonlyArray<NarrativeKeyEntry>;
  /** Translation-ready key + params for each left-side sentence. */
  readonly leftFindingsEntries: ReadonlyArray<NarrativeKeyEntry>;
  /** Translation-ready key + params for each conclusion bullet. */
  readonly conclusionsEntries: ReadonlyArray<NarrativeKeyEntry>;
}

export function generateNarrative(findings: VenousSegmentFindings): NarrativeOutput {
  const right = buildSideNarrative(findings, 'right');
  const left = buildSideNarrative(findings, 'left');

  const conclusions: string[] = [...right.conclusions, ...left.conclusions];
  const conclusionsKeys: string[] = [...right.conclusionsKeys, ...left.conclusionsKeys];
  const conclusionsEntries: NarrativeKeyEntry[] = [
    ...right.conclusionsEntries,
    ...left.conclusionsEntries,
  ];

  return {
    rightFindings: right.prose,
    leftFindings: left.prose,
    rightFindingsKeys: right.proseKeys,
    leftFindingsKeys: left.proseKeys,
    conclusions,
    conclusionsKeys,
    rightFindingsEntries: right.proseEntries,
    leftFindingsEntries: left.proseEntries,
    conclusionsEntries,
  };
}

/** Build the `venousLE.segments.<base>` translation key for a segment base. */
export function segmentDisplayKey(segment: VenousLESegmentBase): string {
  return `venousLE.segments.${segment}`;
}

// ============================================================================
// Internals
// ============================================================================

type Side = 'left' | 'right';

interface SideNarrativeParts {
  readonly prose: string;
  readonly proseKeys: ReadonlyArray<string>;
  readonly proseEntries: ReadonlyArray<NarrativeKeyEntry>;
  readonly conclusions: ReadonlyArray<string>;
  readonly conclusionsKeys: ReadonlyArray<string>;
  readonly conclusionsEntries: ReadonlyArray<NarrativeKeyEntry>;
}

interface ClassifiedSegments {
  readonly normalDeep: VenousLESegmentBase[];
  readonly normalSuperficial: VenousLESegmentBase[];
  readonly pathologicalReflux: Array<{ segment: VenousLESegmentBase; ms: number }>;
  readonly subthresholdReflux: Array<{ segment: VenousLESegmentBase; ms: number }>;
  readonly nonCompressible: VenousLESegmentBase[];
  readonly partialCompressibility: VenousLESegmentBase[];
  readonly acuteThrombosis: VenousLESegmentBase[];
  readonly chronicThrombosis: VenousLESegmentBase[];
  readonly inconclusive: VenousLESegmentBase[];
  readonly incompetentValve: VenousLESegmentBase[];
  readonly postAblation: VenousLESegmentBase[];
}

function buildSideNarrative(
  findings: VenousSegmentFindings,
  side: Side
): SideNarrativeParts {
  const classified = classifySide(findings, side);
  const hasAny =
    classified.normalDeep.length > 0 ||
    classified.normalSuperficial.length > 0 ||
    classified.pathologicalReflux.length > 0 ||
    classified.subthresholdReflux.length > 0 ||
    classified.nonCompressible.length > 0 ||
    classified.partialCompressibility.length > 0 ||
    classified.acuteThrombosis.length > 0 ||
    classified.chronicThrombosis.length > 0 ||
    classified.inconclusive.length > 0 ||
    classified.incompetentValve.length > 0 ||
    classified.postAblation.length > 0;

  if (!hasAny) {
    return {
      prose: '',
      proseKeys: [],
      proseEntries: [],
      conclusions: [],
      conclusionsKeys: [],
      conclusionsEntries: [],
    };
  }

  const sentences: string[] = [];
  const sentenceKeys: string[] = [];
  const sentenceEntries: NarrativeKeyEntry[] = [];
  const conclusions: string[] = [];
  const conclusionsKeys: string[] = [];
  const conclusionsEntries: NarrativeKeyEntry[] = [];

  const sideLabel: 'right' | 'left' = side;

  // (a) Normal compressibility of deep veins — summarize if any deep segments are normal.
  if (classified.normalDeep.length > 0) {
    sentences.push(
      `Normal compressibility of the deep veins in the ${sideLabel} lower extremity.`
    );
    sentenceKeys.push(`venousLE.narrative.normalCompressibilityDeep.${side}`);
    sentenceEntries.push({
      key: `venousLE.narrative.normalCompressibilityDeep.${side}`,
    });

    // Normal flow — emit when at least one deep segment shows respirophasic flow.
    if (anyDeepFlowNormal(findings, side)) {
      sentences.push(
        `Normal respirophasic flow in the ${sideLabel} lower extremity.`
      );
      sentenceKeys.push(`venousLE.narrative.normalFlowDeep.${side}`);
      sentenceEntries.push({
        key: `venousLE.narrative.normalFlowDeep.${side}`,
      });
    }
  }

  // (b) Pathological reflux — list per vein with ms.
  for (const { segment, ms } of classified.pathologicalReflux) {
    const vein = segmentDisplay(segment);
    sentences.push(`Marked reflux noted in the ${vein} (${ms} ms).`);
    sentenceKeys.push(`venousLE.narrative.refluxNoted.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.refluxNoted',
      params: {
        vein: segmentDisplayKey(segment),
        ms,
        side,
      },
    });
    conclusions.push(`Pathological reflux in the ${sideLabel} ${vein} (${ms} ms).`);
    conclusionsKeys.push(`venousLE.conclusion.reflux.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.reflux',
      params: {
        vein: segmentDisplayKey(segment),
        ms,
        side,
      },
    });
  }

  // (c) Non-compressible / partial — flag acute DVT / chronic post-thrombotic.
  for (const segment of classified.nonCompressible) {
    const vein = segmentDisplay(segment);
    sentences.push(
      `Non-compressible segment suggestive of acute DVT in the ${vein}.`
    );
    sentenceKeys.push(`venousLE.narrative.nonCompressible.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.nonCompressible',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(`Acute DVT suspected in the ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.acuteDvt.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.acuteDvt',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }
  for (const segment of classified.partialCompressibility) {
    const vein = segmentDisplay(segment);
    sentences.push(
      `Partial compressibility noted in the ${vein}, consistent with chronic post-thrombotic changes.`
    );
    sentenceKeys.push(`venousLE.narrative.partialCompressibility.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.partialCompressibility',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(
      `Chronic post-thrombotic changes in the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.chronicPostThrombotic.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.chronicPostThrombotic',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }

  // Thrombosis axis — only emit if it isn't already captured by compressibility.
  for (const segment of classified.acuteThrombosis) {
    if (classified.nonCompressible.includes(segment)) continue;
    const vein = segmentDisplay(segment);
    sentences.push(`Acute thrombus visualized within the ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.acuteThrombus.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.acuteThrombus',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(`Acute DVT in the ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.acuteDvt.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.acuteDvt',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }
  for (const segment of classified.chronicThrombosis) {
    if (classified.partialCompressibility.includes(segment)) continue;
    const vein = segmentDisplay(segment);
    sentences.push(
      `Echogenic, adherent thrombus noted in the ${vein}, consistent with chronic post-thrombotic changes.`
    );
    sentenceKeys.push(`venousLE.narrative.chronicThrombus.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.chronicThrombus',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(
      `Chronic post-thrombotic changes in the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.chronicPostThrombotic.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.chronicPostThrombotic',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }

  // (d.1) Sub-threshold reflux — measured but below pathological cutoff.
  for (const { segment, ms } of classified.subthresholdReflux) {
    const vein = segmentDisplay(segment);
    sentences.push(`Reflux measured in the ${vein} (${ms} cm/s).`);
    sentenceKeys.push(`venousLE.narrative.refluxMeasured.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.refluxMeasured',
      params: { vein: segmentDisplayKey(segment), ms, side },
    });
  }

  // (d.2) Manually marked incompetent valves.
  for (const segment of classified.incompetentValve) {
    const vein = segmentDisplay(segment);
    sentences.push(`Incompetent valves noted — ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.incompetent.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.incompetent',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(`Valvular incompetence — ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.incompetent.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.incompetent',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }

  // (d.3) Post-ablation status.
  for (const segment of classified.postAblation) {
    const vein = segmentDisplay(segment);
    sentences.push(`Post-ablation status — ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.postAblation.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.postAblation',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(`Post-ablation — ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.postAblation.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.postAblation',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }

  // (e) Inconclusive — flag as a study limitation.
  for (const segment of classified.inconclusive) {
    const vein = segmentDisplay(segment);
    sentences.push(`Study limited — inconclusive compressibility of the ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.inconclusive.${segment}.${side}`);
    sentenceEntries.push({
      key: 'venousLE.narrative.inconclusive',
      params: { vein: segmentDisplayKey(segment), side },
    });
    conclusions.push(
      `Study limitation: inconclusive assessment of the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.inconclusive.${segment}.${side}`);
    conclusionsEntries.push({
      key: 'venousLE.conclusion.inconclusive',
      params: { vein: segmentDisplayKey(segment), side },
    });
  }

  return {
    prose: sentences.join(' '),
    proseKeys: sentenceKeys,
    proseEntries: sentenceEntries,
    conclusions,
    conclusionsKeys,
    conclusionsEntries,
  };
}

function classifySide(findings: VenousSegmentFindings, side: Side): ClassifiedSegments {
  const normalDeep: VenousLESegmentBase[] = [];
  const normalSuperficial: VenousLESegmentBase[] = [];
  const pathologicalReflux: Array<{ segment: VenousLESegmentBase; ms: number }> = [];
  const subthresholdReflux: Array<{ segment: VenousLESegmentBase; ms: number }> = [];
  const nonCompressible: VenousLESegmentBase[] = [];
  const partialCompressibility: VenousLESegmentBase[] = [];
  const acuteThrombosis: VenousLESegmentBase[] = [];
  const chronicThrombosis: VenousLESegmentBase[] = [];
  const inconclusive: VenousLESegmentBase[] = [];
  const incompetentValve: VenousLESegmentBase[] = [];
  const postAblation: VenousLESegmentBase[] = [];

  for (const segment of VENOUS_LE_SEGMENTS) {
    const fullId = `${segment}-${side}` as VenousLEFullSegmentId;
    const finding = findings[fullId];
    if (!finding) continue;

    if (finding.compressibility === 'non-compressible') {
      nonCompressible.push(segment);
    } else if (finding.compressibility === 'partial') {
      partialCompressibility.push(segment);
    } else if (finding.compressibility === 'inconclusive') {
      inconclusive.push(segment);
    } else if (finding.compressibility === 'normal') {
      if (isDeepSegment(segment)) normalDeep.push(segment);
      else normalSuperficial.push(segment);
    }

    if (finding.thrombosis === 'acute') acuteThrombosis.push(segment);
    if (finding.thrombosis === 'chronic') chronicThrombosis.push(segment);

    if (finding.refluxDurationMs !== undefined) {
      const ms = finding.refluxDurationMs;
      if (hasPathologicalReflux(segment, finding)) {
        pathologicalReflux.push({ segment, ms });
      } else {
        subthresholdReflux.push({ segment, ms });
      }
    }

    if (finding.competencyOverride === 'incompetent') incompetentValve.push(segment);
    if (finding.competencyOverride === 'ablated') postAblation.push(segment);
  }

  return {
    normalDeep,
    normalSuperficial,
    pathologicalReflux,
    subthresholdReflux,
    nonCompressible,
    partialCompressibility,
    acuteThrombosis,
    chronicThrombosis,
    inconclusive,
    incompetentValve,
    postAblation,
  };
}

/** At least one deep segment with respirophasic flow. */
function anyDeepFlowNormal(findings: VenousSegmentFindings, side: Side): boolean {
  for (const segment of VENOUS_LE_SEGMENTS) {
    if (!isDeepSegment(segment)) continue;
    const fullId = `${segment}-${side}` as VenousLEFullSegmentId;
    const f: VenousSegmentFinding | undefined = findings[fullId];
    if (!f) continue;
    if (f.phasicity === 'respirophasic') {
      return true;
    }
  }
  return false;
}

/** Human-friendly (English) display for a segment — mirrors the i18n source of truth. */
function segmentDisplay(segment: VenousLESegmentBase): string {
  switch (segment) {
    case 'cfv':
      return 'common femoral vein';
    case 'fv-prox':
      return 'femoral vein, proximal';
    case 'fv-mid':
      return 'femoral vein, mid';
    case 'fv-dist':
      return 'femoral vein, distal';
    case 'pfv':
      return 'profunda femoral vein';
    case 'gsv-prox-thigh':
      return 'great saphenous vein, proximal thigh';
    case 'gsv-mid-thigh':
      return 'great saphenous vein, mid thigh';
    case 'gsv-dist-thigh':
      return 'great saphenous vein, distal thigh';
    case 'gsv-knee':
      return 'great saphenous vein, at the knee';
    case 'gsv-calf':
      return 'great saphenous vein, calf';
    case 'pop-ak':
      return 'popliteal vein, above knee';
    case 'pop-bk':
      return 'popliteal vein, below knee';
    case 'ptv':
      return 'posterior tibial vein';
    case 'per':
      return 'peroneal vein';
    case 'ssv':
      return 'small saphenous vein';
    case 'gastroc':
      return 'gastrocnemius vein';
    case 'soleal':
      return 'soleal vein';
    case 'sfj':
      return 'saphenofemoral junction';
    case 'spj':
      return 'saphenopopliteal junction';
    default: {
      const _exhaustive: never = segment;
      return _exhaustive;
    }
  }
}
