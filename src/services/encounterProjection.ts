// SPDX-License-Identifier: Apache-2.0
/**
 * encounterProjection — turn a raw encounter study-slot into a `FormState`.
 *
 * Why this exists:
 *   After Phase 3b each per-study form mirrors its V1/V2 reducer state into
 *   `encounter.studies[studyType]`. That reducer state has `findings`,
 *   `pressures`, `nascet`, etc. as TOP-LEVEL fields. But every PDF + FHIR
 *   builder downstream expects the legacy `FormState` shape, where findings
 *   travel inside the `parameters: { segmentFindings, ... }` bag.
 *
 *   Each per-study form already has its own `toFormState(state, encounter)`
 *   function that does the merge, but those live inside the form files —
 *   not callable from the unified-export path in `FormActions.tsx` for the
 *   NON-active studies in an encounter (which never run their form's
 *   render path during the export click).
 *
 *   Phase 4c flagged this with a TODO ("Phase 4a may add a centralised
 *   adapter") but neither phase shipped it. Result: `FormActions.tsx`'s
 *   unified-mode useMemo did `slot as FormState` and `resolveStudyAssets`
 *   blew up reading `studyForm.parameters['segmentFindings']` (parameters
 *   was undefined on the raw slot).
 *
 *   This helper is the missing adapter. Same contract as each form's
 *   private `toFormState`, just keyed off `studyType` instead of being
 *   colocated with one form's reducer.
 *
 * Plain-language: think of `encounter.studies.arterialLE` as a doctor's
 * shorthand notebook. The PDF + FHIR machines downstream expect a fully
 * typed-up patient chart. This helper does the typing-up — pulling
 * patient identity from the encounter (the visit-level chart) and the
 * clinical findings from the per-study notebook page.
 */

import type { EncounterDraft } from '../types/encounter';
import type { CptCode, FormState, StudyHeader } from '../types/form';
import type { StudyType } from '../types/study';

/**
 * Minimal shape every Phase-3b per-study reducer state shares.
 * We don't depend on the per-study `*FormStateV1`/`V2` interfaces directly
 * to keep this helper free of cross-feature imports. The runtime guards
 * below validate the bits we actually consume.
 */
interface PerStudySlotCommon {
  readonly studyType?: StudyType;
  readonly studyDate?: string;
  readonly studyTime?: string;
  readonly accessionNumber?: string;
  readonly cptCode?: CptCode;
  readonly patientPosition?: StudyHeader['patientPosition'];
  // `quality` + `protocol` are venous-only legacy fields that lived on
  // the deprecated StudyHeaderValue extension; canonical StudyHeader
  // doesn't include them. Carried as `unknown` so the projection
  // doesn't fight the type system; they're not consumed downstream.
  readonly quality?: unknown;
  readonly protocol?: unknown;
  readonly impression?: string;
  readonly sonographerComments?: string;
  readonly clinicianComments?: string;
  readonly recommendations?: FormState['recommendations'];
  readonly findings?: unknown;
}

interface VenousSlot extends PerStudySlotCommon {
  readonly studyType: 'venousLEBilateral' | 'venousLERight' | 'venousLELeft';
  readonly ceap?: FormState['ceap'];
}

interface ArterialSlot extends PerStudySlotCommon {
  readonly studyType: 'arterialLE';
  readonly pressures?: unknown;
}

interface CarotidSlot extends PerStudySlotCommon {
  readonly studyType: 'carotid';
  readonly nascet?: unknown;
}

interface IvcSlot extends PerStudySlotCommon {
  readonly studyType: 'ivcDuplex';
}

function hasStudyType(slot: unknown, type: StudyType): slot is PerStudySlotCommon {
  if (typeof slot !== 'object' || slot === null) return false;
  const s = slot as { studyType?: unknown };
  return s.studyType === type;
}

/**
 * Build the encounter-level half of `FormState.header`. Used by every
 * branch below — encounter-level fields (patient identity, operator,
 * referring physician, institution, ICD-10s, indication notes, consent,
 * medications) are always sourced from the encounter, never from the
 * per-study slot.
 */
function buildEncounterHeader(encounter: EncounterDraft): Pick<
  StudyHeader,
  | 'patientName'
  | 'patientId'
  | 'patientBirthDate'
  | 'patientGender'
  | 'operatorName'
  | 'referringPhysician'
  | 'institution'
  | 'informedConsent'
  | 'informedConsentSignedAt'
  | 'medications'
  | 'icd10Codes'
