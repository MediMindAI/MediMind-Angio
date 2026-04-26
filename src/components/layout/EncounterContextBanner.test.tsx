// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterContextBanner — Phase 3c tests.
 *
 * Validates the public contract:
 *   - Renders patient name, age (computed from birthDate), encounter date.
 *   - Renders one chip per `selectedStudyTypes` entry.
 *   - The chip whose StudyType matches the current `:studyType` route
 *     param has the active styling and is non-clickable.
 *   - Clicking a non-active chip navigates to
 *     `/encounter/{id}/{studyType}` via react-router-dom.
 *   - "+ Add study" menu lists ONLY StudyTypes not in selectedStudyTypes;
 *     selecting one calls `addStudy()` on the EncounterContext + navigates.
 *   - "Edit encounter" navigates to `/?edit={encounterId}`.
 *   - Renders nothing when `encounter === null`.
 *
 * Uses a real `<EncounterProvider>` seeded via `saveEncounter()` so the
 * sync-hydration path covers the test runs. `useNavigate` is mocked at
 * the module level to assert call shapes without a real router.
 */

/// <reference types="@testing-library/jest-dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';

import { EncounterContextBanner } from './EncounterContextBanner';
import { EncounterProvider } from '../../contexts/EncounterContext';
import { TranslationProvider } from '../../contexts/TranslationContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  saveEncounter,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';
import type { StudyType } from '../../types/study';

// -------------------------------------------------------------------------
// Mock useNavigate — chip clicks + add-study + edit-encounter all call it.
// We capture calls and assert exact navigation targets.
// -------------------------------------------------------------------------
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-banner-1',
    header: {
      patientName: 'Jane Doe',
      patientBirthDate: '1985-03-21', // age 41 in 2026
      patientGender: 'female',
      operatorName: 'Dr. Sonographer',
      institution: 'Test Clinic',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

interface HarnessProps {
  readonly encounterId: string | null;
  readonly route: string; // e.g. '/encounter/enc-banner-1/venousLEBilateral'
  readonly children?: ReactNode;
}

/**
 * Renders the banner inside the full provider stack:
 *   MemoryRouter → MantineProvider → TranslationProvider → EncounterProvider
 * with a `:encounterId/:studyType` route shape so `useParams()` resolves.
 */
function Harness({ encounterId, route }: HarnessProps): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[route]}>
      <MantineProvider>
        <TranslationProvider>
          <EncounterProvider encounterId={encounterId}>
            <Routes>
              <Route
                path="/encounter/:encounterId/:studyType"
                element={<EncounterContextBanner />}
              />
              <Route path="*" element={<EncounterContextBanner />} />
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
  navigateMock.mockReset();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
});

// -------------------------------------------------------------------------
// Render contract
// -------------------------------------------------------------------------
describe('EncounterContextBanner — render contract', () => {
  it('returns null when encounter is null (encounterId={null} mode)', () => {
    const { container } = render(<Harness encounterId={null} route="/anywhere" />);
    expect(container.querySelector('[data-testid="encounter-context-banner"]')).toBeNull();
  });

  it('renders patient name, age, and encounter date when encounter is loaded', async () => {
    const draft = buildDraft();
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    expect(screen.getByTestId('encounter-context-banner')).toBeInTheDocument();
    expect(screen.getByTestId('banner-patient-name')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('banner-encounter-date')).toHaveTextContent('2026-04-25');
    // Age is computed at runtime; assert it is present and a non-negative number.
    const ageEl = screen.getByTestId('banner-patient-age');
    expect(ageEl).toBeInTheDocument();
    expect(ageEl.textContent).toMatch(/\d+/);
  });

  it('omits the age block when birthDate is missing', async () => {
    const draft = buildDraft({
      header: {
        patientName: 'No Birthdate',
        encounterDate: '2026-04-25',
      },
    });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    expect(screen.queryByTestId('banner-patient-age')).toBeNull();
  });
});

