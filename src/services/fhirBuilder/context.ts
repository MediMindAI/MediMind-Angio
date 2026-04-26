/**
 * Build context + shared low-level helpers used by every per-resource module.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. All IDs + derived refs are minted here
 * once per bundle so the resource builders stay pure transformers.
 */

import type { FormState } from '../../types/form';
import type { CodeableConcept } from '../../types/fhir';
import type { StudyType } from '../../types/study';
import {
  FHIR_BASE_URL,
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
  // Wave 3.4 — Practitioner / Organization references so header.operatorName,
  // header.referringPhysician, and header.institution flow into typed FHIR
  // slots (DiagnosticReport.performer, ServiceRequest.requester,
  // Encounter.serviceProvider) instead of dead-ending as free-text strings
  // (Area 05 HIGH).
  readonly operatorPractitionerId: string | null;
  readonly operatorPractitionerRef: string | null;
  readonly referrerPractitionerId: string | null;
  readonly referrerPractitionerRef: string | null;
  readonly institutionOrganizationId: string | null;
  readonly institutionOrganizationRef: string | null;
  readonly loincCode: string;
  readonly loincDisplay: string;
  /**
   * Per-parameter CodeSystem URL prefix (e.g. `venous` → emits
   * `/CodeSystem/venous-stenosisPct`). Wave 3.6 fix for Part 05 HIGH — the
   * prior `medimindParamSystem` hard-coded `venous-` regardless of study,
   * so an arterial Observation carried `system: ".../venous-stenosisPct"`.
   */
  readonly paramPrefix: 'venous' | 'arterial' | 'carotid' | 'ivc';
}

function paramPrefixForStudy(studyType: StudyType): 'venous' | 'arterial' | 'carotid' | 'ivc' {
  switch (studyType) {
    case 'venousLEBilateral':
    case 'venousLERight':
    case 'venousLELeft':
      return 'venous';
    case 'arterialLE':
      return 'arterial';
    case 'carotid':
      return 'carotid';
    case 'ivcDuplex':
      return 'ivc';
  }
}

/**
 * Encounter-level refs that are minted ONCE per encounter and reused by
 * every per-study sub-context inside a multi-study Bundle (Phase 4a).
 *
 * Single-study Bundles still go through `createContext`, which mints these
 * refs internally — so existing call-sites (`buildFhirBundle`, the Wave 1.4-
 * 1.6 test corpus) keep working byte-identically.
 */
export interface SharedEncounterRefs {
  readonly nowIso: string;
  readonly patientId: string;
  readonly patientRef: string;
  readonly encounterId: string | null;
  readonly encounterRef: string | null;
  readonly operatorPractitionerId: string | null;
  readonly operatorPractitionerRef: string | null;
  readonly referrerPractitionerId: string | null;
  readonly referrerPractitionerRef: string | null;
  readonly institutionOrganizationId: string | null;
  readonly institutionOrganizationRef: string | null;
}

/**
 * Mint per-study IDs (panel / QR / report / CEAP / consent / position /
 * sonographer / clinician / serviceRequest) given a form. Pure ID minting —
 * no behavioral logic. Both `createContext` and `createSharedContext` reuse
 * this helper so the gating rules for optional resources stay in one place.
 */
function mintPerStudyIds(form: FormState): {
  readonly panelId: string;
  readonly qrId: string;
  readonly reportId: string;
  readonly ceapObsId: string | null;
  readonly serviceRequestId: string | null;
  readonly consentId: string | null;
  readonly positionObsId: string | null;
  readonly sonographerObsId: string | null;
  readonly clinicianObsId: string | null;
} {
  const header = form.header;
  const hasCeap = !!form.ceap;
  const hasCpt = !!header.cptCode;
  const hasConsent = header.informedConsent === true;
  const hasPosition = !!header.patientPosition;
  const hasSonographer =
    typeof form.narrative.sonographerComments === 'string' &&
    form.narrative.sonographerComments.trim().length > 0;
  const hasClinician =
    typeof form.narrative.clinicianComments === 'string' &&
    form.narrative.clinicianComments.trim().length > 0;

  return {
    panelId: newUuid(),
    qrId: newUuid(),
    reportId: newUuid(),
    ceapObsId: hasCeap ? newUuid() : null,
    serviceRequestId: hasCpt ? newUuid() : null,
    consentId: hasConsent ? newUuid() : null,
    positionObsId: hasPosition ? newUuid() : null,
    sonographerObsId: hasSonographer ? newUuid() : null,
    clinicianObsId: hasClinician ? newUuid() : null,
  };
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
  const perStudy = mintPerStudyIds(form);

  // Phase 1.5 optional resources — allocate IDs only if inputs are present.
  const header = form.header;
  const hasIcd10 = Array.isArray(header.icd10Codes) && header.icd10Codes.length > 0;

  const encounterId = hasIcd10 ? newUuid() : null;

  // Practitioner / Organization presence — gated on the source string being
  // non-empty after trim so blank header fields don't spawn empty resources.
  const hasOperator =
    typeof header.operatorName === 'string' && header.operatorName.trim().length > 0;
  const hasReferrer =
    typeof header.referringPhysician === 'string' &&
    header.referringPhysician.trim().length > 0;
  const hasInstitution =
    typeof header.institution === 'string' && header.institution.trim().length > 0;
  const operatorPractitionerId = hasOperator ? newUuid() : null;
  const referrerPractitionerId = hasReferrer ? newUuid() : null;
  const institutionOrganizationId = hasInstitution ? newUuid() : null;

  return {
    form,
    nowIso,
    patientId,
    patientRef: urnRef(patientId),
    panelId: perStudy.panelId,
    panelRef: urnRef(perStudy.panelId),
    qrId: perStudy.qrId,
    qrRef: urnRef(perStudy.qrId),
    reportId: perStudy.reportId,
    reportRef: urnRef(perStudy.reportId),
    ceapObsId: perStudy.ceapObsId,
    ceapObsRef: perStudy.ceapObsId ? urnRef(perStudy.ceapObsId) : null,
    encounterId,
    encounterRef: encounterId ? urnRef(encounterId) : null,
    serviceRequestId: perStudy.serviceRequestId,
    serviceRequestRef: perStudy.serviceRequestId ? urnRef(perStudy.serviceRequestId) : null,
    consentId: perStudy.consentId,
    consentRef: perStudy.consentId ? urnRef(perStudy.consentId) : null,
    positionObsId: perStudy.positionObsId,
    sonographerObsId: perStudy.sonographerObsId,
    clinicianObsId: perStudy.clinicianObsId,
    operatorPractitionerId,
    operatorPractitionerRef: operatorPractitionerId ? urnRef(operatorPractitionerId) : null,
    referrerPractitionerId,
    referrerPractitionerRef: referrerPractitionerId ? urnRef(referrerPractitionerId) : null,
    institutionOrganizationId,
    institutionOrganizationRef: institutionOrganizationId
      ? urnRef(institutionOrganizationId)
      : null,
    loincCode: loinc.code,
    loincDisplay: loinc.display,
    paramPrefix: paramPrefixForStudy(form.studyType),
  };
}

