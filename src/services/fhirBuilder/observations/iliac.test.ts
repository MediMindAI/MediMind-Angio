// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac/pelvic FHIR emitter tests — guard the audit fixes that closed silent
 * data loss (H3 context, H4 Valsalva/confirmatory, H5 plexus reflux-type, H6
 * escape-point body site) and the verified SNOMED body-site codes (C1).
 */

import { describe, expect, it } from 'vitest';
import { buildFhirBundle } from '../buildBundle';
import type { FormState } from '../../../types/form';
import type { Observation } from '../../../types/fhir';
import type { IliacPelvicVenousFindings, IliacContext } from '../../../components/studies/iliac-pelvic-venous/config';

function iliacForm(
  findings: IliacPelvicVenousFindings,
  context: IliacContext,
): FormState {
  return {
    studyType: 'iliacPelvicVenous',
    header: {
      patientName: 'Jane Doe',
      patientId: 'MRN-1',
      patientBirthDate: '1985-03-21',
      patientGender: 'female',
      studyDate: '2026-06-05',
      operatorName: '',
      referringPhysician: '',
      institution: '',
      accessionNumber: '',
    },
    segments: [],
    narrative: {},
    recommendations: [],
    parameters: { segmentFindings: findings, context },
  } as unknown as FormState;
}

function observations(form: FormState): Observation[] {
  const bundle = buildFhirBundle(form);
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is Observation => r?.resourceType === 'Observation');
}

/** True if any Observation's note tags it with `parameter=<id>`. */
function hasParam(obs: Observation[], id: string): boolean {
  return obs.some((o) => o.note?.some((n) => n.text?.includes(`parameter=${id}`)));
}

function hasBodySiteCode(obs: Observation[], code: string): boolean {
  return obs.some((o) => o.bodySite?.coding?.some((c) => c.code === code));
}

describe('appendIliacObservations — audit data-loss + code fixes', () => {
  const FINDINGS: IliacPelvicVenousFindings = {
    renal: { peakVelocityRatio: 8, confirmatoryImagingRecommended: true },
    caval: {
      'cfv-left': {
        patency: 'patent',
        valsalvaResponse: 'absent',
        confirmatoryImagingRecommended: true,
        velocityRatio: 3,
      },
      // Per-level velocities (protocol multi-level capture) → derived ratio 3.0.
      'eiv-left': { patency: 'partial', levels: { distal: { velocityCmS: 40 }, proximal: { velocityCmS: 120 } } },
    },
    gonadal: { left: { diameterMm: 8, refluxPresent: true } },
    plexus: { left: { largestDiameterMm: 9, refluxType: 'III' } },
    escapePoints: [{ id: 'e1', type: 'inguinal', side: 'left', diameterMm: 5 }],
    specialConsiderations: {
      smas: { smaAortaAngleDeg: 20 },
      mals: { caInspiratoryPsvCmS: 100, caExpiratoryPsvCmS: 250, hookSign: true },
    },
  };
  const CONTEXT: IliacContext = {
    sex: 'female',
    symptoms: ['chronic-pelvic-pain'],
    riskFactors: ['endometriosis'],
    approaches: ['transvaginal'],
    positions: ['standing'],
    valsalvaPerformed: true,
  };

  const obs = observations(iliacForm(FINDINGS, CONTEXT));

  it('emits Zone-0 context (H3): symptoms + Valsalva-performed', () => {
    expect(hasParam(obs, 'presentingSymptoms')).toBe(true);
    expect(hasParam(obs, 'valsalvaPerformed')).toBe(true);
  });

  it('emits caval Valsalva response + confirmatory flag (H4)', () => {
    expect(hasParam(obs, 'valsalvaResponse')).toBe(true);
    expect(hasParam(obs, 'confirmatoryImagingRecommended')).toBe(true);
  });

  it('emits plexus reflux type (H5)', () => {
    // refluxType is emitted for both gonadal and plexus; ensure the plexus zone tag carries it.
    const plexusRefluxType = obs.some(
      (o) =>
        o.note?.some((n) => n.text?.includes('zone=plexus')) &&
        o.note?.some((n) => n.text?.includes('parameter=refluxType')),
    );
    expect(plexusRefluxType).toBe(true);
  });

  it('emits escape-point body site reflecting the point type, not pelvic plexus (H6)', () => {
    const epSite = obs.some((o) => o.bodySite?.text?.includes('inguinal escape point'));
    expect(epSite).toBe(true);
  });

  it('uses verified SNOMED body-site codes (C1): EIV, ovarian, uterine plexus', () => {
    expect(hasBodySiteCode(obs, '63507001')).toBe(true); // external iliac vein
    expect(hasBodySiteCode(obs, '976004')).toBe(true); // ovarian vein
    expect(hasBodySiteCode(obs, '4810005')).toBe(true); // uterine venous plexus
    // The discarded generic-vein placeholder must no longer appear.
    expect(hasBodySiteCode(obs, '29092000')).toBe(false);
  });

  it('emits Zone-0 risk factors (protocol)', () => {
    expect(hasParam(obs, 'riskFactors')).toBe(true);
  });

  it('emits per-level caval velocities (protocol multi-level capture)', () => {
    expect(hasParam(obs, 'cavalVelocity_distal')).toBe(true);
    expect(hasParam(obs, 'cavalVelocity_proximal')).toBe(true);
  });

  it('emits SMAS + MALS arterial observations with mesenteric SNOMED body sites', () => {
    expect(hasParam(obs, 'smaAortaAngleDeg')).toBe(true);
    expect(hasParam(obs, 'caExpiratoryPsvCmS')).toBe(true);
    expect(hasBodySiteCode(obs, '42258001')).toBe(true); // superior mesenteric artery (SMAS)
    expect(hasBodySiteCode(obs, '57850000')).toBe(true); // celiac artery (MALS)
  });

  it('drops nothing for an empty study (no crash, no context observations)', () => {
    const empty = observations(iliacForm({}, { sex: 'female' }));
    expect(hasParam(empty, 'presentingSymptoms')).toBe(false);
    expect(Array.isArray(empty)).toBe(true);
  });
});
