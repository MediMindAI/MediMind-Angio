/**
 * QuestionnaireResponse builder + structured-form serializers.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. The QR is the lossless snapshot of
 * the entire form state, so every input field round-trips through here.
 */

import type {
  FormState,
  StudyHeader,
  StudyNarrative,
} from '../../types/form';
import type { SegmentState } from '../../types/anatomy';
import type {
  BundleEntry,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from '../../types/fhir';
import { formatCeapClassification } from '../ceapService';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildQuestionnaireResponseEntry(
  ctx: BuildContext
): BundleEntry<QuestionnaireResponse> {
  const items = buildQuestionnaireItems(ctx.form);
  const qr: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    id: ctx.qrId,
    status: 'completed',
    subject: { reference: ctx.patientRef },
    authored: ctx.nowIso,
    item: items,
  };
  return {
    fullUrl: urnRef(ctx.qrId),
    resource: qr,
    request: { method: 'POST', url: 'QuestionnaireResponse' },
  };
}

function buildQuestionnaireItems(form: FormState): ReadonlyArray<QuestionnaireResponseItem> {
  const items: QuestionnaireResponseItem[] = [];

  items.push({
    linkId: 'studyType',
    text: 'Study type',
    answer: [{ valueString: form.studyType }],
  });

  items.push(headerToItem(form.header));
  items.push(narrativeToItem(form.narrative));

  if (form.segments.length > 0) {
    items.push({
      linkId: 'segments',
      text: 'Segments',
      item: form.segments.map((s) => segmentStateToItem(s)),
    });
  }

  if (form.recommendations.length > 0) {
    items.push({
      linkId: 'recommendations',
      text: 'Recommendations',
      item: form.recommendations.map((r) => ({
        linkId: r.id,
        text: r.text,
        answer: [
          { valueString: r.text },
          ...(r.priority ? [{ valueString: `priority:${r.priority}` }] : []),
          ...(r.followUpInterval ? [{ valueString: `followUp:${r.followUpInterval}` }] : []),
        ],
      })),
    });
  }

  if (form.ceap) {
    items.push({
      linkId: 'ceap',
      text: 'CEAP classification',
      answer: [{ valueString: formatCeapClassification(form.ceap) }],
    });
  }

  // Segment-findings table (venous studies): stored under `parameters.segmentFindings`
  // by the form UI — serialize as a JSON blob so nothing is lost in the QR snapshot.
  const segFindings = form.parameters['segmentFindings'];
  if (segFindings && typeof segFindings === 'object') {
    items.push({
      linkId: 'segmentFindings',
      text: 'Per-segment findings',
      answer: [{ valueString: JSON.stringify(segFindings) }],
    });
  }

  return items;
}

function headerToItem(header: StudyHeader): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'patientName', 'Patient name', header.patientName);
  pushString(fields, 'patientId', 'Patient ID', header.patientId);
  pushString(fields, 'patientBirthDate', 'Birth date', header.patientBirthDate);
  pushString(fields, 'patientGender', 'Gender', header.patientGender);
  pushString(fields, 'studyDate', 'Study date', header.studyDate);
  pushString(fields, 'operatorName', 'Operator', header.operatorName);
  pushString(fields, 'referringPhysician', 'Referring physician', header.referringPhysician);
  pushString(fields, 'institution', 'Institution', header.institution);
  pushString(fields, 'accessionNumber', 'Accession number', header.accessionNumber);
  // Phase 1.5 additions
  if (header.informedConsent !== undefined) {
    fields.push({
      linkId: 'informedConsent',
      text: 'Informed consent',
      answer: [{ valueBoolean: header.informedConsent }],
    });
  }
  pushString(fields, 'informedConsentSignedAt', 'Consent signed at', header.informedConsentSignedAt);
  pushString(fields, 'patientPosition', 'Patient position', header.patientPosition);
  pushString(fields, 'medications', 'Medications', header.medications);
  if (header.icd10Codes && header.icd10Codes.length > 0) {
    fields.push({
      linkId: 'icd10Codes',
      text: 'ICD-10 indications',
      answer: header.icd10Codes.map((c) => ({ valueString: `${c.code} ${c.display}` })),
    });
  }
  if (header.cptCode) {
    fields.push({
      linkId: 'cptCode',
      text: 'CPT procedure code',
      answer: [{ valueString: `${header.cptCode.code} ${header.cptCode.display}` }],
    });
  }
  return { linkId: 'header', text: 'Study header', item: fields };
}

function narrativeToItem(narrative: StudyNarrative): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'indication', 'Indication', narrative.indication);
  pushString(fields, 'technique', 'Technique', narrative.technique);
  pushString(fields, 'findings', 'Findings', narrative.findings);
  pushString(fields, 'impression', 'Impression', narrative.impression);
  pushString(fields, 'comments', 'Comments', narrative.comments);
  pushString(fields, 'sonographerComments', 'Sonographer comments', narrative.sonographerComments);
  pushString(fields, 'clinicianComments', 'Clinician comments', narrative.clinicianComments);
  return { linkId: 'narrative', text: 'Narrative', item: fields };
}

function segmentStateToItem(s: SegmentState): QuestionnaireResponseItem {
  const fields: QuestionnaireResponseItem[] = [];
  pushString(fields, 'segmentId', 'Segment ID', s.segmentId);
  pushString(fields, 'side', 'Side', s.side);
  pushString(fields, 'competency', 'Competency', s.competency);
  pushString(fields, 'stenosis', 'Stenosis', s.stenosis);
  pushNumber(fields, 'refluxDurationMs', 'Reflux duration (ms)', s.refluxDurationMs);
  pushNumber(fields, 'diameterMm', 'Diameter (mm)', s.diameterMm);
  pushNumber(fields, 'peakSystolicVelocityCmS', 'Peak systolic velocity (cm/s)', s.peakSystolicVelocityCmS);
  pushString(fields, 'note', 'Note', s.note);
  return { linkId: `seg-${s.segmentId}-${s.side}`, item: fields };
}

// ============================================================================
// QR helpers (small, boring)
// ============================================================================

function pushString(
  out: QuestionnaireResponseItem[],
  linkId: string,
  text: string,
  value: string | undefined
): void {
  if (!value) return;
  out.push({ linkId, text, answer: [{ valueString: value }] });
}

function pushNumber(
  out: QuestionnaireResponseItem[],
  linkId: string,
  text: string,
  value: number | undefined
): void {
  if (value === undefined || Number.isNaN(value)) return;
  out.push({ linkId, text, answer: [{ valueDecimal: value }] });
}
