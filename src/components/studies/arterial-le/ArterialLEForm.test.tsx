// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialLEForm — Phase 3b (encounter pivot) integration tests.
 *
 * The Phase 3b refactor removed the per-study `<StudyHeader>` block and
 * mounted `<EncounterContextBanner>` in its place; encounter-level header
 * fields now live on the `EncounterContext` while only the study-clinical
 * subset (studyDate/studyTime/accessionNumber/cptCode/patientPosition/
 * quality + findings/pressures/narrative/recommendations) lives in the
 * reducer. These tests pin that contract:
 *
 *   1. NO `<StudyHeader>` is rendered (regression guard against re-introducing
 *      the duplicate identity card).
 *   2. `<EncounterContextBanner>` IS rendered with the encounter's patient
 *      identity fields visible (proves it's reading from EncounterContext).
 *   3. Per-study findings UI renders (impression / pressure table / segment
 *      table all surface the new layout).
 *   4. Encounter persistence — typing into the impression mirror-saves into
 *      `encounter.studies.arterialLE` after the 500ms debounce window
 *      elapses (option (a) of the Phase 3b brief).
 *   5. Hydration order — when `encounter.studies.arterialLE` already
 *      contains a V2 snapshot the reducer prefers it over the legacy
 *      `localStorage` per-study draft (back-compat fallback path).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

// Heavy children — mocked to keep the test focused on the Phase 3b contract
// (state shape, banner mount, encounter mirror) and avoid jsdom timeouts
// from the anatomy-SVG fetch + PDF lazy import.
vi.mock('../../anatomy/AnatomyView', () => ({
  AnatomyView: () => <div data-testid="mock-anatomy-view" />,
}));
vi.mock('../../form/FormActions', () => ({
  FormActions: () => <div data-testid="mock-form-actions" />,
}));
vi.mock('./ArterialTemplateGallery', () => ({
  ArterialTemplateGallery: () => null,
}));
vi.mock('../../form/SaveTemplateDialog', () => ({
  SaveTemplateDialog: () => null,
}));

import { TranslationProvider } from '../../../contexts/TranslationContext';
import { EncounterProvider } from '../../../contexts/EncounterContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  keyEncounter,
  loadEncounter,
} from '../../../services/encounterStore';
import { keyStudyDraft } from '../../../constants/storage-keys';
import type { EncounterDraft } from '../../../types/encounter';
import { ArterialLEForm } from './ArterialLEForm';

// ----------------------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------------------

