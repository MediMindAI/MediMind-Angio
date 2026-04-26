// SPDX-License-Identifier: Apache-2.0
/**
 * customTemplatesService — localStorage CRUD for user-authored study
 * templates (venous LE, arterial LE, carotid) + the "Recently used" LRU.
 *
 * Storage layout (two keys per study, JSON-encoded):
 *
 *   custom-templates.${studyType}  → ReadonlyArray<CustomTemplate>
 *   recent-templates.${studyType}  → ReadonlyArray<string>   (template IDs, MRU-first, max 5)
 *
 * Back-compat migration — a single one-time migration copies the pre-parametrized
 * venous keys (`venous-le.custom-templates` / `venous-le.recent-templates`) over
 * to the `venousLEBilateral` scoped keys, then deletes the old keys. The
 * migration flag `custom-templates.migrated-from-venous-le` prevents re-runs.
 *
 * Scope rule — standalone app, no Medplum sync. Each saved template snapshots
 * the current findings / CEAP (venous) / recommendations / impression /
 * sonographer comments; it does NOT hold patient data. Intended for the single
 * user on this device.
 *
 * Schema-version safety: every stored template carries a `schemaVersion` tag.
 * When the in-memory finding shape changes in the future, bump the version
 * and add a migrator — this file rejects older entries defensively rather
 * than letting malformed data render into the form.
 */

import type { CeapClassification } from '../types/ceap';
import type { Recommendation, StudyType } from '../types/form';

// Template kind / scope unions — each study has its own but we keep them
// permissive here so the generic service can store any variant.
export type CustomTemplateKind = string;
export type CustomTemplateScope = 'right' | 'left' | 'bilateral';

/**
 * One user-authored template.
 *
 * `findings` is `unknown` on purpose — each study casts to its own shape
 * (`VenousSegmentFindings`, `ArterialSegmentFindings`, `CarotidFindings`) at
 * callsite. Likewise `extras` carries study-specific payload (arterial
 * pressures, carotid NASCET).
 */
export interface CustomTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: CustomTemplateKind;
  readonly scope: CustomTemplateScope;
  /** Per-study findings map; the study casts it to its strong type. */
  readonly findings: unknown;
  /** Venous-specific CEAP (optional, only venous studies populate). */
  readonly ceap?: CeapClassification;
  /** Study-specific extras (e.g. arterial `pressures`, carotid `nascet`). */
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly recommendations?: ReadonlyArray<Recommendation>;
  readonly impression?: string;
  readonly sonographerComments?: string;
  /** ISO timestamp of save. */
  readonly createdAt: string;
  readonly schemaVersion: 1;
}

const CUSTOM_KEY_PREFIX = 'custom-templates';
const RECENT_KEY_PREFIX = 'recent-templates';
const MIGRATION_FLAG_KEY = 'custom-templates.migrated-from-venous-le';
const LEGACY_CUSTOM_KEY = 'venous-le.custom-templates';
const LEGACY_RECENT_KEY = 'venous-le.recent-templates';
const LEGACY_TARGET_STUDY: StudyType = 'venousLEBilateral';
const RECENT_MAX = 5;

function customKey(studyType: StudyType): string {
  return `${CUSTOM_KEY_PREFIX}.${studyType}`;
}

function recentKey(studyType: StudyType): string {
  return `${RECENT_KEY_PREFIX}.${studyType}`;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded or mode-locked storage — surface to console for now.
    // A future UX iteration can notify the user with a toast.
    // eslint-disable-next-line no-console
    console.warn('[customTemplatesService] failed to persist', key, err);
  }
}

function removeKey(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// One-time back-compat migration
// ---------------------------------------------------------------------------

/**
 * Migrate legacy venous-only keys (`venous-le.custom-templates`,
 * `venous-le.recent-templates`) to the new study-scoped keys
 * (`custom-templates.venousLEBilateral`, `recent-templates.venousLEBilateral`).
 *
 * Guarded by a flag so we never overwrite post-migration data, even if the
 * user re-saves into the legacy key by accident.
 *
 * Idempotent — safe to call on every `loadCustomTemplates()` entry point.
 */
function runLegacyMigrationOnce(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (storage.getItem(MIGRATION_FLAG_KEY) === '1') return;
    // Migrate custom templates (only if the new key is absent — preserve any
    // post-migration state that snuck in).
    const legacyCustom = storage.getItem(LEGACY_CUSTOM_KEY);
    if (legacyCustom && !storage.getItem(customKey(LEGACY_TARGET_STUDY))) {
      storage.setItem(customKey(LEGACY_TARGET_STUDY), legacyCustom);
    }
    const legacyRecent = storage.getItem(LEGACY_RECENT_KEY);
    if (legacyRecent && !storage.getItem(recentKey(LEGACY_TARGET_STUDY))) {
      storage.setItem(recentKey(LEGACY_TARGET_STUDY), legacyRecent);
    }
    // Delete legacy keys regardless of copy (they're no longer consulted).
    removeKey(LEGACY_CUSTOM_KEY);
    removeKey(LEGACY_RECENT_KEY);
    storage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[customTemplatesService] migration failed', err);
  }
}

