// SPDX-License-Identifier: Apache-2.0
/**
 * Quick-fill clinical templates for the iliac/pelvic venous study. Kept
 * lightweight (a typed built-in list the form applies via APPLY_TEMPLATE) — the
 * heavier custom-template gallery used by venous/carotid is intentionally
 * out-of-scope for v1.
 *
 * Each template's `findings` is a frozen seed; the reducer clones it on apply so
 * a shared reference can't be mutated across cases.
 */

import type { IliacContext, IliacPelvicVenousFindings } from './config';

export interface IliacTemplateRecommendation {
  readonly textKey: string;
  readonly textFallback: string;
}

export interface IliacTemplate {
  readonly id: string;
  readonly nameKey: string;
  readonly nameFallback: string;
  readonly descriptionKey: string;
  readonly descriptionFallback: string;
  readonly impressionKey: string;
  readonly impressionFallback: string;
  readonly context?: IliacContext;
  readonly findings: IliacPelvicVenousFindings;
  readonly recommendations?: ReadonlyArray<IliacTemplateRecommendation>;
}

export const ILIAC_PELVIC_VENOUS_TEMPLATES: ReadonlyArray<IliacTemplate> = [
  {
    id: 'iliac-normal',
    nameKey: 'iliacPelvicVenous.templates.normal.name',
    nameFallback: 'Normal pelvic venous study',
    descriptionKey: 'iliacPelvicVenous.templates.normal.description',
    descriptionFallback: 'No reflux or obstruction in any zone.',
    impressionKey: 'iliacPelvicVenous.templates.normal.impression',
    impressionFallback:
      'No pelvic venous reflux or obstruction identified. Gonadal veins of normal calibre without reflux; no iliac vein compression or thrombosis; left renal vein without nutcracker features.',
    context: { sex: 'female' },
    findings: Object.freeze({}),
  },
  {
    id: 'iliac-pcs-left-ovarian',
    nameKey: 'iliacPelvicVenous.templates.pcs.name',
    nameFallback: 'Pelvic congestion — left ovarian reflux',
    descriptionKey: 'iliacPelvicVenous.templates.pcs.description',
    descriptionFallback: 'Dilated, refluxing left ovarian vein with parametrial congestion.',
    impressionKey: 'iliacPelvicVenous.templates.pcs.impression',
    impressionFallback:
      'Dilated, incompetent left ovarian vein with sustained reflux and congested left parametrial plexus — findings consistent with pelvic venous reflux (pelvic congestion).',
    context: {
      sex: 'female',
      symptoms: ['chronic-pelvic-pain', 'dyspareunia'],
      approaches: ['transabdominal', 'transvaginal'],
    },
    findings: Object.freeze({
      gonadal: {
        left: {
          diameterMm: 8,
          refluxPresent: true,
          refluxTrigger: 'spontaneous',
          refluxDurationS: 4,
          refluxType: 'II',
          flowDirection: 'retrograde',
        },
      },
      plexus: {
        left: {
          largestDiameterMm: 7,
          refluxDurationS: 3,
          refluxType: 'II',
          flowVelocityCmS: 2,
          tortuosity: 'severe',
        },
      },
    }) as IliacPelvicVenousFindings,
    recommendations: [
      {
        textKey: 'iliacPelvicVenous.templates.pcs.rec',
        textFallback:
          'Refer to interventional radiology for consideration of ovarian vein embolization.',
      },
    ],
  },
  {
    id: 'iliac-may-thurner',
    nameKey: 'iliacPelvicVenous.templates.mayThurner.name',
    nameFallback: 'May-Thurner pattern (left CIV)',
    descriptionKey: 'iliacPelvicVenous.templates.mayThurner.description',
    descriptionFallback: 'Left common iliac vein compression with collaterals — screening positive.',
    impressionKey: 'iliacPelvicVenous.templates.mayThurner.impression',
    impressionFallback:
      'Narrowing of the left common iliac vein with elevated cross-stenosis velocity ratio and pelvic collaterals, suggestive of May-Thurner (non-thrombotic iliac vein) compression. Ultrasound is screening only — cross-sectional/IVUS confirmation advised.',
    context: { sex: 'female', symptoms: ['leg-varices'], approaches: ['transabdominal'] },
    findings: Object.freeze({
      caval: {
        'civ-left': {
          patency: 'partial',
          velocityRatio: 3.0,
          stenosisPct: 60,
          collateralsPresent: true,
          confirmatoryImagingRecommended: true,
        },
      },
    }) as IliacPelvicVenousFindings,
    recommendations: [
      {
        textKey: 'iliacPelvicVenous.templates.mayThurner.rec',
        textFallback: 'Confirm with IVUS or CT/MR venography prior to any intervention.',
      },
    ],
  },
  {
    id: 'iliac-nutcracker',
    nameKey: 'iliacPelvicVenous.templates.nutcracker.name',
    nameFallback: 'Nutcracker pattern (left renal vein)',
    descriptionKey: 'iliacPelvicVenous.templates.nutcracker.description',
    descriptionFallback: 'Left renal vein compression — screening positive.',
    impressionKey: 'iliacPelvicVenous.templates.nutcracker.impression',
    impressionFallback:
      'Aortomesenteric compression of the left renal vein with elevated peak-velocity and diameter ratios and a beak sign, suggestive of nutcracker phenomenon. Ultrasound is screening only — CT/MR venography confirmation advised.',
    context: { sex: 'female', symptoms: ['flank-pain', 'hematuria'], approaches: ['transabdominal'] },
    findings: Object.freeze({
      renal: {
        peakVelocityRatio: 6,
        apDiameterRatio: 5,
        aortoSmaAngleDeg: 28,
        beakSign: true,
        hilarVarices: true,
        confirmatoryImagingRecommended: true,
      },
    }) as IliacPelvicVenousFindings,
    recommendations: [
      {
        textKey: 'iliacPelvicVenous.templates.nutcracker.rec',
        textFallback: 'Confirm with CT/MR venography and correlate with renocaval pressure gradient.',
      },
    ],
  },
];
