// SPDX-License-Identifier: Apache-2.0
/**
 * Clinical templates for the Venous LE duplex form.
 *
 * Each template is a preset "case in a can" — a ready-made findings map
 * (plus optional CEAP + recommendations + canonical impression + sonographer
 * protocol note) that matches one of the 12 most common reporting scenarios
 * the vascular lab sees. Applying a template bulk-writes the reducer state
 * so a doctor can start from the closest canonical case instead of filling
 * the form from scratch.
 *
 * Phase 1.8 additions:
 *   - `severity` — visual accent on the dropdown item.
 *   - `nameFallback` + `descriptionFallback` — English fallback strings so
 *     the picker never shows a raw translation key mid-load.
 *   - `impressionKey` + `impressionFallback` — canonical clinician-voiced
 *     prose that is auto-applied to the Impression textarea.
 *   - `sonographerCommentsKey?` + `sonographerCommentsFallback?` — standard
 *     sonographer protocol boilerplate that seeds the Sonographer Comments
 *     textarea for the relevant scan protocol class.
 *   - AP diameters (`apDiameterMm`) on DVT / chronic templates so the caliper
 *     column populates with clinically representative values (IAC typical).
 *   - Recommendations carry `textKey` so they localize with the UI; `text`
 *     remains the persisted English fallback.
 *
 * IDs are stable and safe to persist (used as React keys, could later be
 * referenced from saved drafts). Custom templates use the `custom-` prefix.
 *
 * AP diameter defaults — source:
 *   IAC Vascular Testing Standards + typical acute-DVT presentation
 *   (CFV 12–15 mm dilated vs ~9 mm normal; FV 9–11 mm; POP 7–10 mm).
 *   Chronic post-thrombotic veins are non-dilated / mildly contracted.
 *   Clinicians can edit per-case — these are presentation defaults.
 */

import type { CeapClassification } from '../../../types/ceap';
import type { Recommendation } from '../../../types/form';
import type { Side } from '../../../types/study';
import {
  VENOUS_LE_SEGMENTS,
  type VenousLEFullSegmentId,
  type VenousLESegmentBase,
  type VenousSegmentFinding,
  type VenousSegmentFindings,
} from './config';

// ---------------------------------------------------------------------------
// Template shape
// ---------------------------------------------------------------------------

/** Clinical scope a template targets. */
export type TemplateScope = 'right' | 'left' | 'bilateral';

/** High-level classification shown as a group heading in the picker. */
export type TemplateKind = 'normal' | 'acute' | 'chronic' | 'post-procedure';

/** Visual accent on the picker row — drives icon + subtle color tint. */
export type TemplateSeverity = 'critical' | 'urgent' | 'routine' | 'informational';

export interface VenousLETemplate {
  readonly id: string;
  readonly nameKey: string;
  /** English fallback for the name — rendered if the key is missing. */
  readonly nameFallback: string;
  readonly descriptionKey: string;
  /** English fallback for the description. */
  readonly descriptionFallback: string;
  readonly kind: TemplateKind;
  readonly scope: TemplateScope;
  readonly severity: TemplateSeverity;
  readonly findings: VenousSegmentFindings;
  readonly ceap?: CeapClassification;
  readonly recommendations?: ReadonlyArray<Recommendation>;
  /** Translation key for the canonical impression prose. */
  readonly impressionKey: string;
  /** English fallback for the canonical impression. */
  readonly impressionFallback: string;
  /** Optional translation key for the sonographer protocol boilerplate. */
  readonly sonographerCommentsKey?: string;
  /** English fallback for the sonographer boilerplate. */
  readonly sonographerCommentsFallback?: string;
  /** Schema version for forward-compat safety. */
  readonly schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Finding-map builders
// ---------------------------------------------------------------------------

/** A "normal" (fully negative) DVT-rule-out finding shape. */
const NORMAL_FINDING: VenousSegmentFinding = Object.freeze({
  compressibility: 'normal',
  thrombosis: 'none',
  spontaneity: 'normal',
  phasicity: 'normal',
  augmentation: 'normal',
});

/** An "acute occlusive DVT" finding shape. */
const ACUTE_DVT_FINDING: VenousSegmentFinding = Object.freeze({
  compressibility: 'non-compressible',
  thrombosis: 'acute',
  spontaneity: 'absent',
  phasicity: 'absent',
  augmentation: 'absent',
});

/** A "chronic post-thrombotic" finding shape. */
const CHRONIC_POST_THROMBOTIC_FINDING: VenousSegmentFinding = Object.freeze({
  compressibility: 'partial',
  thrombosis: 'chronic',
  spontaneity: 'reduced',
  phasicity: 'continuous',
  augmentation: 'reduced',
});

function sidesForScope(scope: TemplateScope): ReadonlyArray<Side> {
  return scope === 'bilateral' ? ['left', 'right'] : [scope];
}

/** Fill every segment × side(s) with `NORMAL_FINDING`. */
function allNormalMap(scope: TemplateScope): VenousSegmentFindings {
  const out: Record<string, VenousSegmentFinding> = {};
  for (const base of VENOUS_LE_SEGMENTS) {
    for (const side of sidesForScope(scope)) {
      const fullId = `${base}-${side}` as VenousLEFullSegmentId;
      out[fullId] = { ...NORMAL_FINDING };
    }
  }
  return out as VenousSegmentFindings;
}

/** Build a finding map from a base → finding map, limited to the given sides. */
function findingMap(
  entries: ReadonlyArray<readonly [VenousLESegmentBase, VenousSegmentFinding]>,
  sides: ReadonlyArray<Side>,
): VenousSegmentFindings {
  const out: Record<string, VenousSegmentFinding> = {};
  for (const [base, finding] of entries) {
    for (const side of sides) {
      const fullId = `${base}-${side}` as VenousLEFullSegmentId;
      out[fullId] = { ...finding };
    }
  }
  return out as VenousSegmentFindings;
}

/** Merge two finding maps (later overrides earlier). */
function mergeFindings(
  ...maps: ReadonlyArray<VenousSegmentFindings>
): VenousSegmentFindings {
  const out: Record<string, VenousSegmentFinding> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out as VenousSegmentFindings;
}

/**
 * Overlay AP diameter (and optionally depth) onto an already-built findings
 * map. Only touches segments that already exist in `findings`.
 */
function withDiameters(
  findings: VenousSegmentFindings,
  diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]>,
): VenousSegmentFindings {
  const out: Record<string, VenousSegmentFinding> = {
    ...(findings as Record<string, VenousSegmentFinding>),
  };
  for (const [id, apDiameterMm] of diameters) {
    const prev = out[id];
    if (prev) {
      out[id] = { ...prev, apDiameterMm };
    }
  }
  return out as VenousSegmentFindings;
}

