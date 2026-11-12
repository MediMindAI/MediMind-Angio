// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterContext — React layer over the encounter draft store.
 *
 * Phase 2a of the encounter-pivot plan. The store lives in
 * `src/services/encounterStore.ts` (Phase 1b); this provider wraps it so
 * downstream components — intake page (Phase 2b), per-study route wrapper
 * (Phase 3a), per-study forms (Phase 3b), and the encounter banner
 * (Phase 3c) — can share one source of truth without re-loading IDB on
 * every render.
 *
 * Design choices:
 *   - **Sync hydration on mount.** `loadEncounterSync` reads localStorage
 *     and gives the first render a non-null encounter when one already
 *     exists. The async `loadEncounter` runs immediately afterwards to
 *     pull the IDB copy (the source of truth) and rehydrate state.
 *   - **No debounced auto-save.** Encounter mutations are user-driven
 *     and infrequent (header field blur, study checkbox toggle), so we
 *     write through `saveEncounter` on every mutation. `useAutoSave`'s
 *     30-min idle timeout is wrong for encounters per plan §1b — drafts
 *     persist indefinitely so a clinician can leave the form open.
 *   - **Race-safe encounterId switches.** The load effect uses a
 *     cancelled flag (Wave 2.7 pattern) so a slow `loadEncounter('a')`
 *     resolution can't clobber state after the route switched to 'b'.
 *   - **`encounterId === null` mode.** The provider can sit at the root
 *     before any encounter is selected (intake page renders before the
 *     "Start" click). Mutations are no-ops in that mode; consumers must
 *     null-check `encounter`.
 *   - **Cross-tab freshness (UX-ANGIO-001 L2).** The provider remembers
 *     the `updatedAt` it last loaded or wrote. If another tab saved the
 *     visit since, the next change is applied on top of the newest stored
 *     draft and `staleFromOtherTab` is raised (see BLOCK_STALE_WRITES).
 *   - **Truthful save status (UX-ANGIO-002 L1).** `lastSavedAt` and
 *     `saveError` come from the one write funnel, not from each form.
 *   - **Type safety via generics.** `setStudyState<T>` lets each per-
 *     study form pass its own reducer state shape without exporting a
 *     discriminated union here. The backing store widens to `unknown`
 *     (matches `EncounterDraft.studies` from `types/encounter.ts`).
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearEncounter as clearEncounterStore,
  keyEncounter,
  loadEncounter,
  loadEncounterSync,
  saveEncounter,
} from '../services/encounterStore';
import type { EncounterDraft, EncounterHeader, EncounterId } from '../types/encounter';
import type { StudyType } from '../types/study';

/**
 * UX-ANGIO-001 L2 switch. `false` (shipped): when another tab saved this
 * visit since this tab last loaded/wrote it, the change is applied on top
 * of the newest stored draft (so the other tab's answers survive) and
 * `staleFromOtherTab` is raised. `true`: the stale tab writes nothing at
 * all until reloaded (block-and-reload). Turn on only once FormActions
 * shows the reload notice (UX-ANGIO-001 L3), or the stale tab's own edits
 * would stop saving silently.
 */
export const BLOCK_STALE_WRITES = false;

/**
 * True when two drafts hold the same answers and differ at most in their
 * `updatedAt` stamp. A tab that merely re-saved (e.g. on open) is not a
 * conflicting edit and must not raise the stale notice.
 */
function sameAnswers(a: EncounterDraft, b: EncounterDraft | null): boolean {
  if (!b) return false;
  return JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
}

/**
 * Why the last save did not fully land (UX-ANGIO-002 L1):
 *   - `'write-failed'`: the IndexedDB write (source of truth) rejected —
 *     the latest answers are only in memory and would be lost on reload.
 *   - `'cache-failed'`: IndexedDB is fine but the localStorage mirror
 *     could not be written (quota) — a reload may show older answers.
 */
export type EncounterSaveError = 'write-failed' | 'cache-failed';

export interface EncounterContextValue {
  /** The active encounter draft. `null` until an encounter is loaded. */
  readonly encounter: EncounterDraft | null;

  /** True while the encounter is being loaded from storage. */
  readonly isLoading: boolean;

  // The three save-status fields below are always set by EncounterProvider.
  // They are optional on the type only so hand-built context values (e.g.
  // FormActions.test.tsx) written before them stay valid.

  /**
   * When this visit was last confirmed saved: the stored `updatedAt` on
   * load (so a reload shows the real time), then the `updatedAt` of each
   * write once IndexedDB confirms it. `null` only when no encounter.
   */
  readonly lastSavedAt?: Date | null;

  /** Set when a save failed; cleared by the next fully successful save. */
  readonly saveError?: EncounterSaveError | null;

  /**
   * True once another browser tab saved (or deleted) this same visit
   * after this tab loaded it. Stays true until reload. FormActions shows
   * the reload notice from this (UX-ANGIO-001 L3).
   */
  readonly staleFromOtherTab?: boolean;

