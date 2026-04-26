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
 *
 * Hardening (Wave 2.4):
 *   A. Cleanup-flush — unmount synchronously persists any pending state so
 *      a click on "Back to studies" within the debounce window doesn't
 *      silently drop the user's last keystrokes.
 *   B. clearDraft no longer suppresses the next real edit (the previous
 *      `firstRunRef = true` re-arming swallowed the first post-reset save).
 *   C. Storage write errors (quota, security) surface via `lastError` and
 *      an optional `onError` callback instead of being silently swallowed.
 *   D. studyId-change race — flush pending writes to the OLD key before
 *      the new render schedules under the NEW key.
 *   E. beforeunload guard — best-effort flush + native confirm prompt
 *      when the user navigates away with unsaved changes.
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

/**
 * Internal: synchronous draft writer.
 *
 * Returns `{ ok, err }` rather than a bare boolean so the caller can
 * surface quota / security errors (Wave 2.4 C) instead of swallowing
 * them — clinicians otherwise see an "unsaved" badge with no idea why.
 */
function writeDraft<T>(studyId: string, state: T): { ok: boolean; err: unknown } {
  if (typeof localStorage === 'undefined') return { ok: false, err: null };
  try {
    localStorage.setItem(keyStudyDraft(studyId), JSON.stringify(state));
    return { ok: true, err: null };
  } catch (err) {
    return { ok: false, err };
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
  /**
   * Called when a localStorage write fails (quota exceeded, security
   * exception, etc). The hook also exposes `lastError` for inline UI.
   */
  readonly onError?: (err: unknown) => void;
}

export interface UseAutoSaveResult {
  readonly lastSavedAt: Date | null;
  readonly hasUnsavedChanges: boolean;
  /** Most recent localStorage write error, or null if last write succeeded. */
  readonly lastError: Error | null;
  /** Force-save immediately (bypasses the debounce) and clear the dirty flag. */
  readonly saveNow: () => void;
  /**
   * Remove the persisted draft for this study and reset the in-hook
   * lastSaved/dirty state. Use when the caller intentionally starts a
   * brand-new case — the next user edit will persist normally.
   */
  readonly clearDraft: () => void;
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
  const [lastError, setLastError] = useState<Error | null>(null);

  // Refs kept in sync with the latest values so saveNow() / the debounce
  // callback always see the freshest state without the `state` variable
  // being re-captured in a closure.
  const stateRef = useRef<T>(state);
  const studyIdRef = useRef<string>(studyId);
  const prevStudyIdRef = useRef<string>(studyId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which studyId a pending timer was scheduled for, so cleanup
  // paths (studyId swap, unmount) flush to the CORRECT key even after
  // studyIdRef has been updated by a subsequent render.
  const pendingStudyIdRef = useRef<string | null>(null);
  const firstRunRef = useRef<boolean>(true);
  // Keep the latest onError in a ref so the unmount-flush callback never
  // sees a stale reference, and so changing the callback doesn't re-run
  // the auto-save effect (which would reset firstRunRef).
  const onErrorRef = useRef<((err: unknown) => void) | undefined>(options?.onError);
  onErrorRef.current = options?.onError;

  stateRef.current = state;
  studyIdRef.current = studyId;

  /**
   * Synchronous flush helper used by:
   *   - the debounced timer
   *   - saveNow()
   *   - the unmount cleanup (Wave 2.4 A)
   *   - the studyId-change effect (Wave 2.4 D)
   *   - beforeunload (Wave 2.4 E)
   */
  const flushTo = useCallback((targetStudyId: string, value: T) => {
    const result = writeDraft(targetStudyId, value);
    if (result.ok) {
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      setLastError(null);
    } else if (result.err !== null) {
      const errObj =
        result.err instanceof Error ? result.err : new Error(String(result.err));
      setLastError(errObj);
      // eslint-disable-next-line no-console
      console.warn('[useAutoSave] localStorage write failed', targetStudyId, result.err);
      onErrorRef.current?.(result.err);
    }
  }, []);

  // --- Wave 2.4 D: studyId-change race fix ---------------------------------
  // If the consumer swaps studyId between renders, flush any pending timer
  // to the OLD key before the next debounce arms under the NEW key.
  useEffect(() => {
    if (prevStudyIdRef.current !== studyId) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        const targetStudyId = pendingStudyIdRef.current ?? prevStudyIdRef.current;
        timerRef.current = null;
        pendingStudyIdRef.current = null;
        flushTo(targetStudyId, stateRef.current);
      }
      prevStudyIdRef.current = studyId;
    }
  }, [studyId, flushTo]);

  // --- Debounced auto-save -------------------------------------------------
  // NOTE: this effect intentionally does NOT flush in its cleanup callback.
  // Its cleanup fires on EVERY state change (not just unmount), so flushing
  // there would defeat debouncing entirely. Unmount-flush is a separate
  // effect below (Wave 2.4 A).
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
    pendingStudyIdRef.current = studyIdRef.current;
    timerRef.current = setTimeout(() => {
      flushTo(studyIdRef.current, stateRef.current);
      timerRef.current = null;
      pendingStudyIdRef.current = null;
    }, debounceMs);
  }, [state, debounceMs, enabled, flushTo]);

  // --- Wave 2.4 A: unmount-only flush --------------------------------------
  // Standalone effect with a `[]` dep array so its cleanup fires ONLY on
  // unmount (not on every state change). Default debounce is 1.5–2s; without
  // this flush, any keystroke in the final pre-unmount window would be
  // silently dropped. Wave 1.2 ErrorBoundary's "draft has been saved"
  // copy depends on this guarantee.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        const targetStudyId = pendingStudyIdRef.current ?? studyIdRef.current;
        timerRef.current = null;
        pendingStudyIdRef.current = null;
        flushTo(targetStudyId, stateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Wave 2.4 E: beforeunload guard --------------------------------------
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Best-effort synchronous flush. Modern browsers ignore the
        // confirmation message text but still honor preventDefault.
        flushTo(studyIdRef.current, stateRef.current);
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, hasUnsavedChanges, flushTo]);

  const saveNow = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingStudyIdRef.current = null;
    }
    flushTo(studyIdRef.current, stateRef.current);
  }, [flushTo]);

  const clearDraftNow = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingStudyIdRef.current = null;
    }
    clearDraft(studyIdRef.current);
    setLastSavedAt(null);
    setHasUnsavedChanges(false);
    setLastError(null);
    // Wave 2.4 B: do NOT set firstRunRef.current = true here.
    // The previous version re-armed first-run suppression, which silently
    // dropped the very first edit on a fresh case. Re-saving the empty/reset
    // state on the next change tick is harmless.
  }, []);

  return { lastSavedAt, hasUnsavedChanges, lastError, saveNow, clearDraft: clearDraftNow };
}
