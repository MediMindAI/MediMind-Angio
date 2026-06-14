// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac/pelvic venous per-zone Observation emitters.
 *
 * Unlike the uniform per-segment studies, this study's findings are
 * zone-grouped (renal / iliac-caval / gonadal / plexus / escape points), so a
 * single `appendIliacObservations` walks the zones and emits the relevant
 * measurements/flags each. Reuses the shared push helpers + `bodySiteForSegment`
 * SNOMED body sites (laterality post-coordinated).
 */

import type { FormState } from '../../../types/form';
import { isIliacContext, isIliacFindings } from '../../../types/parameters';
import type {
  IliacPelvicVenousFindings,
  IliacContext,
  IliacCavalFinding,
  IliacCavalFullId,
  RenalVeinFinding,
  GonadalVeinFinding,
  PelvicPlexusFinding,
  EscapePoint,
  ExtrapelvicVarices,
  SpecialConsiderationsFindings,
  Side,
} from '../../../components/studies/iliac-pelvic-venous/config';
import {
  ILIAC_THRESHOLDS,
  effectiveCavalVelocityRatio,
} from '../../../components/studies/iliac-pelvic-venous/config';
import { MEDIMIND_CODESYSTEMS } from '../../../constants/fhir-systems';
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
  if (findings.renal) appendRenal(ctx, out, findings.renal);
  if (findings.caval) {
    for (const [id, f] of Object.entries(findings.caval)) {
      if (f) appendCaval(ctx, out, id as IliacCavalFullId, f);
    }
  }
  for (const side of ['left', 'right'] as const) {
    const g = findings.gonadal?.[side];
    if (g) appendGonadal(ctx, out, side, g);
    const p = findings.plexus?.[side];
    if (p) appendPlexus(ctx, out, side, p);
  }
  for (const ep of findings.escapePoints ?? []) appendEscapePoint(ctx, out, ep);
  if (findings.extrapelvic) appendExtrapelvic(ctx, out, findings.extrapelvic);
  if (findings.specialConsiderations) {
    appendSpecialConsiderations(ctx, out, findings.specialConsiderations);
  }
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
      paramLabel: 'Risk factors',
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
// Zone 1 — left renal vein (nutcracker)
// ---------------------------------------------------------------------------
function appendRenal(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  f: RenalVeinFinding,
): void {
  const bodySite = bodySiteForSegment('renal-vein', 'left');
  const sideText = 'Left';
  const tag = 'zone=renal;segment=left-renal-vein';
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'renalPeakVelocityRatio',
    paramLabel: 'LRV peak-velocity ratio',
    value: f.peakVelocityRatio,
    system: MEDIMIND_CODESYSTEMS.VELOCITY_RATIO,
    unit: '1',
    tag,
    isAbnormal: (f.peakVelocityRatio ?? 0) >= ILIAC_THRESHOLDS.renalPeakVelocityRatio,
  });
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'renalApDiameterRatio',
    paramLabel: 'LRV AP-diameter ratio',
    value: f.apDiameterRatio,
    system: medimindParamSystem(ctx, 'renalApDiameterRatio'),
    unit: '1',
    tag,
    isAbnormal: (f.apDiameterRatio ?? 0) >= ILIAC_THRESHOLDS.renalApDiameterRatio,
  });
  // Per-level LRV velocities (proximal/mid/distal) + hilar (distal) diameter.
  for (const [lvl, m] of Object.entries(f.levels ?? {})) {
    if (m?.velocityCmS !== undefined) {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText,
        paramId: `lrvVelocity_${lvl}`,
        paramLabel: `LRV peak velocity (${lvl})`,
        value: m.velocityCmS,
        system: medimindParamSystem(ctx, 'velocityCmS'),
        unit: 'cm/s',
        tag: `${tag};level=${lvl}`,
        isAbnormal: false,
      });
    }
    if (m?.diameterMm !== undefined) {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText,
        paramId: `lrvDiameter_${lvl}`,
        paramLabel: `LRV diameter (${lvl})`,
        value: m.diameterMm,
        system: medimindParamSystem(ctx, 'diameterMm'),
        unit: 'mm',
        tag: `${tag};level=${lvl}`,
        isAbnormal: false,
      });
    }
  }
  if (f.retroAortic === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'retroAortic',
      paramLabel: 'Retro-aortic left renal vein',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.beakSign === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'beakSign',
      paramLabel: 'Beak sign',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.hilarVarices === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'hilarVarices',
      paramLabel: 'Renal hilar varices',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.confirmatoryImagingRecommended === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'confirmatoryImagingRecommended',
      paramLabel: 'Confirmatory imaging recommended (CT/MR venography)',
      value: true,
      tag,
      isAbnormal: false,
    });
  }
  pushStringObservation(ctx, out, {
    bodySite,
    sideText,
    paramId: 'renalNote',
    paramLabel: 'Renal vein note',
    value: f.note,
    tag,
  });
}

