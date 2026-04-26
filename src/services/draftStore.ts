// SPDX-License-Identifier: Apache-2.0
/**
 * draftStore — IndexedDB-backed storage for in-progress study drafts.
 *
 * Wave 4.1 (Area 10 MEDIUM — PHI in plain-text localStorage).
 *
 * Why IndexedDB instead of localStorage:
 *   - Per-origin storage that's not exposed to `window.localStorage` reads
 *     by every browser extension with the bare `storage` permission.
 *   - Supports an idle-timeout / "clear all" workflow for shared
 *     workstations where clinician A finishes and walks away → clinician
 *     B sits down 30+ min later: drafts auto-clear instead of hydrating
 *     A's PHI into B's session.
 *   - Future-friendly for AES-GCM encryption (TODO Wave 5) — IDB stores
 *     ArrayBuffers natively without base64 overhead.
 *
 * The legacy `loadDraft(studyId)` helper in `useAutoSave` remains
 * synchronous for backward compatibility (study form reducers call it
 * inside `useReducer`'s init callback). Until Wave 5 moves hydration to
 * an async boundary, `useAutoSave` mirrors writes to BOTH IndexedDB and
 * localStorage. The IDB copy is the source of truth for the
 * `listDrafts`, `clearAllDrafts`, idle-timeout, and "Clear all drafts"
 * banner flows; localStorage is a sync read-cache.
 */

import { get, set, del, keys, createStore } from 'idb-keyval';
import { keyStudyDraft, STORAGE_KEYS } from '../constants/storage-keys';

const DB_NAME = 'medimind-angio-drafts';
const STORE_NAME = 'drafts';

// Lazy-init the store so test setup (fake-indexeddb) can run BEFORE the
// store is created. Top-level `createStore(...)` calls fire at module
// import time, before the test setup file finishes executing.
let storeRef: ReturnType<typeof createStore> | null = null;
function store(): ReturnType<typeof createStore> {
  if (!storeRef) storeRef = createStore(DB_NAME, STORE_NAME);
  return storeRef;
}

/** Stored shape — kept versioned so future encryption (Wave 5) can layer on. */
export interface StoredDraft<T = unknown> {
  readonly studyId: string;
  readonly value: T;
  readonly updatedAt: number;
  /** Bump when the on-disk shape changes (e.g. when encryption is added). */
  readonly v: 1;
}

export interface DraftMeta {
  readonly studyId: string;
  readonly updatedAt: number;
}

function isDraftRecord(x: unknown): x is StoredDraft {
  return (
    typeof x === 'object' &&
    x !== null &&
    'studyId' in x &&
    'value' in x &&
    'updatedAt' in x &&
    'v' in x &&
    (x as StoredDraft).v === 1
  );
}

/**
 * Persist a draft. Always writes the full record (no partial merge) —
 * the caller owns serialization shape.
 *
 * TODO Wave 5: encrypt `value` with a per-session AES-GCM key and store
 * `{ iv, ciphertext, updatedAt, v: 2 }` instead. The session key lives
 * in `sessionStorage` so it wipes on tab close, making any persisted
 * ciphertext unreadable across clinician handovers.
 */
export async function saveDraft<T>(studyId: string, value: T): Promise<void> {
  const record: StoredDraft<T> = {
    studyId,
    value,
    updatedAt: Date.now(),
    v: 1,
  };
  await set(studyId, record, store());
}

export async function loadDraftAsync<T>(studyId: string): Promise<T | null> {
  const record = await get(studyId, store());
  if (!isDraftRecord(record)) return null;
  return record.value as T;
}

export async function clearDraftAsync(studyId: string): Promise<void> {
  await del(studyId, store());
}

/**
 * Wipe every draft. Used by:
 *   - StudyPicker "Clear all drafts" button (manual, with confirm)
 *   - Idle-timeout sweeper (30 min of inactivity in useAutoSave)
 *
 * Also clears the matching localStorage shadow so `loadDraft` (sync)
 * doesn't keep returning a stale PHI blob after the IDB copy is gone.
 */
export async function clearAllDrafts(): Promise<void> {
  const allKeys = await keys(store());
  await Promise.all(allKeys.map((k) => del(k, store())));

  if (typeof localStorage !== 'undefined') {
    // Iterate a snapshot of keys — deleting while iterating shifts indices.
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_KEYS.STUDY_DRAFT_PREFIX)) lsKeys.push(k);
    }
    for (const k of lsKeys) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore — ephemeral keys, harmless if removal fails.
      }
    }
  }
}

/** List drafts with metadata, newest first. */
export async function listDrafts(): Promise<readonly DraftMeta[]> {
  const allKeys = await keys(store());
  const records = await Promise.all(
    allKeys.map(async (k) => {
      const record = await get(k, store());
      if (!isDraftRecord(record)) return null;
      return { studyId: record.studyId, updatedAt: record.updatedAt };
    })
  );
  return records
    .filter((r): r is DraftMeta => r !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * One-shot migration from localStorage → IndexedDB.
 *
 * Idempotent — already-migrated drafts are detected by a `*-migrated`
 * flag in localStorage. Old localStorage entries are kept for 30 days
 * as a safety net (the sync `loadDraft` helper still reads them); a
 * Wave 5 sweep can drop them.
 *
 * Safe to call from `main.tsx` on every app load.
 */
export async function migrateLocalStorageDrafts(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const candidateKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_KEYS.STUDY_DRAFT_PREFIX)) candidateKeys.push(k);
  }

  for (const lsKey of candidateKeys) {
    if (lsKey.endsWith('-migrated')) continue;
    const flagKey = `${lsKey}-migrated`;
    if (localStorage.getItem(flagKey) === '1') continue;

    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const studyId = lsKey.slice(STORAGE_KEYS.STUDY_DRAFT_PREFIX.length);
      await saveDraft(studyId, parsed);
      try {
        localStorage.setItem(flagKey, '1');
      } catch {
        // ignore — flag is a hint, not a guarantee.
      }
    } catch (err) {
      console.warn('[draftStore] migration failed for', lsKey, err);
    }
  }
}

/** Test helper — wipes the in-memory store reference so each suite starts clean. */
export function _resetStoreForTests(): void {
  storeRef = null;
}

/** Build the localStorage key for a given studyId. Re-exported for callers
 * that need to reach the legacy sync cache (kept thin so we can drop it
 * in Wave 5 without a rename cascade). */
export function legacyLocalStorageKey(studyId: string): string {
  return keyStudyDraft(studyId);
}