/**
 * Per-study context that inherits encounter-level refs from a shared parent
 * (Phase 4a). Used by `buildEncounterBundle` to spin up N study contexts that
 * all reference the same Patient / Encounter / Practitioner / Organization
 * while each carrying its own Panel / QR / Report / CEAP IDs.
 *
 * Shared refs (`patientId`, `encounterId`, `operatorPractitionerId`,
 * `referrerPractitionerId`, `institutionOrganizationId`) come from the
 * `shared` argument verbatim — this function does NOT mint them. Per-study
 * refs (panel / QR / report / CEAP / consent / position / sonographer /
 * clinician / serviceRequest) are minted fresh from `form` using the same
 * gating rules as `createContext`.
 *
 * The single-study path (`createContext` → `buildFhirBundle`) is unchanged.
 */
export function createSharedContext(
  form: FormState,
  shared: SharedEncounterRefs,
): BuildContext {
  const loinc = VASCULAR_LOINC[form.studyType];
  if (!loinc) {
    throw new Error(`fhirBuilder: no VASCULAR_LOINC mapping for studyType "${form.studyType}"`);
  }
  const perStudy = mintPerStudyIds(form);

  return {
    form,
    nowIso: shared.nowIso,
    patientId: shared.patientId,
    patientRef: shared.patientRef,
    panelId: perStudy.panelId,
    panelRef: urnRef(perStudy.panelId),
    qrId: perStudy.qrId,
    qrRef: urnRef(perStudy.qrId),
    reportId: perStudy.reportId,
    reportRef: urnRef(perStudy.reportId),
    ceapObsId: perStudy.ceapObsId,
    ceapObsRef: perStudy.ceapObsId ? urnRef(perStudy.ceapObsId) : null,
    encounterId: shared.encounterId,
    encounterRef: shared.encounterRef,
    serviceRequestId: perStudy.serviceRequestId,
    serviceRequestRef: perStudy.serviceRequestId ? urnRef(perStudy.serviceRequestId) : null,
    consentId: perStudy.consentId,
    consentRef: perStudy.consentId ? urnRef(perStudy.consentId) : null,
    positionObsId: perStudy.positionObsId,
    sonographerObsId: perStudy.sonographerObsId,
    clinicianObsId: perStudy.clinicianObsId,
    operatorPractitionerId: shared.operatorPractitionerId,
    operatorPractitionerRef: shared.operatorPractitionerRef,
    referrerPractitionerId: shared.referrerPractitionerId,
    referrerPractitionerRef: shared.referrerPractitionerRef,
    institutionOrganizationId: shared.institutionOrganizationId,
    institutionOrganizationRef: shared.institutionOrganizationRef,
    loincCode: loinc.code,
    loincDisplay: loinc.display,
    paramPrefix: paramPrefixForStudy(form.studyType),
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

export function medimindParamSystem(
  ctx: Pick<BuildContext, 'paramPrefix'>,
  paramId: string
): string {
  // A lightweight per-parameter CodeSystem under the MediMind namespace — lets
  // the downstream consumer distinguish e.g. compressibility values from
  // phasicity values even though we reuse tokens like `normal`/`absent`.
  //
  // Wave 3.6 (Part 05 HIGH): the prefix is now study-derived (`venous` |
  // `arterial` | `carotid` | `ivc`), not the legacy hard-coded `venous-`. An
  // arterial Observation no longer claims to carry a `venous-stenosisPct`
  // system URL.
  return `${FHIR_BASE_URL}/CodeSystem/${ctx.paramPrefix}-${paramId}`;
}

export function urnRef(id: string): string {
  return `urn:uuid:${id}`;
}

export function newUuid(): string {
  // `crypto.randomUUID` exists in Node >=19 and all modern browsers — both
  // are explicit runtime targets for this app (`engines.node >=20.0.0`).
  // No fallback: a missing WebCrypto impl indicates an unsupported environment.
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error(
      'crypto.randomUUID not available — modern browser or Node 19+ required',
    );
  }
  return crypto.randomUUID();
}

// Re-export `MEDIMIND_EXTENSIONS` for the generic competency-tagged Observation
// builder; keeps the import surface symmetrical with the rest of the modules.
export { MEDIMIND_EXTENSIONS };
