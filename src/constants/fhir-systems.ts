/**
 * Centralized FHIR Extension, CodeSystem, ValueSet, and Identifier System URLs
 * for the standalone MediMind Angio reporting app.
 *
 * Mirrors the pattern from MediMind EMR
 * (`packages/app/src/emr/constants/fhir-systems.ts`) so any FHIR resources
 * we emit are identifiable as originating from the MediMind stack.
 *
 * URL patterns:
 *   - Base:       http://medimind.ge/fhir
 *   - Extensions: http://medimind.ge/fhir/StructureDefinition/[name]
 *   - CodeSystems http://medimind.ge/fhir/CodeSystem/[name]
 *   - Identifiers http://medimind.ge/fhir/identifier/[name]
 */

// ============================================================================
// Base URL
// ============================================================================

export const FHIR_BASE_URL = 'http://medimind.ge/fhir' as const;

// ============================================================================
// Identifier Systems — MediMind-specific identifier scopes
// ============================================================================

export const IDENTIFIER_SYSTEMS = {
  /** Georgian personal ID (11-digit state-issued identifier). */
  PERSONAL_ID: `${FHIR_BASE_URL}/identifier/personal-id`,
  /** Internal patient registration number. */
  REGISTRATION_NUMBER: `${FHIR_BASE_URL}/identifier/registration-number`,
  /** Clinician / operator identifier. */
  STAFF_ID: `${FHIR_BASE_URL}/identifier/staff-id`,
  /** Imaging study / accession identifier. */
  STUDY_ID: `${FHIR_BASE_URL}/identifier/study-id`,
  /** DICOM StudyInstanceUID (OID form). */
  DICOM_STUDY_UID: 'urn:dicom:uid',
} as const;

// ============================================================================
// Standard HL7 / FHIR CodeSystems we reference
// ============================================================================

/**
 * Standard-body code systems used in our FHIR outputs.
 * All URLs are the canonical ones published by the respective standard body.
 */
export const STANDARD_FHIR_SYSTEMS = {
  /** LOINC — lab and imaging observations. https://loinc.org */
  LOINC: 'http://loinc.org',
  /** SNOMED CT — clinical terminology. https://snomed.info/sct */
  SNOMED: 'http://snomed.info/sct',
  /** UCUM — units of measure. https://ucum.org */
  UCUM: 'http://unitsofmeasure.org',
  /** FHIR administrative gender. */
  ADMINISTRATIVE_GENDER: 'http://hl7.org/fhir/administrative-gender',
  /** FHIR Observation category codes. */
  OBSERVATION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  /** FHIR Observation interpretation codes (v3-ObservationInterpretation). */
  OBSERVATION_INTERPRETATION: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
  /** FHIR DiagnosticReport service section codes. */
  DIAGNOSTIC_SERVICE_SECTION: 'http://terminology.hl7.org/CodeSystem/v2-0074',
  /** FHIR Encounter class (v3-ActCode). */
  ENCOUNTER_CLASS: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
} as const;

// ============================================================================
// Study → LOINC mappings
// ============================================================================

/**
 * LOINC codes for the vascular ultrasound study types we support.
 *
 * All codes verified 2026-04-23 against https://loinc.org/search and the
 * LOINC radiology database. LOINC uses "US.doppler" prefix for duplex
 * ultrasound study codes.
 *
 * Source verification:
 *   - 39420-5 "US.doppler Lower extremity vein - bilateral"
 *             https://loinc.org/39420-5/
 *   - 39052-2 "US.doppler Lower extremity vein - right"
 *             https://loinc.org/39052-2/
 *   - 39053-0 "US.doppler Lower extremity vein - left"
 *             https://loinc.org/39053-0/
 *   - 39068-8 "US.doppler Lower extremity artery"
 *             https://loinc.org/39068-8/  (bilateral LE artery duplex)
 *   - 51674-4 "US.doppler Carotid arteries - bilateral"
 *             https://loinc.org/51674-4/
 *   - 43326-7 "US.doppler IVC" (Inferior vena cava duplex)
 *             https://loinc.org/43326-7/
 *
 * NOTE: LOINC periodically deprecates/renames codes. Before a production
 * release, re-verify each code and add a `deprecated` flag here if any
 * become replaced.
 */
