// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac/pelvic venous per-zone Observation emitters.
 *
 * Walks the simplified study shape (clinician feedback 2026-11): context, one
 * Observation group per iliac/caval table row (patency · filling · phasicity ·
 * competency · AP diameter · peak velocity), and the left gonadal vein.
 * Reuses the shared push helpers + `bodySiteForSegment` SNOMED body sites
 * (laterality post-coordinated). Old drafts' removed zones / old caval keys /
 * removed ovarian rows (`ov-*`) are ignored because only `ILIAC_CAVAL_ROW_ORDER`
 * is walked.
 */

import type { FormState } from '../../../types/form';
import { isIliacContext, isIliacFindings } from '../../../types/parameters';
import type {
  IliacPelvicVenousFindings,
  IliacContext,
  IliacCavalFinding,
  IliacCavalFullId,
  GonadalVeinFinding,
} from '../../../components/studies/iliac-pelvic-venous/config';
import {
  ILIAC_THRESHOLDS,
  ILIAC_CAVAL_ROW_ORDER,
  LRV_ROW,
  isCavalObstructive,
  rowBaseOf,
  sideOfRow,
  vesselOfRow,
} from '../../../components/studies/iliac-pelvic-venous/config';
import type { BundleEntry, Observation } from '../../../types/fhir';
import type { BuildContext } from '../context';
import { bodySiteForSegment, medimindParamSystem } from '../context';
import {
  pushBooleanObservation,
  pushCodedCategorical,
  pushCustomNumeric,
  pushStringObservation,
} from './shared';

export function extractIliacFindings(form: FormState): IliacPelvicVenousFindings | undefined {
  const raw = form.parameters['segmentFindings'];
  return isIliacFindings(raw) ? raw : undefined;
}

export function appendIliacObservations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  findings: IliacPelvicVenousFindings,
): void {
  // Zone 0 — technique/context lives under `parameters.context`, not in the
  // zone findings map, so it must be read separately or it is silently dropped
  // from the structured Bundle (audit H3).
  const rawContext = ctx.form.parameters['context'];
  if (isIliacContext(rawContext)) appendContext(ctx, out, rawContext);
  for (const id of ILIAC_CAVAL_ROW_ORDER) {
    const f = findings.caval?.[id];
    if (f) appendCaval(ctx, out, id, f);
  }
  const g = findings.gonadal?.left;
  if (g) appendGonadal(ctx, out, g);
}

// ---------------------------------------------------------------------------
// Zone 0 — technique / context
// ---------------------------------------------------------------------------
function appendContext(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  c: IliacContext,
): void {
  const sideText = 'Pelvic';
  const tag = 'zone=context';
  // Symptoms drive the SVP S-axis clinically — emit them as a structured string
  // so they survive into the Bundle, not only the QuestionnaireResponse snapshot.
  if (c.symptoms && c.symptoms.length > 0) {
    pushStringObservation(ctx, out, {
      sideText,
      paramId: 'presentingSymptoms',
      paramLabel: 'Presenting symptoms',
      value: c.symptoms.join(', '),
      tag,
    });
  }
  if (c.riskFactors && c.riskFactors.length > 0) {
    pushStringObservation(ctx, out, {
      sideText,
      paramId: 'riskFactors',
      paramLabel: 'Comorbidities',
      value: c.riskFactors.join(', '),
      tag,
    });
  }
  if (c.approaches && c.approaches.length > 0) {
    pushStringObservation(ctx, out, {
      sideText,
      paramId: 'approaches',
      paramLabel: 'Scanning approaches',
      value: c.approaches.join(', '),
      tag,
    });
  }
  if (c.positions && c.positions.length > 0) {
    pushStringObservation(ctx, out, {
      sideText,
      paramId: 'patientPositions',
      paramLabel: 'Patient positions',
      value: c.positions.join(', '),
      tag,
    });
  }
  if (c.valsalvaPerformed === true) {
    pushBooleanObservation(ctx, out, {
      bodySite: { text: 'Pelvic venous study' },
      sideText,
      paramId: 'valsalvaPerformed',
      paramLabel: 'Valsalva maneuver performed',
      value: true,
      tag,
      isAbnormal: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Iliac & caval table rows
// ---------------------------------------------------------------------------
const VESSEL_BODY_SITE: Readonly<Record<string, string>> = {
  ivc: 'ivc',
  civ: 'iliac-vein',
  eiv: 'external-iliac-vein',
  iiv: 'internal-iliac-vein',
  cfv: 'cfv',
  lrv: 'renal-vein',
};

function appendCaval(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  id: IliacCavalFullId,
  f: IliacCavalFinding,
): void {
  // The LRV row sits in the IVC section on screen but is a left-side vein.
  const side = sideOfRow(id) ?? (id === LRV_ROW ? 'left' : undefined);
  const bodySite = bodySiteForSegment(VESSEL_BODY_SITE[vesselOfRow(id)] ?? 'ivc', side);
  const sideText = side ? (side === 'right' ? 'Right' : 'Left') : 'Midline';
  const tag = `zone=caval;segment=${id};level=${rowBaseOf(id)}`;

  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'patency',
    paramLabel: 'Patency / thrombosis',
    value: f.patency,
    system: medimindParamSystem(ctx, 'patency'),
    tag,
    isAbnormal: isCavalObstructive({ patency: f.patency }),
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'filling',
    paramLabel: 'Spontaneity / filling',
    value: f.filling,
    system: medimindParamSystem(ctx, 'filling'),
    tag,
    isAbnormal: isCavalObstructive({ filling: f.filling }),
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'phasicity',
    paramLabel: 'Phasicity',
    value: f.phasicity,
    system: medimindParamSystem(ctx, 'phasicity'),
    tag,
    isAbnormal: f.phasicity === 'monophasic' || f.phasicity === 'pulsatile',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'competency',
    paramLabel: 'Competency',
    value: f.competency,
    system: medimindParamSystem(ctx, 'competency'),
    tag,
    isAbnormal: f.competency === 'incompetent',
  });
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'apDiameterMm',
    paramLabel: 'AP diameter',
    value: f.apDiameterMm,
    system: medimindParamSystem(ctx, 'diameterMm'),
    unit: 'mm',
    tag,
    isAbnormal: false,
  });
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'peakVelocityCmS',
    paramLabel: 'Peak velocity',
    value: f.peakVelocityCmS,
    system: medimindParamSystem(ctx, 'velocityCmS'),
    unit: 'cm/s',
    tag,
    isAbnormal: false,
  });
}

// ---------------------------------------------------------------------------
// Left gonadal vein (diameter + reflux)
// ---------------------------------------------------------------------------
function appendGonadal(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  f: GonadalVeinFinding,
): void {
  const bodySite = bodySiteForSegment('gonadal-vein', 'left');
  const sideText = 'Left';
  const tag = 'zone=gonadal;side=left';
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'gonadalDiameterMm',
    paramLabel: 'Gonadal vein diameter',
    value: f.diameterMm,
    system: medimindParamSystem(ctx, 'gonadalDiameterMm'),
    unit: 'mm',
    tag,
    isAbnormal: (f.diameterMm ?? 0) > ILIAC_THRESHOLDS.gonadalDiameterMm,
  });
  if (f.refluxPresent !== undefined) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'refluxPresent',
      paramLabel: 'Reflux present',
      value: f.refluxPresent,
      tag,
      isAbnormal: f.refluxPresent,
    });
  }
}
