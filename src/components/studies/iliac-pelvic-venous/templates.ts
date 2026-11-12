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

import { ILIAC_CAVAL_ROW_ORDER } from './config';
import type { IliacCavalFindings, IliacContext, IliacPelvicVenousFindings } from './config';

/**
 * Every row patent / fully filling / competent — the facts the normal
 * impression states. A normal template must never write a "no reflux, no
 * obstruction" conclusion over an empty table (level-up U-1025).
 *
 * Phasicity: iliac + common femoral veins (CIV, EIV, IIV, CFV) are normally
 * respirophasic, so they get it. IVC (cardiac pulsatility near the heart) and
 * the left renal vein (LRV) stay blank for the sonographer. Decided under founder
 * delegation 2026-11-12, pending clinician review (sign-off S5).
 *
 * Also the source of the table's one-click "all normal" action (UX-ANGIO-011),
 * so the button and the normal template can never drift apart.
 */
const RESPIROPHASIC_NORMAL = /^(civ|eiv|iiv|cfv)/;

export const NORMAL_CAVAL: IliacCavalFindings = Object.fromEntries(
  ILIAC_CAVAL_ROW_ORDER.map((id) => [
    id,
    {
      patency: 'patent',
      filling: 'full',
      competency: 'competent',
      ...(RESPIROPHASIC_NORMAL.test(id) ? { phasicity: 'respirophasic' as const } : {}),
    },
  ])
);

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
}

export const ILIAC_PELVIC_VENOUS_TEMPLATES: ReadonlyArray<IliacTemplate> = [
  {
    id: 'iliac-normal',
    nameKey: 'iliacPelvicVenous.templates.normal.name',
    nameFallback: 'Normal pelvic venous study',
    descriptionKey: 'iliacPelvicVenous.templates.normal.description',
    descriptionFallback: 'No reflux or obstruction.',
    impressionKey: 'iliacPelvicVenous.templates.normal.impression',
    impressionFallback:
      'No pelvic venous reflux or obstruction identified. Left gonadal vein of normal calibre without reflux; no iliac vein compression or thrombosis.',
    context: { sex: 'female' },
    findings: Object.freeze({
      caval: NORMAL_CAVAL,
      gonadal: { left: { refluxPresent: false } },
    }) as IliacPelvicVenousFindings,
  },
  {
    id: 'iliac-pcs-left-ovarian',
    nameKey: 'iliacPelvicVenous.templates.pcs.name',
    nameFallback: 'Pelvic congestion — left ovarian reflux',
    descriptionKey: 'iliacPelvicVenous.templates.pcs.description',
    descriptionFallback: 'Dilated, refluxing left ovarian vein.',
    impressionKey: 'iliacPelvicVenous.templates.pcs.impression',
    impressionFallback:
      'Dilated, incompetent left ovarian vein with reflux — findings consistent with pelvic venous reflux (pelvic congestion).',
    context: {
      sex: 'female',
      symptoms: ['chronic-pelvic-pain', 'dyspareunia'],
      approaches: ['transabdominal', 'transvaginal'],
    },
    findings: Object.freeze({
      gonadal: { left: { diameterMm: 8, refluxPresent: true } },
    }) as IliacPelvicVenousFindings,
  },
  {
    id: 'iliac-may-thurner',
    nameKey: 'iliacPelvicVenous.templates.mayThurner.name',
    nameFallback: 'May-Thurner pattern (left CIV)',
    descriptionKey: 'iliacPelvicVenous.templates.mayThurner.description',
    descriptionFallback: 'Left common iliac vein compression — screening positive.',
    impressionKey: 'iliacPelvicVenous.templates.mayThurner.impression',
    impressionFallback:
      'Narrowing of the proximal left common iliac vein with partial filling and elevated peak velocity, suggestive of May-Thurner (non-thrombotic iliac vein) compression. Ultrasound is screening only — cross-sectional/IVUS confirmation advised.',
    context: { sex: 'female', symptoms: ['leg-varices'], approaches: ['transabdominal'] },
    findings: Object.freeze({
      caval: {
        'civ-prox-left': { patency: 'patent', filling: 'partial', peakVelocityCmS: 120 },
        'cfv-left': { phasicity: 'monophasic' },
      },
    }) as IliacPelvicVenousFindings,
  },
];
