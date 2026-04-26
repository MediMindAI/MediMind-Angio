// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterStudyWrapper — Phase 3a tests.
 *
 * Covers the four redirect guards + the happy path:
 *   1. Missing encounterId → redirect to `/`.
 *   2. Invalid studyType (not in StudyType union) → redirect to `/`.
 *   3. Encounter doesn't exist in the store → redirect to `/`.
 *   4. studyType not in encounter.selectedStudyTypes → redirect to `/`.
 *   5. Happy path: valid encounter + matching plugin → form renders inside
 *      <EncounterProvider>.
 *
 * To keep this suite focused on the wrapper's branching, we mock
 * `STUDY_PLUGINS` so we don't pull in the real (heavy) form components.
 * The mock plugin's `FormComponent` calls `useEncounter()` so we
 * implicitly assert the wrapper mounted the provider correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { useEncounter } from '../../contexts/EncounterContext';
import {
  _resetStoreForTests,
  clearAllEncounters,
  keyEncounter,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';

// Mock the studies registry BEFORE importing the wrapper. Each mock
// plugin's FormComponent renders a sentinel + dereferences `useEncounter()`
// so a successful render proves both the route adapter AND the
// EncounterProvider wiring.
vi.mock('./index', () => {
  function MockVenousForm(): React.ReactElement {
    const { encounter } = useEncounter();
    return (
      <div data-testid="mock-venous-form">
        venous form for {encounter?.encounterId ?? 'no-encounter'}
      </div>
    );
  }
  function MockArterialForm(): React.ReactElement {
    const { encounter } = useEncounter();
    return (
      <div data-testid="mock-arterial-form">
        arterial form for {encounter?.encounterId ?? 'no-encounter'}
      </div>
    );
  }
  function MockCarotidForm(): React.ReactElement {
    const { encounter } = useEncounter();
    return (
      <div data-testid="mock-carotid-form">
        carotid form for {encounter?.encounterId ?? 'no-encounter'}
      </div>
    );
  }
  return {
    STUDY_PLUGINS: [
      {
        key: 'venousLE',
        route: '/venous-le',
        available: true,
        icon: () => null,
        FormComponent: MockVenousForm,
        translationKey: 'studies.venousLE',
      },
      {
        key: 'arterialLE',
        route: '/arterial-le',
        available: true,
        icon: () => null,
        FormComponent: MockArterialForm,
        translationKey: 'studies.arterialLE',
      },
      {
        key: 'carotid',
        route: '/carotid',
        available: true,
        icon: () => null,
        FormComponent: MockCarotidForm,
        translationKey: 'studies.carotid',
      },
    ],
    findPluginByPath: () => null,
  };
});

// Import AFTER the mock so the wrapper picks it up.
import { EncounterStudyWrapper } from './EncounterStudyWrapper';

function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-1',
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

/**
 * Mounts the wrapper at `/encounter/:encounterId/:studyType` with a `/`
 * landing sentinel so we can detect redirect-to-root.
 */
function renderWrapper(initial: string): void {
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route
          path="/encounter/:encounterId/:studyType"
          element={<EncounterStudyWrapper />}
        />
      </Routes>
    </MemoryRouter>,
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

describe('EncounterStudyWrapper — Phase 3a', () => {
  // -------------------------------------------------------------------------
  // Guard 1: missing params
  // -------------------------------------------------------------------------
  // Note: React Router won't match `/encounter//arterialLE` against the
  // pattern (empty segments fail), so the equivalent failure mode here is
  // a wholly-unmatched URL. Guard 1 in the wrapper covers a different
  // class — params that come in as `undefined` from `useParams()` (e.g.
  // when the wrapper is mounted under a different route shape). We model
  // that by mounting the wrapper at a route with no params.
  it('redirects to / when encounterId / studyType params are absent', () => {
    render(
      <MemoryRouter initialEntries={['/no-params']}>
        <Routes>
          <Route path="/" element={<div data-testid="landing">landing</div>} />
          <Route path="/no-params" element={<EncounterStudyWrapper />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Guard 2: invalid studyType
  // -------------------------------------------------------------------------
  it('redirects to / when studyType is not in the StudyType union', () => {
    const draft = buildDraft({ encounterId: 'enc-bad-type' });
    localStorage.setItem(keyEncounter('enc-bad-type'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-bad-type/notARealType');
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-arterial-form')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Guard 3: encounter not in store
  // -------------------------------------------------------------------------
  it('redirects to / when the encounter does not exist in storage', () => {
    // No localStorage seeding → loadEncounterSync returns null.
    renderWrapper('/encounter/missing-id/arterialLE');
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-arterial-form')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Guard 4: studyType not in encounter.selectedStudyTypes
  // -------------------------------------------------------------------------
  it('redirects to / when studyType is not in the encounter selectedStudyTypes', () => {
    const draft = buildDraft({
      encounterId: 'enc-no-match',
      selectedStudyTypes: ['carotid'], // wrapper will be asked for arterialLE
    });
    localStorage.setItem(keyEncounter('enc-no-match'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-no-match/arterialLE');
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-arterial-form')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Happy paths
  // -------------------------------------------------------------------------
  it('renders the arterial form when encounter has arterialLE selected', () => {
    const draft = buildDraft({
      encounterId: 'enc-arterial',
      selectedStudyTypes: ['arterialLE'],
    });
    localStorage.setItem(keyEncounter('enc-arterial'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-arterial/arterialLE');
    const form = screen.getByTestId('mock-arterial-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('arterial form for enc-arterial');
  });

  it('maps venousLEBilateral to the venousLE plugin form', () => {
    const draft = buildDraft({
      encounterId: 'enc-venous-bi',
      selectedStudyTypes: ['venousLEBilateral'],
    });
    localStorage.setItem(keyEncounter('enc-venous-bi'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-venous-bi/venousLEBilateral');
    const form = screen.getByTestId('mock-venous-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('venous form for enc-venous-bi');
  });

  it('maps venousLERight to the venousLE plugin form', () => {
    const draft = buildDraft({
      encounterId: 'enc-venous-r',
      selectedStudyTypes: ['venousLERight'],
    });
    localStorage.setItem(keyEncounter('enc-venous-r'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-venous-r/venousLERight');
    expect(screen.getByTestId('mock-venous-form')).toBeInTheDocument();
  });

  it('renders the carotid form when encounter has carotid selected', () => {
    const draft = buildDraft({
      encounterId: 'enc-carotid',
      selectedStudyTypes: ['carotid'],
    });
    localStorage.setItem(keyEncounter('enc-carotid'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-carotid/carotid');
    expect(screen.getByTestId('mock-carotid-form')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Edge: studyType in catalog but no plugin (ivcDuplex)
  // -------------------------------------------------------------------------
  it('redirects to / when studyType has no plugin mapping (e.g. ivcDuplex)', () => {
    const draft = buildDraft({
      encounterId: 'enc-ivc',
      selectedStudyTypes: ['ivcDuplex'],
    });
    localStorage.setItem(keyEncounter('enc-ivc'), JSON.stringify(draft));

    renderWrapper('/encounter/enc-ivc/ivcDuplex');
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });
});
