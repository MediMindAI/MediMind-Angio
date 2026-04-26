/**
 * useAutoSave — Wave 2.4 hardening tests.
 *
 * Covers the four findings closed in Wave 2 Task 2.4:
 *   A. Cleanup-flush on unmount       (HIGH — Part 07)
 *   B. clearDraft no longer suppresses next edit (HIGH — Part 02 clearDraft data loss)
 *   C. Quota errors surface via lastError + onError (MEDIUM — Part 02)
 *   D. studyId-change race           (MEDIUM — Part 02 / Strict Mode)
 *
 * Vitest fake timers + jsdom localStorage. Each test starts from a clean
 * storage so assertions are deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { keyStudyDraft } from '../constants/storage-keys';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoSave — Wave 2.4 hardening', () => {
  // -------------------------------------------------------------------------
  // A. Cleanup-flush on unmount
  // -------------------------------------------------------------------------
  it('flushes pending state on unmount (Pattern Wave 2.4 A)', () => {
    const { rerender, unmount } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    // Schedule a debounced save by changing state
    rerender({ state: { v: 2 } });

    // Unmount BEFORE the 1500ms timer fires — the cleanup must flush
    unmount();

    expect(localStorage.getItem(keyStudyDraft('s1'))).toContain('"v":2');
  });

  it('does not flush on unmount when no debounce is pending', () => {
    const { unmount } = renderHook(() =>
      useAutoSave('s1', { v: 1 }, { debounceMs: 1500 })
    );
    // Initial render is suppressed (firstRunRef) — no timer scheduled
    unmount();
    expect(localStorage.getItem(keyStudyDraft('s1'))).toBeNull();
  });

  // -------------------------------------------------------------------------
  // B. clearDraft no longer swallows the next real edit
  // -------------------------------------------------------------------------
  it('persists the next edit immediately after clearDraft (Pattern Wave 2.4 B)', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    act(() => {
      result.current.clearDraft();
    });

    // First real edit AFTER clearDraft — must still be persisted
    rerender({ state: { v: 99 } });
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(localStorage.getItem(keyStudyDraft('s1'))).toContain('"v":99');
  });

  it('clearDraft resets lastSavedAt, hasUnsavedChanges, and lastError', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 2 } });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.lastSavedAt).not.toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.lastError).toBeNull();
    expect(localStorage.getItem(keyStudyDraft('s1'))).toBeNull();
  });

  // -------------------------------------------------------------------------
  // C. Quota / security errors surface via lastError + onError
  // -------------------------------------------------------------------------
  it('surfaces quota errors via lastError + onError (Pattern Wave 2.4 C)', () => {
    const onError = vi.fn();
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

    const { result, rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { onError, debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 2 } });
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.lastError).not.toBeNull();
    expect(result.current.lastError?.message).toContain('QuotaExceeded');

    setItemSpy.mockRestore();
  });

  it('clears lastError after a subsequent successful write', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });

    const { result, rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 2 } });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.lastError).not.toBeNull();

    // Subsequent write is allowed (mockImplementationOnce only intercepted one call)
    rerender({ state: { v: 3 } });
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.lastError).toBeNull();
    expect(localStorage.getItem(keyStudyDraft('s1'))).toContain('"v":3');

    setItemSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // D. studyId-change race fix
  // -------------------------------------------------------------------------
  it('flushes to OLD studyId when studyId changes mid-debounce (Pattern Wave 2.4 D)', () => {
    const { rerender } = renderHook(
      ({ studyId, state }) => useAutoSave(studyId, state, { debounceMs: 1500 }),
      { initialProps: { studyId: 'a', state: { v: 1 } as { v: number } } }
    );

    // Change state under key 'a' — schedules a debounced timer
    rerender({ studyId: 'a', state: { v: 99 } });

    // BEFORE the timer fires, swap to studyId 'b' — pending value must
    // be flushed to 'a', not silently moved under 'b' / dropped.
    rerender({ studyId: 'b', state: { v: 99 } });

    expect(localStorage.getItem(keyStudyDraft('a'))).toContain('"v":99');
    // 'b' should NOT receive that pre-swap value
    expect(localStorage.getItem(keyStudyDraft('b'))).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Existing happy-path regression coverage (debounce + saveNow)
  // -------------------------------------------------------------------------
  it('debounces saves to a single localStorage write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 2 } });
    rerender({ state: { v: 3 } });
    rerender({ state: { v: 4 } });

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // Only the FINAL state hits storage
    const writesForStudy = setItemSpy.mock.calls.filter(
      (call) => call[0] === keyStudyDraft('s1')
    );
    expect(writesForStudy.length).toBe(1);
    expect(localStorage.getItem(keyStudyDraft('s1'))).toContain('"v":4');

    setItemSpy.mockRestore();
  });

  it('saveNow bypasses the debounce', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 7 } });

    act(() => {
      result.current.saveNow();
    });

    // Stored immediately, well before the 1500ms debounce
    expect(localStorage.getItem(keyStudyDraft('s1'))).toContain('"v":7');
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('respects enabled=false (no writes scheduled)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { rerender } = renderHook(
      ({ state }) => useAutoSave('s1', state, { enabled: false, debounceMs: 1500 }),
      { initialProps: { state: { v: 1 } as { v: number } } }
    );

    rerender({ state: { v: 2 } });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const writesForStudy = setItemSpy.mock.calls.filter(
      (call) => call[0] === keyStudyDraft('s1')
    );
    expect(writesForStudy.length).toBe(0);

    setItemSpy.mockRestore();
  });
});
