/**
 * Patient resource builder.
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change.
 */

import type { StudyHeader } from '../../types/form';
import type { BundleEntry, Patient } from '../../types/fhir';
import { IDENTIFIER_SYSTEMS } from '../../constants/fhir-systems';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildPatientEntry(ctx: BuildContext): BundleEntry<Patient> {
  const header: StudyHeader = ctx.form.header;
  const nameParts = header.patientName.split(/\s+/).filter(Boolean);
  const family = nameParts.length > 0 ? (nameParts[nameParts.length - 1] ?? '') : '';
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [];

  // Emit identifier(s) for the patient. Without these, every bundle creates
  // a fresh anonymous Patient on import — re-importing the same patient
  // would never match an existing record (Area 05 CRITICAL).
  const identifier = header.patientId
    ? [{ system: IDENTIFIER_SYSTEMS.PERSONAL_ID, value: header.patientId }]
    : undefined;

  const patient: Patient = {
    resourceType: 'Patient',
    id: ctx.patientId,
    active: true,
    identifier,
    name: header.patientName
      ? [
          {
            use: 'official',
            text: header.patientName,
            family: family || undefined,
            given: given.length > 0 ? given : undefined,
          },
        ]
      : undefined,
    gender: header.patientGender,
    birthDate: header.patientBirthDate,
  };

  return {
    fullUrl: urnRef(ctx.patientId),
    resource: patient,
    request: { method: 'POST', url: 'Patient' },
  };
}