> {
  const eh = encounter.header;
  return {
    patientName: eh.patientName ?? '',
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
  };
}

/**
 * Per-study fields layered on top of the encounter header. Each study's
 * reducer state contributes scalars that don't make sense at encounter
 * level (e.g. accession number is per-imaging-procedure, CPT is per-
 * billed-procedure).
 */
function buildPerStudyHeader(slot: PerStudySlotCommon, encounter: EncounterDraft): Pick<
  StudyHeader,
  'studyDate' | 'accessionNumber' | 'cptCode' | 'patientPosition'
> {
  // `studyTime` is a venous-only extension (lived on StudyHeaderValue
  // in StudyHeader.tsx) — not part of canonical StudyHeader. Dropped
  // from the projection to keep types honest.
  return {
    studyDate: slot.studyDate || encounter.header.encounterDate || new Date().toISOString().slice(0, 10),
    accessionNumber: slot.accessionNumber,
    cptCode: slot.cptCode,
    patientPosition: slot.patientPosition,
  };
}

/**
 * Project an encounter study-slot into a fully-typed `FormState` ready to
 * hand to the PDF + FHIR builders. Returns `null` for slots that don't
 * match the requested `studyType` — caller should filter.
 *
 * Mirrors the per-study `toFormState(state, encounter)` functions inside
 * VenousLEForm / ArterialLEForm / CarotidForm so the unified-export path
 * produces the SAME shape downstream consumers (resolveStudyAssets,
 * buildEncounterBundle, narrativeService) already understand.
 */
export function projectStudyToFormState(
  type: StudyType,
  slot: unknown,
  encounter: EncounterDraft,
): FormState | null {
  if (!hasStudyType(slot, type)) return null;

  const headerBase = buildEncounterHeader(encounter);
  const headerPerStudy = buildPerStudyHeader(slot, encounter);
  const header: StudyHeader = { ...headerBase, ...headerPerStudy };

  if (type === 'venousLEBilateral' || type === 'venousLERight' || type === 'venousLELeft') {
    const v = slot as VenousSlot;
    return {
      studyType: type,
      header,
      segments: [],
      narrative: {
        // Encounter-level indication notes flow through as the legacy
        // `narrative.indication` slot the PDF + FHIR builders read.
        indication: encounter.header.indicationNotes,
        impression: v.impression ?? '',
        sonographerComments: v.sonographerComments || undefined,
        clinicianComments: v.clinicianComments || undefined,
      },
      recommendations: v.recommendations ?? [],
      ceap: v.ceap,
      parameters: {
        segmentFindings: v.findings ?? {},
      },
    };
  }

  if (type === 'arterialLE') {
    const a = slot as ArterialSlot;
    return {
      studyType: 'arterialLE',
      header,
      segments: [],
      narrative: {
        indication: encounter.header.indicationNotes,
        impression: a.impression ?? '',
        sonographerComments: a.sonographerComments,
        clinicianComments: a.clinicianComments,
      },
      recommendations: a.recommendations ?? [],
      parameters: {
        segmentFindings: a.findings ?? {},
        pressures: a.pressures ?? {},
      },
    };
  }

  if (type === 'carotid') {
    const c = slot as CarotidSlot;
    return {
      studyType: 'carotid',
      header,
      segments: [],
      narrative: {
        indication: encounter.header.indicationNotes,
        impression: c.impression ?? '',
        sonographerComments: c.sonographerComments,
        clinicianComments: c.clinicianComments,
      },
      recommendations: c.recommendations ?? [],
      parameters: {
        segmentFindings: c.findings ?? {},
        nascet: c.nascet ?? {},
      },
    };
  }

  if (type === 'ivcDuplex') {
    const i = slot as IvcSlot;
    return {
      studyType: 'ivcDuplex',
      header,
      segments: [],
      narrative: {
        indication: encounter.header.indicationNotes,
        impression: i.impression ?? '',
        sonographerComments: i.sonographerComments,
        clinicianComments: i.clinicianComments,
      },
      recommendations: i.recommendations ?? [],
      parameters: {
        segmentFindings: i.findings ?? {},
      },
    };
  }

  return null;
}
