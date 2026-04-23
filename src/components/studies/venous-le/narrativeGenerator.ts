/**
 * Narrative generator for bilateral lower-extremity venous duplex studies.
 *
 * Given a map of per-segment findings, produce a radiology-style English
 * findings narrative (one paragraph per side) + a conclusions list. Each
 * emitted sentence also has a paired i18n *key* so the UI can translate
 * the same output via `t()` — the caller renders whichever suits them.
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

export interface NarrativeOutput {
  /** English narrative prose for the right side (empty if no findings). */
  readonly rightFindings: string;
  /** English narrative prose for the left side (empty if no findings). */
  readonly leftFindings: string;
  /** Bullet-style English conclusions across both sides. */
  readonly conclusions: ReadonlyArray<string>;
  /** Translation-ready template keys for each right-side sentence. */
  readonly rightFindingsKeys: ReadonlyArray<string>;
  /** Translation-ready template keys for each left-side sentence. */
  readonly leftFindingsKeys: ReadonlyArray<string>;
  /** Translation-ready template keys for each conclusion bullet. */
  readonly conclusionsKeys: ReadonlyArray<string>;
}

export function generateNarrative(findings: VenousSegmentFindings): NarrativeOutput {
  const right = buildSideNarrative(findings, 'right');
  const left = buildSideNarrative(findings, 'left');

  const conclusions: string[] = [...right.conclusions, ...left.conclusions];
  const conclusionsKeys: string[] = [...right.conclusionsKeys, ...left.conclusionsKeys];

  return {
    rightFindings: right.prose,
    leftFindings: left.prose,
    rightFindingsKeys: right.proseKeys,
    leftFindingsKeys: left.proseKeys,
    conclusions,
    conclusionsKeys,
  };
}

// ============================================================================
// Internals
// ============================================================================

type Side = 'left' | 'right';

interface SideNarrativeParts {
  readonly prose: string;
  readonly proseKeys: ReadonlyArray<string>;
  readonly conclusions: ReadonlyArray<string>;
  readonly conclusionsKeys: ReadonlyArray<string>;
}

interface ClassifiedSegments {
  readonly normalDeep: VenousLESegmentBase[];
  readonly normalSuperficial: VenousLESegmentBase[];
  readonly pathologicalReflux: Array<{ segment: VenousLESegmentBase; ms: number }>;
  readonly nonCompressible: VenousLESegmentBase[];
  readonly partialCompressibility: VenousLESegmentBase[];
  readonly acuteThrombosis: VenousLESegmentBase[];
  readonly chronicThrombosis: VenousLESegmentBase[];
  readonly inconclusive: VenousLESegmentBase[];
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
    classified.nonCompressible.length > 0 ||
    classified.partialCompressibility.length > 0 ||
    classified.acuteThrombosis.length > 0 ||
    classified.chronicThrombosis.length > 0 ||
    classified.inconclusive.length > 0;

  if (!hasAny) {
    return { prose: '', proseKeys: [], conclusions: [], conclusionsKeys: [] };
  }

  const sentences: string[] = [];
  const sentenceKeys: string[] = [];
  const conclusions: string[] = [];
  const conclusionsKeys: string[] = [];

  const sideLabel = side === 'right' ? 'right' : 'left';

  // (a) Normal compressibility of deep veins — summarize if any deep segments are normal.
  if (classified.normalDeep.length > 0) {
    sentences.push(
      `Normal compressibility of the deep veins in the ${sideLabel} lower extremity.`
    );
    sentenceKeys.push(`venousLE.narrative.normalCompressibilityDeep.${side}`);

    // Normal spontaneous phasic augmented flow — emit only when at least one deep
    // segment shows all three (spontaneity/phasicity/augmentation) as normal.
    if (anyDeepFlowNormal(findings, side)) {
      sentences.push(
        `Normal spontaneous phasic augmented flow in the ${sideLabel} lower extremity.`
      );
      sentenceKeys.push(`venousLE.narrative.normalFlowDeep.${side}`);
    }
  }

  // (b) Pathological reflux — list per vein with ms.
  for (const { segment, ms } of classified.pathologicalReflux) {
    const vein = segmentDisplay(segment);
    sentences.push(`Marked reflux noted in the ${vein} (${ms} ms).`);
    sentenceKeys.push(`venousLE.narrative.refluxNoted.${segment}.${side}`);
    conclusions.push(`Pathological reflux in the ${sideLabel} ${vein} (${ms} ms).`);
    conclusionsKeys.push(`venousLE.conclusion.reflux.${segment}.${side}`);
  }

