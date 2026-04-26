// SPDX-License-Identifier: Apache-2.0
/**
 * Multi-study FHIR Bundle orchestrator (Phase 4a).
 *
 * Where `buildFhirBundle(form)` emits a single-study transaction Bundle
 * (one Patient, one Encounter, one DiagnosticReport, etc.), this orchestrator
 * emits an **encounter-level** Bundle for a clinic visit that produced
 * multiple ultrasound studies in one sitting:
 *
 *   - 1 × Patient (shared across every study)
 *   - 1 × Encounter (shared, ICD-10 from encounter header, period start from
 *     encounter.encounterDate)
 *   - 0..1 × Practitioner per unique operator name (deduped across studies)
 *   - 0..1 × Practitioner per unique referrer name (deduped across studies)
 *   - 0..1 × Organization for the institution (single-source-of-truth: the
 *     encounter header)
 *   - 0..1 × Consent (one per encounter, not per study — patient signs once
 *     for the whole visit)
 *   - For each study form:
 *       - 1 × DiagnosticReport (study-LOINC, references shared Patient +
 *         shared Encounter + study's own panel + segment Observations)
 *       - 1 × Observation panel (LOINC-coded, hasMember[] → segment
 *         Observations)
 *       - N × Observation (per-segment / per-vessel findings)
 *       - 0..1 × Observation (CEAP — venous studies only)
 *       - 0..1 × Observation (patient position / sonographer / clinician
 *         per-performer comments)
 *       - 0..1 × ServiceRequest (when CPT code is set on the form)
 *       - 1 × QuestionnaireResponse (lossless per-study snapshot)
 *
 * Reference integrity invariant: every intra-bundle Reference uses
 * `urn:uuid:<id>` and every URN in the bundle is the `fullUrl` of exactly one
 * entry. The companion test (`buildEncounterBundle.test.ts`) walks every
 * Reference and asserts it resolves.
 *
 * Practitioner / Organization de-dup approach: encounter header is the source
 * of truth for operator / referrer / institution per the field-split table
 * (see plan §Phase 1). Each is minted ONCE per encounter regardless of how
 * many study forms reference the same string. As a defensive measure, we ALSO
 * scan per-form headers and key by `name.trim().toLowerCase()` so a future
 * caller that passes mixed forms (e.g. legacy single-study bundles re-routed
 * through this orchestrator) still emits one Practitioner per distinct name.
 *
 * Consent: emitted ONCE if the encounter header carries
 * `informedConsent === true`, regardless of how many studies are in the
 * encounter.
 */

import type { EncounterDraft } from '../../types/encounter';
import type { FormState } from '../../types/form';
import type {
  Bundle,
  BundleEntry,
  EmittedResource,
} from '../../types/fhir';
import type { BuildContext, SharedEncounterRefs } from './context';
import { createSharedContext, newUuid, urnRef } from './context';
import { buildPatientEntry } from './patient';
import {
  buildInstitutionOrganizationEntry,
  buildOperatorPractitionerEntry,
  buildReferrerPractitionerEntry,
} from './practitioner';
import { buildEncounterEntry } from './encounter';
import { buildConsentEntry } from './consent';
import { buildServiceRequestEntry } from './serviceRequest';
import { buildQuestionnaireResponseEntry } from './questionnaireResponse';
import { buildSegmentObservationEntries } from './observations/segments';
import {
  buildClinicianImpressionObservationEntry,
  buildPatientPositionObservationEntry,
  buildSonographerCommentsObservationEntry,
} from './observations/perPerformer';
import { buildPanelObservationEntry } from './observations/panel';
import { buildCeapObservationEntry } from './observations/ceap';
import { buildDiagnosticReportEntry } from './diagnosticReport';

export interface BuildEncounterBundleInput {
  readonly encounter: EncounterDraft;
  /**
   * One projected `FormState` per study in the encounter. The caller (Phase
   * 4c FormActions) builds these via each per-study form's `stateToFormState`
   * helper — so each form already carries a merged `header` (encounter-level
   * fields + per-study fields like studyDate / accessionNumber / cptCode /
   * patientPosition).
   */
  readonly studyForms: ReadonlyArray<FormState>;
}

