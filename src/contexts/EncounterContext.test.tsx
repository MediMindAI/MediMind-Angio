// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterContext — Phase 2a tests.
 *
 * Covers the public API contract:
 *   - useEncounter() outside the provider throws.
 *   - encounterId={null} mode renders cleanly with no-op mutations.
 *   - Sync hydration on mount when localStorage has a draft.
 *   - Async hydration from IDB completes after mount.
 *   - updateHeader / addStudy / removeStudy / setStudyState mutate state +
 *     persist to the store + bump updatedAt.
 *   - clearEncounter wipes both in-memory and storage.
 *   - encounterId-change race: a slow load for the previous id can't
 *     clobber the new id's state (Wave 2.7 cancelled-flag pattern).
 *
 * Backed by `fake-indexeddb/auto` from `test/setup.ts` so every IDB call
 * works under jsdom without a real browser.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EncounterProvider, useEncounter } from './EncounterContext';
import type { EncounterDraft } from '../types/encounter';
import {
  _resetStoreForTests,
  clearAllEncounters,
  keyEncounter,
  loadEncounter,
  saveEncounter,
} from '../services/encounterStore';

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
    selectedStudyTypes: ['venousLEBilateral'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

function wrapperFor(encounterId: string | null): ({ children }: { children: ReactNode }) => React.ReactElement {
  return function Wrapper({ children }: { children: ReactNode }): React.ReactElement {
    return <EncounterProvider encounterId={encounterId}>{children}</EncounterProvider>;
  };
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

describe('EncounterContext — Phase 2a', () => {
  // -------------------------------------------------------------------------
  // Hook contract
  // -------------------------------------------------------------------------
  it('useEncounter() throws when used outside a provider', () => {
    // renderHook surfaces the throw on the result.error property in v16+.
    // Use a try/catch wrapper so the assertion is robust across versions.
    expect(() => renderHook(() => useEncounter())).toThrow(
      /useEncounter must be used inside <EncounterProvider>/,
    );
  });

  // -------------------------------------------------------------------------
  // Null mode
  // -------------------------------------------------------------------------
  it('renders cleanly with encounterId=null and treats mutations as safe no-ops', async () => {
    const { result } = renderHook(() => useEncounter(), { wrapper: wrapperFor(null) });

    expect(result.current.encounter).toBeNull();
    expect(result.current.isLoading).toBe(false);

    // None of these should throw or change state.
    act(() => {
      result.current.updateHeader({ patientName: 'X', encounterDate: '2026-01-01' });
      result.current.addStudy('arterialLE');
      result.current.removeStudy('arterialLE');
      result.current.setStudyState('venousLEBilateral', { foo: 1 });
    });
    await act(async () => {
      await result.current.clearEncounter();
    });

    expect(result.current.encounter).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Hydration
  // -------------------------------------------------------------------------
  it('hydrates synchronously from localStorage on first render', async () => {
    const draft = buildDraft({ encounterId: 'enc-sync' });
    // Plant directly into localStorage so the sync path picks it up before
    // any async work runs.
    localStorage.setItem(keyEncounter('enc-sync'), JSON.stringify(draft));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-sync'),
    });

    // First render result — sync cache hit.
    expect(result.current.encounter?.encounterId).toBe('enc-sync');
    expect(result.current.encounter?.header.patientName).toBe('Jane Doe');
    expect(result.current.isLoading).toBe(false);

    // Let the async loadEncounter resolve.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.encounter?.encounterId).toBe('enc-sync');
  });

  it('hydrates asynchronously from IDB when localStorage is empty', async () => {
    const draft = buildDraft({ encounterId: 'enc-idb' });
    await saveEncounter(draft);
    // Simulate cross-tab scenario where IDB has the draft but the current
    // tab's localStorage doesn't yet.
    localStorage.removeItem(keyEncounter('enc-idb'));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-idb'),
    });

    // Sync cache miss → null on first render with isLoading true.
    expect(result.current.encounter).toBeNull();
    expect(result.current.isLoading).toBe(true);

    // Drain the microtask queue for the async load.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.encounter?.encounterId).toBe('enc-idb');
    expect(result.current.isLoading).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  it('updateHeader replaces header, persists, and bumps updatedAt', async () => {
    const draft = buildDraft({ encounterId: 'enc-upd' });
    await saveEncounter(draft);
    localStorage.setItem(keyEncounter('enc-upd'), JSON.stringify(draft));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-upd'),
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const originalUpdatedAt = result.current.encounter?.updatedAt ?? '';
    // Tiny delay so the new ISO timestamp is strictly greater.
    await new Promise((r) => setTimeout(r, 5));

    act(() => {
      result.current.updateHeader({
        ...result.current.encounter!.header,
        patientName: 'Updated Name',
      });
    });

    expect(result.current.encounter?.header.patientName).toBe('Updated Name');
    expect(result.current.encounter?.updatedAt ?? '').not.toBe(originalUpdatedAt);

    // Allow the fire-and-forget save to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const persisted = await loadEncounter('enc-upd');
    expect(persisted?.header.patientName).toBe('Updated Name');
  });

  it('addStudy is idempotent on duplicates', async () => {
    const draft = buildDraft({ encounterId: 'enc-add', selectedStudyTypes: [] });
    await saveEncounter(draft);
    localStorage.setItem(keyEncounter('enc-add'), JSON.stringify({ ...draft, selectedStudyTypes: [] }));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-add'),
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.addStudy('arterialLE');
    });
    expect(result.current.encounter?.selectedStudyTypes).toEqual(['arterialLE']);

    act(() => {
      result.current.addStudy('arterialLE');
    });
    expect(result.current.encounter?.selectedStudyTypes).toEqual(['arterialLE']);
  });

  it('removeStudy clears the selection AND its studies slot', async () => {
    const draft = buildDraft({
      encounterId: 'enc-rem',
      selectedStudyTypes: ['arterialLE', 'carotid'],
      studies: { arterialLE: { foo: 'bar' }, carotid: { baz: 'qux' } },
    });
    await saveEncounter(draft);
    localStorage.setItem(keyEncounter('enc-rem'), JSON.stringify(draft));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-rem'),
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      result.current.removeStudy('arterialLE');
    });

    expect(result.current.encounter?.selectedStudyTypes).toEqual(['carotid']);
    expect(result.current.encounter?.studies.arterialLE).toBeUndefined();
    expect(result.current.encounter?.studies.carotid).toEqual({ baz: 'qux' });
  });

  it('setStudyState writes the per-study slot', async () => {
    const draft = buildDraft({ encounterId: 'enc-set', selectedStudyTypes: ['venousLEBilateral'] });
    await saveEncounter(draft);
    localStorage.setItem(keyEncounter('enc-set'), JSON.stringify(draft));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-set'),
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    interface VenousLEState {
      readonly findings: string;
    }
    act(() => {
      result.current.setStudyState<VenousLEState>('venousLEBilateral', {
        findings: 'patent veins',
      });
    });

    expect(result.current.encounter?.studies.venousLEBilateral).toEqual({
      findings: 'patent veins',
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const persisted = await loadEncounter('enc-set');
    expect(persisted?.studies.venousLEBilateral).toEqual({ findings: 'patent veins' });
  });

  it('clearEncounter wipes the in-memory state and the store entry', async () => {
    const draft = buildDraft({ encounterId: 'enc-clear' });
    await saveEncounter(draft);
    localStorage.setItem(keyEncounter('enc-clear'), JSON.stringify(draft));

    const { result } = renderHook(() => useEncounter(), {
      wrapper: wrapperFor('enc-clear'),
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.encounter?.encounterId).toBe('enc-clear');

    await act(async () => {
      await result.current.clearEncounter();
    });

    expect(result.current.encounter).toBeNull();
    expect(await loadEncounter('enc-clear')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Race safety
  // -------------------------------------------------------------------------
  it('encounterId switch does not let the previous load clobber the new state', async () => {
    // Seed two distinct encounters in IDB.
    const draftA = buildDraft({ encounterId: 'enc-a' });
    const draftB = buildDraft({ encounterId: 'enc-b' });
    await saveEncounter(draftA);
    await saveEncounter(draftB);
    // Strip localStorage so the async path is the only hydration source —
    // forces both loads to actually go through Promise resolution.
    localStorage.removeItem(keyEncounter('enc-a'));
    localStorage.removeItem(keyEncounter('enc-b'));

    // renderHook can't pipe `initialProps` into the `wrapper` factory, so
    // the encounterId is held in a closure-captured object the wrapper reads
    // on every render. Updating `currentId.value` then calling `rerender()`
    // forces the wrapper to re-render with the new id.
    const currentId = { value: 'enc-a' };
    function ProbeWrapper({ children }: { children: ReactNode }): React.ReactElement {
      return (
        <EncounterProvider encounterId={currentId.value}>
          {children}
        </EncounterProvider>
      );
    }

    const { result, rerender } = renderHook(() => useEncounter(), {
      wrapper: ProbeWrapper,
    });

    // Switch immediately to 'enc-b' before the 'enc-a' load resolves.
    currentId.value = 'enc-b';
    rerender();

    // Drain the microtask queue.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Final state must reflect 'enc-b' — the previous-id load was cancelled.
    expect(result.current.encounter?.encounterId).toBe('enc-b');
  });
});