// ---------------------------------------------------------------------------
// Template payload builders (per case)
// ---------------------------------------------------------------------------

/** Acute femoropopliteal DVT on one side: CFV + FV-(prox/mid/dist) + POP (all three). */
function acuteDvtFemoropoplitealFindings(side: Side): VenousSegmentFindings {
  const abnormalBases: ReadonlyArray<VenousLESegmentBase> = [
    'cfv',
    'fv-prox',
    'fv-mid',
    'fv-dist',
    'pop-ak',
    'pop-fossa',
    'pop-bk',
  ];
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !abnormalBases.includes(b),
  );
  const abnormal = findingMap(
    abnormalBases.map((b) => [b, ACUTE_DVT_FINDING] as const),
    [side],
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    [side],
  );
  // Dilated-caliper AP diameters for acute DVT (IAC typical values).
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    [`cfv-${side}` as VenousLEFullSegmentId, 13],
    [`fv-prox-${side}` as VenousLEFullSegmentId, 10],
    [`fv-mid-${side}` as VenousLEFullSegmentId, 9],
    [`fv-dist-${side}` as VenousLEFullSegmentId, 8],
    [`pop-ak-${side}` as VenousLEFullSegmentId, 8],
    [`pop-fossa-${side}` as VenousLEFullSegmentId, 9],
    [`pop-bk-${side}` as VenousLEFullSegmentId, 7],
  ];
  return withDiameters(mergeFindings(normal, abnormal), diameters);
}

/** Acute iliofemoral DVT on one side (EIV + CFV + FV-prox + FV-mid). */
function acuteDvtIliofemoralFindings(side: Side): VenousSegmentFindings {
  const abnormalBases: ReadonlyArray<VenousLESegmentBase> = [
    'eiv',
    'cfv',
    'fv-prox',
    'fv-mid',
  ];
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !abnormalBases.includes(b),
  );
  const abnormal = findingMap(
    abnormalBases.map((b) => [b, ACUTE_DVT_FINDING] as const),
    [side],
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    [side],
  );
  // Markedly dilated iliofemoral calibers.
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    [`eiv-${side}` as VenousLEFullSegmentId, 16],
    [`cfv-${side}` as VenousLEFullSegmentId, 15],
    [`fv-prox-${side}` as VenousLEFullSegmentId, 12],
    [`fv-mid-${side}` as VenousLEFullSegmentId, 10],
  ];
  return withDiameters(mergeFindings(normal, abnormal), diameters);
}

/** Acute isolated calf DVT (PTV + peroneal + gastroc + soleal). */
function acuteDvtCalfFindings(side: Side): VenousSegmentFindings {
  const abnormalBases: ReadonlyArray<VenousLESegmentBase> = [
    'ptv',
    'per',
    'gastroc',
    'soleal',
  ];
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !abnormalBases.includes(b),
  );
  const abnormal = findingMap(
    abnormalBases.map((b) => [b, ACUTE_DVT_FINDING] as const),
    [side],
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    [side],
  );
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    [`ptv-${side}` as VenousLEFullSegmentId, 5],
    [`per-${side}` as VenousLEFullSegmentId, 4],
    [`gastroc-${side}` as VenousLEFullSegmentId, 5],
    [`soleal-${side}` as VenousLEFullSegmentId, 5],
  ];
  return withDiameters(mergeFindings(normal, abnormal), diameters);
}

