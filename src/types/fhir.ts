/**
 * Narrow FHIR R4 type subsets — just what we emit.
 *
 * We deliberately DO NOT import @medplum/fhirtypes. That package is large
 * and pulls in every FHIR resource in the spec, which bloats the bundle
 * and slows typechecking. For this standalone app we only emit a handful
 * of resources, so we define the minimal shapes we need here.
 *
 * Source: https://hl7.org/fhir/R4/
 *
 * All types are read-only to reinforce the "once built, don't mutate" FHIR
 * discipline — constructors should return a fresh object every time.
 */

// ============================================================================
// Primitive helpers
// ============================================================================

/** FHIR `code` — a pattern-constrained string. We don't validate at runtime. */
export type FhirCode = string;

/** FHIR `dateTime` — ISO 8601 (e.g. `2026-04-23T14:30:00+04:00`). */
export type FhirDateTime = string;

/** FHIR `date` — ISO 8601 date only (e.g. `2026-04-23`). */
export type FhirDate = string;

/** FHIR `uri` — any absolute or relative URI. */
export type FhirUri = string;

/** FHIR `canonical` — URL pointing to a canonical resource. */
export type FhirCanonical = string;

// ============================================================================
// Common datatypes
// ============================================================================

export interface Coding {
  readonly system?: FhirUri;
  readonly version?: string;
  readonly code?: FhirCode;
  readonly display?: string;
  readonly userSelected?: boolean;
}

export interface CodeableConcept {
  readonly coding?: ReadonlyArray<Coding>;
  readonly text?: string;
}

export interface Reference {
  readonly reference?: string; // e.g. "Patient/123"
  readonly type?: FhirUri;
  readonly identifier?: Identifier;
  readonly display?: string;
}

export interface Identifier {
  readonly use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  readonly type?: CodeableConcept;
  readonly system?: FhirUri;
  readonly value?: string;
  readonly period?: Period;
}

export interface Period {
  readonly start?: FhirDateTime;
  readonly end?: FhirDateTime;
}

export interface Quantity {
  readonly value?: number;
  readonly comparator?: '<' | '<=' | '>=' | '>';
  readonly unit?: string;
  readonly system?: FhirUri;
  readonly code?: FhirCode;
}

export interface Annotation {
  readonly authorReference?: Reference;
  readonly authorString?: string;
  readonly time?: FhirDateTime;
  readonly text: string;
}

export interface HumanName {
  readonly use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  readonly text?: string;
  readonly family?: string;
  readonly given?: ReadonlyArray<string>;
  readonly prefix?: ReadonlyArray<string>;
  readonly suffix?: ReadonlyArray<string>;
}

// ============================================================================
// Resource base + specific resources we emit
// ============================================================================

export interface ResourceBase {
  readonly resourceType: string;
  readonly id?: string;
  readonly meta?: Meta;
}

export interface Meta {
  readonly versionId?: string;
  readonly lastUpdated?: FhirDateTime;
  readonly source?: FhirUri;
  readonly profile?: ReadonlyArray<FhirCanonical>;
  readonly tag?: ReadonlyArray<Coding>;
}

// --- Patient ----------------------------------------------------------------

export interface Patient extends ResourceBase {
  readonly resourceType: 'Patient';
  readonly identifier?: ReadonlyArray<Identifier>;
  readonly active?: boolean;
  readonly name?: ReadonlyArray<HumanName>;
  readonly gender?: 'male' | 'female' | 'other' | 'unknown';
  readonly birthDate?: FhirDate;
}

// --- Practitioner -----------------------------------------------------------

/**
 * Narrow Practitioner — a person who delivered or referred care. We emit one
 * per unique operator/sonographer + one per unique referring physician so
 * "show me all reports performed by Dr. X" is queryable via
 * `DiagnosticReport.performer` instead of free-text annotations (Area 05 HIGH).
 */
export interface Practitioner extends ResourceBase {
  readonly resourceType: 'Practitioner';
  readonly identifier?: ReadonlyArray<Identifier>;
  readonly active?: boolean;
  readonly name?: ReadonlyArray<HumanName>;
}

// --- Organization -----------------------------------------------------------

/**
 * Narrow Organization — the facility that hosted the study. We emit one per
 * unique `header.institution` so `Encounter.serviceProvider` is a typed
 * Reference instead of free text (Area 05 HIGH).
 */
export interface Organization extends ResourceBase {
  readonly resourceType: 'Organization';
  readonly identifier?: ReadonlyArray<Identifier>;
  readonly active?: boolean;
  readonly name?: string;
}

// --- Encounter --------------------------------------------------------------

export interface Encounter extends ResourceBase {
  readonly resourceType: 'Encounter';
  readonly status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  readonly class: Coding;
  readonly subject: Reference;
  readonly period?: Period;
  readonly reasonCode?: ReadonlyArray<CodeableConcept>;
  /** The Organization that provided the encounter setting (Area 05 HIGH). */
  readonly serviceProvider?: Reference;
}

// --- ServiceRequest ---------------------------------------------------------

