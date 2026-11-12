// SPDX-License-Identifier: Apache-2.0
/**
 * Iliac/pelvic FHIR emitter tests — guard context emission (audit H3), the
 * simplified per-row table (clinician feedback 2026-11), the verified SNOMED
 * body-site codes (C1), and that old drafts' removed zones are ignored.
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

describe('appendIliacObservations — simplified pelvic venous shape', () => {
  const FINDINGS: IliacPelvicVenousFindings = {
    caval: {
      'ivc-prox': { patency: 'patent', peakVelocityCmS: 30 },
      'cfv-left': {
        patency: 'patent',
        filling: 'full',
        phasicity: 'monophasic',
        competency: 'incompetent',
        apDiameterMm: 11,
        peakVelocityCmS: 25,
      },
      'eiv-mid-left': { patency: 'partial', filling: 'partial' },
    },
    gonadal: { left: { diameterMm: 8, refluxPresent: true } },
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

  it('emits context (H3): symptoms, comorbidities, Valsalva-performed', () => {
    expect(hasParam(obs, 'presentingSymptoms')).toBe(true);
    expect(hasParam(obs, 'riskFactors')).toBe(true);
    expect(hasParam(obs, 'valsalvaPerformed')).toBe(true);
  });

  it('emits every table column for a row', () => {
    for (const id of ['patency', 'filling', 'phasicity', 'competency', 'apDiameterMm', 'peakVelocityCmS']) {
      expect(hasParam(obs, id)).toBe(true);
    }
  });

  it('emits left gonadal diameter + reflux', () => {
    expect(hasParam(obs, 'gonadalDiameterMm')).toBe(true);
    expect(hasParam(obs, 'refluxPresent')).toBe(true);
  });

  it('uses verified SNOMED body-site codes (C1): EIV + ovarian vein', () => {
    expect(hasBodySiteCode(obs, '63507001')).toBe(true); // external iliac vein
    expect(hasBodySiteCode(obs, '976004')).toBe(true); // ovarian vein
    expect(hasBodySiteCode(obs, '29092000')).toBe(false);
  });

  it('ignores removed zones + old caval keys from an old draft (no crash)', () => {
    const legacy = {
      renal: { peakVelocityRatio: 8 },
      plexus: { left: { largestDiameterMm: 9 } },
      caval: { ivc: { patency: 'occluded' }, 'civ-left': { stenosisPct: 60 } },
    } as unknown as IliacPelvicVenousFindings;
    const out = observations(iliacForm(legacy, { sex: 'female' }));
    expect(hasParam(out, 'renalPeakVelocityRatio')).toBe(false);
    expect(hasParam(out, 'stenosisPct')).toBe(false);
    expect(hasParam(out, 'patency')).toBe(false);
  });

  it('LRV row: renal-vein body site with left laterality; AP exported on any row', () => {
    const out = observations(
      iliacForm(
        { caval: { lrv: { patency: 'patent', apDiameterMm: 6 }, 'iiv-right': { apDiameterMm: 9 } } },
        { sex: 'female' },
      ),
    );
    const lrv = out.filter((o) => o.note?.some((n) => n.text?.includes('segment=lrv;')));
    expect(lrv.length).toBeGreaterThan(0);
    expect(lrv.every((o) => o.bodySite?.coding?.some((c) => c.code === '56400007'))).toBe(true);
    expect(lrv.every((o) => o.bodySite?.coding?.some((c) => c.code === '7771000'))).toBe(true);
    const iivAp = out.filter(
      (o) =>
        o.note?.some((n) => n.text?.includes('segment=iiv-right;')) &&
        o.note?.some((n) => n.text?.includes('parameter=apDiameterMm')),
    );
    expect(iivAp).toHaveLength(1);
  });

  it('flags thrombosis patency abnormal', () => {
    const out = observations(iliacForm({ caval: { 'civ-mid-left': { patency: 'thrombosis' } } }, {}));
    const patency = out.find((o) => o.note?.some((n) => n.text?.includes('parameter=patency')));
    expect(patency?.interpretation?.[0]?.coding?.[0]?.code).toBe('A');
  });

  it('never exports the removed ovarian rows from an old draft', () => {
    const legacy = {
      caval: { 'ov-right': { competency: 'incompetent' }, 'ov-left': { patency: 'patent' } },
    } as unknown as IliacPelvicVenousFindings;
    const out = observations(iliacForm(legacy, {}));
    expect(out.some((o) => o.note?.some((n) => n.text?.includes('segment=ov-')))).toBe(false);
  });

  it('drops nothing for an empty study (no crash, no context observations)', () => {
    const empty = observations(iliacForm({}, { sex: 'female' }));
    expect(hasParam(empty, 'presentingSymptoms')).toBe(false);
    expect(Array.isArray(empty)).toBe(true);
  });
});