/** Chronic post-thrombotic (right): CFV + FV-prox/mid/dist partial compressibility. */
function chronicPostThromboticRightFindings(): VenousSegmentFindings {
  const abnormalBases: ReadonlyArray<VenousLESegmentBase> = [
    'cfv',
    'fv-prox',
    'fv-mid',
    'fv-dist',
  ];
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !abnormalBases.includes(b),
  );
  const abnormal = findingMap(
    abnormalBases.map((b) => [b, CHRONIC_POST_THROMBOTIC_FINDING] as const),
    ['right'],
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    ['right'],
  );
  // Non-dilated / mildly contracted calibers (wall scarring).
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    ['cfv-right' as VenousLEFullSegmentId, 8],
    ['fv-prox-right' as VenousLEFullSegmentId, 7],
    ['fv-mid-right' as VenousLEFullSegmentId, 6],
    ['fv-dist-right' as VenousLEFullSegmentId, 6],
  ];
  return withDiameters(mergeFindings(normal, abnormal), diameters);
}

/**
 * Chronic GSV reflux (bilateral): GSV above-knee + proximal calf + mid calf
 * show > 1000 ms reflux; SFJ forced incompetent via competencyOverride.
 * Deep veins stay compressible with normal flow.
 */
function chronicGsvRefluxBilateralFindings(): VenousSegmentFindings {
  const refluxBases: ReadonlyArray<VenousLESegmentBase> = [
    'gsv-ak',
    'gsv-prox-calf',
    'gsv-mid-calf',
  ];
  const refluxFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    spontaneity: 'normal',
    phasicity: 'normal',
    augmentation: 'normal',
    refluxDurationMs: 1500,
  };
  const sfjFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    spontaneity: 'normal',
    phasicity: 'normal',
    augmentation: 'normal',
    competencyOverride: 'incompetent',
  };
  const handledBases = new Set<VenousLESegmentBase>([
    ...refluxBases,
    'sfj',
  ]);
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !handledBases.has(b),
  );
  const sides: ReadonlyArray<Side> = ['left', 'right'];
  const reflux = findingMap(
    refluxBases.map((b) => [b, refluxFinding] as const),
    sides,
  );
  const sfj = findingMap([['sfj', sfjFinding]], sides);
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    sides,
  );
  // Dilated varicose calibers.
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    ['gsv-ak-left' as VenousLEFullSegmentId, 6.5],
    ['gsv-ak-right' as VenousLEFullSegmentId, 6.5],
    ['gsv-prox-calf-left' as VenousLEFullSegmentId, 5.5],
    ['gsv-prox-calf-right' as VenousLEFullSegmentId, 5.5],
    ['gsv-mid-calf-left' as VenousLEFullSegmentId, 4.5],
    ['gsv-mid-calf-right' as VenousLEFullSegmentId, 4.5],
  ];
  return withDiameters(mergeFindings(normal, reflux, sfj), diameters);
}

/** Chronic SSV reflux (right): SSV reflux > 500 ms, SPJ incompetent. */
function chronicSsvRefluxRightFindings(): VenousSegmentFindings {
  const ssvFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    spontaneity: 'normal',
    phasicity: 'normal',
    augmentation: 'normal',
    refluxDurationMs: 800,
  };
  const spjFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    spontaneity: 'normal',
    phasicity: 'normal',
    augmentation: 'normal',
    competencyOverride: 'incompetent',
  };
  const handledBases = new Set<VenousLESegmentBase>(['ssv', 'spj']);
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !handledBases.has(b),
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    ['right'],
  );
  const ssv = findingMap([['ssv', ssvFinding]], ['right']);
  const spj = findingMap([['spj', spjFinding]], ['right']);
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    ['ssv-right' as VenousLEFullSegmentId, 4.5],
  ];
  return withDiameters(mergeFindings(normal, ssv, spj), diameters);
}

/**
 * Acute superficial venous thrombophlebitis of GSV (right):
 * GSV-AK + proximal calf = partial compressibility + acute thrombus.
 * SFJ marked incompetent to flag the proximity concern on the diagram.
 */