// ---------------------------------------------------------------------------
// Zone 2 — iliac & caval
// ---------------------------------------------------------------------------
function cavalKeyAndSide(id: IliacCavalFullId): { key: string; side?: Side } {
  if (id === 'ivc') return { key: 'ivc' };
  const dash = id.lastIndexOf('-');
  const base = id.slice(0, dash);
  const side = id.slice(dash + 1) as Side;
  const key =
    base === 'civ'
      ? 'iliac-vein'
      : base === 'eiv'
        ? 'external-iliac-vein'
        : base === 'iiv'
          ? 'internal-iliac-vein'
          : 'cfv';
  return { key, side };
}

function appendCaval(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  id: IliacCavalFullId,
  f: IliacCavalFinding,
): void {
  const { key, side } = cavalKeyAndSide(id);
  const bodySite = bodySiteForSegment(key, side);
  const sideText = side ? (side === 'right' ? 'Right' : 'Left') : 'Midline';
  const tag = `zone=caval;segment=${id}`;

  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'patency',
    paramLabel: 'Patency',
    value: f.patency,
    system: medimindParamSystem(ctx, 'patency'),
    tag,
    isAbnormal: f.patency === 'occluded' || f.patency === 'partial',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'compressibility',
    paramLabel: 'Compressibility',
    value: f.compressibility,
    system: medimindParamSystem(ctx, 'compressibility'),
    tag,
    isAbnormal: f.compressibility === 'non-compressible' || f.compressibility === 'partial',
  });
  if (f.thrombusChronicity && f.thrombusChronicity !== 'none') {
    pushCodedCategorical(ctx, out, {
      bodySite,
      sideText,
      paramId: 'thrombusChronicity',
      paramLabel: 'Thrombus chronicity',
      value: f.thrombusChronicity,
      system: medimindParamSystem(ctx, 'thrombusChronicity'),
      tag,
      isAbnormal: true,
    });
  }
  const effRatio = effectiveCavalVelocityRatio(f);
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'velocityRatio',
    paramLabel: 'Cross-stenosis velocity ratio',
    value: effRatio,
    system: MEDIMIND_CODESYSTEMS.VELOCITY_RATIO,
    unit: '1',
    tag,
    isAbnormal: (effRatio ?? 0) >= ILIAC_THRESHOLDS.cavalVelocityRatio,
  });
  // Per-level velocities (distal/mid/proximal) + diameters (CFV SFJ-level, IVC).
  for (const [lvl, m] of Object.entries(f.levels ?? {})) {
    if (m?.velocityCmS !== undefined) {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText,
        paramId: `cavalVelocity_${lvl}`,
        paramLabel: `Peak velocity (${lvl})`,
        value: m.velocityCmS,
        system: medimindParamSystem(ctx, 'velocityCmS'),
        unit: 'cm/s',
        tag: `${tag};level=${lvl}`,
        isAbnormal: false,
      });
    }
    if (m?.diameterMm !== undefined) {
      pushCustomNumeric(ctx, out, {
        bodySite,
        sideText,
        paramId: `cavalDiameter_${lvl}`,
        paramLabel: `Diameter (${lvl})`,
        value: m.diameterMm,
        system: medimindParamSystem(ctx, 'diameterMm'),
        unit: 'mm',
        tag: `${tag};level=${lvl}`,
        isAbnormal: false,
      });
    }
  }
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'stenosisPct',
    paramLabel: 'Stenosis percent',
    value: f.stenosisPct,
    system: medimindParamSystem(ctx, 'stenosisPct'),
    unit: '%',
    tag,
    isAbnormal: (f.stenosisPct ?? 0) >= ILIAC_THRESHOLDS.cavalStenosisPct,
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'phasicity',
    paramLabel: 'CFV phasicity',
    value: f.phasicity,
    system: medimindParamSystem(ctx, 'phasicity'),
    tag,
    isAbnormal: f.phasicity === 'monophasic',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'valsalvaResponse',
    paramLabel: 'Valsalva response',
    value: f.valsalvaResponse,
    system: medimindParamSystem(ctx, 'valsalvaResponse'),
    tag,
    isAbnormal: f.valsalvaResponse === 'absent',
  });
  if (f.reflux === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'reflux',
      paramLabel: 'Reflux',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.collateralsPresent === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'collateralsPresent',
      paramLabel: 'Collaterals present',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.confirmatoryImagingRecommended === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'confirmatoryImagingRecommended',
      paramLabel: 'Confirmatory imaging recommended (IVUS/CT venography)',
      value: true,
      tag,
      isAbnormal: false,
    });
  }
  if (f.bladderArtifactSuspected === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'bladderArtifactSuspected',
      paramLabel: 'Bladder-distension artifact suspected',
      value: true,
      tag,
      isAbnormal: false,
    });
  }
  if (f.remeasuredAfterVoiding === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'remeasuredAfterVoiding',
      paramLabel: 'Remeasured after voiding',
      value: true,
      tag,
      isAbnormal: false,
    });
  }
  pushStringObservation(ctx, out, {
    bodySite,
    sideText,
    paramId: 'cavalNote',
    paramLabel: 'Segment note',
    value: f.note,
    tag,
  });
}