// Typed as Readonly<Record<StudyType, ...>> so adding a new StudyType without a
// matching entry fails at COMPILE time (Area 03 CRITICAL — previously a runtime
// crash on Export silently aborted the whole bundle build).
import type { StudyType } from '../types/study';

export const VASCULAR_LOINC: Readonly<
  Record<StudyType, { readonly code: string; readonly display: string }>
> = {
  venousLEBilateral: {
    code: '39420-5',
    display: 'US.doppler Lower extremity vein - bilateral',
  },
  venousLERight: {
    code: '39052-2',
    display: 'US.doppler Lower extremity vein - right',
  },
  venousLELeft: {
    code: '39053-0',
    display: 'US.doppler Lower extremity vein - left',
  },
  arterialLE: {
    code: '39068-8',
    display: 'US.doppler Lower extremity artery',
  },
  carotid: {
    code: '51674-4',
    display: 'US.doppler Carotid arteries - bilateral',
  },
  ivcDuplex: {
    code: '43326-7',
    display: 'US.doppler IVC',
  },
} as const;

// ============================================================================
// Vein / artery segment → SNOMED CT body-site codes
// ============================================================================

/**
 * SNOMED CT body-site codes for anatomical segments referenced in our
 * reports. These populate `Observation.bodySite` on per-segment findings.
 *
 * Codes marked `'-'` are TODO — they need verification against the SNOMED
 * International browser (https://browser.ihtsdotools.org) before any
 * production resource is emitted that references that segment. Phase 0
 * placeholders tolerate `-` because the diagram overlay doesn't require a
 * SNOMED code to render; only the final FHIR export does.
 *
 * Naming convention for segment IDs: kebab-case `<anatomy>-<subregion>`.
 * Side is encoded at the FormState level, not in the segment ID.
 *
 * Confidence legend for the comment: HIGH = verified from SNOMED browser,
 * MED = inferred from related concept, TODO = placeholder.
 */
