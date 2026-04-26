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
 *   - **Type safety via generics.** `setStudyState<T>` lets each per-
 *     study form pass its own reducer state shape without exporting a
 *     discriminated union here. The backing store widens to `unknown`
 *     (matches `EncounterDraft.studies` from `types/encounter.ts`).
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearEncounter as clearEncounterStore,
  loadEncounter,
  loadEncounterSync,
  saveEncounter,
} from '../services/encounterStore';
import type { EncounterDraft, EncounterHeader, EncounterId } from '../types/encounter';
import type { StudyType } from '../types/study';

export interface EncounterContextValue {
  /** The active encounter draft. `null` until an encounter is loaded. */
  readonly encounter: EncounterDraft | null;

  /** True while the encounter is being loaded from storage. */
  readonly isLoading: boolean;

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

  // Async refresh on mount + on encounterId change. Cancelled-flag pattern
  // protects against the route flipping mid-load (Wave 2.7 race-safety).
  useEffect(() => {
    if (!encounterId) {
      setEncounter(null);
      setIsLoading(false);
      return;
    }

    // Reset state for the new id. If sync cache already has it we keep
    // the in-memory value; otherwise we null + spinner until IDB resolves.
    const sync = loadEncounterSync(encounterId);
    setEncounter(sync);
    setIsLoading(sync === null);

    let cancelled = false;
    loadEncounter(encounterId)
      .then((draft) => {
        if (cancelled) return;
        setEncounter(draft);
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
  }, [encounterId]);

  // Single persistence path — every mutation funnels through here so we
  // get one place to log save failures and one place to bump updatedAt.
  const persist = useCallback((next: EncounterDraft): EncounterDraft => {
    const stamped: EncounterDraft = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    void saveEncounter(stamped).catch((err) => {
      console.warn('[EncounterContext] save failed', stamped.encounterId, err);
    });
    return stamped;
  }, []);

  const updateHeader = useCallback(
    (nextHeader: EncounterHeader) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        return persist({ ...prev, header: nextHeader });
      });
    },
    [persist],
  );

  const addStudy = useCallback(
    (studyType: StudyType) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        if (prev.selectedStudyTypes.includes(studyType)) return prev;
        return persist({
          ...prev,
          selectedStudyTypes: [...prev.selectedStudyTypes, studyType],
        });
      });
    },
    [persist],
  );

  const removeStudy = useCallback(
    (studyType: StudyType) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        if (!prev.selectedStudyTypes.includes(studyType) && !(studyType in prev.studies)) {
          return prev;
        }
        // Strip the studyType from the selection list AND from the studies map.
        const nextStudies: Partial<Record<StudyType, unknown>> = { ...prev.studies };
        delete nextStudies[studyType];
        return persist({
          ...prev,
          selectedStudyTypes: prev.selectedStudyTypes.filter((s) => s !== studyType),
          studies: nextStudies,
        });
      });
    },
    [persist],
  );

  const setStudyState = useCallback(
    <T,>(studyType: StudyType, state: T) => {
      setEncounter((prev) => {
        if (!prev) return prev;
        // Widen to unknown for storage — matches EncounterDraft.studies
        // signature. Consumers narrow back via their own type guards.
        const nextStudies: Partial<Record<StudyType, unknown>> = {
          ...prev.studies,
          [studyType]: state as unknown,
        };
        return persist({ ...prev, studies: nextStudies });
      });
    },
    [persist],
  );

  const clearEncounter = useCallback(async () => {
    const id = encounterId;
    setEncounter(null);
    if (id) {
      await clearEncounterStore(id);
    }
  }, [encounterId]);

  const value = useMemo<EncounterContextValue>(
    () => ({
      encounter,
      isLoading,
      updateHeader,
      addStudy,
      removeStudy,
      setStudyState,
      clearEncounter,
    }),
    [encounter, isLoading, updateHeader, addStudy, removeStudy, setStudyState, clearEncounter],
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
