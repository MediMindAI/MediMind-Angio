// SPDX-License-Identifier: Apache-2.0
/**
 * customTemplatesService — localStorage CRUD for user-authored Venous LE
 * templates + the "Recently used" LRU queue.
 *
 * Storage layout (two keys, both JSON-encoded):
 *
 *   venous-le.custom-templates  → ReadonlyArray<CustomTemplate>
 *   venous-le.recent-templates  → ReadonlyArray<string>   (template IDs, MRU-first, max 5)
 *
 * Scope rule — standalone app, no Medplum sync. Each saved template snapshots
 * the current findings / CEAP / recommendations / impression / sonographer
 * comments; it does NOT hold patient data. Intended for the single user on
 * this device. A future `Basic` resource sync is a drop-in.
 *
 * Schema-version safety: every stored template carries a `schemaVersion` tag.
 * When the in-memory finding shape changes in the future, bump the version
 * and add a migrator — this file rejects older entries defensively rather
 * than letting malformed data render into the form.
 */

import type { CeapClassification } from '../types/ceap';
import type { Recommendation } from '../types/form';
import type {
  TemplateKind,
  TemplateScope,
} from '../components/studies/venous-le/templates';
import type { VenousSegmentFindings } from '../components/studies/venous-le/config';

/** One user-authored template. */
export interface CustomTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: TemplateKind;
  readonly scope: TemplateScope;
  readonly findings: VenousSegmentFindings;
  readonly ceap?: CeapClassification;
  readonly recommendations?: ReadonlyArray<Recommendation>;
  readonly impression?: string;
  readonly sonographerComments?: string;
  /** ISO timestamp of save. */
  readonly createdAt: string;
  readonly schemaVersion: 1;
}

const CUSTOM_KEY = 'venous-le.custom-templates';
const RECENT_KEY = 'venous-le.recent-templates';
const RECENT_MAX = 5;

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

// ---------------------------------------------------------------------------
// CustomTemplate CRUD
// ---------------------------------------------------------------------------

function isCustomTemplate(value: unknown): value is CustomTemplate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.scope === 'string' &&
    typeof v.findings === 'object' &&
    v.findings !== null &&
    typeof v.createdAt === 'string' &&
    v.schemaVersion === 1
  );
}

export function loadCustomTemplates(): ReadonlyArray<CustomTemplate> {
  const raw = readJson<unknown>(CUSTOM_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCustomTemplate);
}

function writeCustomTemplates(list: ReadonlyArray<CustomTemplate>): void {
  writeJson(CUSTOM_KEY, list);
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
  readonly kind: TemplateKind;
  readonly scope: TemplateScope;
  readonly findings: VenousSegmentFindings;
  readonly ceap?: CeapClassification;
  readonly recommendations?: ReadonlyArray<Recommendation>;
  readonly impression?: string;
  readonly sonographerComments?: string;
}

/**
 * Save (create or replace) a custom template. If `input.id` is supplied and
 * it matches an existing template, that entry is replaced in place;
 * otherwise a new id is minted and the template is prepended to the list.
 */
export function saveCustomTemplate(input: SaveCustomTemplateInput): CustomTemplate {
  const list = loadCustomTemplates();
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
    recommendations: input.recommendations,
    impression: input.impression,
    sonographerComments: input.sonographerComments,
    createdAt: existingIdx >= 0 && list[existingIdx] ? list[existingIdx]!.createdAt : nowIso,
    schemaVersion: 1,
  };

  let next: CustomTemplate[];
  if (existingIdx >= 0) {
    next = list.slice();
    next[existingIdx] = template;
  } else {
    next = [template, ...list];
  }
  writeCustomTemplates(next);
  return template;
}

export function deleteCustomTemplate(id: string): void {
  const list = loadCustomTemplates();
  const next = list.filter((t) => t.id !== id);
  writeCustomTemplates(next);
}

// ---------------------------------------------------------------------------
// Recently-used queue (LRU, MRU-first, max 5, dedupes)
// ---------------------------------------------------------------------------

export function loadRecentTemplateIds(): ReadonlyArray<string> {
  const raw = readJson<unknown>(RECENT_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX);
}

export function pushRecentTemplate(id: string): void {
  const current = loadRecentTemplateIds();
  const filtered = current.filter((x) => x !== id);
  const next = [id, ...filtered].slice(0, RECENT_MAX);
  writeJson(RECENT_KEY, next);
}

export function clearRecentTemplates(): void {
  writeJson(RECENT_KEY, []);
}