function svtGsvRightFindings(): VenousSegmentFindings {
  const svtFinding: VenousSegmentFinding = {
    compressibility: 'partial',
    thrombosis: 'acute',
    spontaneity: 'absent',
    phasicity: 'absent',
    augmentation: 'absent',
  };
  const sfjFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    spontaneity: 'normal',
    phasicity: 'normal',
    augmentation: 'normal',
    competencyOverride: 'incompetent',
  };
  const svtBases: ReadonlyArray<VenousLESegmentBase> = ['gsv-ak', 'gsv-prox-calf'];
  const handled = new Set<VenousLESegmentBase>([...svtBases, 'sfj']);
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !handled.has(b),
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    ['right'],
  );
  const svt = findingMap(
    svtBases.map((b) => [b, svtFinding] as const),
    ['right'],
  );
  const sfj = findingMap([['sfj', sfjFinding]], ['right']);
  const diameters: ReadonlyArray<readonly [VenousLEFullSegmentId, number]> = [
    ['gsv-ak-right' as VenousLEFullSegmentId, 6],
    ['gsv-prox-calf-right' as VenousLEFullSegmentId, 5],
  ];
  return withDiameters(mergeFindings(normal, svt, sfj), diameters);
}

/** Post-ablation GSV (right): GSV AK + calves marked ablated via override. */
function postAblationGsvRightFindings(): VenousSegmentFindings {
  const ablatedBases: ReadonlyArray<VenousLESegmentBase> = [
    'gsv-ak',
    'gsv-prox-calf',
    'gsv-mid-calf',
    'gsv-dist-calf',
  ];
  const ablatedFinding: VenousSegmentFinding = {
    compressibility: 'normal',
    thrombosis: 'none',
    competencyOverride: 'ablated',
  };
  const normalBases: ReadonlyArray<VenousLESegmentBase> = VENOUS_LE_SEGMENTS.filter(
    (b) => !ablatedBases.includes(b),
  );
  const ablated = findingMap(
    ablatedBases.map((b) => [b, ablatedFinding] as const),
    ['right'],
  );
  const normal = findingMap(
    normalBases.map((b) => [b, NORMAL_FINDING] as const),
    ['right'],
  );
  return mergeFindings(normal, ablated);
}

// ---------------------------------------------------------------------------
// Sonographer-protocol note keys (six protocol classes)
// ---------------------------------------------------------------------------

const SONO_DVT_RULEOUT = {
  key: 'venousLE.templates.sonographerProtocol.dvtRuleOut',
  fallback:
    'Bilateral venous duplex protocol per IAC standards. Compression evaluation every 2 cm from common femoral through tibial and peroneal veins. Colour and spectral Doppler assessment of spontaneity, phasicity, and augmentation. Patient supine with reverse Trendelenburg tilt.',
};

const SONO_IFDVT = {
  key: 'venousLE.templates.sonographerProtocol.iliofemoralDvt',
  fallback:
    'Iliofemoral DVT protocol: extended proximal imaging through the common femoral into the external and common iliac veins. Documented compressibility, spectral Doppler respiratory phasicity, and caliper measurements from iliac through mid-femoral segments. Contralateral screening for May-Thurner pattern.',
};

const SONO_CALF_DVT = {
  key: 'venousLE.templates.sonographerProtocol.calfDvt',
  fallback:
    'Calf-targeted DVT protocol with transverse compression of paired tibial and peroneal veins every 1–2 cm, plus gastrocnemius and soleal muscular branches. Colour Doppler augmentation applied to confirm patency where compression is technically limited.',
};

const SONO_CHRONIC_REFLUX = {
  key: 'venousLE.templates.sonographerProtocol.chronicReflux',
  fallback:
    'Chronic venous insufficiency protocol: reverse Trendelenburg / standing position for reflux. Distal manual augmentation or pneumatic cuff release. Reflux duration measured at SFJ, SPJ, and mid-segments per ESVS 2022 — pathological threshold > 500 ms superficial / > 1000 ms deep.',
};

const SONO_ACUTE_SVT = {
  key: 'venousLE.templates.sonographerProtocol.acuteSvt',
  fallback:
    'Acute superficial venous thrombophlebitis protocol: B-mode measurement of thrombus extent along the great saphenous vein, with specific documentation of the distance from the most proximal thrombus to the saphenofemoral junction. Deep venous system screened in full to rule out extension.',
};

const SONO_POST_ABLATION = {
  key: 'venousLE.templates.sonographerProtocol.postAblation',
  fallback:
    'Post-endovenous-ablation follow-up protocol. Assessment of ablated GSV segments for occlusion (absent flow, echogenic lumen). SFJ stump inspected for endovenous heat-induced thrombosis (EHIT) per Kabnick classification. Deep venous system screened for thrombus extension.',
};

// ---------------------------------------------------------------------------
// Recommendation builders (guideline-cited, localized)
// ---------------------------------------------------------------------------

function rec(
  id: string,
  textKey: string,
  text: string,
  priority: 'routine' | 'urgent' | 'stat',
): Recommendation {
  return { id, textKey, text, priority };
}

// ---------------------------------------------------------------------------
// The 12 templates
// ---------------------------------------------------------------------------

