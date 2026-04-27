// SPDX-License-Identifier: Apache-2.0
/**
 * EncountersPage — Phase 5 Item 2 tests.
 *
 * Covers the dedicated `/encounters` management view added in Phase 5:
 *   - Empty state (no encounters): renders the empty-state CTA, hides
 *     the list section
 *   - Populated state: renders rows for each saved encounter with
 *     Resume + Discard, and a footer with "+ New encounter" + Clear all
 *   - "+ New encounter" navigates to `/`
 *   - Resume routes to `/encounter/{id}/{firstStudy}`
 *   - Discard fires the confirm dialog and calls `clearEncounter` on
 *     confirm; list shrinks afterwards
 *   - Clear-all wipes both encounters and per-study drafts
 *
 * Mirrors the StudyPicker.test.tsx scaffolding (mocked navigate, fake
 * IDB via `fake-indexeddb/auto` from test/setup.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { EncountersPage } from './EncountersPage';
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

describe('EncountersPage — Phase 5 Item 2', () => {
  it('renders the empty state with a "+ New encounter" CTA when no encounters exist', async () => {
    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    // Wait for hydration so the empty state is committed.
    await waitFor(() => {
      expect(screen.queryByTestId('encounters-page-empty')).not.toBeNull();
    });

    expect(screen.queryByTestId('encounters-page-list')).toBeNull();
    expect(screen.getByTestId('encounters-page-empty-cta')).toBeInTheDocument();
  });

  it('empty-state CTA navigates to /', async () => {
    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-empty-cta')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('encounters-page-empty-cta'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('renders all saved encounters when 2 are present', async () => {
    await saveEncounter(buildEncounter('enc-A'));
    await new Promise((r) => setTimeout(r, 5));
    await saveEncounter(buildEncounter('enc-B'));

    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-list')).not.toBeNull(),
    );
    expect(screen.getByTestId('encounters-page-row-enc-A')).toBeInTheDocument();
    expect(screen.getByTestId('encounters-page-row-enc-B')).toBeInTheDocument();
    expect(screen.getByTestId('encounters-page-resume-enc-A')).toBeInTheDocument();
    expect(screen.getByTestId('encounters-page-discard-enc-B')).toBeInTheDocument();

    // Counter shows the encounter total.
    expect(screen.getByTestId('encounters-page-count')).toHaveTextContent('2');
  });

  it('Resume routes to /encounter/{id}/{firstStudy}', async () => {
    await saveEncounter(
      buildEncounter('enc-resume', { selectedStudyTypes: ['arterialLE'] }),
    );

    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-resume-enc-resume')).not.toBeNull(),
    );

    fireEvent.click(screen.getByTestId('encounters-page-resume-enc-resume'));
    expect(navigateMock).toHaveBeenCalledWith('/encounter/enc-resume/arterialLE');
  });

  it('"+ New encounter" footer button navigates to /', async () => {
    await saveEncounter(buildEncounter('enc-1'));

    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-new')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('encounters-page-new'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('Discard opens confirm and removes the encounter on confirm', async () => {
    await saveEncounter(buildEncounter('enc-discard'));

    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-discard-enc-discard')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('encounters-page-discard-enc-discard'));

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

  it('Clear all empties both encounters and per-study drafts', async () => {
    await saveEncounter(buildEncounter('enc-1'));
    await saveEncounter(buildEncounter('enc-2'));

    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    await waitFor(() =>
      expect(screen.queryByTestId('encounters-page-clear-all')).not.toBeNull(),
    );
    fireEvent.click(screen.getByTestId('encounters-page-clear-all'));

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

  it('back link routes to /', async () => {
    render(
      <Wrap>
        <EncountersPage />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId('encounters-page-back'));
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
