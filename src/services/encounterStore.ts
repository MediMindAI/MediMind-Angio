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

import { get, set, update, del, keys, createStore } from 'idb-keyval';
import type { EncounterDraft, EncounterId } from '../types/encounter';

const DB_NAME = 'medimind-angio-encounters';
const STORE_NAME = 'encounters';

/** Public so tests + future migration code can build keys without re-hardcoding. */
export const ENCOUNTER_KEY_PREFIX = 'encounter-';

/** Build the storage key for a given encounter id (IDB key === localStorage key). */
export function keyEncounter(id: EncounterId): string {
  return `${ENCOUNTER_KEY_PREFIX}${id}`;
}

/**
 * Idle-timeout policy for encounter drafts.
 *
 * Phase 5 Item 4 reconciliation. The original Wave 4.1 per-study drafts
 * auto-cleared after 30 minutes of inactivity (`useAutoSave`'s
 * `idleTimeoutMs: 30 * 60 * 1000`). Encounters explicitly opt out:
 * `EncounterContext` writes through `saveEncounter` on every mutation
 * with no idle timer, so a clinician sitting on the venous form for 35
 * minutes mid-encounter does NOT lose their work.
 *
 * Phase 3b dropped per-study `useAutoSave` instances in favor of
 * `setStudyState` mirroring into the encounter draft. The per-study
 * forms today only call `loadDraft(...)` for legacy migration reads;
 * none constructs a `useAutoSave` hook with a non-zero idle timeout.
 * The encounter store is the single persistence layer for live data.
 *
 * If a future feature wants automatic age-out (e.g. "auto-discard
 * 24-hour-old encounters"), import this constant and gate the cleanup
 * pass against `Date.now() - new Date(draft.updatedAt).getTime()`.
 * Today the value is `0` (disabled) — no cleanup runs.
 */
export const MAX_ENCOUNTER_AGE_MS = 0;

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

