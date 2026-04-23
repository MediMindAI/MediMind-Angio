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
import type { Competency } from '../../types/anatomy';
import { PATIENT_POSITIONS } from '../../types/patient-position';

export type TFunction = (key: string, fallbackOrParams?: string | Record<string, unknown>) => string;

/**
 * Build the full label bundle for the PDF from the caller's translate function.
 */
export function buildReportLabels(t: TFunction): ReportLabels {
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

  return {
    title: t('venousLE.form.title', t('venousLE.title', 'Lower Extremity Venous Duplex')),
    subtitle: t('venousLE.form.subtitle', 'Bilateral reflux + DVT assessment'),
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
      refluxMs: t('venousLE.refluxTable.ms', 'Duration (ms)'),
      apMm: t('venousLE.refluxTable.ap', 'AP (mm)'),
      transMm: t('venousLE.refluxTable.trans', 'Trans (mm)'),
      depthMm: t('venousLE.refluxTable.depth', 'Depth (mm)'),
      segmentName,
      emptyDash: '—',
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
