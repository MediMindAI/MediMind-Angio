// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.2 (Pattern G) — schemaVersion runtime guards on draft hydration.
 *
 * Audit Part 03 MEDIUM (no schemaVersion) + Part 10 HIGH (arterial + carotid
 * hydrate without check):
 *
 * Each per-study form keeps state in a `*FormStateV1` interface. The `V1`
 * lives in the NAME only — there is no `schemaVersion: 1` runtime field. So
 * after any code release that bumps the state shape (rename, add required
 * field, change findings shape), yesterday's persisted draft will hydrate as
 * the new shape and either crash on missing-field access or silently render
 * wrong data (renamed enum, dropped field).
 *
 * Pre-Wave-3.2 status:
 *   - Venous form had a partial check (`studyType === 'venousLEBilateral'`).
 *   - Arterial + carotid forms had no check at all (`persisted ?? initialState()`).
 *
 * The fix (Wave 3.2):
 *   1. Add `readonly schemaVersion: 1` to each `*FormStateV1` interface.
 *   2. Set `schemaVersion: 1` in each `initialState()` / `INITIAL_STATE`.
 *   3. In each `loadDraft` initializer, validate
 *      `draft.schemaVersion === 1 && draft.studyType === <expected>` before
 *      hydrating. On mismatch, fall back to fresh initial state.
 *
 * These tests are static-source guards (matching Wave 3.1 pattern) rather
 * than full-form-render integration tests because:
 *   - The per-form state interfaces and reducers are intentionally
 *     module-private (no `export` keyword).
 *   - Full-form rendering pulls a heavy dependency tree (Mantine providers,
 *     i18n bootstrap, study plugin registry, anatomy SVG loader) that
 *     existing reducer-level tests in this repo also intentionally avoid.
 *   - The static guards are the same shape Wave 3.1 used to enforce its
 *     reducer invariant, so this file stays consistent with that precedent.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function readForm(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

/**
 * Extract the body of the loadDraft initializer block from a form source.
 * Returns the substring from the first occurrence of `loadDraft<` up to the
 * next `useAutoSave` token (which always immediately follows the hydrate
 * block in all 3 forms).
 */
function loadDraftInitializerBody(source: string): string {
  const start = source.indexOf('loadDraft<');
  expect(start, 'expected a loadDraft<...> call in form source').toBeGreaterThan(-1);
  const after = source.slice(start);
  const end = after.indexOf('useAutoSave');
  expect(end, 'expected useAutoSave to follow the hydrate block').toBeGreaterThan(-1);
  return after.slice(0, end);
}

describe('Wave 3.2 — *FormStateV1 interfaces declare schemaVersion: 1', () => {
  it('venous interface declares schemaVersion: 1', () => {
    const src = readForm('./venous-le/VenousLEForm.tsx');
    expect(src).toMatch(/interface VenousFormStateV1\s*\{[\s\S]*?schemaVersion\s*:\s*1\s*;/);
  });

  it('arterial interface declares schemaVersion: 1', () => {
    const src = readForm('./arterial-le/ArterialLEForm.tsx');
    expect(src).toMatch(/interface ArterialFormStateV1\s*\{[\s\S]*?schemaVersion\s*:\s*1\s*;/);
  });

  it('carotid interface declares schemaVersion: 1', () => {
    const src = readForm('./carotid/CarotidForm.tsx');
    expect(src).toMatch(/interface CarotidFormStateV1\s*\{[\s\S]*?schemaVersion\s*:\s*1\s*;/);
  });
});

describe('Wave 3.2 — initialState seeds schemaVersion: 1', () => {
  it('venous INITIAL_STATE seeds schemaVersion: 1', () => {
    const src = readForm('./venous-le/VenousLEForm.tsx');
    expect(src).toMatch(
      /const INITIAL_STATE:\s*VenousFormStateV1\s*=\s*\{\s*schemaVersion\s*:\s*1\s*,/,
    );
  });

  it('arterial initialState() seeds schemaVersion: 1', () => {
    const src = readForm('./arterial-le/ArterialLEForm.tsx');
    expect(src).toMatch(
      /function initialState\(\)\s*:\s*ArterialFormStateV1\s*\{[\s\S]*?return\s*\{\s*schemaVersion\s*:\s*1\s*,/,
    );
  });

  it('carotid initialState() seeds schemaVersion: 1', () => {
    const src = readForm('./carotid/CarotidForm.tsx');
    expect(src).toMatch(
      /function initialState\(\)\s*:\s*CarotidFormStateV1\s*\{[\s\S]*?return\s*\{\s*schemaVersion\s*:\s*1\s*,/,
    );
  });
});

describe('Wave 3.2 — loadDraft hydrate paths validate schemaVersion === 1', () => {
  it('venous hydrate path checks schemaVersion === 1', () => {
    const src = readForm('./venous-le/VenousLEForm.tsx');
    const body = loadDraftInitializerBody(src);
    expect(body).toMatch(/schemaVersion\s*===\s*1/);
    expect(body).toMatch(/studyType\s*===\s*['"]venousLEBilateral['"]/);
  });

  it('arterial hydrate path checks schemaVersion === 1 (Part 10 HIGH fix)', () => {
    const src = readForm('./arterial-le/ArterialLEForm.tsx');
    const body = loadDraftInitializerBody(src);
    expect(body).toMatch(/schemaVersion\s*===\s*1/);
    expect(body).toMatch(/studyType\s*===\s*['"]arterialLE['"]/);
  });

  it('carotid hydrate path checks schemaVersion === 1 (Part 10 HIGH fix)', () => {
    const src = readForm('./carotid/CarotidForm.tsx');
    const body = loadDraftInitializerBody(src);
    expect(body).toMatch(/schemaVersion\s*===\s*1/);
    expect(body).toMatch(/studyType\s*===\s*['"]carotid['"]/);
  });
});