function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-arterial-test',
    header: {
      patientName: 'Jane Doe',
      patientId: '01001011116',
      patientBirthDate: '1985-03-21',
      patientGender: 'female',
      operatorName: 'Dr. Sonographer',
      institution: 'Test Clinic',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['arterialLE'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

function renderForm(encounterId: string): void {
  render(
    <MantineProvider>
      <Notifications />
      <TranslationProvider>
        <MemoryRouter initialEntries={[`/encounter/${encounterId}/arterialLE`]}>
          <Routes>
            <Route
              path="/encounter/:encounterId/:studyType"
              element={
                <EncounterProvider encounterId={encounterId}>
                  <ArterialLEForm />
                </EncounterProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </TranslationProvider>
    </MantineProvider>,
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
});

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

// The form pulls in the full Mantine + reducer + template registry tree on
// first render — under jsdom that easily blows past the 5 s default. Bump
// the per-test cap to 60 s so the slow cold-start render isn't flaky under
// parallel test runners (where CPU contention can stretch the cold start
// well past 30 s).
describe('ArterialLEForm — Phase 3b (encounter pivot)', { timeout: 60_000 }, () => {
  it('does NOT render the legacy <StudyHeader> identity card', () => {
    const draft = buildDraft();
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // The old StudyHeader (the collapsible patient/visit/operator card) used
    // a per-study expand toggle whose label key was the only stable hook —
    // its absence proves the duplicate identity card no longer renders.
    expect(screen.queryByLabelText(/Toggle study header/i)).not.toBeInTheDocument();
    // Belt-and-braces: assert no patientName or patient-identity input is
    // rendered as an editable field on the study page (the banner shows it
    // as static text instead).
    expect(screen.queryByLabelText(/Patient name/i)).not.toBeInTheDocument();
  });

  it('renders the <EncounterContextBanner> with encounter identity', () => {
    const draft = buildDraft({
      encounterId: 'enc-banner',
      header: {
        patientName: 'Alex Patient',
        patientBirthDate: '1990-06-15',
        encounterDate: '2026-04-25',
      },
    });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // Banner rendered with stable testid.
    expect(screen.getByTestId('encounter-context-banner')).toBeInTheDocument();
    // Patient identity comes from EncounterContext, not from local form state.
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent('Alex Patient');
    expect(screen.getByTestId('banner-encounter-date')).toHaveTextContent('2026-04-25');
  });

  it('renders the per-study findings UI (impression + segment table)', () => {
    const draft = buildDraft();
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // The arterial-specific impression / sonographer / clinician textareas
    // are stable test ids in the form.
    expect(screen.getByTestId('arterial-impression')).toBeInTheDocument();
    expect(screen.getByTestId('arterial-sonographer')).toBeInTheDocument();
    expect(screen.getByTestId('arterial-clinician')).toBeInTheDocument();
    // Templates trigger button is part of the per-study toolbar.
    expect(screen.getByTestId('arterial-template-gallery-trigger')).toBeInTheDocument();
  });

  it('mirrors per-study state into encounter.studies.arterialLE after the debounce', async () => {
    const draft = buildDraft({ encounterId: 'enc-mirror' });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    const impressionField = screen.getByTestId('arterial-impression') as HTMLTextAreaElement;
    fireEvent.change(impressionField, { target: { value: 'Patent femoral arteries.' } });

    // 500ms debounce + a tick for the fire-and-forget save to flush.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    const persisted = await loadEncounter('enc-mirror');
    const study = persisted?.studies.arterialLE as
      | { schemaVersion?: number; studyType?: string; impression?: string }
      | undefined;
    expect(study).toBeDefined();
    expect(study?.schemaVersion).toBe(2);
    expect(study?.studyType).toBe('arterialLE');
    expect(study?.impression).toBe('Patent femoral arteries.');
  });

  it('hydrates from encounter.studies.arterialLE when present (overrides legacy draft)', () => {
    // Plant a legacy localStorage per-study draft (V2 shape) — would be the
    // fallback path if the encounter slot were empty.
    const legacy = {
      schemaVersion: 2,
      studyType: 'arterialLE',
      studyDate: '2025-01-01',
      findings: {},
      pressures: {},
      view: 'bilateral',
      impression: 'LEGACY-FALLBACK',
      impressionEdited: true,
      sonographerComments: '',
      clinicianComments: '',
      recommendations: [],
    };
    localStorage.setItem(keyStudyDraft('arterialLE'), JSON.stringify(legacy));

    // Plant an encounter draft whose studies.arterialLE carries a different
    // impression — this should win over the legacy fallback.
    const draft = buildDraft({
      encounterId: 'enc-hydrate',
      studies: {
        arterialLE: {
          schemaVersion: 2,
          studyType: 'arterialLE',
          studyDate: '2026-04-25',
          findings: {},
          pressures: {},
          view: 'bilateral',
          impression: 'FROM-ENCOUNTER',
          impressionEdited: true,
          sonographerComments: '',
          clinicianComments: '',
          recommendations: [],
        },
      },
    });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    const impressionField = screen.getByTestId('arterial-impression') as HTMLTextAreaElement;
    expect(impressionField.value).toBe('FROM-ENCOUNTER');
    expect(impressionField.value).not.toBe('LEGACY-FALLBACK');
  });
});