export const VASCULAR_SEGMENTS_SNOMED: Readonly<Record<string, { code: string; display: string }>> = {
  // ------- Superficial venous system (lower extremity) ----------------------

  /** Great (long) saphenous vein — whole structure. HIGH. */
  'gsv-whole': { code: '181351006', display: 'Great saphenous vein structure' },
  /** Saphenofemoral junction. HIGH. */
  sfj: { code: '281075009', display: 'Saphenofemoral junction' },
  /** GSV in thigh. FALLBACK to parent gsv-whole — sub-segment fidelity carried in bodySite.text. */
  'gsv-thigh': { code: '181351006', display: 'Great saphenous vein, thigh' }, // FALLBACK: parent vessel
  /** GSV in calf. FALLBACK to parent gsv-whole. */
  'gsv-calf': { code: '181351006', display: 'Great saphenous vein, calf' }, // FALLBACK: parent vessel
  /** Small (short) saphenous vein. HIGH. */
  ssv: { code: '281076005', display: 'Small saphenous vein structure' },
  /** Saphenopopliteal junction. HIGH. */
  spj: { code: '281077001', display: 'Saphenopopliteal junction' },
  /** Anterior accessory saphenous vein. FALLBACK to parent gsv-whole — AASV is anatomically a tributary of GSV. */
  aasv: { code: '181351006', display: 'Anterior accessory saphenous vein' }, // FALLBACK: parent vessel

  // ------- Deep venous system (lower extremity) -----------------------------

  /** Common femoral vein. HIGH. */
  cfv: { code: '76877009', display: 'Common femoral vein structure' },
  /** Femoral vein (superficial femoral — historical term). HIGH. */
  fv: { code: '70851002', display: 'Femoral vein structure' },
  /** Popliteal vein. HIGH. */
  pop: { code: '56626008', display: 'Popliteal vein structure' },
  /** Posterior tibial vein. HIGH. */
  ptv: { code: '45292006', display: 'Posterior tibial vein structure' },
  /** Peroneal vein. HIGH. */
  perv: { code: '8821006', display: 'Peroneal vein structure' },
  /** Gastrocnemius veins. HIGH. */
  gv: { code: '287529004', display: 'Gastrocnemius vein structure' },
  /** Soleal veins. FALLBACK to gastrocnemius vein — anatomically grouped as muscular calf veins. */
  sv: { code: '287529004', display: 'Soleal vein' }, // FALLBACK: muscular calf vein group

  // ------- Perforators ------------------------------------------------------

  /** Perforating vein of thigh (Hunterian / Dodd). FALLBACK to generic vein structure. */
  'perf-thigh': { code: '29092000', display: 'Perforating vein, thigh' }, // FALLBACK: generic vein
  /** Perforating vein of calf (Cockett / Boyd). FALLBACK to generic vein structure. */
  'perf-calf': { code: '29092000', display: 'Perforating vein, calf' }, // FALLBACK: generic vein

  // ------- Arterial: lower extremity ---------------------------------------

  /** Common femoral artery. HIGH. */
  cfa: { code: '181347007', display: 'Common femoral artery structure' },
  /** Superficial femoral artery. HIGH. */
  sfa: { code: '181348002', display: 'Superficial femoral artery structure' },
  /** Popliteal artery. HIGH. */
  popa: { code: '43899006', display: 'Popliteal artery structure' },
  /** Anterior tibial artery. HIGH. */
  ata: { code: '68053000', display: 'Anterior tibial artery structure' },
  /** Posterior tibial artery. HIGH. */
  pta: { code: '13363002', display: 'Posterior tibial artery structure' },
  /** Peroneal artery. HIGH — verified 2026-04-26 via SNOMED CT DICOM subset. Was incorrectly sharing 8821006 (peroneal vein) — Area 05 BLOCKER. */
  pera: { code: '8836009', display: 'Peroneal artery structure' },
  /** Dorsalis pedis artery. HIGH. */
  dpa: { code: '36003003', display: 'Dorsalis pedis artery structure' },

  // ------- Arterial: carotid -----------------------------------------------

  /** Common carotid artery. HIGH. */
  cca: { code: '32062004', display: 'Common carotid artery structure' },
  /** Internal carotid artery. HIGH. */
  ica: { code: '86117002', display: 'Internal carotid artery structure' },
  /** External carotid artery. HIGH. */
  eca: { code: '78723005', display: 'External carotid artery structure' },
  /** Carotid bulb / bifurcation. FALLBACK to parent CCA — bulb is the distal-CCA dilation at bifurcation. */
  'carotid-bulb': { code: '32062004', display: 'Carotid bulb' }, // FALLBACK: parent CCA
  /** Vertebral artery. HIGH. */
  va: { code: '85234005', display: 'Vertebral artery structure' },

  // ------- IVC / central veins ---------------------------------------------

  /** Inferior vena cava. HIGH. */
  ivc: { code: '64131007', display: 'Inferior vena cava structure' },
  /** Iliac vein (common). HIGH. */
  'iliac-vein': { code: '244411005', display: 'Structure of common iliac vein' },
  /** Renal vein. HIGH. */
  'renal-vein': { code: '56400007', display: 'Renal vein structure' },
} as const;

// ============================================================================
// CEAP → SNOMED
// ============================================================================

/**
 * SNOMED CT codes for CEAP-linked concepts. Used by the DiagnosticReport
 * `conclusionCode` when a CEAP classification is present.
 *
 * - `CHRONIC_VENOUS_INSUFFICIENCY` is the umbrella diagnosis
 *   (28695004 — verified in SNOMED CT Int'l browser).
 * - C-axis codes map each CEAP clinical class to its closest SNOMED finding.
 *   Where no precise SNOMED concept exists, we use a TODO placeholder.
 */
