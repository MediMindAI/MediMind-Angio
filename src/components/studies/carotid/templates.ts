// SPDX-License-Identifier: Apache-2.0
/**
 * Carotid Duplex — Pre-seeded clinical templates.
 *
 * 7 medically-reviewed templates spanning the common clinical scenarios:
 * normal, mild bilateral atherosclerosis, moderate/severe left ICA,
 * ICA occlusion, post-CEA, post-stent.
 *
 * Templates carry no manual NASCET grade (`nascet: {}`): the SRU 2003
 * calculator grades each side from the template's own findings, so the grade
 * keeps following any velocity the clinician types afterwards.
 */

import type { Recommendation } from '../../../types/form';
import type {
  CarotidFindings,
  CarotidNascetClassification,
  CarotidVesselFinding,
} from './config';
import { CAROTID_NORMAL_FINDING } from './config';

export type CarotidTemplateKind = 'normal' | 'mild' | 'moderate' | 'severe' | 'post-procedure';
export type CarotidTemplateScope = 'bilateral' | 'left' | 'right';
export type CarotidTemplateSeverity =
  | 'routine'
  | 'urgent'
  | 'critical'
  | 'informational';

export interface CarotidTemplate {
  readonly id: string;
  readonly nameKey: string;
  readonly nameFallback: string;
  readonly descriptionKey: string;
  readonly descriptionFallback: string;
  readonly kind: CarotidTemplateKind;
  readonly scope: CarotidTemplateScope;
  readonly severity: CarotidTemplateSeverity;
  readonly findings: CarotidFindings;
  readonly nascet: CarotidNascetClassification;
  readonly impressionKey: string;
  readonly impressionFallback: string;
  readonly recommendations?: ReadonlyArray<Recommendation>;
}

// --- Helpers ---------------------------------------------------------------

const VESSELS = [
  'cca-prox', 'cca-mid', 'cca-dist', 'bulb',
  'ica-prox', 'ica-mid', 'ica-dist', 'eca',
  'vert-v1', 'vert-v2', 'vert-v3',
  'subclav-prox', 'subclav-dist',
] as const;

function allVessels(finding: CarotidVesselFinding): CarotidFindings {
  const out: Record<string, CarotidVesselFinding> = {};
  for (const v of VESSELS) {
    // Wave 3.7 (Part 03 HIGH) — clone per slot so each slot owns its own
    // finding object. Sharing the seed reference across 26+ slots was an
    // in-place mutation away from cross-slot corruption.
    out[`${v}-left`] = { ...finding };
    out[`${v}-right`] = { ...finding };
  }
  return out as CarotidFindings;
}

function patch(
  base: CarotidFindings,
  overrides: Readonly<Record<string, CarotidVesselFinding>>,
): CarotidFindings {
  return { ...base, ...overrides } as CarotidFindings;
}

// --- 7 templates -----------------------------------------------------------

