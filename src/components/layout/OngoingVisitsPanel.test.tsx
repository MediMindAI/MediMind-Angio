// SPDX-License-Identifier: Apache-2.0
/**
 * OngoingVisitsPanel — W1-D tests (UX-ANGIO-009 L2/L3, UX-ANGIO-010).
 *
 *   - Folded on a fresh device; the clinician's last open/folded choice is
 *     remembered per device (STORAGE_KEYS.ONGOING_VISITS_EXPANDED).
 *   - Rows are ordered newest-CREATED first, so resuming (which bumps
 *     updatedAt) never reshuffles the list.
 *   - The trash button's accessible name and the discard confirm both name
 *     the patient; the confirm also shows the visit date.
 *
 * IDB is shimmed by `fake-indexeddb/auto` from `test/setup.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { OngoingVisitsPanel } from './OngoingVisitsPanel';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { STORAGE_KEYS } from '../../constants/storage-keys';
import {
  _resetStoreForTests,
  clearAllEncounters,
  saveEncounter,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MemoryRouter>
      <MantineProvider>
        <TranslationProvider><ThemeProvider>{children}</ThemeProvider></TranslationProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

function enc(id: string, name: string, createdAt: string): EncounterDraft {
  return {
    schemaVersion: 2,
    encounterId: id,
    header: { patientName: name, encounterDate: '2026-11-12' },
    selectedStudyTypes: ['carotid'],
    studies: {},
    createdAt,
    updatedAt: createdAt,
  };
}

function rowNames(): string[] {
  return Array.from(
    document.querySelectorAll('[data-testid^="ongoing-visits-row-"]'),
  ).map((r) => r.querySelector('span')?.textContent ?? '');
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

describe('OngoingVisitsPanel — remembered fold (UX-ANGIO-009 L2)', () => {
  it('is folded on a fresh device and remembers an opened list', async () => {
    await saveEncounter(enc('e1', 'Ana', '2026-11-12T08:00:00.000Z'));

    const first = render(<Wrap><OngoingVisitsPanel /></Wrap>);
    const toggle = await screen.findByTestId('ongoing-visits-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(STORAGE_KEYS.ONGOING_VISITS_EXPANDED)).toBe('true');
    first.unmount();

    render(<Wrap><OngoingVisitsPanel /></Wrap>);
    const again = await screen.findByTestId('ongoing-visits-toggle');
    expect(again.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(again);
    expect(localStorage.getItem(STORAGE_KEYS.ONGOING_VISITS_EXPANDED)).toBe('false');
  });
});

describe('OngoingVisitsPanel — stable order (UX-ANGIO-009 L3)', () => {
  it('lists newest-created first even when an older visit was updated last', async () => {
    await saveEncounter(enc('old', 'Older Visit', '2026-11-12T08:00:00.000Z'));
    await saveEncounter(enc('new', 'Newer Visit', '2026-11-12T09:00:00.000Z'));
    // Re-save the older one so it is newest by updatedAt (as a resume/edit would).
    await new Promise((r) => setTimeout(r, 5));
    await saveEncounter(enc('old', 'Older Visit', '2026-11-12T08:00:00.000Z'));
    localStorage.setItem(STORAGE_KEYS.ONGOING_VISITS_EXPANDED, 'true');

    render(<Wrap><OngoingVisitsPanel /></Wrap>);
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(rowNames()).toEqual(['Newer Visit', 'Older Visit']);
  });
});

describe('OngoingVisitsPanel — discard names the patient (UX-ANGIO-010)', () => {
  it('names the patient on the trash button and in the confirm', async () => {
    await saveEncounter(enc('e1', 'Nino Beridze', '2026-11-12T08:00:00.000Z'));
    localStorage.setItem(STORAGE_KEYS.ONGOING_VISITS_EXPANDED, 'true');

    render(<Wrap><OngoingVisitsPanel /></Wrap>);
    const trash = await screen.findByTestId('ongoing-visits-discard-e1');
    const name = trash.getAttribute('aria-label') ?? '';
    expect(name).toContain('Nino Beridze');
    // Must not reuse the old 'discard' key, which reads as 'cancel' in ka.
    expect(name).not.toBe('გაუქმება');

    fireEvent.click(trash);
    const patient = await screen.findByTestId('ongoing-visits-discard-patient');
    expect(patient.textContent).toBe('Nino Beridze');
    expect(screen.getByRole('dialog').textContent).toContain('12.11.2026');
  });
});
