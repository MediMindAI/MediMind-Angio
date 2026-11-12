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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// ---------------------------------------------------------------------------
// UX-ANGIO-001 L2 (cross-tab freshness) + UX-ANGIO-002 L1 (save status)
// ---------------------------------------------------------------------------
describe('EncounterContext — save status + cross-tab freshness', () => {
  async function mountSeeded(id: string, draft: EncounterDraft) {
    await saveEncounter(draft, { keepUpdatedAt: true });
    const hook = renderHook(() => useEncounter(), { wrapper: wrapperFor(id) });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    return hook;
  }

  async function flush(ms = 10): Promise<void> {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lastSavedAt is the stored updatedAt after a reload (not "never saved")', async () => {
    const draft = buildDraft({ encounterId: 'enc-ts', updatedAt: '2026-11-12T10:15:00.000Z' });
    const { result } = await mountSeeded('enc-ts', draft);
    expect(result.current.lastSavedAt?.toISOString()).toBe('2026-11-12T10:15:00.000Z');
    expect(result.current.saveError).toBeNull();
    expect(result.current.staleFromOtherTab).toBe(false);
  });

  it('lastSavedAt moves to the written updatedAt once the save lands', async () => {
    const draft = buildDraft({ encounterId: 'enc-ts2', updatedAt: '2026-11-12T10:15:00.000Z' });
    const { result } = await mountSeeded('enc-ts2', draft);
    act(() => {
      result.current.setStudyState('arterialLE', { note: 'x' });
    });
    await flush();
    expect(result.current.lastSavedAt?.toISOString()).toBe(result.current.encounter?.updatedAt);
    const stored = await loadEncounter('enc-ts2');
    expect(stored?.updatedAt).toBe(result.current.encounter?.updatedAt);
  });

  it('a failed IndexedDB write sets saveError and keeps the answer in memory', async () => {
    const { result } = await mountSeeded('enc-fail', buildDraft({ encounterId: 'enc-fail' }));
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('forced IDB failure');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => {
      result.current.setStudyState('carotid', { note: 'keep me' });
    });
    await flush();
    expect(result.current.saveError).toBe('write-failed');
    expect(result.current.encounter?.studies.carotid).toEqual({ note: 'keep me' });
    expect(warnSpy).toHaveBeenCalled();

    // Next successful save clears the error.
    putSpy.mockRestore();
    act(() => {
      result.current.setStudyState('carotid', { note: 'keep me 2' });
    });
    await flush();
    expect(result.current.saveError).toBeNull();
  });

  it('a localStorage quota failure sets saveError cache-failed', async () => {
    const { result } = await mountSeeded('enc-quota', buildDraft({ encounterId: 'enc-quota' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => {
      result.current.setStudyState('carotid', { note: 'n' });
    });
    await flush();
    expect(result.current.saveError).toBe('cache-failed');
    // IDB (source of truth) still has it.
    expect((await loadEncounter('enc-quota'))?.studies.carotid).toEqual({ note: 'n' });
  });

  it("does not flag its own writes as another tab's", async () => {
    const { result } = await mountSeeded('enc-self', buildDraft({ encounterId: 'enc-self' }));
    act(() => {
      result.current.setStudyState('arterialLE', { a: 1 });
    });
    act(() => {
      result.current.setStudyState('arterialLE', { a: 2 });
    });
    await flush();
    act(() => {
      result.current.updateHeader({ ...result.current.encounter!.header, patientName: 'B' });
    });
    await flush();
    expect(result.current.staleFromOtherTab).toBe(false);
  });

  it("a stale tab's edit no longer wipes another tab's saved answer", async () => {
    const seed = buildDraft({
      encounterId: 'enc-2tab',
      selectedStudyTypes: ['arterialLE', 'carotid'],
      updatedAt: '2026-11-12T10:00:00.000Z',
    });
    // Tab A opens the visit.
    const { result } = await mountSeeded('enc-2tab', seed);

    // Tab B (another tab) saves a carotid note to the same visit.
    await saveEncounter({ ...seed, studies: { carotid: { note: 'tab B note' } } });

    // Tab A, still holding the old copy, edits arterial.
    act(() => {
      result.current.setStudyState('arterialLE', { psv: 120 });
    });
    await flush();

    const stored = await loadEncounter('enc-2tab');
    expect(stored?.studies.carotid).toEqual({ note: 'tab B note' });
    expect(stored?.studies.arterialLE).toEqual({ psv: 120 });
    expect(result.current.staleFromOtherTab).toBe(true);
    expect(result.current.encounter?.studies.carotid).toEqual({ note: 'tab B note' });
  });

  it("a storage event from another tab raises the flag and catches the copy up", async () => {
    const seed = buildDraft({ encounterId: 'enc-evt', updatedAt: '2026-11-12T10:00:00.000Z' });
    const { result } = await mountSeeded('enc-evt', seed);

    await saveEncounter({ ...seed, studies: { carotid: { note: 'from B' } } });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: keyEncounter('enc-evt') }));
    });

    expect(result.current.staleFromOtherTab).toBe(true);
    expect(result.current.encounter?.studies.carotid).toEqual({ note: 'from B' });
  });

  it('a tab that only re-saves the same answers raises no flag', async () => {
    const seed = buildDraft({ encounterId: 'enc-same', updatedAt: '2026-11-12T10:00:00.000Z' });
    const { result } = await mountSeeded('enc-same', seed);

    // Tab B just opened the visit and re-stamped it — no answer changed.
    await saveEncounter(seed);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: keyEncounter('enc-same') }));
    });

    expect(result.current.staleFromOtherTab).toBe(false);
  });

  it('ignores storage events for other keys', async () => {
    const { result } = await mountSeeded('enc-other', buildDraft({ encounterId: 'enc-other' }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'emr-language' }));
      window.dispatchEvent(new StorageEvent('storage', { key: keyEncounter('enc-unrelated') }));
    });
    expect(result.current.staleFromOtherTab).toBe(false);
  });
});