const T_NORMAL_BILATERAL: VenousLETemplate = {
  id: 'normal-bilateral',
  nameKey: 'venousLE.templates.normalBilateral.name',
  nameFallback: 'Normal bilateral study',
  descriptionKey: 'venousLE.templates.normalBilateral.description',
  descriptionFallback: 'DVT rule-out confirmed normal on both legs.',
  kind: 'normal',
  scope: 'bilateral',
  severity: 'routine',
  findings: allNormalMap('bilateral'),
  impressionKey: 'venousLE.templates.normalBilateral.impression',
  impressionFallback:
    'Bilateral lower-extremity venous duplex examination is within normal limits. All deep and superficial venous segments are fully compressible with normal spontaneous, phasic, and augmented flow patterns. No evidence of acute or chronic deep vein thrombosis. No pathological reflux identified.',
  sonographerCommentsKey: SONO_DVT_RULEOUT.key,
  sonographerCommentsFallback: SONO_DVT_RULEOUT.fallback,
  schemaVersion: 1,
};

const T_NORMAL_RIGHT: VenousLETemplate = {
  id: 'normal-right',
  nameKey: 'venousLE.templates.normalRight.name',
  nameFallback: 'Normal right only',
  descriptionKey: 'venousLE.templates.normalRight.description',
  descriptionFallback: 'Unilateral right-leg study, all segments normal.',
  kind: 'normal',
  scope: 'right',
  severity: 'routine',
  findings: allNormalMap('right'),
  impressionKey: 'venousLE.templates.normalRight.impression',
  impressionFallback:
    'Right lower-extremity venous duplex examination is within normal limits. Deep and superficial venous segments are fully compressible with normal spontaneous, phasic, and augmented flow patterns. No evidence of acute or chronic deep vein thrombosis. No pathological reflux identified.',
  sonographerCommentsKey: SONO_DVT_RULEOUT.key,
  sonographerCommentsFallback: SONO_DVT_RULEOUT.fallback,
  schemaVersion: 1,
};

const T_NORMAL_LEFT: VenousLETemplate = {
  id: 'normal-left',
  nameKey: 'venousLE.templates.normalLeft.name',
  nameFallback: 'Normal left only',
  descriptionKey: 'venousLE.templates.normalLeft.description',
  descriptionFallback: 'Unilateral left-leg study, all segments normal.',
  kind: 'normal',
  scope: 'left',
  severity: 'routine',
  findings: allNormalMap('left'),
  impressionKey: 'venousLE.templates.normalLeft.impression',
  impressionFallback:
    'Left lower-extremity venous duplex examination is within normal limits. Deep and superficial venous segments are fully compressible with normal spontaneous, phasic, and augmented flow patterns. No evidence of acute or chronic deep vein thrombosis. No pathological reflux identified.',
  sonographerCommentsKey: SONO_DVT_RULEOUT.key,
  sonographerCommentsFallback: SONO_DVT_RULEOUT.fallback,
  schemaVersion: 1,
};

const T_ACUTE_DVT_RIGHT_FEMOROPOPLITEAL: VenousLETemplate = {
  id: 'acute-dvt-right-femoropopliteal',
  nameKey: 'venousLE.templates.acuteDvtRightFemoropopliteal.name',
  nameFallback: 'Acute DVT — right femoropopliteal',
  descriptionKey: 'venousLE.templates.acuteDvtRightFemoropopliteal.description',
  descriptionFallback: 'Occlusive thrombus from right CFV through popliteal.',
  kind: 'acute',
  scope: 'right',
  severity: 'critical',
  findings: acuteDvtFemoropoplitealFindings('right'),
  impressionKey: 'venousLE.templates.acuteDvtRightFemoropopliteal.impression',
  impressionFallback:
    'Acute occlusive deep vein thrombosis involving the right common femoral, femoral, and popliteal veins, consistent with femoropopliteal DVT. Segments are non-compressible with absent flow augmentation. Vein calipers are enlarged, supporting acute timing. The distal tibial and peroneal veins are patent with normal compressibility. Superficial venous system appears patent.',
  sonographerCommentsKey: SONO_DVT_RULEOUT.key,
  sonographerCommentsFallback: SONO_DVT_RULEOUT.fallback,
  recommendations: [
    rec(
      'rec-acute-dvt-right-femoropop',
      'venousLE.templates.recommendations.acuteDvtRightFemoropopliteal',
      'Initiate therapeutic anticoagulation per CHEST 2021 guidelines (DOAC first-line in absence of contraindications). Confirm hospital bridge if applicable. Repeat venous duplex at 3 months to assess resolution and residual thrombus.',
      'urgent',
    ),
  ],
  schemaVersion: 1,
};

