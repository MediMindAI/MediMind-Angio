/**
 * useAutoSave — debounced localStorage persistence for form state.
 *
 * The hook writes `state` to `localStorage[keyStudyDraft(studyId)]` after
 * every change, debounced (default 2000 ms). It does **not** hydrate your
 * state — call `loadDraft(studyId)` at mount and seed your reducer /
 * `useState` initializer manually so the caller keeps control of the
 * "initial value" truth.
 *
 * API mirrors MediMind EMR's hook shape so this can fold back into the
 * main app without a consumer-side rename.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { keyStudyDraft } from '../constants/storage-keys';

// ============================================================================
// Standalone helpers (usable outside React)
// ============================================================================

/** Read a previously-saved draft for `studyId`. Returns null if absent / corrupt. */
export function loadDraft<T>(studyId: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyStudyDraft(studyId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Remove any saved draft for `studyId`. No-op if none present. */
export function clearDraft(studyId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(keyStudyDraft(studyId));
  } catch {
    // quota / security errors — draft sticks around harmlessly.
  }
}

function writeDraft<T>(studyId: string, state: T): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(keyStudyDraft(studyId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseAutoSaveOptions {
  /** Debounce in ms. Default 2000. */
  readonly debounceMs?: number;
  /** If false, the hook becomes inert (no save). Default true. */
  readonly enabled?: boolean;
}

export interface UseAutoSaveResult {
  readonly lastSavedAt: Date | null;
  readonly hasUnsavedChanges: boolean;
  /** Force-save immediately (bypasses the debounce) and clear the dirty flag. */
  readonly saveNow: () => void;
}

export function useAutoSave<T>(
  studyId: string,
  state: T,
  options?: UseAutoSaveOptions
): UseAutoSaveResult {
  const debounceMs = options?.debounceMs ?? 2000;
  const enabled = options?.enabled ?? true;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Refs kept in sync with the latest values so saveNow() / the debounce
  // callback always see the freshest state without the `state` variable
  // being re-captured in a closure.
  const stateRef = useRef<T>(state);
  const studyIdRef = useRef<string>(studyId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = useRef<boolean>(true);

  stateRef.current = state;
  studyIdRef.current = studyId;

  useEffect(() => {
    if (!enabled) return;

    // Skip the first run — the initial state hasn't been user-edited, so
    // don't flash an (incorrect) "unsaved changes" badge.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    setHasUnsavedChanges(true);

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const ok = writeDraft(studyIdRef.current, stateRef.current);
      if (ok) {
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);
      }
      timerRef.current = null;
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state, debounceMs, enabled]);

  const saveNow = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ok = writeDraft(studyIdRef.current, stateRef.current);
    if (ok) {
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
    }
  }, []);

  return { lastSavedAt, hasUnsavedChanges, saveNow };
}
