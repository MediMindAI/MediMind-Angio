// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousForm — smoke tests (encounter pivot).
 *   1. `stateToFormState` projects encounter identity + the zone findings under
 *      the conventional `parameters.segmentFindings` key the FHIR/PDF readers use.
 *   2. The form mounts inside the full provider stack.
 */

/// <reference types="@testing-library/jest-dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { TranslationProvider } from '../../../contexts/TranslationContext';
import { EncounterProvider } from '../../../contexts/EncounterContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  saveEncounter,
} from '../../../services/encounterStore';
import type { EncounterDraft } from '../../../types/encounter';
import type { IliacPelvicVenousFindings } from './config';
import {
  stateToFormState,
  IliacPelvicVenousForm,
  type IliacPelvicVenousFormStateV1,
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
): IliacPelvicVenousFormStateV1 {
  return {
    schemaVersion: 1,
    studyType: 'iliacPelvicVenous',
    studyDate: '2026-06-05',
    context: { sex: 'female' },
    findings,
    cavalView: 'bilateral',
    impression: '',
    impressionEdited: false,
    sonographerComments: '',
    clinicianComments: '',
    recommendations: [],
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
});