const T_ACUTE_DVT_LEFT_FEMOROPOPLITEAL: VenousLETemplate = {
  id: 'acute-dvt-left-femoropopliteal',
  nameKey: 'venousLE.templates.acuteDvtLeftFemoropopliteal.name',
  nameFallback: 'Acute DVT — left femoropopliteal',
  descriptionKey: 'venousLE.templates.acuteDvtLeftFemoropopliteal.description',
  descriptionFallback: 'Occlusive thrombus from left CFV through popliteal.',
  kind: 'acute',
  scope: 'left',
  severity: 'critical',
  findings: acuteDvtFemoropoplitealFindings('left'),
  impressionKey: 'venousLE.templates.acuteDvtLeftFemoropopliteal.impression',
  impressionFallback:
    'Acute occlusive deep vein thrombosis involving the left common femoral, femoral, and popliteal veins, consistent with femoropopliteal DVT. Segments are non-compressible with absent flow augmentation. Vein calipers are enlarged, supporting acute timing. The distal tibial and peroneal veins are patent with normal compressibility. Superficial venous system appears patent.',
  sonographerCommentsKey: SONO_DVT_RULEOUT.key,
  sonographerCommentsFallback: SONO_DVT_RULEOUT.fallback,
  recommendations: [
    rec(
      'rec-acute-dvt-left-femoropop',
      'venousLE.templates.recommendations.acuteDvtLeftFemoropopliteal',
      'Initiate therapeutic anticoagulation per CHEST 2021 guidelines (DOAC first-line in absence of contraindications). Confirm hospital bridge if applicable. Repeat venous duplex at 3 months to assess resolution and residual thrombus.',
      'urgent',
    ),
  ],
  schemaVersion: 1,
};

const T_ACUTE_DVT_LEFT_ILIOFEMORAL: VenousLETemplate = {
  id: 'acute-dvt-left-iliofemoral',
  nameKey: 'venousLE.templates.acuteDvtLeftIliofemoral.name',
  nameFallback: 'Acute iliofemoral DVT — left',
  descriptionKey: 'venousLE.templates.acuteDvtLeftIliofemoral.description',
  descriptionFallback: 'Extensive thrombus from left EIV through mid-FV; May-Thurner workup.',
  kind: 'acute',
  scope: 'left',
  severity: 'critical',
  findings: acuteDvtIliofemoralFindings('left'),
  impressionKey: 'venousLE.templates.acuteDvtLeftIliofemoral.impression',
  impressionFallback:
    'Acute iliofemoral deep vein thrombosis. Non-compressible segments with absent phasicity and augmentation extending from the external iliac vein through the mid-femoral vein of the left lower extremity. Markedly dilated venous calipers. Distribution raises suspicion for May-Thurner syndrome — recommend cross-sectional imaging of the iliac venous outflow. Distal femoral, popliteal, and calf veins are patent.',
  sonographerCommentsKey: SONO_IFDVT.key,
  sonographerCommentsFallback: SONO_IFDVT.fallback,
  recommendations: [
    rec(
      'rec-acute-iliofemoral-dvt-left',
      'venousLE.templates.recommendations.acuteDvtLeftIliofemoral',
      'Urgent vascular surgery consultation. Consider catheter-directed thrombolysis or pharmacomechanical thrombectomy for acute iliofemoral DVT per ATTRACT subgroup analysis. Screen for May-Thurner syndrome with CT or MR venography. IVC filter if anticoagulation contraindicated. Initiate therapeutic anticoagulation immediately.',
      'stat',
    ),
  ],
  schemaVersion: 1,
};

const T_ACUTE_DVT_RIGHT_CALF: VenousLETemplate = {
  id: 'acute-dvt-right-calf',
  nameKey: 'venousLE.templates.acuteDvtRightCalf.name',
  nameFallback: 'Isolated calf DVT — right',
  descriptionKey: 'venousLE.templates.acuteDvtRightCalf.description',
  descriptionFallback: 'Right PTV + peroneal + gastroc + soleal acute thrombosis.',
  kind: 'acute',
  scope: 'right',
  severity: 'urgent',
  findings: acuteDvtCalfFindings('right'),
  impressionKey: 'venousLE.templates.acuteDvtRightCalf.impression',
  impressionFallback:
    'Acute isolated calf deep vein thrombosis involving the right posterior tibial and peroneal veins, with extension into the gastrocnemius and soleal muscular venous branches. Proximal deep venous system (common femoral, femoral, popliteal) is fully patent. Superficial venous system is patent.',
  sonographerCommentsKey: SONO_CALF_DVT.key,
  sonographerCommentsFallback: SONO_CALF_DVT.fallback,
  recommendations: [
    rec(
      'rec-acute-calf-dvt-right',
      'venousLE.templates.recommendations.acuteDvtRightCalf',
      'Per CHEST 2021 isolated distal (calf) DVT guidance: in a patient with severe symptoms or risk factors for proximal extension, initiate therapeutic anticoagulation for 3 months. Otherwise consider serial duplex surveillance at 1–2 weeks to rule out proximal extension. Evaluate for underlying provocative factors.',
      'urgent',
    ),
  ],
  schemaVersion: 1,
};

