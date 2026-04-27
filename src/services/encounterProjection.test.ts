// SPDX-License-Identifier: Apache-2.0
/**
 * Regression guards for the unified-mode PDF crash:
 * `Cannot read properties of undefined (reading 'segmentFindings')`.
 *
 * The crash happened because `FormActions.tsx`'s unified-mode useMemo
 * passed raw `encounter.studies[type]` slots straight to
 * `resolveStudyAssets`, which expects a `FormState` shape with
 * `parameters.segmentFindings`. The slots are RAW Phase-3b reducer state
 * (V1 venous, V2 arterial/carotid) — `findings` is top-level, no
 * `parameters` bag. These tests pin the projection that adapts each
 * slot shape to the legacy `FormState` contract.
 */

import { describe, expect, it } from 'vitest';
import { projectStudyToFormState } from './encounterProjection';
import type { EncounterDraft } from '../types/encounter';

function baseEncounter(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: 'enc-test',
    header: {
      patientName: 'Test Patient',
      patientId: '12345678901',
      encounterDate: '2026-04-25',
      operatorName: 'Dr. Mock',
      institution: 'Mock Clinic',
      indicationNotes: 'Routine screening',
      icd10Codes: [{ code: 'I83.90', display: 'Asymptomatic varicose veins' }],
    },
    selectedStudyTypes: ['venousLEBilateral', 'arterialLE', 'carotid'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

describe('projectStudyToFormState — unified-mode crash regression guard', () => {
  it('returns null when slot is undefined', () => {
    const enc = baseEncounter();
    expect(projectStudyToFormState('venousLEBilateral', undefined, enc)).toBeNull();
  });

  it('returns null when slot.studyType disagrees with the requested type', () => {
    const enc = baseEncounter();
    const slot = { studyType: 'arterialLE', findings: {} };
    expect(projectStudyToFormState('venousLEBilateral', slot, enc)).toBeNull();
  });

  it('projects venous V1 reducer state into FormState with parameters.segmentFindings', () => {
    const enc = baseEncounter();
    const venousSlot = {
      schemaVersion: 1,
      studyType: 'venousLEBilateral',
      studyDate: '2026-04-25',
      findings: {
        'pop-ak-left': { compressibility: 'non-compressible', thrombosis: 'acute' },
      },
      view: 'right',
      impression: 'Acute left popliteal DVT.',
      impressionEdited: true,
      ceap: undefined,
      recommendations: [],
      sonographerComments: '',
      clinicianComments: '',
    };
    const result = projectStudyToFormState('venousLEBilateral', venousSlot, enc);
    expect(result).not.toBeNull();
    expect(result?.studyType).toBe('venousLEBilateral');
    expect(result?.parameters['segmentFindings']).toEqual(venousSlot.findings);
    expect(result?.header.patientName).toBe('Test Patient');
    expect(result?.header.patientId).toBe('12345678901');
    expect(result?.header.studyDate).toBe('2026-04-25');
    expect(result?.narrative.indication).toBe('Routine screening');
    expect(result?.narrative.impression).toBe('Acute left popliteal DVT.');
  });

  it('projects arterial V2 reducer state into FormState with parameters.segmentFindings + pressures', () => {
    const enc = baseEncounter();
    const arterialSlot = {
      schemaVersion: 2,
      studyType: 'arterialLE',
      studyDate: '2026-04-25',
      findings: { 'sfa-left': { stenosisCategory: '50-69' } },
      pressures: { ankleLeft: 110, brachialLeft: 130 },
      view: 'bilateral',
      impression: '',
      impressionEdited: false,
      sonographerComments: '',
      clinicianComments: '',
      recommendations: [],
    };
    const result = projectStudyToFormState('arterialLE', arterialSlot, enc);
    expect(result).not.toBeNull();
    expect(result?.studyType).toBe('arterialLE');
    expect(result?.parameters['segmentFindings']).toEqual(arterialSlot.findings);
    expect(result?.parameters['pressures']).toEqual(arterialSlot.pressures);
  });

  it('projects carotid V2 reducer state into FormState with parameters.segmentFindings + nascet', () => {
    const enc = baseEncounter();
    const carotidSlot = {
      schemaVersion: 2,
      studyType: 'carotid',
      studyDate: '2026-04-25',
      findings: { 'ica-left': { plaqueMorphology: 'soft' } },
      nascet: { left: '50-69%', right: '<50%' },
      view: 'bilateral',
      impression: '',
      impressionEdited: false,
      sonographerComments: '',
      clinicianComments: '',
      recommendations: [],
    };
    const result = projectStudyToFormState('carotid', carotidSlot, enc);
    expect(result).not.toBeNull();
    expect(result?.studyType).toBe('carotid');
    expect(result?.parameters['segmentFindings']).toEqual(carotidSlot.findings);
    expect(result?.parameters['nascet']).toEqual(carotidSlot.nascet);
  });

  it('falls back to encounter.encounterDate when slot has no studyDate (regression: empty findings)', () => {
    const enc = baseEncounter({ header: { ...baseEncounter().header, encounterDate: '2026-04-26' } });
    const slot = {
      studyType: 'arterialLE',
      // No studyDate, no findings — nothing should crash.
    };
    const result = projectStudyToFormState('arterialLE', slot, enc);
    expect(result).not.toBeNull();
    expect(result?.header.studyDate).toBe('2026-04-26');
    expect(result?.parameters['segmentFindings']).toEqual({});
  });

  it('always emits a parameters object — the crash this helper exists to prevent', () => {
    const enc = baseEncounter();
    const slot = { studyType: 'venousLEBilateral' }; // bare minimum
    const result = projectStudyToFormState('venousLEBilateral', slot, enc);
    expect(result).not.toBeNull();
    // The original crash: accessing `.parameters.segmentFindings` threw because
    // `parameters` itself was undefined. This guard pins it.
    expect(result?.parameters).toBeDefined();
    expect(result?.parameters['segmentFindings']).toBeDefined();
  });
});