export interface ServiceRequest extends ResourceBase {
  readonly resourceType: 'ServiceRequest';
  readonly status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  readonly intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  readonly category?: ReadonlyArray<CodeableConcept>;
  readonly code?: CodeableConcept;
  readonly subject: Reference;
  readonly encounter?: Reference;
  readonly authoredOn?: FhirDateTime;
  readonly requester?: Reference;
  readonly occurrenceDateTime?: FhirDateTime;
  readonly reasonCode?: ReadonlyArray<CodeableConcept>;
}

// --- Consent ----------------------------------------------------------------

export interface ConsentProvision {
  readonly type?: 'deny' | 'permit';
  readonly period?: Period;
}

export interface Consent extends ResourceBase {
  readonly resourceType: 'Consent';
  readonly status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
  readonly scope: CodeableConcept;
  readonly category: ReadonlyArray<CodeableConcept>;
  readonly patient?: Reference;
  readonly dateTime?: FhirDateTime;
  readonly performer?: ReadonlyArray<Reference>;
  readonly policyRule?: CodeableConcept;
  readonly provision?: ConsentProvision;
}

// --- Observation ------------------------------------------------------------

/** Narrowed `Observation` — fields we actually populate. */
export interface Observation extends ResourceBase {
  readonly resourceType: 'Observation';
  readonly status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  readonly category?: ReadonlyArray<CodeableConcept>;
  readonly code: CodeableConcept; // LOINC code identifying the observation
  readonly subject: Reference; // Patient
  readonly encounter?: Reference;
  readonly effectiveDateTime?: FhirDateTime;
  readonly issued?: FhirDateTime;
  readonly performer?: ReadonlyArray<Reference>;
  readonly valueQuantity?: Quantity;
  readonly valueCodeableConcept?: CodeableConcept;
  readonly valueString?: string;
  readonly valueBoolean?: boolean;
  readonly interpretation?: ReadonlyArray<CodeableConcept>;
  readonly note?: ReadonlyArray<Annotation>;
  readonly bodySite?: CodeableConcept; // SNOMED-coded anatomical region
  readonly component?: ReadonlyArray<ObservationComponent>;
  readonly hasMember?: ReadonlyArray<Reference>;
}

export interface ObservationComponent {
  readonly code: CodeableConcept;
  readonly valueQuantity?: Quantity;
  readonly valueCodeableConcept?: CodeableConcept;
  readonly valueString?: string;
  readonly valueBoolean?: boolean;
  readonly interpretation?: ReadonlyArray<CodeableConcept>;
}

// --- DiagnosticReport -------------------------------------------------------

export interface DiagnosticReport extends ResourceBase {
  readonly resourceType: 'DiagnosticReport';
  readonly identifier?: ReadonlyArray<Identifier>;
  readonly status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  readonly category?: ReadonlyArray<CodeableConcept>;
  readonly code: CodeableConcept; // LOINC code for the study type
  readonly subject: Reference;
  readonly encounter?: Reference;
  readonly effectiveDateTime?: FhirDateTime;
  readonly issued?: FhirDateTime;
  readonly performer?: ReadonlyArray<Reference>;
  readonly result?: ReadonlyArray<Reference>; // References to Observation resources
  readonly conclusion?: string; // Narrative summary
  readonly conclusionCode?: ReadonlyArray<CodeableConcept>; // Coded conclusions (e.g. CEAP)
}

// --- QuestionnaireResponse --------------------------------------------------

export interface QuestionnaireResponseAnswer {
  readonly valueString?: string;
  readonly valueBoolean?: boolean;
  readonly valueDecimal?: number;
  readonly valueInteger?: number;
  readonly valueDate?: FhirDate;
  readonly valueDateTime?: FhirDateTime;
  readonly valueCoding?: Coding;
  readonly valueQuantity?: Quantity;
}

export interface QuestionnaireResponseItem {
  readonly linkId: string;
  readonly text?: string;
  readonly answer?: ReadonlyArray<QuestionnaireResponseAnswer>;
  readonly item?: ReadonlyArray<QuestionnaireResponseItem>;
}

export interface QuestionnaireResponse extends ResourceBase {
  readonly resourceType: 'QuestionnaireResponse';
  readonly questionnaire?: FhirCanonical;
  readonly status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped';
  readonly subject?: Reference;
  readonly encounter?: Reference;
  readonly authored?: FhirDateTime;
  readonly author?: Reference;
  readonly item?: ReadonlyArray<QuestionnaireResponseItem>;
}

// --- Bundle -----------------------------------------------------------------

export interface BundleEntry<T extends ResourceBase = ResourceBase> {
  readonly fullUrl?: FhirUri;
  readonly resource: T;
  readonly request?: BundleEntryRequest;
}

export interface BundleEntryRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  readonly url: string;
  readonly ifNoneExist?: string;
  readonly ifMatch?: string;
}

export interface Bundle<T extends ResourceBase = ResourceBase> extends ResourceBase {
  readonly resourceType: 'Bundle';
  readonly type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  readonly timestamp?: FhirDateTime;
  readonly total?: number;
  readonly entry?: ReadonlyArray<BundleEntry<T>>;
}

// ============================================================================
// Union of all resources we emit from this app
// ============================================================================

export type EmittedResource =
  | Patient
  | Practitioner
  | Organization
  | Encounter
  | ServiceRequest
  | Consent
  | Observation
  | DiagnosticReport
  | QuestionnaireResponse;