const T_CHRONIC_POST_THROMBOTIC_RIGHT: VenousLETemplate = {
  id: 'chronic-post-thrombotic-right',
  nameKey: 'venousLE.templates.chronicPostThromboticRight.name',
  nameFallback: 'Post-thrombotic — right',
  descriptionKey: 'venousLE.templates.chronicPostThromboticRight.description',
  descriptionFallback:
    'Partial compressibility with chronic changes in right deep system. CEAP C3.',
  kind: 'chronic',
  scope: 'right',
  severity: 'routine',
  findings: chronicPostThromboticRightFindings(),
  ceap: {
    c: 'C3',
    e: 'Es',
    a: 'Ad',
    p: 'Pr',
    modifiers: ['s'],
  },
  impressionKey: 'venousLE.templates.chronicPostThromboticRight.impression',
  impressionFallback:
    'Chronic post-thrombotic changes of the right femoral venous system. Non-dilated, partially compressible segments with echogenic adherent thrombus remnants and reduced spontaneous phasicity. Findings consistent with prior deep vein thrombosis, now chronic. Secondary deep venous insufficiency with combined reflux and obstructive physiology. CEAP C3s Es Ad Pr,o.',
  sonographerCommentsKey: SONO_CHRONIC_REFLUX.key,
  sonographerCommentsFallback: SONO_CHRONIC_REFLUX.fallback,
  recommendations: [
    rec(
      'rec-chronic-post-thrombotic-right',
      'venousLE.templates.recommendations.chronicPostThromboticRight',
      'Graduated elastic compression stockings (30–40 mmHg) daily for post-thrombotic syndrome management. Evaluate for venous ulceration at follow-up. Consider venography or IVUS if stenting of iliac outflow is being considered per ESVS 2022.',
      'routine',
    ),
  ],
  schemaVersion: 1,
};

const T_CHRONIC_GSV_REFLUX_BILATERAL: VenousLETemplate = {
  id: 'chronic-gsv-reflux-bilateral',
  nameKey: 'venousLE.templates.chronicGsvRefluxBilateral.name',
  nameFallback: 'GSV reflux — bilateral (CEAP C2)',
  descriptionKey: 'venousLE.templates.chronicGsvRefluxBilateral.description',
  descriptionFallback: 'Bilateral great saphenous reflux with incompetent SFJ.',
  kind: 'chronic',
  scope: 'bilateral',
  severity: 'routine',
  findings: chronicGsvRefluxBilateralFindings(),
  ceap: {
    c: 'C2',
    e: 'Ep',
    a: 'As',
    p: 'Pr',
  },
  impressionKey: 'venousLE.templates.chronicGsvRefluxBilateral.impression',
  impressionFallback:
    'Bilateral primary superficial venous reflux involving the great saphenous vein (above-knee and proximal calf segments) and the saphenofemoral junctions. Reflux duration exceeds 1000 ms in all involved segments. Deep venous system is patent with normal compressibility and no evidence of deep reflux. CEAP C2 Ep As Pr — varicose veins of primary etiology, superficial anatomic distribution, reflux pathophysiology.',
  sonographerCommentsKey: SONO_CHRONIC_REFLUX.key,
  sonographerCommentsFallback: SONO_CHRONIC_REFLUX.fallback,
  recommendations: [
    rec(
      'rec-chronic-gsv-ablation',
      'venousLE.templates.recommendations.chronicGsvRefluxBilateral',
      'Endovenous ablation (EVLA or RFA) is indicated for symptomatic GSV reflux per ESVS 2022 (Level Ia evidence). Ambulatory phlebectomy for tributary varicosities. Compression therapy (class II, 20–30 mmHg) as bridge therapy.',
      'routine',
    ),
  ],
  schemaVersion: 1,
};

const T_CHRONIC_SSV_REFLUX_RIGHT: VenousLETemplate = {
  id: 'chronic-ssv-reflux-right',
  nameKey: 'venousLE.templates.chronicSsvRefluxRight.name',
  nameFallback: 'SSV reflux — right (CEAP C2)',
  descriptionKey: 'venousLE.templates.chronicSsvRefluxRight.description',
  descriptionFallback: 'Right small saphenous reflux with incompetent SPJ.',
  kind: 'chronic',
  scope: 'right',
  severity: 'routine',
  findings: chronicSsvRefluxRightFindings(),
  ceap: {
    c: 'C2',
    e: 'Ep',
    a: 'As',
    p: 'Pr',
  },
  impressionKey: 'venousLE.templates.chronicSsvRefluxRight.impression',
  impressionFallback:
    'Primary superficial venous reflux involving the right small saphenous vein and saphenopopliteal junction. Reflux duration exceeds 500 ms in the SSV, consistent with pathological reflux distributed along the posterior calf. Deep venous system is patent with normal compressibility and no evidence of deep reflux. CEAP C2 Ep As Pr.',
  sonographerCommentsKey: SONO_CHRONIC_REFLUX.key,
  sonographerCommentsFallback: SONO_CHRONIC_REFLUX.fallback,
  recommendations: [
    rec(
      'rec-chronic-ssv-right',
      'venousLE.templates.recommendations.chronicSsvRefluxRight',
      'Endovenous ablation of the small saphenous vein is appropriate for symptomatic SSV reflux per ESVS 2022. Careful pre-operative mapping of the SPJ and saphenopopliteal anatomy to reduce risk of sural nerve injury. Compression therapy as bridge to definitive treatment.',
      'routine',
    ),
  ],
  schemaVersion: 1,
};

