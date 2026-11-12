// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidForm — Phase 3b (encounter pivot) integration tests.
 *
 * Phase 3b dropped the per-study `<StudyHeader>` block and mounted
 * `<EncounterContextBanner>` in its place. Encounter-level identity
 * + visit-context fields now live on `EncounterContext`; only the
 * study-clinical subset (studyDate / studyTime / accessionNumber /
 * cptCode / patientPosition / quality + findings/nascet/narrative/
 * recommendations) lives in the reducer. These tests pin that contract:
 *
 *   1. NO `<StudyHeader>` is rendered (regression guard against
 *      re-introducing the duplicate identity card).
 *   2. `<EncounterContextBanner>` IS rendered with the encounter's
 *      patient identity (proves it reads from EncounterContext).
 *   3. Per-study findings UI renders (impression + sonographer +
 *      clinician textareas + template-gallery trigger).
 *   4. Encounter persistence — typing into the impression mirror-saves
 *      into `encounter.studies.carotid` (Phase 3b option (a)).
 *   5. Hydration order — when `encounter.studies.carotid` already
 *      contains a V2 snapshot the reducer prefers it over the legacy
 *      `localStorage` per-study draft (back-compat fallback).
 *
 * Mirrors the sibling `ArterialLEForm.test.tsx` shape so both Phase 3b
 * forms have parallel coverage that's easy to compare in review.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

