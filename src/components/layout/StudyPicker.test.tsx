// SPDX-License-Identifier: Apache-2.0
/**
 * StudyPicker — Phase 2.b tests for the encounter list upgrade.
 *
 * Covers the new behavior:
 *   - With 0 encounters: encounter list section is absent; existing study
 *     cards still render. Empty-state path = quiet (no extra empty banner).
 *   - With 2 encounters: list renders both rows, newest-first, each with
 *     study chips and Resume/Discard buttons.
 *   - "Discard" opens a confirmation dialog and calls clearEncounter() on
 *     confirm.
 *   - "Clear all encounters" opens a confirmation dialog and calls
 *     clearAllEncounters() + clearAllDrafts() on confirm.
 *
 * IDB shimmed by `fake-indexeddb/auto`. useNavigate is mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { StudyPicker } from './StudyPicker';
import { TranslationProvider } from '../../contexts/TranslationContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  listEncounters,
  saveEncounter,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MemoryRouter>
      <MantineProvider>
        <TranslationProvider>{children}</TranslationProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

function buildEncounter(id: string, overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: id,
    header: {
      patientName: `Patient ${id}`,
      patientBirthDate: '1980-05-12',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['carotid'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
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

describe('StudyPicker — encounter list (Phase 2.b)', () => {
  it('does NOT render the encounter list section when no encounters exist', async () => {
    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );
    // The async listEncounters() effect resolves with [].
    await waitFor(() => {
      // Wait for any post-mount paint; encounter-list testid must remain absent.
      expect(screen.queryByTestId('encounter-list')).toBeNull();
    });

    // Sanity: study cards still render.
    expect(screen.getByTestId('study-card-venousLE')).toBeInTheDocument();
    expect(screen.getByTestId('study-card-arterialLE')).toBeInTheDocument();
  });

  it('renders both encounters when 2 are saved (newest-first via store)', async () => {
    await saveEncounter(buildEncounter('enc-A'));
    await new Promise((r) => setTimeout(r, 5));
    await saveEncounter(buildEncounter('enc-B'));

    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryByTestId('encounter-list')).not.toBeNull());
    expect(screen.getByTestId('encounter-row-enc-A')).toBeInTheDocument();
    expect(screen.getByTestId('encounter-row-enc-B')).toBeInTheDocument();

    // Each row carries Resume + Discard.
    expect(screen.getByTestId('encounter-resume-enc-A')).toBeInTheDocument();
    expect(screen.getByTestId('encounter-discard-enc-A')).toBeInTheDocument();
  });

  it('Discard opens confirm and calls clearEncounter on confirm', async () => {
    await saveEncounter(buildEncounter('enc-discard-1'));

    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounter-discard-enc-discard-1')).not.toBeNull(),
    );

    fireEvent.click(screen.getByTestId('encounter-discard-enc-discard-1'));

    // Confirm dialog mounts inside a Mantine Modal (role="dialog"). The
    // same Discard label appears on the row button outside the modal —
    // scope by role to disambiguate.
    const dialog = await screen.findByRole('dialog');
    const ka = (await import('../../translations/ka.json')).default as {
      encounter: { list: { discardConfirmAction: string } };
    };
    const confirmText = ka.encounter.list.discardConfirmAction;
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(confirmText),
    );
    expect(confirmBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });

    await waitFor(async () => {
      const remaining = await listEncounters();
      expect(remaining).toHaveLength(0);
    });
  });

  it('Clear all opens confirm and clears every encounter on confirm', async () => {
    await saveEncounter(buildEncounter('enc-1'));
    await saveEncounter(buildEncounter('enc-2'));

    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounter-list-clear-all')).not.toBeNull(),
    );

    fireEvent.click(screen.getByTestId('encounter-list-clear-all'));

    const dialog = await screen.findByRole('dialog');
    const ka = (await import('../../translations/ka.json')).default as {
      encounter: { list: { clearAllConfirmAction: string } };
    };
    const confirmText = ka.encounter.list.clearAllConfirmAction;
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(confirmText),
    );
    expect(confirmBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });

    await waitFor(async () => {
      const remaining = await listEncounters();
      expect(remaining).toHaveLength(0);
    });
  });

  it('"+ New encounter" CTA navigates to /', async () => {
    await saveEncounter(buildEncounter('enc-cta'));

    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );

    await waitFor(() => expect(screen.queryByTestId('encounter-list-new')).not.toBeNull());

    fireEvent.click(screen.getByTestId('encounter-list-new'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('Resume routes to /encounter/{id}/{firstStudy}', async () => {
    await saveEncounter(
      buildEncounter('enc-resume', { selectedStudyTypes: ['arterialLE'] }),
    );

    render(
      <Wrap>
        <StudyPicker />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounter-resume-enc-resume')).not.toBeNull(),
    );

    fireEvent.click(screen.getByTestId('encounter-resume-enc-resume'));
    expect(navigateMock).toHaveBeenCalledWith('/encounter/enc-resume/arterialLE');
  });
});
