// SPDX-License-Identifier: Apache-2.0
/**
 * encounterStore — IndexedDB-backed persistence for in-progress encounters.
 *
 * Phase 1 (encounter-pivot plan §1b). Mirrors the design of `draftStore.ts`
 * (Wave 4.1) so encounters get the same dual-write durability without
 * reinventing the storage primitives:
 *
 *   - **IndexedDB** (via `idb-keyval`) is the source of truth for the
 *     `listEncounters`, `clearAllEncounters`, and async load paths. IDB
 *     storage is per-origin and not enumerable through `window.localStorage`,
 *     which matters for shared workstations carrying PHI.
 *   - **localStorage** is a synchronous read-cache that powers
 *     `loadEncounterSync` — used by reducer-init paths that can't await.
 *
 * Every write hits BOTH stores and bumps `updatedAt` to the current ISO
 * timestamp. Reads prefer IDB; if IDB has no entry but localStorage does,
 * we hydrate from the sync cache (resilience after an IDB upgrade race).
 *
 * Key scheme: `encounter-<uuid>`. The matching localStorage key uses the
 * exact same string so the two stores stay in lockstep.
 */

import { get, set, del, keys, createStore } from 'idb-keyval';
import type { EncounterDraft, EncounterId } from '../types/encounter';

const DB_NAME = 'medimind-angio-encounters';
const STORE_NAME = 'encounters';

/** Public so tests + future migration code can build keys without re-hardcoding. */
export const ENCOUNTER_KEY_PREFIX = 'encounter-';

/** Build the storage key for a given encounter id (IDB key === localStorage key). */
export function keyEncounter(id: EncounterId): string {
  return `${ENCOUNTER_KEY_PREFIX}${id}`;
}

// Lazy-init the store so `fake-indexeddb/auto` (test setup) installs its
// shim BEFORE we touch the IDBFactory. Top-level `createStore(...)` would
// fire at import time and bind to the real (missing) factory in jsdom.
let storeRef: ReturnType<typeof createStore> | null = null;
function store(): ReturnType<typeof createStore> {
  if (!storeRef) storeRef = createStore(DB_NAME, STORE_NAME);
  return storeRef;
}

// ---------------------------------------------------------------------------
// localStorage helpers — null-safe under SSR / sandboxed iframes.
// ---------------------------------------------------------------------------

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSyncRaw(id: EncounterId): EncounterDraft | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(keyEncounter(id));
    if (!raw) return null;
    return JSON.parse(raw) as EncounterDraft;
  } catch {
    return null;
  }
}

function writeSyncRaw(draft: EncounterDraft): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));
  } catch (err) {
    // Quota exceeded or mode-locked storage — surface to console; the IDB
    // copy still goes through, so the encounter isn't lost.
    console.warn('[encounterStore] localStorage write failed', draft.encounterId, err);
  }
}

function removeSyncRaw(id: EncounterId): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(keyEncounter(id));
  } catch {
    // ignore — best-effort cleanup
  }
}

function isEncounterDraft(x: unknown): x is EncounterDraft {
  return (
    typeof x === 'object' &&
    x !== null &&
    'schemaVersion' in x &&
    'encounterId' in x &&
    'header' in x &&
    'selectedStudyTypes' in x &&
    'studies' in x
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist an encounter draft. Bumps `updatedAt` on every write so
 * `listEncounters` can sort newest-first. Writes hit IDB first; the
 * localStorage mirror follows synchronously so the next render's
 * `loadEncounterSync` sees the new state.
 */
export async function saveEncounter(draft: EncounterDraft): Promise<void> {
  const stamped: EncounterDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  await set(keyEncounter(stamped.encounterId), stamped, store());
  writeSyncRaw(stamped);
}

/**
 * Async load — preferred path. Reads IDB; if missing but localStorage
 * still has a copy (e.g. after an IDB upgrade race), hydrates from the
 * sync cache and self-heals by writing the entry back to IDB.
 */
export async function loadEncounter(id: EncounterId): Promise<EncounterDraft | null> {
  const fromIdb = await get(keyEncounter(id), store());
  if (isEncounterDraft(fromIdb)) return fromIdb;

  const fromLocal = readSyncRaw(id);
  if (fromLocal) {
    // Self-heal: re-populate IDB so subsequent loads stay on the fast path.
    try {
      await set(keyEncounter(id), fromLocal, store());
    } catch {
      // ignore — fall through with the localStorage value.
    }
    return fromLocal;
  }
  return null;
}

/**
 * Sync load — for reducer-init paths that can't await. Reads localStorage
 * only. If a draft was written in another tab and IDB is the only fresh
 * copy, callers should follow up with an async `loadEncounter` to refresh.
 */
export function loadEncounterSync(id: EncounterId): EncounterDraft | null {
  return readSyncRaw(id);
}

/**
 * List every encounter, newest-first by `updatedAt`. Reads IDB and filters
 * by `ENCOUNTER_KEY_PREFIX` so unrelated `idb-keyval` consumers that share
 * the database name (none today, but defensive against future drift) don't
 * leak in.
 */
export async function listEncounters(): Promise<EncounterDraft[]> {
  const allKeys = await keys(store());
  const records = await Promise.all(
    allKeys.map(async (k) => {
      if (typeof k !== 'string' || !k.startsWith(ENCOUNTER_KEY_PREFIX)) return null;
      const record = await get(k, store());
      if (!isEncounterDraft(record)) return null;
      return record;
    })
  );
  return records
    .filter((r): r is EncounterDraft => r !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Remove a single encounter from BOTH IDB and the localStorage mirror. */
export async function clearEncounter(id: EncounterId): Promise<void> {
  await del(keyEncounter(id), store());
  removeSyncRaw(id);
}

/**
 * Wipe every encounter. Used by:
 *   - Future "Clear all encounters" admin/banner action
 *   - Test cleanup
 *
 * Iterates IDB keys filtered by `ENCOUNTER_KEY_PREFIX` and the matching
 * localStorage keys. Unrelated entries (preferences, study drafts, etc.)
 * survive untouched.
 */
export async function clearAllEncounters(): Promise<void> {
  const allKeys = await keys(store());
  const encounterKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(ENCOUNTER_KEY_PREFIX)
  );
  await Promise.all(encounterKeys.map((k) => del(k, store())));

  const storage = safeStorage();
  if (storage) {
    const lsKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(ENCOUNTER_KEY_PREFIX)) lsKeys.push(k);
    }
    for (const k of lsKeys) {
      try {
        storage.removeItem(k);
      } catch {
        // ignore — best-effort cleanup
      }
    }
  }
}

/** Test helper — wipes the in-memory store reference so each suite starts clean. */
export function _resetStoreForTests(): void {
  storeRef = null;
}