/** Returns false when the localStorage mirror could not be written. */
function writeSyncRaw(draft: EncounterDraft): boolean {
  const storage = safeStorage();
  if (!storage) return true;
  try {
    storage.setItem(keyEncounter(draft.encounterId), JSON.stringify(draft));
    return true;
  } catch (err) {
    // Quota exceeded or mode-locked storage — surface to console; the IDB
    // copy still goes through, so the encounter isn't lost. The caller gets
    // `localCacheWritten: false` so the UI can warn (UX-ANGIO-002 L1): a
    // stale sync cache would re-hydrate old answers on the next reload.
    console.warn('[encounterStore] localStorage write failed', draft.encounterId, err);
    return false;
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

export interface SaveEncounterOptions {
  /**
   * Keep the caller's `updatedAt` instead of re-stamping. `EncounterContext`
   * stamps once and remembers that exact value, so its cross-tab freshness
   * check (UX-ANGIO-001 L2) compares against what is really stored.
   */
  readonly keepUpdatedAt?: boolean;
}

export interface SaveEncounterResult {
  /** The draft exactly as written (with its final `updatedAt`). */
  readonly saved: EncounterDraft;
  /** False when IDB succeeded but the localStorage mirror failed (quota). */
  readonly localCacheWritten: boolean;
}

/**
 * Persist an encounter draft. Bumps `updatedAt` on every write so
 * `listEncounters` can sort newest-first. The localStorage mirror is written
 * synchronously BEFORE the IDB await, so a route guard or render that runs
 * while IDB is still writing already sees the new state via
 * `loadEncounterSync` (level-up W1-E: adding a study from the banner bounced
 * to `/` because the mirror lagged). Rejects when the IDB write fails.
 */
export async function saveEncounter(
  draft: EncounterDraft,
  options: SaveEncounterOptions = {},
): Promise<SaveEncounterResult> {
  const stamped: EncounterDraft = options.keepUpdatedAt
    ? draft
    : { ...draft, updatedAt: new Date().toISOString() };
  const localCacheWritten = writeSyncRaw(stamped);
  await set(keyEncounter(stamped.encounterId), stamped, store());
  return { saved: stamped, localCacheWritten };
}

// ---------------------------------------------------------------------------
// Legacy-data migration
// ---------------------------------------------------------------------------

/**
 * Rewrite legacy venous-LE segment IDs and phasicity values stored in older
 * encounter drafts so they match the current schema. Pure on the input —
 * returns a new draft when anything changes; otherwise returns the original.
 */
function migrateLegacyDraft(draft: EncounterDraft): EncounterDraft {
  const segMap: Readonly<Record<string, string | null>> = {
    'eiv-left': null,
    'eiv-right': null,
    'pop-fossa-left': null,
    'pop-fossa-right': null,
    'gsv-ak-left': 'gsv-prox-thigh-left',
    'gsv-ak-right': 'gsv-prox-thigh-right',
    'gsv-prox-calf-left': 'gsv-calf-left',
    'gsv-prox-calf-right': 'gsv-calf-right',
    'gsv-mid-calf-left': 'gsv-calf-left',
    'gsv-mid-calf-right': 'gsv-calf-right',
    'gsv-dist-calf-left': 'gsv-calf-left',
    'gsv-dist-calf-right': 'gsv-calf-right',
  };
  const phasicityMap: Readonly<Record<string, string>> = {
    normal: 'respirophasic',
    continuous: 'monophasic',
    absent: 'reduced',
  };
  let mutated = false;
  const rewriteFindings = (findings: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(findings)) {
      const remapped = key in segMap ? segMap[key] : key;
      if (remapped === null) {
        mutated = true;
        continue;
      }
      const newKey = remapped ?? key;
      if (newKey !== key) mutated = true;
      let entry = value;
      if (entry && typeof entry === 'object' && 'phasicity' in entry) {
        const currentPhase = (entry as { phasicity?: unknown }).phasicity;
        if (typeof currentPhase === 'string' && currentPhase in phasicityMap) {
          entry = { ...(entry as object), phasicity: phasicityMap[currentPhase] };
          mutated = true;
        }
      }
      // Drop transDiameterMm if present.
      if (entry && typeof entry === 'object' && 'transDiameterMm' in entry) {
        const { transDiameterMm: _drop, ...rest } = entry as Record<string, unknown>;
        entry = rest;
        mutated = true;
      }
      // Drop spontaneity / augmentation if present.
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        if ('spontaneity' in obj || 'augmentation' in obj) {
          const { spontaneity: _s, augmentation: _a, ...rest } = obj;
          entry = rest;
          mutated = true;
        }
      }
      // If multiple legacy keys collapse onto the same new key, last write wins.
      out[newKey] = entry;
    }
    return out;
  };

  const studies = draft.studies as Readonly<Record<string, unknown>>;
  const newStudies: Record<string, unknown> = {};
  for (const [studyType, study] of Object.entries(studies)) {
    if (!study || typeof study !== 'object') {
      newStudies[studyType] = study;
      continue;
    }
    const studyObj = study as Record<string, unknown>;
    const params = studyObj['parameters'];
    if (!params || typeof params !== 'object') {
      newStudies[studyType] = study;
      continue;
    }
    const paramsObj = params as Record<string, unknown>;
    const findings = paramsObj['segmentFindings'];
    if (!findings || typeof findings !== 'object') {
      newStudies[studyType] = study;
      continue;
    }
    const newFindings = rewriteFindings(findings as Record<string, unknown>);
    newStudies[studyType] = {
      ...studyObj,
      parameters: { ...paramsObj, segmentFindings: newFindings },
    };
  }
  if (!mutated) return draft;
  return { ...draft, studies: newStudies as EncounterDraft['studies'] };
}

/**
 * Async load — preferred path. Reads IDB; if missing but localStorage
 * still has a copy (e.g. after an IDB upgrade race), hydrates from the
 * sync cache and self-heals by writing the entry back to IDB.
 */
export async function loadEncounter(id: EncounterId): Promise<EncounterDraft | null> {
  const fromIdb = await get(keyEncounter(id), store());
  if (isEncounterDraft(fromIdb)) return migrateLegacyDraft(fromIdb);

  const fromLocal = readSyncRaw(id);
  if (fromLocal) {
    const migrated = migrateLegacyDraft(fromLocal);
    // Self-heal: re-populate IDB so subsequent loads stay on the fast path.
    // Atomic fill-if-empty: a save that landed after our read must win over
    // this older localStorage copy (UX-ANGIO-001 — no silent overwrite).
    try {
      await update<unknown>(keyEncounter(id), (current) => current ?? migrated, store());
    } catch {
      // ignore — fall through with the localStorage value.
    }
    return migrated;
  }
  return null;
}

/**
 * Sync load — for reducer-init paths that can't await. Reads localStorage
 * only. If a draft was written in another tab and IDB is the only fresh
 * copy, callers should follow up with an async `loadEncounter` to refresh.
 */
export function loadEncounterSync(id: EncounterId): EncounterDraft | null {
  const raw = readSyncRaw(id);
  return raw ? migrateLegacyDraft(raw) : null;
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