// ---------------------------------------------------------------------------
// Zone 3 — gonadal veins
// ---------------------------------------------------------------------------
function appendGonadal(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  side: Side,
  f: GonadalVeinFinding,
): void {
  const bodySite = bodySiteForSegment('gonadal-vein', side);
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `zone=gonadal;side=${side}`;
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
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'refluxDurationS',
    paramLabel: 'Reflux duration',
    value: f.refluxDurationS,
    system: medimindParamSystem(ctx, 'refluxDurationS'),
    unit: 's',
    tag,
    isAbnormal: (f.refluxDurationS ?? 0) > ILIAC_THRESHOLDS.refluxDurationS,
  });
  if (f.refluxPresent === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'refluxPresent',
      paramLabel: 'Reflux present',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'refluxTrigger',
    paramLabel: 'Reflux trigger',
    value: f.refluxTrigger,
    system: medimindParamSystem(ctx, 'refluxTrigger'),
    tag,
    isAbnormal: f.refluxTrigger === 'spontaneous',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'refluxType',
    paramLabel: 'Reflux type',
    value: f.refluxType,
    system: medimindParamSystem(ctx, 'refluxType'),
    tag,
    isAbnormal: f.refluxType === 'II' || f.refluxType === 'III',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'flowDirection',
    paramLabel: 'Flow direction',
    value: f.flowDirection,
    system: MEDIMIND_CODESYSTEMS.FLOW_DIRECTION,
    tag,
    isAbnormal: f.flowDirection === 'retrograde',
  });
  pushStringObservation(ctx, out, {
    bodySite,
    sideText,
    paramId: 'gonadalNote',
    paramLabel: 'Gonadal vein note',
    value: f.note,
    tag,
  });
}