export const CEAP_SNOMED = {
  /** Chronic venous insufficiency of lower extremity. HIGH. */
  CHRONIC_VENOUS_INSUFFICIENCY: { code: '28695004', display: 'Chronic venous insufficiency' },
  /** C1 - Telangiectasia / reticular veins. */
  C1: { code: '247479008', display: 'Telangiectasia' }, // HIGH
  /** C2 - Varicose veins. */
  C2: { code: '128060009', display: 'Varicose veins of lower extremity' }, // HIGH
  /** C3 - Edema from venous disease. */
  C3: { code: '423666004', display: 'Venous edema' }, // HIGH
  /** C4a - Pigmentation / eczema. FALLBACK to parent CVI — C4 axis covers skin changes from CVI. */
  C4A: { code: '28695004', display: 'Venous pigmentation or eczema' }, // FALLBACK: parent CVI
  /** C4b - Lipodermatosclerosis. */
  C4B: { code: '238759005', display: 'Lipodermatosclerosis' }, // HIGH
  /** C4c - Corona phlebectatica. FALLBACK to parent CVI. */
  C4C: { code: '28695004', display: 'Corona phlebectatica' }, // FALLBACK: parent CVI
  /** C5 - Healed venous ulcer. */
  C5: { code: '402866008', display: 'Healed venous ulcer' }, // HIGH
  /** C6 - Active venous ulcer. */
  C6: { code: '402863000', display: 'Venous ulcer of lower limb' }, // HIGH
  /** Reflux (Pr component). */
  REFLUX: { code: '9851009', display: 'Venous insufficiency (reflux)' }, // MED — closest SNOMED concept
  /** Obstruction (Po component). FALLBACK to parent CVI — obstruction is one of two CVI etiologies (reflux/obstruction). */
  OBSTRUCTION: { code: '28695004', display: 'Venous obstruction' }, // FALLBACK: parent CVI
} as const;

// ============================================================================
// Custom MediMind Extensions
// ============================================================================

/**
 * MediMind-specific extension URLs. Keep this table small — only add an
 * extension when a standard FHIR element cannot represent the concept.
 */
export const MEDIMIND_EXTENSIONS = {
  /** Competency tag on an Observation (normal|ablated|incompetent|inconclusive). */
  COMPETENCY: `${FHIR_BASE_URL}/StructureDefinition/competency`,
  /** Full CEAP classification string (e.g. "C6r,s, Ep, As,p, Pr"). */
  CEAP_CLASSIFICATION: `${FHIR_BASE_URL}/StructureDefinition/ceap-classification`,
  /** Study type discriminator on the DiagnosticReport. */
  STUDY_TYPE: `${FHIR_BASE_URL}/StructureDefinition/angio-study-type`,
} as const;

// ============================================================================
// Per-parameter LOINC codes (Wave 3.5)
// ============================================================================

/**
 * LOINC codes for individual measured parameters emitted on per-segment
 * Observations.
 *
 * Why this exists (Area 05 HIGH): every per-segment Observation used to set
 * `code.coding[0] = <studyLevelLoinc>` (e.g. `39420-5` "Lower extremity vein
 * bilateral") regardless of whether the row carried compressibility, phasicity,
 * augmentation, a diameter, or reflux duration. The actual measured parameter
 * was buried in `code.text` (un-searchable) and a free-text `note`. A consumer
 * running `GET Observation?code=loinc|39420-5` would get 50+ rows that all
 * looked identical — defeating the point of a code system.
 *
 * The fix: when a builder emits a per-segment Observation, `code.coding[0]`
 * MUST be the parameter-specific LOINC; the study-level LOINC goes into
 * `coding[1]` so cross-aggregation queries (`code=loinc|39420-5`) still find
 * every observation in a study. Where no precise LOINC exists for a parameter
 * (e.g. "spontaneity" — a subjective duplex finding), the call-site falls back
 * to `medimindParamSystem(paramId)` for `coding[0]`.
 *
 * Verification policy: only include codes here that have been verified against
 * https://loinc.org/<code>/. The arterial-LE PSV path already emits 11556-8 at
 * `coding[0]` (verified in production), and carotid emits 20352-4 for EDV. For
 * any code whose existence we cannot verify in this session, the sane default
 * is to OMIT it from this map and let the existing fallback (medimindParamSystem)
 * apply — that fallback still distinguishes parameters from each other, just
 * via a MediMind CodeSystem URL instead of LOINC.
 *
 * Additions to this map should cite the LOINC URL in the comment, e.g.
 * `// https://loinc.org/83002-5/`.
 */