  /** Updates the encounter header (immutable replace; auto-saves). */
  readonly updateHeader: (next: EncounterHeader) => void;

  /** Adds a study type to selectedStudyTypes (no-op if already present). */
  readonly addStudy: (studyType: StudyType) => void;

  /** Removes a study type and its accumulated study state. */
  readonly removeStudy: (studyType: StudyType) => void;

  /**
   * Patches the per-study state slot. Used by per-study forms to keep
   * their reducer state mirrored into the encounter draft (Phase 3
   * wiring). Generic over T so each study can pass its own reducer
   * state shape; internally widened to `unknown` for storage.
   */
  readonly setStudyState: <T>(studyType: StudyType, state: T) => void;

  /** Discards the encounter (deletes from store + clears in-memory). */
  readonly clearEncounter: () => Promise<void>;
}

const EncounterCtx = createContext<EncounterContextValue | null>(null);

interface EncounterProviderProps {
  /**
   * Encounter to load. `null` mounts the provider in pre-encounter mode
   * (e.g. intake page before "Start" is clicked) — `encounter` stays null
   * and mutation methods are safe no-ops.
   */
  readonly encounterId: EncounterId | null;
  readonly children: ReactNode;
}

export function EncounterProvider({
  encounterId,
  children,
}: EncounterProviderProps): React.ReactElement {
  // Sync hydration: try localStorage on first render so reducer-init paths
  // in downstream forms don't see a null encounter on mount when one
  // already exists in the sync cache. The async effect below confirms
  // against IDB right after.
  const [encounter, setEncounter] = useState<EncounterDraft | null>(() =>
    encounterId ? loadEncounterSync(encounterId) : null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => Boolean(encounterId) && loadEncounterSync(encounterId ?? '') === null,
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() =>
    encounter ? new Date(encounter.updatedAt) : null,
  );
  const [saveError, setSaveError] = useState<EncounterSaveError | null>(null);
  const [staleFromOtherTab, setStaleFromOtherTab] = useState(false);

  // Latest draft, readable synchronously by the mutation funnel below.
  // Mutations run OUTSIDE `setEncounter` updaters: StrictMode calls
  // updaters twice, which used to fire every save twice.
  const encounterRef = useRef<EncounterDraft | null>(encounter);
  // The `updatedAt` this tab last loaded or wrote. A stored draft with a
  // different (newer) value means another tab wrote it (UX-ANGIO-001 L2).
  const baseUpdatedAtRef = useRef<string | null>(encounter?.updatedAt ?? null);

  /** Take a draft read from storage as this tab's current, fresh copy. */
  const adopt = useCallback((draft: EncounterDraft | null) => {
    encounterRef.current = draft;
    baseUpdatedAtRef.current = draft?.updatedAt ?? null;
    setEncounter(draft);
    setLastSavedAt(draft ? new Date(draft.updatedAt) : null);
  }, []);

  // Async refresh on mount + on encounterId change. Cancelled-flag pattern
  // protects against the route flipping mid-load (Wave 2.7 race-safety).
  useEffect(() => {
    if (!encounterId) {
      adopt(null);
      setIsLoading(false);
      return;
    }

    // Reset state for the new id. If sync cache already has it we keep
    // the in-memory value; otherwise we null + spinner until IDB resolves.
    const sync = loadEncounterSync(encounterId);
    adopt(sync);
    setIsLoading(sync === null);

    let cancelled = false;
    loadEncounter(encounterId)
      .then((draft) => {
        if (cancelled) return;
        // Never step back: if this tab already wrote a newer copy while
        // the load was in flight, keep it (an edit made in the first
        // milliseconds would otherwise vanish from memory).
        const base = baseUpdatedAtRef.current;
        if (!(draft && base !== null && draft.updatedAt < base)) adopt(draft);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[EncounterContext] load failed', encounterId, err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [encounterId, adopt]);

  // Cross-tab signal (UX-ANGIO-001 L2; pattern: mantineTheme.ts storage
  // listener). The browser fires `storage` only in OTHER tabs, so any event
  // for this key whose updatedAt differs from ours is another tab's write.
  useEffect(() => {
    if (!encounterId) return;
    const key = keyEncounter(encounterId);
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== key) return;
      const stored = loadEncounterSync(encounterId);
      const base = baseUpdatedAtRef.current;
      if (stored && base !== null && stored.updatedAt === base) return;
      // A tab that only re-stamps the same answers (e.g. one just opened)
      // changed nothing: take its timestamp silently, raise no notice.
      if (stored && sameAnswers(stored, encounterRef.current)) {
        baseUpdatedAtRef.current = stored.updatedAt;
        return;
      }
      setStaleFromOtherTab(true);
      // Catch the in-memory copy up so the next write starts from the
      // other tab's answers. Not in block mode: there the tab must reload.
      if (!BLOCK_STALE_WRITES && stored && (base === null || stored.updatedAt > base)) {
        adopt(stored);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [encounterId, adopt]);

  // Single persistence path — every mutation funnels through here so we
  // get one place to stamp updatedAt, check freshness and report failures.
  // `recipe` returns the next draft, or null for "nothing to change".
  // Every mutation still persists immediately (no debounce, CLAUDE.md).
  const mutate = useCallback(
    (recipe: (current: EncounterDraft) => EncounterDraft | null) => {
      const inMemory = encounterRef.current;
      if (!inMemory) return;

      // Freshness check: did another tab save this visit since we last
      // loaded/wrote it? (Backstop for a storage event not yet delivered.)
      const stored = loadEncounterSync(inMemory.encounterId);
      const base = baseUpdatedAtRef.current;
      const otherTabWrote = stored !== null && base !== null && stored.updatedAt > base;
      if (otherTabWrote && !sameAnswers(stored, inMemory)) setStaleFromOtherTab(true);
      // Apply this change on top of the newest stored draft, so the other
      // tab's saved answers are not overwritten by our older copy.
      const current = otherTabWrote && !BLOCK_STALE_WRITES ? stored : inMemory;

      const next = recipe(current);
      if (!next) {
        if (current !== inMemory) adopt(current);
        return;
      }
      const stamped: EncounterDraft = { ...next, updatedAt: new Date().toISOString() };
      encounterRef.current = stamped;
      setEncounter(stamped);

      if (otherTabWrote && BLOCK_STALE_WRITES) {
        // Kept in memory (the answer stays on screen), not written.
        console.warn('[EncounterContext] write skipped: visit changed in another tab', stamped.encounterId);
        return;
      }

      baseUpdatedAtRef.current = stamped.updatedAt;
      void saveEncounter(stamped, { keepUpdatedAt: true })
        .then(({ localCacheWritten }) => {
          setLastSavedAt(new Date(stamped.updatedAt));
          setSaveError(localCacheWritten ? null : 'cache-failed');
        })
        .catch((err) => {
          console.warn('[EncounterContext] save failed', stamped.encounterId, err);
          setSaveError('write-failed');
        });
    },
    [adopt],
  );

  const updateHeader = useCallback(
    (nextHeader: EncounterHeader) => {
      mutate((prev) => ({ ...prev, header: nextHeader }));
    },
    [mutate],
  );

  const addStudy = useCallback(
    (studyType: StudyType) => {
      mutate((prev) => {
        if (prev.selectedStudyTypes.includes(studyType)) return null;
        return {
          ...prev,
          selectedStudyTypes: [...prev.selectedStudyTypes, studyType],
        };
      });
    },
    [mutate],
  );

  const removeStudy = useCallback(
    (studyType: StudyType) => {
      mutate((prev) => {
        if (!prev.selectedStudyTypes.includes(studyType) && !(studyType in prev.studies)) {
          return null;
        }
        // Strip the studyType from the selection list AND from the studies map.
        const nextStudies: Partial<Record<StudyType, unknown>> = { ...prev.studies };
        delete nextStudies[studyType];
        return {
          ...prev,
          selectedStudyTypes: prev.selectedStudyTypes.filter((s) => s !== studyType),
          studies: nextStudies,
        };
      });
    },
    [mutate],
  );

  const setStudyState = useCallback(
    <T,>(studyType: StudyType, state: T) => {
      mutate((prev) => {
        // Widen to unknown for storage — matches EncounterDraft.studies
        // signature. Consumers narrow back via their own type guards.
        const nextStudies: Partial<Record<StudyType, unknown>> = {
          ...prev.studies,
          [studyType]: state as unknown,
        };
        return { ...prev, studies: nextStudies };
      });
    },
    [mutate],
  );

  const clearEncounter = useCallback(async () => {
    const id = encounterId;
    adopt(null);
    if (id) {
      await clearEncounterStore(id);
    }
  }, [encounterId, adopt]);

  const value = useMemo<EncounterContextValue>(
    () => ({
      encounter,
      isLoading,
      lastSavedAt,
      saveError,
      staleFromOtherTab,
      updateHeader,
      addStudy,
      removeStudy,
      setStudyState,
      clearEncounter,
    }),
    [
      encounter,
      isLoading,
      lastSavedAt,
      saveError,
      staleFromOtherTab,
      updateHeader,
      addStudy,
      removeStudy,
      setStudyState,
      clearEncounter,
    ],
  );

  return <EncounterCtx.Provider value={value}>{children}</EncounterCtx.Provider>;
}

export function useEncounter(): EncounterContextValue {
  const ctx = useContext(EncounterCtx);
  if (!ctx) {
    throw new Error('useEncounter must be used inside <EncounterProvider>');
  }
  return ctx;
}

export { EncounterCtx };