const T_SVT_GSV_RIGHT: VenousLETemplate = {
  id: 'svt-gsv-right',
  nameKey: 'venousLE.templates.svtGsvRight.name',
  nameFallback: 'SVT — GSV right (acute)',
  descriptionKey: 'venousLE.templates.svtGsvRight.description',
  descriptionFallback: 'Acute superficial thrombophlebitis of right GSV — SFJ-proximity check.',
  kind: 'acute',
  scope: 'right',
  severity: 'urgent',
  findings: svtGsvRightFindings(),
  impressionKey: 'venousLE.templates.svtGsvRight.impression',
  impressionFallback:
    'Acute superficial venous thrombophlebitis of the right great saphenous vein, involving the above-knee and proximal calf segments. Non-compressible superficial thrombus extending toward the saphenofemoral junction — document distance from SFJ for management decision. Deep venous system is patent; no evidence of deep extension.',
  sonographerCommentsKey: SONO_ACUTE_SVT.key,
  sonographerCommentsFallback: SONO_ACUTE_SVT.fallback,
  recommendations: [
    rec(
      'rec-svt-gsv-right',
      'venousLE.templates.recommendations.svtGsvRight',
      'If thrombus extends within 3 cm of the saphenofemoral junction, treat as DVT-equivalent with therapeutic anticoagulation. If > 3 cm from SFJ, prophylactic fondaparinux 2.5 mg daily × 45 days per SURPRISE trial. NSAIDs for symptom relief. Ambulation encouraged. Follow-up duplex in 7–10 days to confirm no deep extension.',
      'urgent',
    ),
  ],
  schemaVersion: 1,
};

const T_POST_ABLATION_GSV_RIGHT: VenousLETemplate = {
  id: 'post-ablation-gsv-right',
  nameKey: 'venousLE.templates.postAblationGsvRight.name',
  nameFallback: 'GSV post-ablation — right',
  descriptionKey: 'venousLE.templates.postAblationGsvRight.description',
  descriptionFallback: 'Right GSV segments marked ablated post-EVLA/RFA.',
  kind: 'post-procedure',
  scope: 'right',
  severity: 'informational',
  findings: postAblationGsvRightFindings(),
  impressionKey: 'venousLE.templates.postAblationGsvRight.impression',
  impressionFallback:
    'Status post endovenous ablation of the right great saphenous vein. Ablated GSV segments from above-knee through distal calf demonstrate no flow, consistent with successful occlusion. Saphenofemoral junction stump is patent. Deep venous system is patent with normal compressibility and flow. Small saphenous vein is patent.',
  sonographerCommentsKey: SONO_POST_ABLATION.key,
  sonographerCommentsFallback: SONO_POST_ABLATION.fallback,
  recommendations: [
    rec(
      'rec-post-ablation-gsv-right',
      'venousLE.templates.recommendations.postAblationGsvRight',
      'Continue compression therapy (class II) × 2 weeks post-procedure. Return-to-duplex in 1 month to confirm durable occlusion and exclude endovenous heat-induced thrombosis (EHIT) classes II–IV per Kabnick classification.',
      'routine',
    ),
  ],
  schemaVersion: 1,
};

/** All shipped Venous LE built-in clinical templates (12 total). */
export const VENOUS_LE_TEMPLATES: ReadonlyArray<VenousLETemplate> = [
  // Normal (3)
  T_NORMAL_BILATERAL,
  T_NORMAL_RIGHT,
  T_NORMAL_LEFT,
  // Acute DVT (4 — includes SVT, which is urgent acute)
  T_ACUTE_DVT_RIGHT_FEMOROPOPLITEAL,
  T_ACUTE_DVT_LEFT_FEMOROPOPLITEAL,
  T_ACUTE_DVT_LEFT_ILIOFEMORAL,
  T_ACUTE_DVT_RIGHT_CALF,
  T_SVT_GSV_RIGHT,
  // Chronic (3)
  T_CHRONIC_POST_THROMBOTIC_RIGHT,
  T_CHRONIC_GSV_REFLUX_BILATERAL,
  T_CHRONIC_SSV_REFLUX_RIGHT,
  // Post-procedure (1)
  T_POST_ABLATION_GSV_RIGHT,
];

/** Look up a built-in template by its stable id. */
export function findTemplateById(id: string): VenousLETemplate | undefined {
  return VENOUS_LE_TEMPLATES.find((t) => t.id === id);
}