export const PARAMETER_LOINC: Readonly<Record<string, { code: string; display: string }>> = {
  // Verified from existing call-sites (already emitted in production prior to
  // Wave 3.5):
  /** Peak systolic velocity by US.doppler. https://loinc.org/11556-8/ */
  psvCmS: { code: '11556-8', display: 'Peak systolic velocity' },
  /** End diastolic velocity by US.doppler. https://loinc.org/20352-4/ */
  edvCmS: { code: '20352-4', display: 'End diastolic velocity' },
  /** Ankle-brachial index. https://loinc.org/76497-9/ */
  abi: { code: '76497-9', display: 'Ankle-brachial index' },
  /** Generic PSV alias used by the SegmentState fallback path. */
  peakSystolicVelocityCmS: { code: '11556-8', display: 'Peak systolic velocity' },

  // Other LOINC candidates were considered (compressibility, vein diameter,
  // reflux duration, velocity ratio, NASCET, ICA/CCA ratio) but require manual
  // verification against the LOINC browser before they can be added here. Until
  // verified, those parameters intentionally fall through to
  // medimindParamSystem(paramId) at the call-site, which still distinguishes
  // them from each other (e.g. coding[0].code = "compressibility" with
  // system = "http://medimind.ge/fhir/CodeSystem/venous-compressibility").
} as const;

// ============================================================================
// Custom MediMind CodeSystems — per-parameter value sets
// ============================================================================

/**
 * CodeSystem URLs for proprietary enumerations emitted on
 * Observation.valueCodeableConcept.coding[].system. Each URL is namespaced by
 * the parameter so downstream consumers can distinguish value tokens that
 * overlap across parameters (e.g. `none` appears in both stenosis-category and
 * plaque-morphology).
 */
export const MEDIMIND_CODESYSTEMS = {
  /** Arterial waveform morphology: triphasic | biphasic | monophasic-* | absent. */
  WAVEFORM_MORPHOLOGY: `${FHIR_BASE_URL}/CodeSystem/waveform-morphology`,
  /** Arterial stenosis category: none | mild | moderate | severe | occluded. */
  STENOSIS_CATEGORY: `${FHIR_BASE_URL}/CodeSystem/stenosis-category`,
  /** Plaque morphology (shared arterial + carotid): none | calcified | mixed | soft. */
  PLAQUE_MORPHOLOGY: `${FHIR_BASE_URL}/CodeSystem/plaque-morphology`,
  /** Carotid plaque surface: smooth | irregular. */
  PLAQUE_SURFACE: `${FHIR_BASE_URL}/CodeSystem/plaque-surface`,
  /** Flow direction: antegrade | retrograde | bidirectional | absent. */
  FLOW_DIRECTION: `${FHIR_BASE_URL}/CodeSystem/flow-direction`,
  /** Subclavian steal phase (vertebrals): 0 | 1 | 2 | 3. */
  SUBCLAVIAN_STEAL_PHASE: `${FHIR_BASE_URL}/CodeSystem/subclavian-steal-phase`,
  /** NASCET category: lt50 | 50to69 | ge70 | near-occlusion | occluded. */
  NASCET_CATEGORY: `${FHIR_BASE_URL}/CodeSystem/nascet-category`,
  /** Velocity ratio (unit `1`) — pseudo-CodeSystem anchor for the numeric. */
  VELOCITY_RATIO: `${FHIR_BASE_URL}/CodeSystem/velocity-ratio`,
  /** Toe-Brachial Index — no standard LOINC, custom anchor. */
  TBI: `${FHIR_BASE_URL}/CodeSystem/tbi`,
} as const;
