/**
 * Practitioner + Organization resource builders (Wave 3.4).
 *
 * Before this module, `header.operatorName`, `header.referringPhysician`, and
 * `header.institution` flowed into bundles only as `QuestionnaireResponse`
 * answers (free text) or as per-Observation `note: 'performer=...'` strings.
 * None of them reached typed FHIR slots like `ServiceRequest.requester`,
 * `DiagnosticReport.performer`, or `Encounter.serviceProvider`, which meant
 * "show me all reports performed by Dr. X" returned nothing (Area 05 HIGH).
 *
 * This module emits the missing typed resources. Each builder returns `null`
 * when the source header field is empty/blank so all three remain optional
 * bundle entries — bundles built without these fields are byte-identical to
 * the pre-3.4 output.
 */

import type {
  BundleEntry,
  HumanName,
  Organization,
  Practitioner,
} from '../../types/fhir';
import type { BuildContext } from './context';
import { urnRef } from './context';

/**
 * Split a free-text name (e.g. "Dr. Maia Lomidze") into a HumanName so the
 * Practitioner survives FHIR consumers that key on `family` / `given` instead
 * of `text`. The split is best-effort — when the source has fewer than two
 * tokens we fall back to `text` only.
 */
function nameFromString(raw: string): HumanName {
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { use: 'official', text: trimmed };
  }
  const family = parts[parts.length - 1] ?? '';
  const given = parts.slice(0, -1);
  return {
    use: 'official',
    text: trimmed,
    family: family || undefined,
    given: given.length > 0 ? given : undefined,
  };
}

export function buildOperatorPractitionerEntry(
  ctx: BuildContext,
): BundleEntry<Practitioner> | null {
  if (!ctx.operatorPractitionerId) return null;
  const raw = ctx.form.header.operatorName;
  // Defensive — context.ts only mints the ID when the trimmed string is
  // non-empty, but we re-check here so this builder is independently safe.
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: ctx.operatorPractitionerId,
    active: true,
    name: [nameFromString(raw)],
  };
  return {
    fullUrl: urnRef(ctx.operatorPractitionerId),
    resource: practitioner,
    request: { method: 'POST', url: 'Practitioner' },
  };
}

export function buildReferrerPractitionerEntry(
  ctx: BuildContext,
): BundleEntry<Practitioner> | null {
  if (!ctx.referrerPractitionerId) return null;
  const raw = ctx.form.header.referringPhysician;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: ctx.referrerPractitionerId,
    active: true,
    name: [nameFromString(raw)],
  };
  return {
    fullUrl: urnRef(ctx.referrerPractitionerId),
    resource: practitioner,
    request: { method: 'POST', url: 'Practitioner' },
  };
}

export function buildInstitutionOrganizationEntry(
  ctx: BuildContext,
): BundleEntry<Organization> | null {
  if (!ctx.institutionOrganizationId) return null;
  const raw = ctx.form.header.institution;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const organization: Organization = {
    resourceType: 'Organization',
    id: ctx.institutionOrganizationId,
    active: true,
    name: raw.trim(),
  };
  return {
    fullUrl: urnRef(ctx.institutionOrganizationId),
    resource: organization,
    request: { method: 'POST', url: 'Organization' },
  };
}