// ---------------------------------------------------------------------------
// Zone 4 — pelvic plexus
// ---------------------------------------------------------------------------
function appendPlexus(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  side: Side,
  f: PelvicPlexusFinding,
): void {
  const bodySite = bodySiteForSegment('pelvic-plexus', side);
  const sideText = side === 'right' ? 'Right' : 'Left';
  const tag = `zone=plexus;side=${side}`;
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plexusDiameterMm',
    paramLabel: 'Plexus vein diameter',
    value: f.largestDiameterMm,
    system: medimindParamSystem(ctx, 'plexusDiameterMm'),
    unit: 'mm',
    tag,
    isAbnormal: (f.largestDiameterMm ?? 0) >= ILIAC_THRESHOLDS.plexusDiameterMm,
  });
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'refluxDurationS',
    paramLabel: 'Reflux duration',
    value: f.refluxDurationS,
    system: medimindParamSystem(ctx, 'refluxDurationS'),
    unit: 's',
    tag,
    isAbnormal: (f.refluxDurationS ?? 0) > ILIAC_THRESHOLDS.refluxDurationS,
  });
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: 'flowVelocityCmS',
    paramLabel: 'Flow velocity',
    value: f.flowVelocityCmS,
    system: medimindParamSystem(ctx, 'flowVelocityCmS'),
    unit: 'cm/s',
    tag,
    isAbnormal:
      f.flowVelocityCmS !== undefined && f.flowVelocityCmS < ILIAC_THRESHOLDS.plexusCongestedVelocityCmS,
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'refluxType',
    paramLabel: 'Reflux type',
    value: f.refluxType,
    system: medimindParamSystem(ctx, 'refluxType'),
    tag,
    isAbnormal: f.refluxType === 'II' || f.refluxType === 'III',
  });
  pushCodedCategorical(ctx, out, {
    bodySite,
    sideText,
    paramId: 'tortuosity',
    paramLabel: 'Tortuosity',
    value: f.tortuosity,
    system: medimindParamSystem(ctx, 'tortuosity'),
    tag,
    isAbnormal: f.tortuosity === 'severe',
  });
  if (f.crossingVeins === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'crossingVeins',
      paramLabel: 'Crossing (arcuate) veins',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  if (f.crossPelvicCollateral === true) {
    pushBooleanObservation(ctx, out, {
      bodySite,
      sideText,
      paramId: 'crossPelvicCollateral',
      paramLabel: 'Cross-pelvic collateral',
      value: true,
      tag,
      isAbnormal: true,
    });
  }
  pushStringObservation(ctx, out, {
    bodySite,
    sideText,
    paramId: 'plexusNote',
    paramLabel: 'Plexus note',
    value: f.note,
    tag,
  });
}

// ---------------------------------------------------------------------------
// Zone 5 — escape points + extrapelvic varices
// ---------------------------------------------------------------------------
function appendEscapePoint(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  ep: EscapePoint,
): void {
  // Escape points (perineal/inguinal/gluteal/obturator) are not the pelvic
  // plexus — SNOMED has no per-type body-structure concept, so emit a text-only
  // bodySite reflecting the actual point + side (audit H6) rather than
  // mis-coding every type as pelvic plexus.
  const lat = ep.side === 'right' ? 'Right' : 'Left';
  const bodySite = { text: `${ep.type} escape point (${lat})` };
  const sideText = ep.side === 'right' ? 'Right' : 'Left';
  const tag = `zone=escapePoint;type=${ep.type};side=${ep.side}`;
  pushCustomNumeric(ctx, out, {
    bodySite,
    sideText,
    paramId: `escapePoint_${ep.type}`,
    paramLabel: `Escape point (${ep.type}) diameter`,
    value: ep.diameterMm,
    system: medimindParamSystem(ctx, 'escapePointDiameterMm'),
    unit: 'mm',
    tag,
    isAbnormal: (ep.diameterMm ?? 0) > ILIAC_THRESHOLDS.escapePointDiameterMm,
  });
}