export const CAROTID_TEMPLATES: ReadonlyArray<CarotidTemplate> = [
  // 1. Normal bilateral
  {
    id: 'carotid-normal-bilateral',
    nameKey: 'carotid.templates.normalBilateral.name',
    nameFallback: 'Normal bilateral',
    descriptionKey: 'carotid.templates.normalBilateral.description',
    descriptionFallback: 'All vessels normal, no plaque, no stenosis bilaterally.',
    kind: 'normal',
    scope: 'bilateral',
    severity: 'routine',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
      'cca-dist-left':  { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 90, edvCmS: 30 },
      'ica-prox-left':  { ...CAROTID_NORMAL_FINDING, psvCmS: 90, edvCmS: 30 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.normalBilateral.impression',
    impressionFallback:
      'Normal bilateral carotid, vertebral, and subclavian duplex examination. Common and internal carotid arteries demonstrate normal peak systolic and end-diastolic velocities with triphasic antegrade flow and no atherosclerotic plaque. Vertebral arteries show normal antegrade flow bilaterally. No hemodynamic evidence of stenosis or occlusion.',
  },

  // 2. Mild bilateral atherosclerosis
  {
    id: 'carotid-mild-bilateral-atherosclerosis',
    nameKey: 'carotid.templates.mildBilateralAtherosclerosis.name',
    nameFallback: 'Mild bilateral atherosclerosis',
    descriptionKey: 'carotid.templates.mildBilateralAtherosclerosis.description',
    descriptionFallback: 'Bilateral bulb/ICA plaque, NASCET <50% bilateral.',
    kind: 'mild',
    scope: 'bilateral',
    severity: 'routine',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 110, edvCmS: 35, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 8, plaqueSurface: 'smooth' },
      'ica-prox-left':  { ...CAROTID_NORMAL_FINDING, psvCmS: 115, edvCmS: 38, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 8, plaqueSurface: 'smooth' },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 80, imtMm: 0.9, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 10, plaqueSurface: 'smooth' },
      'cca-dist-left':  { ...CAROTID_NORMAL_FINDING, psvCmS: 82, imtMm: 0.9, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 12, plaqueSurface: 'smooth' },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.mildBilateralAtherosclerosis.impression',
    impressionFallback:
      'Bilateral mild atherosclerotic disease of the carotid bifurcations involving the bulbs and proximal internal carotid arteries. Plaques are of mixed echogenicity with smooth surfaces. Peak systolic velocities remain within normal limits; no hemodynamically significant stenosis. NASCET < 50% bilaterally.',
  },

  // 3. Moderate left ICA
  {
    id: 'carotid-moderate-left-ica',
    nameKey: 'carotid.templates.moderateLeftIca.name',
    nameFallback: 'Moderate left ICA stenosis',
    descriptionKey: 'carotid.templates.moderateLeftIca.description',
    descriptionFallback: 'Left ICA 50–69%, soft plaque, ICA/CCA 2.5.',
    kind: 'moderate',
    scope: 'left',
    severity: 'urgent',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'ica-prox-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 180, edvCmS: 55, plaquePresent: true, plaqueMorphology: 'type1', plaqueLengthMm: 18, plaqueSurface: 'smooth' },
      'cca-dist-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 72 },
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 95, edvCmS: 30 },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.moderateLeftIca.impression',
    impressionFallback:
      'Moderate atherosclerotic stenosis of the left internal carotid artery, proximal segment, with NASCET 50–69% stenosis by SRU velocity criteria (PSV 180 cm/s, ICA/CCA ratio 2.5). Soft plaque, smooth surface. Right carotid system unremarkable — no significant stenosis. Vertebral and subclavian arteries are patent bilaterally with normal antegrade flow.',
    recommendations: [
      {
        id: 'moderate-ica-omt',
        textKey: 'carotid.rec.moderateIcaOMT',
        text: 'Asymptomatic moderate stenosis: optimal medical therapy per ESVS 2023 — high-intensity statin, antiplatelet, BP control <140/90 mmHg, HbA1c <7%, smoking cessation. Duplex surveillance at 6 months. If symptomatic (TIA or minor stroke attributable to this territory), urgent referral for revascularization consideration.',
        priority: 'urgent',
      },
    ],
  },

  // 4. Severe left ICA
  {
    id: 'carotid-severe-left-ica',
    nameKey: 'carotid.templates.severeLeftIca.name',
    nameFallback: 'Severe left ICA stenosis',
    descriptionKey: 'carotid.templates.severeLeftIca.description',
    descriptionFallback: 'Left ICA ≥70%, irregular plaque.',
    kind: 'severe',
    scope: 'left',
    severity: 'critical',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'ica-prox-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 310, edvCmS: 120, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 22, plaqueSurface: 'irregular' },
      'cca-dist-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 65 },
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 95, edvCmS: 30 },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.severeLeftIca.impression',
    impressionFallback:
      'Severe atherosclerotic stenosis of the left internal carotid artery, proximal segment — NASCET ≥ 70% by SRU velocity criteria (PSV 310 cm/s, EDV 120 cm/s, ICA/CCA ratio 4.8). Mixed-echogenicity plaque with irregular surface — high-risk morphology. Right carotid system unremarkable. Vertebrals patent with antegrade flow.',
    recommendations: [
      {
        id: 'severe-ica-revasc',
        textKey: 'carotid.rec.severeIcaRevasc',
        text: 'Urgent vascular surgery consultation for carotid revascularization evaluation per ESVS 2023. If symptomatic within past 6 months: CEA within 2 weeks (Class I, Level A) unless contraindications. If asymptomatic: CEA or CAS in patients with life expectancy >5 years and low perioperative risk (Class IIa). Best medical therapy bridge: high-intensity statin, dual antiplatelet short-term consideration, BP <140/90. Brain imaging (MRI) to document baseline infarct burden.',
        priority: 'urgent',
      },
    ],
  },

  // 5. Left ICA occlusion
  {
    id: 'carotid-left-ica-occlusion',
    nameKey: 'carotid.templates.leftIcaOcclusion.name',
    nameFallback: 'Left ICA occlusion',
    descriptionKey: 'carotid.templates.leftIcaOcclusion.description',
    descriptionFallback: 'Left ICA occluded, contralateral compensation.',
    kind: 'severe',
    scope: 'left',
    severity: 'critical',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'ica-prox-left': { flowDirection: 'absent', plaquePresent: true, plaqueMorphology: 'type3' },
      'ica-mid-left':  { flowDirection: 'absent' },
      'ica-dist-left': { flowDirection: 'absent' },
      'cca-dist-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 80 },
      // Compensatory PSV 145 alone reads 50–69 % by SRU; the 0 % gray-scale
      // estimate + EDV < 40 + ratio < 2.0 grade it < 50 % (no primary stenosis).
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 145, edvCmS: 35, plaqueStenosisPct: 0 },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.leftIcaOcclusion.impression',
    impressionFallback:
      'Complete occlusion of the left internal carotid artery. The left common carotid artery distal segment demonstrates a high-resistance waveform with reversed end-diastolic flow, consistent with distal occlusion (externalization pattern). Right internal carotid artery shows compensatory elevated peak systolic velocity (145 cm/s) without evidence of primary stenosis — hemodynamic contralateral compensation. Vertebrals patent bilaterally.',
    recommendations: [
      {
        id: 'ica-occlusion-confirm',
        textKey: 'carotid.rec.icaOcclusionConfirm',
        text: 'Confirm occlusion with CT angiography or MR angiography. Rule out acute thrombosis vs chronic occlusion — different management. Anticoagulation if acute; antiplatelet + statin if chronic. Optimal medical therapy. Revascularization of chronic ICA occlusion generally not beneficial except in select symptomatic patients with compromised cerebral reserve — EC-IC bypass controversial and limited indication. Brain imaging to assess infarct burden and evaluate for hemodynamic symptoms.',
        priority: 'urgent',
      },
    ],
  },

  // 6. Post-CEA left
  {
    id: 'carotid-post-cea-left',
    nameKey: 'carotid.templates.postCeaLeft.name',
    nameFallback: 'Post-CEA (left)',
    descriptionKey: 'carotid.templates.postCeaLeft.description',
    descriptionFallback: 'Post-endarterectomy surveillance, no restenosis.',
    kind: 'post-procedure',
    scope: 'left',
    severity: 'informational',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      'ica-prox-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 110, edvCmS: 30 },
      'cca-dist-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 85, imtMm: 0.7 },
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 105, edvCmS: 32, plaquePresent: true, plaqueMorphology: 'type3', plaqueLengthMm: 8, plaqueSurface: 'smooth' },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 85, imtMm: 0.9 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.postCeaLeft.impression',
    impressionFallback:
      'Status post left carotid endarterectomy. The left internal carotid artery demonstrates normal peak systolic and end-diastolic velocities with a smooth post-surgical lumen and minimal intimal thickening — no evidence of restenosis. Right carotid system shows mild atherosclerotic plaque without significant stenosis. Vertebrals patent bilaterally.',
    recommendations: [
      {
        id: 'post-cea-surveillance',
        textKey: 'carotid.rec.postCeaSurveillance',
        text: 'Routine post-CEA duplex surveillance per SVS guideline: at 1 month, 6 months, and annually thereafter. Report return of neurologic symptoms immediately. Continue antiplatelet + high-intensity statin lifelong.',
        priority: 'routine',
      },
    ],
  },

  // 7. Post-stent right ICA
  {
    id: 'carotid-post-stent-right-ica',
    nameKey: 'carotid.templates.postStentRightIca.name',
    nameFallback: 'Post-stent (right ICA)',
    descriptionKey: 'carotid.templates.postStentRightIca.description',
    descriptionFallback: 'Right ICA stent patent, no in-stent restenosis.',
    kind: 'post-procedure',
    scope: 'right',
    severity: 'informational',
    findings: patch(allVessels(CAROTID_NORMAL_FINDING), {
      // In-stent PSV 160 alone reads 50–69 % by native SRU; the 0 % gray-scale
      // lumen estimate + EDV < 40 + ratio < 2.0 grade it < 50 % (no restenosis).
      'ica-prox-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 160, edvCmS: 35, plaqueStenosisPct: 0 },
      'cca-dist-right': { ...CAROTID_NORMAL_FINDING, psvCmS: 88 },
      'ica-prox-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 95, edvCmS: 30 },
      'cca-dist-left': { ...CAROTID_NORMAL_FINDING, psvCmS: 85 },
    }),
    nascet: {},
    impressionKey: 'carotid.templates.postStentRightIca.impression',
    impressionFallback:
      'Status post right internal carotid artery stenting with patent in-stent flow. In-stent peak systolic velocity (160 cm/s) and ICA/CCA ratio (1.8) are within accepted post-stent thresholds — no evidence of in-stent restenosis. Edge velocities are normal. Left carotid system unremarkable.',
    recommendations: [
      {
        id: 'post-stent-carotid-surveillance',
        textKey: 'carotid.rec.postStentSurveillance',
        text: 'Carotid-stent surveillance per SVS: duplex at 1 month, 6 months, 12 months, then annually. Higher in-stent PSV thresholds apply (≥ 220 cm/s concerning for restenosis). Dual antiplatelet per interventionalist regimen; then lifelong single antiplatelet + statin.',
        priority: 'routine',
      },
    ],
  },
];

export function findCarotidTemplateById(id: string): CarotidTemplate | undefined {
  return CAROTID_TEMPLATES.find((t) => t.id === id);
}
