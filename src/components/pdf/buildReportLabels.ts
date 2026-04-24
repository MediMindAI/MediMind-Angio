/**
 * buildReportLabels — pre-resolve every string the PDF renderer needs.
 *
 * `@react-pdf/renderer` runs under its own React reconciler and does not
 * share our TranslationContext. Callers must bundle the fully translated
 * labels up-front and pass them to `ReportDocument` as `labels`.
 *
 * This helper takes the host app's `t()` function and emits the entire
 * `ReportLabels` bundle. Keep additions synchronized with the label
 * interfaces in `pdf/sections/*`.
 */

import type { ReportLabels } from './ReportDocument';
import type { VenousLESegmentBase } from '../studies/venous-le/config';
import { VENOUS_LE_SEGMENTS } from '../studies/venous-le/config';
import type {
  ArterialLESegmentBase,
  Waveform,
  StenosisCategory,
  PlaqueMorphology as ArterialPlaqueMorphology,
  AbiBand,
} from '../studies/arterial-le/config';
import {
  ARTERIAL_LE_SEGMENTS,
  WAVEFORM_VALUES,
  STENOSIS_CATEGORY_VALUES,
  PLAQUE_MORPHOLOGY_VALUES as ARTERIAL_PLAQUE_VALUES,
} from '../studies/arterial-le/config';
import type {
  CarotidVesselBase,
  FlowDirection,
  PlaqueMorphology as CarotidPlaqueMorphology,
  PlaqueSurface,
  NascetCategory,
} from '../studies/carotid/config';
import {
  CAROTID_VESSELS,
  FLOW_DIRECTION_VALUES,
  PLAQUE_MORPHOLOGY_VALUES as CAROTID_PLAQUE_VALUES,
  PLAQUE_SURFACE_VALUES,
  NASCET_CATEGORY_VALUES,
} from '../studies/carotid/config';
import type { Competency } from '../../types/anatomy';
import { PATIENT_POSITIONS } from '../../types/patient-position';
import type { FormState } from '../../types/form';
import type { Language } from '../../contexts/TranslationContext';
import { cptDisplay as formatCptDisplay, findCptByCode } from '../../constants/vascular-cpt';

export type TFunction = (key: string, fallbackOrParams?: string | Record<string, unknown>) => string;

/**
 * Build the full label bundle for the PDF from the caller's translate function.
 *
 * `form` + `lang` are used to:
 *   - dispatch the PDF title key on `form.studyType` (so arterial + carotid don't
 *     ship with the venous title)
 *   - re-derive the CPT-code display from `VASCULAR_CPT` using the active language
 *     (the form-stored display is frozen at form-init time in English)
 */