function appendExtrapelvic(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  ev: ExtrapelvicVarices,
): void {
  const sites: ReadonlyArray<[keyof ExtrapelvicVarices, string]> = [
    ['vulvar', 'Vulvar varices'],
    ['perineal', 'Perineal varices'],
    ['gluteal', 'Gluteal varices'],
    ['posteromedialThigh', 'Posteromedial-thigh varices'],
    ['sciatic', 'Sciatic varices'],
  ];
  for (const [key, label] of sites) {
    if (ev[key] === true) {
      pushBooleanObservation(ctx, out, {
        bodySite: { text: label },
        sideText: 'Pelvic',
        paramId: `extrapelvic_${key}`,
        paramLabel: label,
        value: true,
        tag: `zone=extrapelvic;type=${key}`,
        isAbnormal: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Zone 6 — arterial special considerations (SMAS / MALS)
// ---------------------------------------------------------------------------
function appendSpecialConsiderations(
  ctx: BuildContext,
  out: Array<BundleEntry<Observation>>,
  sc: SpecialConsiderationsFindings,
): void {
  const smas = sc.smas;
  if (smas?.smaAortaAngleDeg !== undefined || smas?.note) {
    const smaSite = bodySiteForSegment('superior-mesenteric-artery');
    const smasTag = 'zone=specialConsiderations;syndrome=smas';
    if (smas.smaAortaAngleDeg !== undefined) {
      pushCustomNumeric(ctx, out, {
        bodySite: smaSite,
        sideText: 'Midline',
        paramId: 'smaAortaAngleDeg',
        paramLabel: 'SMA-aorta angle',
        value: smas.smaAortaAngleDeg,
        system: medimindParamSystem(ctx, 'smaAortaAngleDeg'),
        unit: 'deg',
        tag: smasTag,
        isAbnormal: smas.smaAortaAngleDeg < ILIAC_THRESHOLDS.smasAortaAngleDeg,
      });
    }
    if (smas.note) {
      pushStringObservation(ctx, out, {
        bodySite: smaSite,
        sideText: 'Midline',
        paramId: 'smasNote',
        paramLabel: 'SMAS note',
        value: smas.note,
        tag: smasTag,
      });
    }
  }

  const mals = sc.mals;
  if (!mals) return;
  const celiac = bodySiteForSegment('celiac-artery');
  const malsTag = 'zone=specialConsiderations;syndrome=mals';
  if (mals.caInspiratoryPsvCmS !== undefined) {
    pushCustomNumeric(ctx, out, {
      bodySite: celiac,
      sideText: 'Midline',
      paramId: 'caInspiratoryPsvCmS',
      paramLabel: 'Celiac artery PSV (inspiration)',
      value: mals.caInspiratoryPsvCmS,
      system: medimindParamSystem(ctx, 'caInspiratoryPsvCmS'),
      unit: 'cm/s',
      tag: malsTag,
      isAbnormal: false,
    });
  }
  if (mals.caExpiratoryPsvCmS !== undefined) {
    pushCustomNumeric(ctx, out, {
      bodySite: celiac,
      sideText: 'Midline',
      paramId: 'caExpiratoryPsvCmS',
      paramLabel: 'Celiac artery PSV (expiration)',
      value: mals.caExpiratoryPsvCmS,
      system: medimindParamSystem(ctx, 'caExpiratoryPsvCmS'),
      unit: 'cm/s',
      tag: malsTag,
      isAbnormal: mals.caExpiratoryPsvCmS > ILIAC_THRESHOLDS.malsExpiratoryPsvCmS,
    });
  }
  if (mals.chaPsvCmS !== undefined) {
    pushCustomNumeric(ctx, out, {
      bodySite: bodySiteForSegment('common-hepatic-artery'),
      sideText: 'Midline',
      paramId: 'chaPsvCmS',
      paramLabel: 'Common hepatic artery PSV',
      value: mals.chaPsvCmS,
      system: medimindParamSystem(ctx, 'chaPsvCmS'),
      unit: 'cm/s',
      tag: malsTag,
      isAbnormal: false,
    });
  }
  if (mals.splenicPsvCmS !== undefined) {
    pushCustomNumeric(ctx, out, {
      bodySite: bodySiteForSegment('splenic-artery'),
      sideText: 'Midline',
      paramId: 'splenicPsvCmS',
      paramLabel: 'Splenic artery PSV',
      value: mals.splenicPsvCmS,
      system: medimindParamSystem(ctx, 'splenicPsvCmS'),
      unit: 'cm/s',
      tag: malsTag,
      isAbnormal: false,
    });
  }
  if (mals.hookSign === true) {
    pushBooleanObservation(ctx, out, {
      bodySite: celiac,
      sideText: 'Midline',
      paramId: 'hookSign',
      paramLabel: 'Hook-shaped celiac artery',
      value: true,
      tag: malsTag,
      isAbnormal: true,
    });
  }
  if (mals.note) {
    pushStringObservation(ctx, out, {
      bodySite: celiac,
      sideText: 'Midline',
      paramId: 'malsNote',
      paramLabel: 'MALS note',
      value: mals.note,
      tag: malsTag,
    });
  }
}
