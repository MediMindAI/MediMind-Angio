// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousForm — smoke tests (encounter pivot).
 *   1. `stateToFormState` projects encounter identity + the zone findings under
 *      the conventional `parameters.segmentFindings` key the FHIR/PDF readers use.
 *   2. The form mounts inside the full provider stack.
 *   3. An old (pre-simplification) draft still loads, and its removed free-text
 *      fields are folded into the single comments box.
 */

/// <reference types="@testing-library/jest-dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { TranslationProvider } from '../../../contexts/TranslationContext';
import { EncounterProvider } from '../../../contexts/EncounterContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  loadEncounter,
  saveEncounter,
} from '../../../services/encounterStore';
import type { EncounterDraft } from '../../../types/encounter';
import type { IliacPelvicVenousFindings } from './config';
import {
  allNormalOverwritesFindings,
  reducer,
  stateToFormState,
  IliacPelvicVenousForm,
  type IliacPelvicVenousFormStateV2,
} from './IliacPelvicVenousForm';

function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-iliac-1',
    header: {
      patientName: 'Jane Doe',
      patientBirthDate: '1985-03-21',
      patientGender: 'female',
      operatorName: 'Dr. Sonographer',
      institution: 'Test Clinic',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['iliacPelvicVenous'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

function baseState(
  findings: IliacPelvicVenousFindings = {},
): IliacPelvicVenousFormStateV2 {
  return {
    schemaVersion: 2,
    studyType: 'iliacPelvicVenous',
    studyDate: '2026-06-05',
    context: { sex: 'female' },
    findings,
    impression: '',
    impressionEdited: false,
    clinicianComments: '',
    drawings: [],
  };
}

function Harness({ encounterId }: { readonly encounterId: string }): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[`/encounter/${encounterId}/iliacPelvicVenous`]}>
      <MantineProvider>
        <Notifications />
        <TranslationProvider>
          <EncounterProvider encounterId={encounterId}>
            <Routes>
              <Route
                path="/encounter/:encounterId/:studyType"
                element={<IliacPelvicVenousForm />}
              />
            </Routes>
          </EncounterProvider>
        </TranslationProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  _resetStoreForTests();
  await clearAllEncounters();
  localStorage.clear();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('IliacPelvicVenousForm', () => {
  it('stateToFormState projects encounter identity + zone findings under segmentFindings', () => {
    const draft = buildDraft();
    const fs = stateToFormState(
      baseState({ gonadal: { left: { diameterMm: 8, refluxPresent: true } } }),
      draft,
    );
    expect(fs.studyType).toBe('iliacPelvicVenous');
    expect(fs.header.patientName).toBe('Jane Doe');
    expect(fs.header.studyDate).toBe('2026-06-05');
    const findings = fs.parameters['segmentFindings'] as IliacPelvicVenousFindings;
    expect(findings.gonadal?.left?.diameterMm).toBe(8);
    expect(findings.gonadal?.left?.refluxPresent).toBe(true);
  });

  it('renders the form shell inside the provider stack', async () => {
    const draft = buildDraft();
    await saveEncounter(draft);
    render(<Harness encounterId={draft.encounterId} />);
    expect(await screen.findByTestId('iliac-pelvic-venous-form')).toBeInTheDocument();
  });

  it('takes sex from the intake patient details, never a guessed "female" (sign-off S8)', async () => {
    const draft = buildDraft({
      header: { ...buildDraft().header, patientGender: 'male' },
    });
    await saveEncounter(draft);
    render(<Harness encounterId={draft.encounterId} />);
    await screen.findByTestId('iliac-pelvic-venous-form');
    const sex = screen.getByLabelText(/სქესი|Sex/) as HTMLInputElement;
    expect(sex.value).toMatch(/მამრობითი|Male/);
  });

  it('loads an old draft with removed fields and folds its text into comments', async () => {
    const oldState = {
      ...baseState(),
      findings: {
        renal: { peakVelocityRatio: 8 },
        plexus: { left: { largestDiameterMm: 9 } },
        caval: {
          ivc: { patency: 'occluded' },
          'civ-left': { stenosisPct: 60 },
          'ov-right': { competency: 'incompetent' },
          'cfv-left': { patency: 'patent' },
        },
      },
      cavalView: 'bilateral',
      sonographerComments: 'old sono note',
      recommendations: [{ id: 'r1', text: 'old recommendation' }],
    };
    const draft = buildDraft({
      studies: { iliacPelvicVenous: oldState } as unknown as EncounterDraft['studies'],
    });
    await saveEncounter(draft);
    render(<Harness encounterId={draft.encounterId} />);
    const comments = await screen.findByTestId('iliac-comments');
    expect((comments as HTMLTextAreaElement).value).toBe('old sono note\nold recommendation');
    // Removed zones / old keys / ovarian rows are stripped before they reach
    // the PDF or the FHIR snapshot; current rows survive.
    await waitFor(async () => {
      const saved = (await loadEncounter(draft.encounterId))?.studies?.iliacPelvicVenous as
        | IliacPelvicVenousFormStateV2
        | undefined;
      expect(saved?.findings).toEqual({ caval: { 'cfv-left': { patency: 'patent' } } });
    });
  });

  it('stateToFormState never emits recommendations or sonographer comments', () => {
    const fs = stateToFormState({ ...baseState(), clinicianComments: 'note' }, buildDraft());
    expect(fs.recommendations).toEqual([]);
    expect(fs.narrative.sonographerComments).toBeUndefined();
    expect(fs.narrative.clinicianComments).toBe('note');
  });

  describe('all normal (UX-ANGIO-011)', () => {
    it('asks first only when a set value would change', () => {
      expect(allNormalOverwritesFindings({})).toBe(false);
      expect(
        allNormalOverwritesFindings({
          'cfv-left': { patency: 'patent', competency: 'competent', phasicity: 'pulsatile' },
        }),
      ).toBe(false);
      expect(allNormalOverwritesFindings({ 'cfv-left': { peakVelocityCmS: 40 } })).toBe(false);
      expect(allNormalOverwritesFindings({ 'cfv-left': { patency: 'occluded' } })).toBe(true);
      expect(allNormalOverwritesFindings({ lrv: { competency: 'incompetent' } })).toBe(true);
      expect(allNormalOverwritesFindings({ 'civ-mid-left': { patency: 'thrombosis' } })).toBe(true);
      // Removed ovarian rows from an old draft are ignored.
      expect(
        allNormalOverwritesFindings({
          'ov-left': { competency: 'incompetent' },
        } as unknown as Parameters<typeof allNormalOverwritesFindings>[0]),
      ).toBe(false);
    });

    it('fills every row in one click on a clean table', async () => {
      const draft = buildDraft();
      await saveEncounter(draft);
      render(<Harness encounterId={draft.encounterId} />);
      fireEvent.click(await screen.findByTestId('iliac-bulk-set-all-normal'));
      await waitFor(() =>
        expect((screen.getByTestId('iliac-ivc-mid-patency') as HTMLInputElement).value).not.toBe(''),
      );
      expect((screen.getByTestId('iliac-lrv-competency') as HTMLInputElement).value).not.toBe('');
      expect((screen.getByTestId('iliac-lrv-phasicity') as HTMLInputElement).value).toBe('');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('SET_ALL_NORMAL fills all 20 rows and keeps phasicity / velocity / diameter', () => {
      const next = reducer(
        baseState({
          caval: { 'cfv-left': { patency: 'occluded', apDiameterMm: 11, phasicity: 'pulsatile' } },
          gonadal: { left: { diameterMm: 4 } },
        }),
        { type: 'SET_ALL_NORMAL' },
      );
      const caval = next.findings.caval ?? {};
      expect(Object.keys(caval)).toHaveLength(20);
      expect(caval['ivc-mid']).toEqual({ patency: 'patent', filling: 'full', competency: 'competent' });
      expect(caval.lrv).toEqual({ patency: 'patent', filling: 'full', competency: 'competent' });
      expect(caval['cfv-left']).toEqual({
        patency: 'patent',
        filling: 'full',
        competency: 'competent',
        apDiameterMm: 11,
        phasicity: 'pulsatile',
      });
      // The gonadal section is outside the table and untouched.
      expect(next.findings.gonadal?.left?.diameterMm).toBe(4);
    });
  });
});