// ---------------------------------------------------------------------------
// CustomTemplate CRUD
// ---------------------------------------------------------------------------

/**
 * Wave 4.7 — light validation of `findings` / `extras` shape.
 *
 * Each study (venous LE / arterial LE / carotid) narrows `findings` and
 * `extras` to its own strong type at the callsite (`isVenousFindings`,
 * `isArterialFindings`, etc.). Here we just guard the outer shape — a
 * plain object map — so a hand-edited localStorage entry containing a
 * string, array, or `null` cannot crash the form on load.
 *
 * We deliberately do NOT inspect inner keys: the per-study type guards at
 * the read boundary already handle wrong-shape internals gracefully (Wave
 * 2.5 pattern), so a stricter check here would just duplicate that logic
 * and tightly couple this service to every study's evolving finding shape.
 */
function isFindingsShapeValid(findings: unknown, extras: unknown): boolean {
  if (typeof findings !== 'object' || findings === null || Array.isArray(findings)) {
    return false;
  }
  if (
    extras !== undefined &&
    (typeof extras !== 'object' || extras === null || Array.isArray(extras))
  ) {
    return false;
  }
  return true;
}

function isCustomTemplate(value: unknown): value is CustomTemplate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.name !== 'string' ||
    typeof v.description !== 'string' ||
    typeof v.kind !== 'string' ||
    typeof v.scope !== 'string' ||
    typeof v.createdAt !== 'string' ||
    v.schemaVersion !== 1
  ) {
    return false;
  }
  // Wave 4.7 — scope must be one of the three allowed values (defends
  // against hand-edited localStorage from older code paths).
  if (v.scope !== 'right' && v.scope !== 'left' && v.scope !== 'bilateral') {
    return false;
  }
  // Wave 4.7 — guard findings / extras shape so malformed entries are
  // dropped at the load boundary instead of crashing the form (Part 05 MEDIUM).
  if (!isFindingsShapeValid(v.findings, v.extras)) return false;
  return true;
}

export function loadCustomTemplates(studyType: StudyType): ReadonlyArray<CustomTemplate> {
  runLegacyMigrationOnce();
  const raw = readJson<unknown>(customKey(studyType));
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCustomTemplate);
}

function writeCustomTemplates(
  studyType: StudyType,
  list: ReadonlyArray<CustomTemplate>,
): void {
  writeJson(customKey(studyType), list);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SaveCustomTemplateInput {
  readonly id?: string;
  readonly name: string;
  readonly description: string;
  readonly kind: CustomTemplateKind;
  readonly scope: CustomTemplateScope;
  readonly findings: unknown;
  readonly ceap?: CeapClassification;
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly recommendations?: ReadonlyArray<Recommendation>;
  readonly impression?: string;
  readonly sonographerComments?: string;
}

/**
 * Save (create or replace) a custom template. If `input.id` is supplied and
 * it matches an existing template, that entry is replaced in place;
 * otherwise a new id is minted and the template is prepended to the list.
 */
export function saveCustomTemplate(
  studyType: StudyType,
  input: SaveCustomTemplateInput,
): CustomTemplate {
  const list = loadCustomTemplates(studyType);
  const nowIso = new Date().toISOString();
  const existingIdx = input.id ? list.findIndex((t) => t.id === input.id) : -1;

  const template: CustomTemplate = {
    id: input.id ?? newId(),
    name: input.name,
    description: input.description,
    kind: input.kind,
    scope: input.scope,
    findings: input.findings,
    ceap: input.ceap,
    extras: input.extras,
    recommendations: input.recommendations,
    impression: input.impression,
    sonographerComments: input.sonographerComments,
    createdAt:
      existingIdx >= 0 && list[existingIdx] ? list[existingIdx]!.createdAt : nowIso,
    schemaVersion: 1,
  };

  let next: CustomTemplate[];
  if (existingIdx >= 0) {
    next = list.slice();
    next[existingIdx] = template;
  } else {
    next = [template, ...list];
  }
  writeCustomTemplates(studyType, next);
  return template;
}

export function deleteCustomTemplate(studyType: StudyType, id: string): void {
  const list = loadCustomTemplates(studyType);
  const next = list.filter((t) => t.id !== id);
  writeCustomTemplates(studyType, next);
}

// ---------------------------------------------------------------------------
// Recently-used queue (LRU, MRU-first, max 5, dedupes)
// ---------------------------------------------------------------------------

export function loadRecentTemplateIds(studyType: StudyType): ReadonlyArray<string> {
  runLegacyMigrationOnce();
  const raw = readJson<unknown>(recentKey(studyType));
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX);
}

export function pushRecentTemplate(studyType: StudyType, id: string): void {
  const current = loadRecentTemplateIds(studyType);
  const filtered = current.filter((x) => x !== id);
  const next = [id, ...filtered].slice(0, RECENT_MAX);
  writeJson(recentKey(studyType), next);
}

export function clearRecentTemplates(studyType: StudyType): void {
  writeJson(recentKey(studyType), []);
}
