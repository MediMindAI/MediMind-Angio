/**
 * Consent resource builder (Phase 1.5).
 *
 * Extracted from the original monolithic `fhirBuilder.ts` (Wave 2.6) — pure
 * mechanical move, no behavior change. Emits a Consent only when the header
 * carries `informedConsent === true`.
 */

import type { BundleEntry, Consent } from '../../types/fhir';
import type { BuildContext } from './context';
import { urnRef } from './context';

export function buildConsentEntry(ctx: BuildContext): BundleEntry<Consent> | null {
  if (!ctx.consentId) return null;
  const signedAt =
    ctx.form.header.informedConsentSignedAt ?? ctx.nowIso;

  const consent: Consent = {
    resourceType: 'Consent',
    id: ctx.consentId,
    status: 'active',
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Privacy Consent',
        },
      ],
      text: 'Privacy Consent',
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
            code: 'dch',
            display: 'Disclosure to Consumer/Healthcare Provider',
          },
        ],
        text: 'Informed consent for imaging study',
      },
    ],
    patient: { reference: ctx.patientRef },
    dateTime: signedAt,
    provision: { type: 'permit' },
  };
  return {
    fullUrl: urnRef(ctx.consentId),
    resource: consent,
    request: { method: 'POST', url: 'Consent' },
  };
}
