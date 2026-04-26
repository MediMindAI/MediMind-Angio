// SPDX-License-Identifier: Apache-2.0
/**
 * Arterial LE Duplex — Pre-seeded clinical templates.
 *
 * 9 medically-reviewed templates covering the common clinical scenarios a
 * vascular lab reports daily: normal, mild/moderate/severe SFA disease,
 * CLI with tissue loss, aortoiliac inflow disease, post-bypass/stent
 * surveillance, and diabetic non-compressible presentation.
 *
 * Each template snapshots: findings map, segmental pressures, impression
 * prose, recommendations (guideline-cited).
 */

import type { Recommendation } from '../../../types/form';
import type { Side } from '../../../types/study';
import type {
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  SegmentalPressures,
} from './config';
import {
  ARTERIAL_NORMAL_FINDING,
  ARTERIAL_OCCLUSION_FINDING,
} from './config';

export type ArterialTemplateKind =
  | 'normal'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'critical'
  | 'post-procedure';

export type ArterialTemplateScope = 'bilateral' | 'left' | 'right';
export type ArterialTemplateSeverity =
  | 'routine'
  | 'urgent'
  | 'critical'
  | 'informational';

export interface ArterialLETemplate {
  readonly id: string;
  readonly nameKey: string;
  readonly nameFallback: string;
  readonly descriptionKey: string;
  readonly descriptionFallback: string;
  readonly kind: ArterialTemplateKind;
  readonly scope: ArterialTemplateScope;
  readonly severity: ArterialTemplateSeverity;
  readonly findings: ArterialSegmentFindings;
  readonly pressures: SegmentalPressures;
  readonly impressionKey: string;
  readonly impressionFallback: string;
  readonly sonographerCommentsKey?: string;
  readonly sonographerCommentsFallback?: string;
  readonly recommendations?: ReadonlyArray<Recommendation>;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const SIDES: ReadonlyArray<Side> = ['left', 'right'];

function fillAll(
  finding: ArterialSegmentFinding,
  sides: ReadonlyArray<Side> = SIDES,
): ArterialSegmentFindings {
  const out: Record<string, ArterialSegmentFinding> = {};
  for (const base of [
    'cia', 'eia', 'cfa', 'pfa',
    'sfa-prox', 'sfa-mid', 'sfa-dist',
    'pop-ak', 'pop-bk', 'tpt', 'ata', 'pta', 'per', 'dp',
  ] as const) {
    for (const side of sides) {
      // Wave 3.7 (Part 03 HIGH) — clone per slot so each slot owns its own
      // finding object. Sharing the seed reference across 28+ slots was an
      // in-place mutation away from cross-slot corruption.
      out[`${base}-${side}`] = { ...finding };
    }
  }
  return out as ArterialSegmentFindings;
}

function patch(
  base: ArterialSegmentFindings,
  overrides: Readonly<Record<string, ArterialSegmentFinding>>,
): ArterialSegmentFindings {
  return { ...base, ...overrides } as ArterialSegmentFindings;
}

const NORMAL_PRESSURES_BILATERAL: SegmentalPressures = {
  brachialL: 130,
  brachialR: 130,
  highThighL: 150,
  highThighR: 150,
  lowThighL: 145,
  lowThighR: 145,
  calfL: 145,
  calfR: 145,
  ankleDpL: 140,
  ankleDpR: 140,
  anklePtL: 140,
  anklePtR: 140,
  toeL: 110,
  toeR: 110,
};

// ---------------------------------------------------------------------------
// 9 templates
// ---------------------------------------------------------------------------

export const ARTERIAL_LE_TEMPLATES: ReadonlyArray<ArterialLETemplate> = [
  // 1. Normal bilateral
  {
    id: 'arterial-normal-bilateral',
    nameKey: 'arterialLE.templates.normalBilateral.name',
    nameFallback: 'Normal bilateral',
    descriptionKey: 'arterialLE.templates.normalBilateral.description',
    descriptionFallback: 'All segments triphasic, no plaque, ABI normal bilaterally.',
    kind: 'normal',
    scope: 'bilateral',
    severity: 'routine',
    findings: fillAll(ARTERIAL_NORMAL_FINDING),
    pressures: NORMAL_PRESSURES_BILATERAL,
    impressionKey: 'arterialLE.templates.normalBilateral.impression',
    impressionFallback:
      'Normal bilateral lower-extremity arterial duplex examination. All segments demonstrate triphasic flow with normal peak systolic velocities. Ankle-Brachial Index is within normal limits bilaterally (R: 1.08, L: 1.08). No hemodynamically significant stenosis or occlusion. No atherosclerotic plaque identified.',
  },

  // 2. Mild SFA disease right
  {
    id: 'arterial-mild-sfa-right',
    nameKey: 'arterialLE.templates.mildSfaRight.name',
    nameFallback: 'Mild SFA disease (right)',
    descriptionKey: 'arterialLE.templates.mildSfaRight.description',
    descriptionFallback: 'Focal <50% stenosis right SFA-mid, ABI 0.92.',
    kind: 'mild',
    scope: 'right',
    severity: 'routine',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'sfa-mid-right': {
        waveform: 'biphasic',
        psvCmS: 180,
        stenosisCategory: 'mild',
        stenosisPct: 40,
        plaqueMorphology: 'soft',
        plaqueLengthMm: 15,
      },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpR: 120,
      anklePtR: 118,
      toeR: 95,
    },
    impressionKey: 'arterialLE.templates.mildSfaRight.impression',
    impressionFallback:
      'Mild atherosclerotic disease of the right superficial femoral artery, mid segment. Focal biphasic waveform with PSV elevation (180 cm/s) suggests <50% stenosis. Right ABI 0.92 — at the lower limit of normal, consistent with hemodynamically non-significant disease. Normal left lower extremity arterial tree.',
    recommendations: [
      {
        id: 'mild-sfa-risk',
        textKey: 'arterialLE.rec.mildSfaRisk',
        text: 'Atherosclerotic risk-factor modification — statin, antiplatelet, BP/diabetes/smoking control per ESVS 2024. Supervised exercise therapy if symptomatic. Repeat surveillance duplex in 12 months.',
        priority: 'routine',
      },
    ],
  },