  // (c) Non-compressible / partial — flag acute DVT / chronic post-thrombotic.
  for (const segment of classified.nonCompressible) {
    const vein = segmentDisplay(segment);
    sentences.push(
      `Non-compressible segment suggestive of acute DVT in the ${vein}.`
    );
    sentenceKeys.push(`venousLE.narrative.nonCompressible.${segment}.${side}`);
    conclusions.push(`Acute DVT suspected in the ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.acuteDvt.${segment}.${side}`);
  }
  for (const segment of classified.partialCompressibility) {
    const vein = segmentDisplay(segment);
    sentences.push(
      `Partial compressibility noted in the ${vein}, consistent with chronic post-thrombotic changes.`
    );
    sentenceKeys.push(`venousLE.narrative.partialCompressibility.${segment}.${side}`);
    conclusions.push(
      `Chronic post-thrombotic changes in the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.chronicPostThrombotic.${segment}.${side}`);
  }

  // Thrombosis axis — only emit if it isn't already captured by compressibility.
  for (const segment of classified.acuteThrombosis) {
    if (classified.nonCompressible.includes(segment)) continue;
    const vein = segmentDisplay(segment);
    sentences.push(`Acute thrombus visualized within the ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.acuteThrombus.${segment}.${side}`);
    conclusions.push(`Acute DVT in the ${sideLabel} ${vein}.`);
    conclusionsKeys.push(`venousLE.conclusion.acuteDvt.${segment}.${side}`);
  }
  for (const segment of classified.chronicThrombosis) {
    if (classified.partialCompressibility.includes(segment)) continue;
    const vein = segmentDisplay(segment);
    sentences.push(
      `Echogenic, adherent thrombus noted in the ${vein}, consistent with chronic post-thrombotic changes.`
    );
    sentenceKeys.push(`venousLE.narrative.chronicThrombus.${segment}.${side}`);
    conclusions.push(
      `Chronic post-thrombotic changes in the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.chronicPostThrombotic.${segment}.${side}`);
  }

  // (d) Inconclusive — flag as a study limitation.
  for (const segment of classified.inconclusive) {
    const vein = segmentDisplay(segment);
    sentences.push(`Study limited — inconclusive compressibility of the ${vein}.`);
    sentenceKeys.push(`venousLE.narrative.inconclusive.${segment}.${side}`);
    conclusions.push(
      `Study limitation: inconclusive assessment of the ${sideLabel} ${vein}.`
    );
    conclusionsKeys.push(`venousLE.conclusion.inconclusive.${segment}.${side}`);
  }

  return {
    prose: sentences.join(' '),
    proseKeys: sentenceKeys,
    conclusions,
    conclusionsKeys,
  };
}

function classifySide(findings: VenousSegmentFindings, side: Side): ClassifiedSegments {
  const normalDeep: VenousLESegmentBase[] = [];
  const normalSuperficial: VenousLESegmentBase[] = [];
  const pathologicalReflux: Array<{ segment: VenousLESegmentBase; ms: number }> = [];
  const nonCompressible: VenousLESegmentBase[] = [];
  const partialCompressibility: VenousLESegmentBase[] = [];
  const acuteThrombosis: VenousLESegmentBase[] = [];
  const chronicThrombosis: VenousLESegmentBase[] = [];
  const inconclusive: VenousLESegmentBase[] = [];

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

    if (hasPathologicalReflux(segment, finding)) {
      const ms = finding.refluxDurationMs;
      if (ms !== undefined) {
        pathologicalReflux.push({ segment, ms });
      }
    }
  }

  return {
    normalDeep,
    normalSuperficial,
    pathologicalReflux,
    nonCompressible,
    partialCompressibility,
    acuteThrombosis,
    chronicThrombosis,
    inconclusive,
  };
}

/** At least one deep segment with normal spontaneity, phasicity, and augmentation. */
function anyDeepFlowNormal(findings: VenousSegmentFindings, side: Side): boolean {
  for (const segment of VENOUS_LE_SEGMENTS) {
    if (!isDeepSegment(segment)) continue;
    const fullId = `${segment}-${side}` as VenousLEFullSegmentId;
    const f: VenousSegmentFinding | undefined = findings[fullId];
    if (!f) continue;
    if (
      f.spontaneity === 'normal' &&
      f.phasicity === 'normal' &&
      f.augmentation === 'normal'
    ) {
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
    case 'eiv':
      return 'external iliac vein';
    case 'fv-prox':
      return 'femoral vein, proximal';
    case 'fv-mid':
      return 'femoral vein, mid';
    case 'fv-dist':
      return 'femoral vein, distal';
    case 'pfv':
      return 'profunda femoral vein';
    case 'gsv-ak':
      return 'great saphenous vein, above knee';
    case 'gsv-prox-calf':
      return 'great saphenous vein, proximal calf';
    case 'gsv-mid-calf':
      return 'great saphenous vein, mid calf';
    case 'gsv-dist-calf':
      return 'great saphenous vein, distal calf';
    case 'pop-ak':
      return 'popliteal vein, above knee';
    case 'pop-fossa':
      return 'popliteal vein, fossa';
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