function normalizeName(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

/**
 * Build the encounter-level transaction Bundle. Pure function — no network,
 * no side effects. Empty `studyForms` is allowed but produces a Bundle with
 * only the shared Patient + Encounter + Consent + Practitioner / Organization
 * entries; callers should still gate on `studyForms.length >= 1` for clinical
 * meaningfulness (the Phase 4c UI does so).
 */
export function buildEncounterBundle(input: BuildEncounterBundleInput): Bundle {
  const { encounter, studyForms } = input;
  const nowIso = new Date().toISOString();

  // ─── 1. Mint shared encounter-level refs once. ────────────────────────────
  // Patient is always emitted (encounter has at least a patientName by Phase
  // 1's intake-required validation). Encounter is gated on icd10Codes for
  // strict byte-parity with the single-study path (`createContext` uses the
  // same gate). When no ICD-10 is set, per-study DRs simply omit the
  // `encounter` slot — exactly the behavior they have today via
  // `buildFhirBundle`.
  const eh = encounter.header;
  const hasIcd10 =
    Array.isArray(eh.icd10Codes) && eh.icd10Codes.length > 0;
  const encounterId = hasIcd10 ? newUuid() : null;

  const operatorName = normalizeName(eh.operatorName);
  const referrerName = normalizeName(eh.referringPhysician);
  const institutionName = normalizeName(eh.institution);

  // Defensive de-dup: scan study-form headers in case callers pass mixed
  // forms. Encounter header still wins as the *first* occurrence so encounter
  // operatorName 'Dr. X' beats a study-form override with the same name.
  const operatorMap = new Map<string, string>();
  const referrerMap = new Map<string, string>();
  if (operatorName) operatorMap.set(operatorName, newUuid());
  if (referrerName) referrerMap.set(referrerName, newUuid());
  for (const f of studyForms) {
    const op = normalizeName(f.header.operatorName);
    if (op && !operatorMap.has(op)) operatorMap.set(op, newUuid());
    const rf = normalizeName(f.header.referringPhysician);
    if (rf && !referrerMap.has(rf)) referrerMap.set(rf, newUuid());
  }

  // Institution de-dup: encounter header is canonical; we don't fan out to
  // per-form institutions (the field-split table puts institution at the
  // encounter level). Single Organization per encounter.
  const institutionOrganizationId = institutionName ? newUuid() : null;

  // Consent: one per encounter when the patient has consented.
  const hasConsent = eh.informedConsent === true;
  const consentId = hasConsent ? newUuid() : null;

  // The shared refs pinned to the encounter's primary operator/referrer (the
  // entries written on `EncounterHeader`). Per-study sub-contexts reuse these
  // by default; if a particular form points at a different operator name, the
  // Phase 4c caller is responsible for wiring it (and the dedup map will have
  // already minted the second Practitioner ID above).
  const primaryOperatorId = operatorName ? operatorMap.get(operatorName) ?? null : null;
  const primaryReferrerId = referrerName ? referrerMap.get(referrerName) ?? null : null;

  const sharedRefs: SharedEncounterRefs = {
    nowIso,
    patientId: newUuid(),
    patientRef: '', // filled below — TS forces us to construct the literal first
    encounterId,
    encounterRef: encounterId ? urnRef(encounterId) : null,
    operatorPractitionerId: primaryOperatorId,
    operatorPractitionerRef: primaryOperatorId ? urnRef(primaryOperatorId) : null,
    referrerPractitionerId: primaryReferrerId,
    referrerPractitionerRef: primaryReferrerId ? urnRef(primaryReferrerId) : null,
    institutionOrganizationId,
    institutionOrganizationRef: institutionOrganizationId
      ? urnRef(institutionOrganizationId)
      : null,
  };
  // Fix patientRef now that patientId is settled (single readonly object so
  // we re-build with the patientRef field set).
  const sharedRefsFinal: SharedEncounterRefs = {
    ...sharedRefs,
    patientRef: urnRef(sharedRefs.patientId),
  };

  // ─── 2. Build shared resources once. ──────────────────────────────────────
  // We need a "shared form" to drive shared resource builders that read from
  // ctx.form.header (Patient identity, Encounter ICD-10, Organization name,
  // primary Practitioner names). Use the first study form when available;
  // otherwise synthesize a minimal one from the encounter header. Either way
  // the shared resources reflect ENCOUNTER-LEVEL truth — the per-study
  // form's per-study-only fields (studyDate, accession, cpt, position) don't
  // affect what shared builders emit since they read header.patientName /
  // header.icd10Codes / header.operatorName / header.institution / etc.,
  // which are encounter-level on every projected form.
  //
  // We override `header.studyDate` with `encounter.encounterDate` so the
  // shared Encounter.period.start reflects the visit date, not the
  // first-study scan time.
  const sharedForm: FormState = synthesizeSharedForm(encounter, studyForms);
  const sharedCtx: BuildContext = createSharedContext(sharedForm, sharedRefsFinal);

  const patientEntry = buildPatientEntry(sharedCtx);
  const encounterEntry = buildEncounterEntry(sharedCtx);
  const operatorPractitionerEntry = buildOperatorPractitionerEntry(sharedCtx);
  const referrerPractitionerEntry = buildReferrerPractitionerEntry(sharedCtx);
  const institutionOrganizationEntry = buildInstitutionOrganizationEntry(sharedCtx);

  // Build the additional (non-primary) Practitioner entries for any names
  // that came from per-form headers but didn't match the encounter's primary
  // operator / referrer.
  const extraPractitionerEntries: Array<BundleEntry<EmittedResource>> = [];
  for (const [name, id] of operatorMap.entries()) {
    if (operatorName && name === operatorName) continue;
    extraPractitionerEntries.push(synthesizePractitionerEntry(id, name));
  }
  for (const [name, id] of referrerMap.entries()) {
    if (referrerName && name === referrerName) continue;
    extraPractitionerEntries.push(synthesizePractitionerEntry(id, name));
  }

  // Consent uses the shared context (consent id is encounter-level so we mint
  // it on the shared refs path manually — buildConsentEntry reads ctx.consentId).
  // Build a one-off context for Consent so the builder can read patientRef +
  // signedAt without us re-implementing it.
  const consentEntry = consentId
    ? buildConsentEntry({
        ...sharedCtx,
        consentId,
        consentRef: urnRef(consentId),
      })
    : null;

  // ─── 3. Per-study sub-contexts + entries. ─────────────────────────────────
  const perStudyEntries: Array<BundleEntry<EmittedResource>> = [];
  for (const form of studyForms) {
    const formOpName = normalizeName(form.header.operatorName);
    const formRfName = normalizeName(form.header.referringPhysician);
    const studySharedRefs: SharedEncounterRefs = {
      ...sharedRefsFinal,
      operatorPractitionerId: formOpName
        ? operatorMap.get(formOpName) ?? sharedRefsFinal.operatorPractitionerId
        : sharedRefsFinal.operatorPractitionerId,
      operatorPractitionerRef: (() => {
        const id = formOpName
          ? operatorMap.get(formOpName) ?? sharedRefsFinal.operatorPractitionerId
          : sharedRefsFinal.operatorPractitionerId;
        return id ? urnRef(id) : null;
      })(),
      referrerPractitionerId: formRfName
        ? referrerMap.get(formRfName) ?? sharedRefsFinal.referrerPractitionerId
        : sharedRefsFinal.referrerPractitionerId,
      referrerPractitionerRef: (() => {
        const id = formRfName
          ? referrerMap.get(formRfName) ?? sharedRefsFinal.referrerPractitionerId
          : sharedRefsFinal.referrerPractitionerId;
        return id ? urnRef(id) : null;
      })(),
    };
    const ctx = createSharedContext(form, studySharedRefs);

    const qrEntry = buildQuestionnaireResponseEntry(ctx);
    const segmentObsEntries = buildSegmentObservationEntries(ctx);
    const positionObsEntry = buildPatientPositionObservationEntry(ctx);
    const sonographerObsEntry = buildSonographerCommentsObservationEntry(ctx);
    const clinicianObsEntry = buildClinicianImpressionObservationEntry(ctx);
    const panelEntry = buildPanelObservationEntry(ctx, segmentObsEntries);
    const ceapEntry = buildCeapObservationEntry(ctx);
    const reportEntry = buildDiagnosticReportEntry(
      ctx,
      panelEntry,
      segmentObsEntries,
      ceapEntry,
      positionObsEntry,
      sonographerObsEntry,
      clinicianObsEntry,
    );
    // ServiceRequest is gated on CPT — emit per-study (CPT is per-study).
    const serviceRequestEntry = buildServiceRequestEntry(ctx);

    perStudyEntries.push(qrEntry);
    if (serviceRequestEntry) perStudyEntries.push(serviceRequestEntry);
    perStudyEntries.push(panelEntry);
    perStudyEntries.push(...segmentObsEntries);
    if (positionObsEntry) perStudyEntries.push(positionObsEntry);
    if (sonographerObsEntry) perStudyEntries.push(sonographerObsEntry);
    if (clinicianObsEntry) perStudyEntries.push(clinicianObsEntry);
    if (ceapEntry) perStudyEntries.push(ceapEntry);
    perStudyEntries.push(reportEntry);
  }

  // ─── 4. Assemble entries in stable, human-diff-friendly order. ────────────
  const entries: Array<BundleEntry<EmittedResource>> = [patientEntry];
  if (operatorPractitionerEntry) entries.push(operatorPractitionerEntry);
  if (referrerPractitionerEntry) entries.push(referrerPractitionerEntry);
  entries.push(...extraPractitionerEntries);
  if (institutionOrganizationEntry) entries.push(institutionOrganizationEntry);
  if (encounterEntry) entries.push(encounterEntry);
  if (consentEntry) entries.push(consentEntry);
  entries.push(...perStudyEntries);

  const bundle: Bundle<EmittedResource> = {
    resourceType: 'Bundle',
    type: 'transaction',
    timestamp: nowIso,
    entry: entries,
  };
  return bundle as Bundle;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a synthetic FormState used to drive shared-resource builders
 * (Patient / Encounter / Practitioners / Organization). The header carries
 * encounter-level fields + a `studyDate` set to `encounter.encounterDate` so
 * the shared Encounter.period.start reflects the visit date rather than any
 * one study's scan time.
 *
 * When `studyForms` is non-empty we copy the first form's `header` and
 * override studyDate; this preserves any per-form patient identity that the
 * caller may have customized. When empty we synthesize from
 * `encounter.header` directly.
 */
function synthesizeSharedForm(
  encounter: EncounterDraft,
  studyForms: ReadonlyArray<FormState>,
): FormState {
  const eh = encounter.header;
  if (studyForms.length > 0) {
    const first = studyForms[0]!;
    return {
      ...first,
      header: {
        ...first.header,
        studyDate: eh.encounterDate,
        // Encounter-level fields take precedence over the per-form copy so
        // shared resources reflect the canonical encounter header even if a
        // form's header projection drifted.
        patientName: eh.patientName,
        patientId: eh.patientId,
        patientBirthDate: eh.patientBirthDate,
        patientGender: eh.patientGender,
        operatorName: eh.operatorName,
        referringPhysician: eh.referringPhysician,
        institution: eh.institution,
        informedConsent: eh.informedConsent,
        informedConsentSignedAt: eh.informedConsentSignedAt,
        medications: eh.medications,
        icd10Codes: eh.icd10Codes,
      },
    };
  }
  // Empty studyForms — synthesize a venous-bilateral-typed minimal form just
  // so VASCULAR_LOINC has an entry. This branch only fires when callers ask
  // for a Bundle with no studies, which is unusual but supported.
  return {
    studyType: 'venousLEBilateral',
    header: {
      patientName: eh.patientName,
      patientId: eh.patientId,
      patientBirthDate: eh.patientBirthDate,
      patientGender: eh.patientGender,
      studyDate: eh.encounterDate,
      operatorName: eh.operatorName,
      referringPhysician: eh.referringPhysician,
      institution: eh.institution,
      informedConsent: eh.informedConsent,
      informedConsentSignedAt: eh.informedConsentSignedAt,
      medications: eh.medications,
      icd10Codes: eh.icd10Codes,
    },
    segments: [],
    narrative: { indication: eh.indicationNotes },
    recommendations: [],
    parameters: {},
  } as FormState;
}

/**
 * Inline Practitioner emitter for the de-dup overflow path. The primary
 * operator / referrer Practitioners (the ones whose names match the encounter
 * header) flow through `buildOperatorPractitionerEntry` /
 * `buildReferrerPractitionerEntry` for free; this helper covers any extras.
 *
 * Practitioner has no `role` slot — that lives on PractitionerRole — so the
 * caller's intent (operator vs referrer) is implicit in the dedup map the ID
 * came from.
 */
function synthesizePractitionerEntry(
  id: string,
  name: string,
): BundleEntry<EmittedResource> {
  // Restore the original casing as best we can — we only kept lower-cased
  // names in the dedup map, but the source was already trimmed by
  // `normalizeName`. Capitalize the first letter of each whitespace-separated
  // token for display; FHIR consumers that key on `text` accept any casing.
  const titled = name
    .split(/\s+/)
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');
  const parts = titled.split(/\s+/).filter(Boolean);
  const family = parts.length > 0 ? (parts[parts.length - 1] ?? '') : '';
  const given = parts.length > 1 ? parts.slice(0, -1) : [];

  return {
    fullUrl: urnRef(id),
    resource: {
      resourceType: 'Practitioner',
      id,
      active: true,
      name: [
        {
          use: 'official',
          text: titled,
          family: family || undefined,
          given: given.length > 0 ? given : undefined,
        },
      ],
    },
    request: { method: 'POST', url: 'Practitioner' },
  };
}