// Heavy children — mocked to keep the test focused on the Phase 3b
// contract (state shape, banner mount, encounter mirror) and avoid
// jsdom timeouts from the anatomy-SVG fetch + PDF lazy import.
vi.mock('../../anatomy/AnatomyView', () => ({
  AnatomyView: () => <div data-testid="mock-anatomy-view" />,
}));
vi.mock('../../form/FormActions', () => ({
  FormActions: () => <div data-testid="mock-form-actions" />,
}));
vi.mock('./CarotidTemplateGallery', () => ({
  CarotidTemplateGallery: () => null,
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
import { CarotidForm } from './CarotidForm';

// ----------------------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------------------

function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-carotid-test',
    header: {
      patientName: 'Jane Doe',
      patientId: '01001011116',
      patientBirthDate: '1985-03-21',
      patientGender: 'female',
      operatorName: 'Dr. Sonographer',
      institution: 'Test Clinic',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['carotid'],
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
        <MemoryRouter initialEntries={[`/encounter/${encounterId}/carotid`]}>
          <Routes>
            <Route
              path="/encounter/:encounterId/:studyType"
              element={
                <EncounterProvider encounterId={encounterId}>
                  <CarotidForm />
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
describe('CarotidForm — Phase 3b (encounter pivot)', { timeout: 60_000 }, () => {
  it('does NOT render the legacy <StudyHeader> identity card', () => {
    const draft = buildDraft();
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // The old StudyHeader's expand toggle was the only stable affordance —
    // its absence proves the duplicate identity card no longer renders.
    expect(screen.queryByLabelText(/Toggle study header/i)).not.toBeInTheDocument();
    // Belt-and-braces: the patient-name editable input is gone (the
    // banner shows it as static text instead).
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

    expect(screen.getByTestId('encounter-context-banner')).toBeInTheDocument();
    // Patient identity comes from EncounterContext, not from local form state.
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent('Alex Patient');
    expect(screen.getByTestId('banner-encounter-date')).toHaveTextContent('25.04.2026');
  });

  it('renders the per-study findings UI (impression + sonographer + clinician)', () => {
    const draft = buildDraft();
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // The carotid-specific narrative textareas are stable test ids.
    // Sonographer comments were removed per clinician request — only
    // impression + clinician comments remain.
    expect(screen.getByTestId('carotid-impression')).toBeInTheDocument();
    expect(screen.queryByTestId('carotid-sonographer')).not.toBeInTheDocument();
    expect(screen.getByTestId('carotid-clinician')).toBeInTheDocument();
    // Templates trigger button is part of the per-study toolbar.
    expect(screen.getByTestId('carotid-template-gallery-trigger')).toBeInTheDocument();
  });

  it('UX-ANGIO-025 L3: the diagram sits beside the table; the NASCET grade stays in the page flow under the table', () => {
    const draft = buildDraft({ encounterId: 'enc-layout' });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    const aside = screen.getByTestId('carotid-assessment-aside');
    const anatomy = screen.getByTestId('mock-anatomy-view');
    const nascet = screen.getByTestId('nascet-section');
    const table = screen.getByRole('table');
    expect(aside).toContainElement(anatomy);
    // NASCET is not inside the sticky, separately scrolling column (walkers
    // and the critic could not find it there) — it follows the table.
    expect(aside).not.toContainElement(nascet);
    expect(aside).not.toContainElement(table);
    expect(table.compareDocumentPosition(nascet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('UX-ANGIO-018 + 020: the segment-table title is an h2 and row controls have Georgian names', () => {
    const draft = buildDraft({ encounterId: 'enc-a11y' });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /^(Vessel assessment|სისხლძარღვების შეფასება)$/,
      }),
    ).toBeInTheDocument();
    // Flow / plaque controls end with the translated column label (the same
    // text as the column header), not a hard-coded English suffix.
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '');
    const flowHeader = headers[4] ?? '';
    const plaqueHeader = headers[5] ?? '';
    const flow = screen.getByTestId('carotid-ica-prox-right-flow');
    const plaque = screen.getByTestId('carotid-ica-prox-right-plaque');
    expect(flowHeader).not.toBe('');
    expect((flow.getAttribute('aria-label') ?? '').endsWith(` R ${flowHeader}`)).toBe(true);
    expect((plaque.getAttribute('aria-label') ?? '').endsWith(` R ${plaqueHeader}`)).toBe(true);
    expect(flow.getAttribute('aria-label')).not.toMatch(/ flow$/);
    expect(plaque.getAttribute('aria-label')).not.toMatch(/ plaque$/);
  });

  it('UX-ANGIO-005: "clear form" is a quiet button whose confirm names the patient', async () => {
    const draft = buildDraft({
      encounterId: 'enc-clear',
      header: { patientName: 'Nino Test', encounterDate: '2026-04-25' },
    });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    const button = screen.getByTestId('new-case-button');
    expect(button).toHaveTextContent(/^(Clear form|ფორმის გასუფთავება)$/);
    expect(button.textContent ?? '').not.toContain('+');

    await act(async () => {
      fireEvent.click(button);
      await new Promise((r) => setTimeout(r, 50));
    });

    const patientLine = await screen.findByTestId('new-case-confirm-patient');
    expect(patientLine).toHaveTextContent('Nino Test');
    expect(patientLine).toHaveTextContent(/·/);
  });

  it('mirrors per-study state into encounter.studies.carotid on dispatch', async () => {
    const draft = buildDraft({ encounterId: 'enc-mirror' });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // Let the EncounterProvider's async IDB hydration settle before
    // typing — otherwise the post-mount setEncounter() can clobber the
    // in-memory copy with the stale (no-studies) snapshot.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const impressionField = screen.getByTestId('carotid-impression') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(impressionField, { target: { value: 'Bilateral patent ICAs.' } });
      // Let the persist effect fire AND saveEncounter (IDB +
      // localStorage dual-write) flush before we read it back.
      await new Promise((r) => setTimeout(r, 200));
    });

    const persisted = await loadEncounter('enc-mirror');
    const study = persisted?.studies.carotid as
      | { schemaVersion?: number; studyType?: string; impression?: string }
      | undefined;
    expect(study).toBeDefined();
    expect(study?.schemaVersion).toBe(2);
    expect(study?.studyType).toBe('carotid');
    expect(study?.impression).toBe('Bilateral patent ICAs.');
  });

  it('asks for a review (never rewrites) when findings change after the conclusion was written', async () => {
    const draft = buildDraft({
      encounterId: 'enc-stale',
      studies: {
        carotid: {
          schemaVersion: 2,
          studyType: 'carotid',
          studyDate: '2026-04-25',
          findings: {},
          nascet: {},
          view: 'bilateral',
          impression: 'Normal bilateral carotid study.',
          impressionEdited: true,
          sonographerComments: '',
          clinicianComments: '',
          recommendations: [],
        },
      },
    });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));
    renderForm(draft.encounterId);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('carotid-impression-stale')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('nascet-right-50to69'));
    });
    const note = screen.getByTestId('carotid-impression-stale');
    const impressionField = screen.getByTestId('carotid-impression') as HTMLTextAreaElement;
    expect(impressionField.value).toBe('Normal bilateral carotid study.');

    // Closing the note = "reviewed, keep it": the note goes, the text stays.
    await act(async () => {
      fireEvent.click(note.querySelector('button') as HTMLButtonElement);
    });
    expect(screen.queryByTestId('carotid-impression-stale')).toBeNull();
    expect(impressionField.value).toBe('Normal bilateral carotid study.');
  });

  it('hydrates from encounter.studies.carotid when present (overrides legacy draft)', () => {
    // Plant a legacy localStorage per-study draft (V2 shape) — would be the
    // fallback path if the encounter slot were empty.
    const legacy = {
      schemaVersion: 2,
      studyType: 'carotid',
      studyDate: '2025-01-01',
      findings: {},
      nascet: {},
      view: 'bilateral',
      impression: 'LEGACY-FALLBACK',
      impressionEdited: true,
      sonographerComments: '',
      clinicianComments: '',
      recommendations: [],
    };
    localStorage.setItem(keyStudyDraft('carotid'), JSON.stringify(legacy));

    // Plant an encounter draft whose studies.carotid carries a different
    // impression — this should win over the legacy fallback.
    const draft = buildDraft({
      encounterId: 'enc-hydrate',
      studies: {
        carotid: {
          schemaVersion: 2,
          studyType: 'carotid',
          studyDate: '2026-04-25',
          findings: {},
          nascet: {},
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

    const impressionField = screen.getByTestId('carotid-impression') as HTMLTextAreaElement;
    expect(impressionField.value).toBe('FROM-ENCOUNTER');
    expect(impressionField.value).not.toBe('LEGACY-FALLBACK');
  });

  it('toFormState reads patient identity from the encounter, not local state', async () => {
    // Build an encounter with distinctive patient identity. The form's
    // toFormState() projects encounter.header into the FormState passed
    // to FormActions; we asserted on the banner already — this case
    // pins the fact that the encounter values are the source of truth
    // for the FormState payload by mirroring the impression and then
    // verifying that the persisted encounter slice carries no patient
    // name (i.e. patient identity does NOT bleed into local state).
    const draft = buildDraft({
      encounterId: 'enc-projection',
      header: {
        patientName: 'Identity Owner',
        patientBirthDate: '1970-01-01',
        encounterDate: '2026-04-25',
      },
    });
    localStorage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));

    renderForm(draft.encounterId);

    // Same async-settle pattern as the mirror test — let EncounterProvider
    // finish its post-mount IDB refresh before we drive any state.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const impressionField = screen.getByTestId('carotid-impression') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(impressionField, { target: { value: 'projection check' } });
      await new Promise((r) => setTimeout(r, 200));
    });

    const persisted = await loadEncounter('enc-projection');
    const study = persisted?.studies.carotid as Record<string, unknown> | undefined;
    expect(study).toBeDefined();
    // The per-study slice must NOT carry encounter-level identity. Only
    // study-clinical scalars + findings/narrative belong here.
    expect(study).not.toHaveProperty('header');
    expect(study).not.toHaveProperty('patientName');
    // And the encounter header itself remains the source of truth.
    expect(persisted?.header.patientName).toBe('Identity Owner');
  });
});
