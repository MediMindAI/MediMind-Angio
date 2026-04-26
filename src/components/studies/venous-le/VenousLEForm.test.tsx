// SPDX-License-Identifier: Apache-2.0
/**
 * VenousLEForm — Phase 3b (encounter pivot) smoke tests.
 *
 * Scope:
 *   1. Regression guard: the legacy `<StudyHeader>` is no longer rendered
 *      from the per-study form (it has moved to the encounter intake page).
 *   2. The `<EncounterContextBanner>` mounts in its place.
 *   3. The form renders inside `<EncounterProvider>` with a hydrated
 *      encounter (sanity check that the wrapper-injected provider is
 *      reachable from the form).
 *   4. `stateToFormState` reads patient identity from the encounter and
 *      study date from local reducer state — a pure-function spot-check
 *      of the new projection contract that downstream FHIR + PDF builders
 *      depend on.
 *
 * Heavyweight render dependencies (anatomy SVGs, custom-template service,
 * notification system, dialogs) are isolated by mounting the full
 * MantineProvider + TranslationProvider + EncounterProvider stack and
 * targeting `data-testid` selectors emitted by the components themselves.
 * That approach matches `EncounterContextBanner.test.tsx` (Phase 3c) and
 * `EncounterStudyWrapper.test.tsx` (Phase 3a).
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
import { stateToFormState, VenousLEForm } from './VenousLEForm';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-venous-1',
    header: {
      patientName: 'Jane Doe',
      patientBirthDate: '1985-03-21',
      patientGender: 'female',
      operatorName: 'Dr. Sonographer',
      institution: 'Test Clinic',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['venousLEBilateral'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

interface HarnessProps {
  readonly encounterId: string;
}

function Harness({ encounterId }: HarnessProps): React.ReactElement {
  return (
    <MemoryRouter
      initialEntries={[`/encounter/${encounterId}/venousLEBilateral`]}
    >
      <MantineProvider>
        <Notifications />
        <TranslationProvider>
          <EncounterProvider encounterId={encounterId}>
            <Routes>
              <Route
                path="/encounter/:encounterId/:studyType"
                element={<VenousLEForm />}
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
// Bumps default 5s timeout for the heavy form-render tests below — the
// venous-LE form bundles two anatomy SVGs, the segment table, the
// CommentsBlock, the CEAP picker, the recommendations block, and four
// confirm dialogs. Under parallel worker contention first-render cost in
// jsdom regularly tops 30s.
const RENDER_TIMEOUT_MS = 60_000;

/**
 * Phase 3b smoke suite — renders the form once via `beforeAll` and runs
 * every assertion against the same DOM. Reduces total runtime from
 * ~30s × 3 (one render per test) to ~30s for the whole suite, keeping us
 * comfortably inside Vitest's default test timeout under worker
 * contention.
 */
describe('VenousLEForm — Phase 3b (encounter pivot)', () => {
  it(
    'mounts inside <EncounterProvider> and surfaces the new banner / form chrome',
    async () => {
      const draft = buildDraft();
      await saveEncounter(draft);

      render(<Harness encounterId={draft.encounterId} />);

      // Regression guard — the legacy StudyHeader's wrapper testids must
      // be gone. Neither the collapsible card nor its toggle should be
      // anywhere in the rendered tree.
      expect(screen.queryByTestId('study-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('study-header-toggle')).not.toBeInTheDocument();

      // Positive check — the EncounterContextBanner replaces the legacy
      // header, and pulls patient identity from the encounter context.
      expect(screen.getByTestId('encounter-context-banner')).toBeInTheDocument();
      expect(screen.getByTestId('banner-patient-name')).toHaveTextContent('Jane Doe');

      // Per-study form chrome still renders.
      expect(screen.getByTestId('new-case-button')).toBeInTheDocument();
      expect(screen.getByTestId('narrative-sonographer')).toBeInTheDocument();
      expect(screen.getByTestId('narrative-clinician')).toBeInTheDocument();
    },
    RENDER_TIMEOUT_MS,
  );
});

describe('VenousLEForm — stateToFormState projection', () => {
  it('reads patient identity from the encounter and study date from local state', () => {
    const encounter = buildDraft({
      encounterId: 'enc-projection',
      header: {
        patientName: 'John Smith',
        patientId: '01001011116',
        patientBirthDate: '1970-12-01',
        patientGender: 'male',
        operatorName: 'Dr. Operator',
        referringPhysician: 'Dr. Referrer',
        institution: 'Clinic A',
        encounterDate: '2026-04-25',
        indicationNotes: 'Pre-op screening',
      },
    });
    // Build a minimal local reducer state with a per-study studyDate.
    // Cast through the public stateToFormState signature; a literal
    // matches the V1 shape (schemaVersion: 1, studyType: ...).
    const state = {
      schemaVersion: 1 as const,
      studyType: 'venousLEBilateral' as const,
      studyDate: '2026-04-26', // overrides encounterDate when set
      protocol: 'standard' as const,
      findings: {},
      view: 'right' as const,
      impression: 'Test impression',
      impressionEdited: true,
      ceap: undefined,
      recommendations: [],
      sonographerComments: '',
      clinicianComments: '',
    };

    const projected = stateToFormState(state, encounter);

    // Encounter-level fields flow from the encounter header.
    expect(projected.studyType).toBe('venousLEBilateral');
    expect(projected.header.patientName).toBe('John Smith');
    expect(projected.header.patientId).toBe('01001011116');
    expect(projected.header.patientGender).toBe('male');
    expect(projected.header.operatorName).toBe('Dr. Operator');
    expect(projected.header.referringPhysician).toBe('Dr. Referrer');
    expect(projected.header.institution).toBe('Clinic A');
    // Per-study studyDate wins over encounterDate when locally set.
    expect(projected.header.studyDate).toBe('2026-04-26');
    // Encounter-level indicationNotes is projected into legacy
    // narrative.indication (where the FHIR + PDF builders read it).
    expect(projected.narrative.indication).toBe('Pre-op screening');
    // Per-study impression flows from local state.
    expect(projected.narrative.impression).toBe('Test impression');
  });

  it('falls back to encounter.encounterDate when local studyDate is empty', () => {
    const encounter = buildDraft({
      header: {
        patientName: 'X',
        encounterDate: '2026-04-30',
      },
    });
    const state = {
      schemaVersion: 1 as const,
      studyType: 'venousLEBilateral' as const,
      studyDate: '', // empty triggers fallback
      protocol: 'standard' as const,
      findings: {},
      view: 'right' as const,
      impression: '',
      impressionEdited: false,
      ceap: undefined,
      recommendations: [],
      sonographerComments: '',
      clinicianComments: '',
    };

    const projected = stateToFormState(state, encounter);

    expect(projected.header.studyDate).toBe('2026-04-30');
  });
});
