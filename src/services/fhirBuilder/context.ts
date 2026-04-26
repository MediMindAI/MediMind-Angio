/**
 * Build context + shared low-level helpers used by every per-resource module.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. All IDs + derived refs are minted here
 * once per bundle so the resource builders stay pure transformers.
 */

import type { FormState } from '../../types/form';
import type { CodeableConcept } from '../../types/fhir';
import {
  MEDIMIND_EXTENSIONS,
  STANDARD_FHIR_SYSTEMS,
  VASCULAR_LOINC,
  VASCULAR_SEGMENTS_SNOMED,
} from '../../constants/fhir-systems';

// ============================================================================
// Build context
// ============================================================================

export interface BuildContext {
  readonly form: FormState;
  readonly nowIso: string;
  readonly patientId: string;
  readonly patientRef: string;
  readonly panelId: string;
  readonly panelRef: string;
  readonly qrId: string;
  readonly qrRef: string;
  readonly reportId: string;
  readonly reportRef: string;
  readonly ceapObsId: string | null;
  readonly ceapObsRef: string | null;
  readonly encounterId: string | null;
  readonly encounterRef: string | null;
  readonly serviceRequestId: string | null;
  readonly serviceRequestRef: string | null;
  readonly consentId: string | null;
  readonly consentRef: string | null;
  readonly positionObsId: string | null;
  readonly sonographerObsId: string | null;
  readonly clinicianObsId: string | null;
  readonly loincCode: string;
  readonly loincDisplay: string;
}

export function createContext(form: FormState): BuildContext {
  const nowIso = new Date().toISOString();
  const loinc = VASCULAR_LOINC[form.studyType];
  // Runtime guard — typing makes this dead code under correct usage, but a
  // freshly-added StudyType without a matching VASCULAR_LOINC entry would
  // otherwise crash on the next .code access (Area 03 CRITICAL).
  if (!loinc) {
    throw new Error(`fhirBuilder: no VASCULAR_LOINC mapping for studyType "${form.studyType}"`);
  }
  const patientId = newUuid();
  const panelId = newUuid();
  const qrId = newUuid();
  const reportId = newUuid();
  const hasCeap = !!form.ceap;
  const ceapObsId = hasCeap ? newUuid() : null;

  // Phase 1.5 optional resources — allocate IDs only if inputs are present.
  const header = form.header;
  const hasIcd10 = Array.isArray(header.icd10Codes) && header.icd10Codes.length > 0;
  const hasCpt = !!header.cptCode;
  const hasConsent = header.informedConsent === true;
  const hasPosition = !!header.patientPosition;
  const hasSonographer =
    typeof form.narrative.sonographerComments === 'string' &&
    form.narrative.sonographerComments.trim().length > 0;
  const hasClinician =
    typeof form.narrative.clinicianComments === 'string' &&
    form.narrative.clinicianComments.trim().length > 0;

  const encounterId = hasIcd10 ? newUuid() : null;
  const serviceRequestId = hasCpt ? newUuid() : null;
  const consentId = hasConsent ? newUuid() : null;
  const positionObsId = hasPosition ? newUuid() : null;
  const sonographerObsId = hasSonographer ? newUuid() : null;
  const clinicianObsId = hasClinician ? newUuid() : null;

  return {
    form,
    nowIso,
    patientId,
    patientRef: urnRef(patientId),
    panelId,
    panelRef: urnRef(panelId),
    qrId,
    qrRef: urnRef(qrId),
    reportId,
    reportRef: urnRef(reportId),
    ceapObsId,
    ceapObsRef: ceapObsId ? urnRef(ceapObsId) : null,
    encounterId,
    encounterRef: encounterId ? urnRef(encounterId) : null,
    serviceRequestId,
    serviceRequestRef: serviceRequestId ? urnRef(serviceRequestId) : null,
    consentId,
    consentRef: consentId ? urnRef(consentId) : null,
    positionObsId,
    sonographerObsId,
    clinicianObsId,
    loincCode: loinc.code,
    loincDisplay: loinc.display,
  };
}

// ============================================================================
// Shared helpers
// ============================================================================

export function bodySiteForSegment(segment: string): CodeableConcept {
  const entry = VASCULAR_SEGMENTS_SNOMED[segment];
  if (!entry || entry.code === '-') {
    // Unmapped segment — still return the text so the Observation carries the site.
    return { text: segment };
  }
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: entry.code,
        display: entry.display,
      },
    ],
    text: entry.display,
  };
}

export function observationCategory(code: 'imaging' | 'laboratory'): CodeableConcept {
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.OBSERVATION_CATEGORY,
        code,
        display: code === 'imaging' ? 'Imaging' : 'Laboratory',
      },
    ],
    text: code === 'imaging' ? 'Imaging' : 'Laboratory',
  };
}

export function interpretationAbnormal(): CodeableConcept {
  return {
    coding: [
      {
        system: STANDARD_FHIR_SYSTEMS.OBSERVATION_INTERPRETATION,
        code: 'A',
        display: 'Abnormal',
      },
    ],
    text: 'Abnormal',
  };
}

export function medimindParamSystem(paramId: string): string {
  // A lightweight per-parameter CodeSystem under the MediMind namespace — lets
  // the downstream consumer distinguish e.g. compressibility values from
  // phasicity values even though we reuse tokens like `normal`/`absent`.
  // Prefix kept as `venous-` for back-compat with already-emitted venous
  // bundles; arterial + carotid numerics use their own system URLs via
  // `MEDIMIND_CODESYSTEMS` where a dedicated CodeSystem is warranted.
  return `http://medimind.ge/fhir/CodeSystem/venous-${paramId}`;
}

export function urnRef(id: string): string {
  return `urn:uuid:${id}`;
}

export function newUuid(): string {
  // `crypto.randomUUID` exists in Node >=19 and all modern browsers. The
  // runtime target for this app is both.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Minimal fallback — only used in the vanishingly rare env without
  // WebCrypto. Not cryptographically strong; acceptable for bundle IDs.
  return Array.from({ length: 36 }, (_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return '-';
    if (i === 14) return '4';
    const r = (Math.random() * 16) | 0;
    const v = i === 19 ? (r & 0x3) | 0x8 : r;
    return v.toString(16);
  }).join('');
}

// Re-export `MEDIMIND_EXTENSIONS` for the patient-position observation which
// builds a sibling URL by string substitution. Keeps the import surface of
// `observations/perPerformer.ts` symmetrical with the rest of the modules.
export { MEDIMIND_EXTENSIONS };