// -------------------------------------------------------------------------
// Study switcher chips
// -------------------------------------------------------------------------
describe('EncounterContextBanner — study switcher chips', () => {
  it('renders one chip per selectedStudyTypes entry', async () => {
    const draft = buildDraft({
      selectedStudyTypes: ['venousLEBilateral', 'arterialLE', 'carotid'],
    });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    expect(screen.getByTestId('banner-chip-venousLEBilateral')).toBeInTheDocument();
    expect(screen.getByTestId('banner-chip-arterialLE')).toBeInTheDocument();
    expect(screen.getByTestId('banner-chip-carotid')).toBeInTheDocument();
  });

  it('marks the chip matching the route :studyType as active', async () => {
    const draft = buildDraft({ selectedStudyTypes: ['venousLEBilateral', 'arterialLE'] });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/arterialLE`}
      />,
    );

    const active = screen.getByTestId('banner-chip-arterialLE');
    const inactive = screen.getByTestId('banner-chip-venousLEBilateral');
    expect(active.getAttribute('data-active')).toBe('true');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(inactive.getAttribute('data-active')).toBe('false');
    expect(inactive.getAttribute('aria-current')).toBeNull();
  });

  it('navigates to /encounter/{id}/{studyType} when a non-active chip is clicked', async () => {
    const draft = buildDraft({ selectedStudyTypes: ['venousLEBilateral', 'arterialLE'] });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('banner-chip-arterialLE'));

    expect(navigateMock).toHaveBeenCalledWith(
      `/encounter/${draft.encounterId}/arterialLE`,
    );
  });

  it('does NOT navigate when the active chip is clicked (button is disabled)', async () => {
    const draft = buildDraft({ selectedStudyTypes: ['venousLEBilateral'] });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    const active = screen.getByTestId('banner-chip-venousLEBilateral') as HTMLButtonElement;
    expect(active.disabled).toBe(true);
    // Clicking a disabled <button> doesn't fire onClick — guarded by the
    // browser. Simulate via fireEvent to be belt-and-braces.
    const user = userEvent.setup();
    await user.click(active).catch(() => {
      // userEvent throws on disabled — that's fine.
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------------
// "+ Add study" menu
// -------------------------------------------------------------------------
describe('EncounterContextBanner — add-study menu', () => {
  it('lists only StudyTypes not already in selectedStudyTypes', async () => {
    const draft = buildDraft({ selectedStudyTypes: ['venousLEBilateral', 'arterialLE'] });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('banner-add-study'));

    // Studies NOT in selection should appear as menu items
    expect(screen.getByTestId('banner-add-option-carotid')).toBeInTheDocument();
    expect(screen.getByTestId('banner-add-option-ivcDuplex')).toBeInTheDocument();
    expect(screen.getByTestId('banner-add-option-venousLERight')).toBeInTheDocument();

    // Studies already selected should NOT
    expect(screen.queryByTestId('banner-add-option-venousLEBilateral')).toBeNull();
    expect(screen.queryByTestId('banner-add-option-arterialLE')).toBeNull();
  });

  it('selecting a new study from the menu adds it to the encounter and navigates', async () => {
    const draft = buildDraft({ selectedStudyTypes: ['venousLEBilateral'] });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('banner-add-study'));
    await user.click(screen.getByTestId('banner-add-option-carotid'));

    expect(navigateMock).toHaveBeenCalledWith(
      `/encounter/${draft.encounterId}/carotid`,
    );

    // Confirm the encounter store was actually mutated. saveEncounter
    // funnels through the EncounterContext.persist() path; the chip row
    // must now contain the new study.
    expect(await screen.findByTestId('banner-chip-carotid')).toBeInTheDocument();
  });

  it('hides the "+ Add study" trigger when every supported study is already selected', async () => {
    const allStudies: ReadonlyArray<StudyType> = [
      'venousLEBilateral',
      'venousLERight',
      'venousLELeft',
      'arterialLE',
      'carotid',
      'ivcDuplex',
    ];
    const draft = buildDraft({ selectedStudyTypes: allStudies });
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    expect(screen.queryByTestId('banner-add-study')).toBeNull();
  });
});

// -------------------------------------------------------------------------
// Edit-encounter action
// -------------------------------------------------------------------------
describe('EncounterContextBanner — edit-encounter action', () => {
  it('navigates to /?edit={encounterId} when the edit button is clicked', async () => {
    const draft = buildDraft();
    await act(async () => {
      await saveEncounter(draft);
    });

    render(
      <Harness
        encounterId={draft.encounterId}
        route={`/encounter/${draft.encounterId}/venousLEBilateral`}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('banner-edit-encounter'));

    expect(navigateMock).toHaveBeenCalledWith(`/?edit=${draft.encounterId}`);
  });
});