export function buildReportLabels(
  t: TFunction,
  form?: FormState,
  lang?: Language,
): ReportLabels {
  const titleKey =
    form?.studyType === 'arterialLE'
      ? 'arterialLE.form.title'
      : form?.studyType === 'carotid'
      ? 'carotid.form.title'
      : 'venousLE.form.title';
  const subtitleKey =
    form?.studyType === 'arterialLE'
      ? 'arterialLE.form.subtitle'
      : form?.studyType === 'carotid'
      ? 'carotid.form.subtitle'
      : 'venousLE.form.subtitle';

  // Re-derive localized CPT display from the lookup table using the active language.
  const cptCode = form?.header.cptCode?.code;
  const cptEntry = cptCode ? findCptByCode(cptCode) : undefined;
  const cptLocalizedDisplay =
    cptEntry && lang ? formatCptDisplay(cptEntry, lang) : undefined;
  // Per-segment names keyed by base id — the FindingsTable walks VENOUS_LE_SEGMENTS.
  const segmentName: Record<VenousLESegmentBase, string> = VENOUS_LE_SEGMENTS.reduce(
    (acc, base) => {
      acc[base] = t(`venousLE.segment.${base}`, base);
      return acc;
    },
    {} as Record<VenousLESegmentBase, string>,
  );

  const legend: Record<Competency, string> = {
    normal: t('competency.normal', 'Normal'),
    ablated: t('competency.ablated', 'Ablated'),
    incompetent: t('competency.incompetent', 'Incompetent'),
    inconclusive: t('competency.inconclusive', 'Inconclusive'),
  };

  const positionLabels: Record<string, string> = PATIENT_POSITIONS.reduce(
    (acc, p) => {
      acc[p] = t(`venousLE.header.position.${p}`, p);
      return acc;
    },
    {} as Record<string, string>,
  );

  // ----- Arterial LE -----
  const arterialSegmentName: Record<ArterialLESegmentBase, string> =
    ARTERIAL_LE_SEGMENTS.reduce(
      (acc, base) => {
        acc[base] = t(`arterialLE.segment.${base}`, base);
        return acc;
      },
      {} as Record<ArterialLESegmentBase, string>,
    );

  const waveformName: Record<Waveform, string> = WAVEFORM_VALUES.reduce(
    (acc, v) => {
      acc[v] = t(`arterialLE.waveform.${v}`, v);
      return acc;
    },
    {} as Record<Waveform, string>,
  );

  const stenosisName: Record<StenosisCategory, string> = STENOSIS_CATEGORY_VALUES.reduce(
    (acc, v) => {
      acc[v] = t(`arterialLE.stenosis.${v}`, v);
      return acc;
    },
    {} as Record<StenosisCategory, string>,
  );

  const arterialPlaqueName: Record<ArterialPlaqueMorphology, string> =
    ARTERIAL_PLAQUE_VALUES.reduce(
      (acc, v) => {
        acc[v] = t(`arterialLE.plaque.${v}`, v);
        return acc;
      },
      {} as Record<ArterialPlaqueMorphology, string>,
    );

  const abiBand: Record<AbiBand, string> = {
    'non-compressible': t('arterialLE.abi.band.non-compressible', 'Non-compressible'),
    normal: t('arterialLE.abi.band.normal', 'Normal'),
    mild: t('arterialLE.abi.band.mild', 'Mild PAD'),
    moderate: t('arterialLE.abi.band.moderate', 'Moderate PAD'),
    severe: t('arterialLE.abi.band.severe', 'Severe / CLI'),
    unknown: t('arterialLE.abi.band.unknown', '—'),
  };

  // ----- Carotid -----
  const vesselName: Record<CarotidVesselBase, string> = CAROTID_VESSELS.reduce(
    (acc, base) => {
      acc[base] = t(`carotid.vessel.${base}`, base);
      return acc;
    },
    {} as Record<CarotidVesselBase, string>,
  );

  const flowName: Record<FlowDirection, string> = FLOW_DIRECTION_VALUES.reduce(
    (acc, v) => {
      acc[v] = t(`carotid.flow.${v}`, v);
      return acc;
    },
    {} as Record<FlowDirection, string>,
  );

  const carotidPlaqueName: Record<CarotidPlaqueMorphology, string> =
    CAROTID_PLAQUE_VALUES.reduce(
      (acc, v) => {
        acc[v] = t(`carotid.plaque.${v}`, v);
        return acc;
      },
      {} as Record<CarotidPlaqueMorphology, string>,
    );

  const surfaceName: Record<PlaqueSurface, string> = PLAQUE_SURFACE_VALUES.reduce(
    (acc, v) => {
      acc[v] = t(`carotid.surface.${v}`, v);
      return acc;
    },
    {} as Record<PlaqueSurface, string>,
  );

  const nascetCategoryName: Record<NascetCategory, string> = NASCET_CATEGORY_VALUES.reduce(
    (acc, v) => {
      acc[v] = t(`carotid.nascet.${v}`, v);
      return acc;
    },
    {} as Record<NascetCategory, string>,
  );

  return {
    title: t(titleKey, 'Vascular Duplex Report'),
    subtitle: t(subtitleKey, ''),
    preliminary: t('venousLE.status.preliminary', 'Preliminary'),
    patient: {
      patientName: t('venousLE.header.patientName', 'Patient name'),
      mrn: t('venousLE.header.patientId', 'Medical record #'),
      dob: t('venousLE.header.birthDate', 'Date of birth'),
      age: t('venousLE.header.age', 'Age'),
      gender: t('venousLE.header.gender', 'Gender'),
      studyDate: t('venousLE.header.studyDate', 'Study date'),
      operator: t('venousLE.header.operator', 'Operator'),
      referring: t('venousLE.header.referringPhysician', 'Referring physician'),
      institution: t('venousLE.header.institution', 'Institution'),
      accession: t('venousLE.header.accession', 'Accession #'),
      patientPosition: t('venousLE.header.patientPosition', 'Patient position'),
      medications: t('venousLE.header.medications', 'Medications'),
      icd10Codes: t('venousLE.header.icd10Codes', 'ICD-10 indications'),
      cptCode: t('venousLE.header.cptCode', 'CPT code'),
      informedConsent: t('venousLE.header.informedConsent', 'Informed consent'),
      informedConsentYes: t('venousLE.header.informedConsentYes', 'Yes'),
      informedConsentNo: t('venousLE.header.informedConsentNo', 'No'),
      positionLabels,
      cptLocalizedDisplay,
    },
    diagram: {
      anterior: t('anatomy.view.le-anterior', 'Anterior view'),
      posterior: t('anatomy.view.le-posterior', 'Posterior view'),
      legendLabel: t('anatomy.legend.label', 'Competency legend'),
      legend,
    },
    findings: {
      right: t('venousLE.tabs.right', 'Right'),
      left: t('venousLE.tabs.left', 'Left'),
      segment: t('venousLE.segmentTable.segment', 'Segment'),
      refluxMs: t('venousLE.refluxTable.msShort', 'Dur. (ms)'),
      apMm: t('venousLE.refluxTable.ap', 'AP (mm)'),
      transMm: t('venousLE.refluxTable.trans', 'Trans (mm)'),
      depthMm: t('venousLE.refluxTable.depth', 'Depth (mm)'),
      segmentName,
      emptyDash: '—',
    },
    arterialFindings: {
      right: t('arterialLE.tabs.right', 'Right'),
      left: t('arterialLE.tabs.left', 'Left'),
      segment: t('arterialLE.segmentTable.segment', 'Segment'),
      waveform: t('arterialLE.findingsTable.waveShort', t('arterialLE.param.waveform', 'Waveform')),
      psv: t('arterialLE.findingsTable.psvShort', t('arterialLE.param.psvCmS', 'PSV')),
      stenosis: t('arterialLE.findingsTable.stenShort', t('arterialLE.param.stenosisCategory', 'Stenosis')),
      plaque: t('arterialLE.findingsTable.plaqueShort', t('arterialLE.param.plaqueMorphology', 'Plaque')),
      occluded: t('arterialLE.findingsTable.occlShort', t('arterialLE.param.occluded', 'Occl.')),
      occludedMark: '✓',
      segmentName: arterialSegmentName,
      waveformName,
      stenosisName,
      plaqueName: arterialPlaqueName,
      emptyDash: '—',
    },
    pressures: {
      title: t('arterialLE.pressureTable.title', t('arterialLE.pressures.title', 'Segmental pressures (mmHg)')),
      sideRight: t('arterialLE.pressureTable.sideRight', 'R'),
      sideLeft: t('arterialLE.pressureTable.sideLeft', 'L'),
      brachial: t('arterialLE.pressureTable.brachialShort', t('arterialLE.pressures.brachial', 'Brachial')),
      highThigh: t('arterialLE.pressureTable.highThighShort', t('arterialLE.pressures.highThigh', 'High thigh')),
      lowThigh: t('arterialLE.pressureTable.lowThighShort', t('arterialLE.pressures.lowThigh', 'Low thigh')),
      calf: t('arterialLE.pressureTable.calfShort', t('arterialLE.pressures.calf', 'Calf')),
      ankleDp: t('arterialLE.pressureTable.ankleDpShort', t('arterialLE.pressures.ankleDp', 'Ankle DP')),
      anklePt: t('arterialLE.pressureTable.anklePtShort', t('arterialLE.pressures.anklePt', 'Ankle PT')),
      toe: t('arterialLE.pressureTable.toeShort', t('arterialLE.pressures.toe', 'Toe')),
      abi: t('arterialLE.abi.label', 'ABI'),
      tbi: t('arterialLE.tbi.label', 'TBI'),
      abiBand,
      emptyDash: '—',
    },
    carotidFindings: {
      right: t('carotid.tabs.right', 'Right'),
      left: t('carotid.tabs.left', 'Left'),
      vessel: t('carotid.segmentTable.vessel', 'Vessel'),
      psv: t('carotid.findingsTable.psvShort', t('carotid.param.psvCmS', 'PSV')),
      edv: t('carotid.findingsTable.edvShort', t('carotid.param.edvCmS', 'EDV')),
      flow: t('carotid.findingsTable.flowShort', t('carotid.param.flowDirection', 'Flow')),
      plaque: t('carotid.findingsTable.plaqueShort', t('carotid.param.plaqueMorphology', 'Plaque')),
      ratio: t('carotid.findingsTable.ratioShort', t('carotid.param.ratio', 'ICA/CCA')),
      ulcerationMark: t('carotid.findingsTable.ulcerationMark', '⚠'),
      vesselName,
      flowName,
      plaqueName: carotidPlaqueName,
      surfaceName,
      emptyDash: '—',
    },
    nascet: {
      title: t('carotid.nascetSummary.title', t('carotid.nascet.title', 'NASCET classification')),
      rightIca: t('carotid.nascetSummary.rightIca', 'Right ICA'),
      leftIca: t('carotid.nascetSummary.leftIca', 'Left ICA'),
      categoryName: nascetCategoryName,
      noneLabel: t('carotid.nascetSummary.noneLabel', '—'),
    },
    narrative: {
      rightFindings: t(
        'venousLE.narrativeSections.rightFindings',
        'Right lower extremity — findings',
      ),
      leftFindings: t(
        'venousLE.narrativeSections.leftFindings',
        'Left lower extremity — findings',
      ),
      indication: t('venousLE.header.indicationNotes', t('venousLE.header.indication', 'Indication')),
      technique: t('venousLE.technique', 'Technique'),
      findings: t('venousLE.findings', 'Findings'),
      impression: t('venousLE.impression.title', 'Impression'),
      comments: t('venousLE.comments', 'Comments'),
      conclusions: t('venousLE.narrativeSections.conclusions', 'Conclusions'),
      sonographerComments: t('venousLE.narrative.sonographerComments', 'Sonographer comments'),
      clinicianComments: t('venousLE.narrative.clinicianComments', 'Clinician impression'),
    },
    ceap: {
      heading: t('venousLE.ceap.title', 'CEAP 2020 Classification'),
      cAxis: t('venousLE.ceap.cSection', 'C — Clinical signs'),
      eAxis: t('venousLE.ceap.eSection', 'E — Etiology'),
      aAxis: t('venousLE.ceap.aSection', 'A — Anatomy'),
      pAxis: t('venousLE.ceap.pSection', 'P — Pathophysiology'),
    },
    recommendations: {
      heading: t('venousLE.recommendations.title', 'Recommendations'),
      priority: {
        routine: t('venousLE.recommendations.priorityRoutine', 'Routine'),
        urgent: t('venousLE.recommendations.priorityUrgent', 'Urgent'),
        stat: t('venousLE.recommendations.priorityStat', 'Stat'),
      },
      followUpPrefix: t('venousLE.followUpPrefix', 'Follow-up:'),
    },
    footer: {
      pageLabelTemplate: t('pdf.pageLabel', 'Page {current} / {total}'),
    },
  };
}

export default buildReportLabels;