  // 3. Moderate claudication right SFA
  {
    id: 'arterial-moderate-claudication-right-sfa',
    nameKey: 'arterialLE.templates.moderateClaudicationRightSfa.name',
    nameFallback: 'Moderate claudication — right SFA',
    descriptionKey: 'arterialLE.templates.moderateClaudicationRightSfa.description',
    descriptionFallback: '50–69% right SFA-mid/dist stenosis, ABI 0.75.',
    kind: 'moderate',
    scope: 'right',
    severity: 'urgent',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'sfa-mid-right': {
        waveform: 'monophasic-phasic',
        psvCmS: 280,
        stenosisCategory: 'moderate',
        stenosisPct: 60,
        plaqueMorphology: 'mixed',
        plaqueLengthMm: 35,
      },
      'sfa-dist-right': {
        waveform: 'monophasic-phasic',
        psvCmS: 240,
        stenosisCategory: 'moderate',
        plaqueMorphology: 'mixed',
      },
      'pop-ak-right': {
        waveform: 'monophasic-damped',
        psvCmS: 60,
        stenosisCategory: 'none',
      },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpR: 100,
      anklePtR: 98,
      toeR: 75,
    },
    impressionKey: 'arterialLE.templates.moderateClaudicationRightSfa.impression',
    impressionFallback:
      'Moderate right superficial femoral artery stenosis, mid-to-distal segment, with post-stenotic flow dampening extending to the popliteal artery. PSV doubling (280 cm/s) and waveform conversion to monophasic-phasic are consistent with 50–69% stenosis by velocity criteria. Right ABI 0.75 — moderate peripheral arterial disease. Flow through the profunda femoris and below-knee runoff is preserved.',
    recommendations: [
      {
        id: 'mod-claud-omt',
        textKey: 'arterialLE.rec.moderateClaudicationOMT',
        text: 'Optimal medical therapy per ESVS 2024 — high-intensity statin, antiplatelet (clopidogrel or DAPT for short-term), HbA1c <7%, smoking cessation. Supervised exercise therapy first-line. Cilostazol 100 mg BID unless contraindicated. Re-evaluate at 3 months; if lifestyle-limiting claudication persists, consider CTA and endovascular revascularization.',
        priority: 'urgent',
      },
    ],
  },

  // 4. Severe claudication left SFA occlusion
  {
    id: 'arterial-severe-claudication-left-sfa-occlusion',
    nameKey: 'arterialLE.templates.severeClaudicationLeftSfaOcclusion.name',
    nameFallback: 'Severe claudication — left SFA occlusion',
    descriptionKey: 'arterialLE.templates.severeClaudicationLeftSfaOcclusion.description',
    descriptionFallback: 'Left SFA-mid occluded, collateralized, ABI 0.45.',
    kind: 'severe',
    scope: 'left',
    severity: 'critical',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'sfa-mid-left': ARTERIAL_OCCLUSION_FINDING,
      'sfa-dist-left': {
        waveform: 'monophasic-damped',
        stenosisCategory: 'none',
        plaqueMorphology: 'mixed',
      },
      'pop-ak-left': { waveform: 'monophasic-damped', stenosisCategory: 'none' },
      'pop-bk-left': { waveform: 'monophasic-damped', stenosisCategory: 'none' },
      'ata-left': { waveform: 'monophasic-damped', stenosisCategory: 'none' },
      'pta-left': { waveform: 'monophasic-damped', stenosisCategory: 'none' },
      'per-left': { waveform: 'monophasic-damped', stenosisCategory: 'none' },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpL: 60,
      anklePtL: 58,
      toeL: 45,
    },
    impressionKey: 'arterialLE.templates.severeClaudicationLeftSfaOcclusion.impression',
    impressionFallback:
      'Occlusion of the left superficial femoral artery, mid segment, with reconstitution of the popliteal artery via profunda femoris collaterals. Distal runoff demonstrates damped monophasic flow in all three tibial vessels. Left ABI 0.45 — moderate-to-severe peripheral arterial disease. Right arterial tree patent with triphasic waveforms.',
    recommendations: [
      {
        id: 'severe-sfa-urgent',
        textKey: 'arterialLE.rec.severeSfaOcclusion',
        text: 'Urgent vascular surgery consultation for revascularization planning. Obtain CT angiography to characterize lesion length, calcification, and runoff. Per ESVS 2024: TASC B/C SFA occlusion — endovascular-first strategy for most patients; open bypass for long (>25 cm) heavily calcified lesions with poor runoff. Initiate optimal medical therapy immediately.',
        priority: 'urgent',
      },
    ],
  },

  // 5. CLI right with tissue loss
  {
    id: 'arterial-cli-right-tissue-loss',
    nameKey: 'arterialLE.templates.cliRightTissueLoss.name',
    nameFallback: 'CLI — right, tissue loss',
    descriptionKey: 'arterialLE.templates.cliRightTissueLoss.description',
    descriptionFallback: 'Multilevel right CLI, Rutherford 5. ABI 0.30, TBI 0.15.',
    kind: 'critical',
    scope: 'right',
    severity: 'critical',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'cfa-right': {
        waveform: 'monophasic-damped',
        psvCmS: 50,
        stenosisCategory: 'none',
      },
      'sfa-mid-right': {
        waveform: 'monophasic-damped',
        psvCmS: 380,
        stenosisCategory: 'severe',
        stenosisPct: 80,
        plaqueMorphology: 'calcified',
        plaqueLengthMm: 45,
      },
      'sfa-dist-right': ARTERIAL_OCCLUSION_FINDING,
      'pop-ak-right': ARTERIAL_OCCLUSION_FINDING,
      'pop-bk-right': { waveform: 'absent', stenosisCategory: 'occluded', occluded: true },
      'ata-right': ARTERIAL_OCCLUSION_FINDING,
      'pta-right': ARTERIAL_OCCLUSION_FINDING,
      'per-right': { waveform: 'monophasic-damped', psvCmS: 25, stenosisCategory: 'none' },
      'dp-right': { waveform: 'absent', occluded: true, stenosisCategory: 'occluded' },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpR: 40,
      anklePtR: 35,
      toeR: 20,
    },
    impressionKey: 'arterialLE.templates.cliRightTissueLoss.impression',
    impressionFallback:
      'Multilevel critical limb ischemia of the right lower extremity with tissue loss. Inflow disease at the iliofemoral level suggested by dampened common femoral artery waveform. Mid superficial femoral artery stenosis >70% with distal SFA occlusion. Above-knee popliteal flow is absent. Runoff restricted to the peroneal artery with dampened monophasic flow; anterior and posterior tibial arteries are occluded. Right ABI 0.30, TBI 0.15 — severe limb-threatening ischemia (Rutherford 5).',
    recommendations: [
      {
        id: 'cli-emergent',
        textKey: 'arterialLE.rec.cliEmergent',
        text: 'Emergent vascular surgery and wound-care consultation. CT angiography or MR angiography head-to-toe for revascularization planning. Per ESVS 2024 CLI guidance: revascularization offered to all patients with anticipated benefit. Urgent initiation of analgesia, antibiotic coverage if infected wound, and optimal medical therapy. Consider hyperbaric oxygen and advanced wound care as adjunct. Limb salvage is the goal; amputation reserved for non-reconstructible disease or failed revascularization.',
        priority: 'stat',
      },
    ],
  },

  // 6. Aortoiliac disease bilateral
  {
    id: 'arterial-aortoiliac-disease-bilateral',
    nameKey: 'arterialLE.templates.aortoiliacDiseaseBilateral.name',
    nameFallback: 'Aortoiliac inflow disease (bilateral)',
    descriptionKey: 'arterialLE.templates.aortoiliacDiseaseBilateral.description',
    descriptionFallback: 'Bilateral CFA damped waveforms, ABI 0.60 bilateral.',
    kind: 'moderate',
    scope: 'bilateral',
    severity: 'urgent',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'cfa-left':  { waveform: 'monophasic-damped', psvCmS: 45, stenosisCategory: 'none' },
      'cfa-right': { waveform: 'monophasic-damped', psvCmS: 48, stenosisCategory: 'none' },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpL: 80,
      ankleDpR: 82,
      anklePtL: 78,
      anklePtR: 80,
      toeL: 60,
      toeR: 62,
    },
    impressionKey: 'arterialLE.templates.aortoiliacDiseaseBilateral.impression',
    impressionFallback:
      'Hemodynamic features suggestive of bilateral aortoiliac inflow disease — bilaterally dampened common femoral artery waveforms with preservation of triphasic (though reduced-amplitude) flow distally. Bilateral ABI 0.60 — moderate peripheral arterial disease, symmetric pattern consistent with inflow limitation. Direct iliac visualization is limited by duplex ultrasound; cross-sectional imaging recommended.',
    recommendations: [
      {
        id: 'aortoiliac-cta',
        textKey: 'arterialLE.rec.aortoiliacCTA',
        text: 'CT angiography or MR angiography of the abdomen-pelvis to directly image the aortoiliac segment and grade stenosis/occlusion length. Evaluate for Leriche syndrome if buttock claudication with erectile dysfunction. Optimal medical therapy initiated. Endovascular iliac intervention is first-line per ESVS 2024 for most patients with claudication or rest pain attributable to iliac disease.',
        priority: 'urgent',
      },
    ],
  },

  // 7. Post-bypass graft patent right
  {
    id: 'arterial-post-bypass-graft-patent-right',
    nameKey: 'arterialLE.templates.postBypassGraftPatentRight.name',
    nameFallback: 'Post-bypass graft — patent (right)',
    descriptionKey: 'arterialLE.templates.postBypassGraftPatentRight.description',
    descriptionFallback: 'Right fem-pop bypass patent, ABI 0.95.',
    kind: 'post-procedure',
    scope: 'right',
    severity: 'informational',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'sfa-prox-right': { waveform: 'triphasic', psvCmS: 100, stenosisCategory: 'none' },
      'sfa-mid-right':  { waveform: 'triphasic', psvCmS: 110, stenosisCategory: 'none' },
      'sfa-dist-right': { waveform: 'triphasic', psvCmS: 120, stenosisCategory: 'none' },
      'pop-ak-right':   { waveform: 'triphasic', psvCmS: 90,  stenosisCategory: 'none' },
      'pop-bk-right':   { waveform: 'triphasic', psvCmS: 85,  stenosisCategory: 'none' },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpR: 124,
      anklePtR: 122,
      toeR: 100,
    },
    impressionKey: 'arterialLE.templates.postBypassGraftPatentRight.impression',
    impressionFallback:
      'Patent right femoropopliteal bypass graft at post-operative surveillance duplex. Proximal anastomosis, graft body, and distal anastomosis all demonstrate normal triphasic flow without hemodynamically significant stenosis. Inflow common femoral artery is unobstructed. Distal runoff is intact with triphasic flow in the below-knee popliteal and tibial arteries. Right ABI 0.95 — normal. Findings consistent with a well-functioning bypass.',
    recommendations: [
      {
        id: 'post-bypass-surveillance',
        textKey: 'arterialLE.rec.postBypassSurveillance',
        text: 'Continue routine graft surveillance duplex every 6 months for first 2 years, then annually per SVS 2018 practice guideline. Immediate return for recurrent claudication or rest pain. Continue antiplatelet therapy and statin.',
        priority: 'routine',
      },
    ],
  },

  // 8. Post-stent patent left SFA
  {
    id: 'arterial-post-stent-patent-left-sfa',
    nameKey: 'arterialLE.templates.postStentPatentLeftSfa.name',
    nameFallback: 'Post-stent — patent (left SFA)',
    descriptionKey: 'arterialLE.templates.postStentPatentLeftSfa.description',
    descriptionFallback: 'Left SFA stent patent, ABI 0.95.',
    kind: 'post-procedure',
    scope: 'left',
    severity: 'informational',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'sfa-prox-left': { waveform: 'triphasic', psvCmS: 140, stenosisCategory: 'none' },
      'sfa-mid-left':  { waveform: 'triphasic', psvCmS: 180, stenosisCategory: 'none' },
      'sfa-dist-left': { waveform: 'triphasic', psvCmS: 120, stenosisCategory: 'none' },
    }),
    pressures: {
      ...NORMAL_PRESSURES_BILATERAL,
      ankleDpL: 124,
      anklePtL: 122,
      toeL: 100,
    },
    impressionKey: 'arterialLE.templates.postStentPatentLeftSfa.impression',
    impressionFallback:
      'Status post left superficial femoral artery stenting. In-stent flow is triphasic with acceptable peak systolic velocity (180 cm/s) and no step-up at the stent margins, indicating no in-stent restenosis. Left ABI 0.95 — normal. Inflow and outflow are patent.',
    recommendations: [
      {
        id: 'post-stent-dapt',
        textKey: 'arterialLE.rec.postStentDapt',
        text: 'Continue dual antiplatelet therapy per interventionalist\'s regimen (typically 1–3 months post-procedure) then lifelong single antiplatelet. Statin at maximum tolerated dose. Duplex surveillance at 1, 6, and 12 months post-stent, then annually. Prompt re-evaluation if return of claudication symptoms.',
        priority: 'routine',
      },
    ],
  },

  // 9. Diabetic non-compressible right
  {
    id: 'arterial-diabetic-non-compressible-right',
    nameKey: 'arterialLE.templates.diabeticNonCompressibleRight.name',
    nameFallback: 'Diabetic non-compressible (right)',
    descriptionKey: 'arterialLE.templates.diabeticNonCompressibleRight.description',
    descriptionFallback: 'Right ABI >1.3 (medial calcinosis), rely on TBI.',
    kind: 'moderate',
    scope: 'right',
    severity: 'urgent',
    findings: patch(fillAll(ARTERIAL_NORMAL_FINDING), {
      'ata-right': { waveform: 'monophasic-damped', psvCmS: 40, stenosisCategory: 'none' },
      'pta-right': { waveform: 'monophasic-damped', psvCmS: 40, stenosisCategory: 'none' },
    }),
    pressures: {
      brachialL: 135,
      brachialR: 140,
      highThighL: 150,
      highThighR: 160,
      lowThighL: 145,
      lowThighR: 160,
      calfL: 140,
      calfR: 180,
      ankleDpL: 140,
      ankleDpR: 220,
      anklePtL: 138,
      anklePtR: 225,
      toeL: 100,
      toeR: 60,
    },
    impressionKey: 'arterialLE.templates.diabeticNonCompressibleRight.impression',
    impressionFallback:
      'Non-compressible right ankle arteries (ABI >1.3) consistent with medial arterial calcinosis — a common finding in diabetes and chronic kidney disease. Ankle pressure is therefore non-diagnostic for hemodynamic status. Toe-Brachial Index of 0.43 indicates moderate peripheral arterial disease. Waveforms demonstrate damped monophasic flow in the anterior and posterior tibial arteries, corroborating distal disease. Clinical correlation with symptoms and consideration of supplementary imaging (CTA or angiography) recommended.',
    recommendations: [
      {
        id: 'diabetic-tbi',
        textKey: 'arterialLE.rec.diabeticNonCompressible',
        text: 'ABI is non-diagnostic due to medial calcinosis; rely on TBI, toe pressures, and waveform analysis for hemodynamic assessment. If symptoms of claudication or rest pain, proceed to CT angiography or invasive angiography. Aggressive atherosclerotic risk factor management — glycemic control, statin, antiplatelet, smoking cessation. Foot-care education and annual foot exam essential. Re-evaluate duplex in 6–12 months or sooner if symptomatic.',
        priority: 'urgent',
      },
    ],
  },
];

export function findArterialTemplateById(id: string): ArterialLETemplate | undefined {
  return ARTERIAL_LE_TEMPLATES.find((t) => t.id === id);
}
