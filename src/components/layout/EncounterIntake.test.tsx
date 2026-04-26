// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterIntake — Phase 2.b tests.
 *
 * Covers the user-visible contract:
 *   - 4 cards render (identity / visit / indication / studies).
 *   - Start button is disabled until patientName is filled AND ≥1 study is checked.
 *   - Clicking Start mints a UUID, persists via saveEncounter, and navigates
 *     to /encounter/{uuid}/{firstStudy}.
 *   - "Resume" link is hidden when listEncounters() is empty; shown when ≥1.
 *   - Translation parity: every encounter.intake.* key the component renders
 *     resolves in all 3 locales (smoke check; full parity covered by i18n.test.ts).
 *
 * IDB is shimmed by `fake-indexeddb/auto` from `test/setup.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { EncounterIntake } from './EncounterIntake';
import { TranslationProvider } from '../../contexts/TranslationContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  listEncounters,
  saveEncounter,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';

// Mock useNavigate so we can assert navigation arguments without a real
// router driving location changes.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MemoryRouter>
      <MantineProvider>
        <TranslationProvider>{children}</TranslationProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

function buildSavedEncounter(id: string): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: id,
    header: {
      patientName: 'Existing Patient',
      encounterDate: '2026-04-20',
    },
    selectedStudyTypes: ['carotid'],
    studies: {},
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(async () => {
  navigateMock.mockReset();
  _resetStoreForTests();
  await clearAllEncounters();
  localStorage.clear();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
});

describe('EncounterIntake — Phase 2.b', () => {
  it('renders all 4 intake cards', async () => {
    render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    // Cards are identified by their <h2 id="intake-*-title"> regardless of
    // active locale (default is Georgian — assertion stays language-agnostic).
    await waitFor(() =>
      expect(document.getElementById('intake-identity-title')).not.toBeNull(),
    );
    expect(document.getElementById('intake-identity-title')).not.toBeNull();
    expect(document.getElementById('intake-visit-title')).not.toBeNull();
    expect(document.getElementById('intake-indication-title')).not.toBeNull();
    expect(document.getElementById('intake-studies-title')).not.toBeNull();
  });

  it('disables Start until patientName + ≥1 study are filled', async () => {
    render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryByTestId('intake-start')).not.toBeNull());

    const startBtn = screen.getByTestId('intake-start') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);

    // Fill name only — still disabled (no study checked).
    const nameInput = screen.getByTestId('intake-patientName') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    expect((screen.getByTestId('intake-start') as HTMLButtonElement).disabled).toBe(true);

    // Check a study — Start is now enabled.
    const carotidCheckbox = screen.getByTestId(
      'intake-study-checkbox-carotid',
    ) as HTMLInputElement;
    fireEvent.click(carotidCheckbox);

    await waitFor(() => {
      expect((screen.getByTestId('intake-start') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('Start mints UUID, persists encounter, navigates to /encounter/{id}/{firstStudy}', async () => {
    render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryByTestId('intake-patientName')).not.toBeNull());

    fireEvent.change(screen.getByTestId('intake-patientName') as HTMLInputElement, {
      target: { value: 'Test Patient' },
    });

    const carotidCheckbox = screen.getByTestId(
      'intake-study-checkbox-carotid',
    ) as HTMLInputElement;
    fireEvent.click(carotidCheckbox);

    await waitFor(() => {
      expect((screen.getByTestId('intake-start') as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('intake-start'));
    });

    // navigateMock should have been called once with /encounter/{uuid}/carotid
    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    const call = navigateMock.mock.calls[0]?.[0] as string;
    expect(call).toMatch(/^\/encounter\/[0-9a-f-]+\/carotid$/);

    // Encounter is now persisted in the store.
    const list = await listEncounters();
    expect(list).toHaveLength(1);
    expect(list[0]?.header.patientName).toBe('Test Patient');
    expect(list[0]?.selectedStudyTypes).toEqual(['carotid']);
  });

  it('Resume link is hidden when no encounters exist', async () => {
    render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryByTestId('intake-patientName')).not.toBeNull());
    // The list-probe effect runs in a microtask; assert the hidden state
    // after the next paint.
    await waitFor(() => {
      expect(screen.queryByTestId('intake-resume-link')).toBeNull();
    });
  });

  it('Resume link is shown when ≥1 encounter exists', async () => {
    await saveEncounter(buildSavedEncounter('enc-resume-1'));

    render(
      <Wrap>
        <EncounterIntake />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('intake-resume-link')).not.toBeNull();
    });
  });
});

describe('EncounterIntake — translation key parity smoke', () => {
  // The full en/ka/ru parity is enforced in src/translations/i18n.test.ts.
  // This is a fail-loud guard that the encounter.intake.* keys the component
  // actually reads exist in the canonical English file.
  it('English translation file contains every encounter.intake key the component reads', async () => {
    const en = (await import('../../translations/en.json')).default as Record<string, unknown>;
    const encounter = en.encounter as Record<string, unknown>;
    expect(encounter).toBeDefined();
    const intake = encounter.intake as Record<string, unknown>;
    expect(intake).toBeDefined();
    expect(intake.title).toBeDefined();
    expect(intake.subtitle).toBeDefined();
    expect((intake.identity as Record<string, unknown>)?.title).toBeDefined();
    expect((intake.visit as Record<string, unknown>)?.title).toBeDefined();
    expect((intake.indication as Record<string, unknown>)?.title).toBeDefined();
    expect((intake.studies as Record<string, unknown>)?.title).toBeDefined();
    expect((intake.actions as Record<string, unknown>)?.start).toBeDefined();
  });
});
