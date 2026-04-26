// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.2 (Pattern G) — schemaVersion runtime guards on draft hydration.
 *
 * Audit Part 03 MEDIUM (no schemaVersion) + Part 10 HIGH (arterial + carotid
 * hydrate without check):
 *
 * Each per-study form keeps state in a `*FormStateV{N}` interface. The
 * `V{N}` lives in the NAME only — without a runtime field a release that
 * bumps the state shape (rename, add required field, change findings
 * shape) would silently hydrate yesterday's draft as the new shape and
 * either crash on missing-field access or silently render wrong data
 * (renamed enum, dropped field).
 *
 * The fix (Wave 3.2):
 *   1. Add `readonly schemaVersion: <N>` to each form-state interface.
 *   2. Seed that exact value in each form's `initialState()` /
 *      `INITIAL_STATE`.
 *   3. In each hydration path (whether `loadDraft<...>` or a custom type
 *      guard like `isHydratableXxxState`), validate
 *      `draft.schemaVersion === <N> && draft.studyType === <expected>`
 *      before hydrating. On mismatch, fall back to fresh initial state.
 *
 * Phase 3b (encounter pivot) bumps arterial + carotid to V2 because the
 * shape now drops `header` (encounter context owns it) and adds
 * per-study scalars. Venous bumps to V2 alongside.
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
 * Per-form expectations. The Wave 3.2 invariant is "interface, initial
 * state, and hydration guard all agree on the same schemaVersion". This
 * suite no longer hardcodes the version number — it discovers the
 * declared version from the form-state interface and asserts the rest of
 * the file (initialState seed + hydration guard) matches.
 *
 * That makes the suite robust to legitimate schema bumps (Phase 3b
 * raised arterial + carotid from V1 to V2 because dropping `header`
 * changed the persisted shape; venous follows independently).
 */
interface FormSchemaExpectation {
  readonly path: string;
  /** A regex that must match the form-state interface declaration. */
  readonly interfacePattern: RegExp;
  readonly studyTypeLiteral: string;
}

const FORMS: ReadonlyArray<FormSchemaExpectation> = [
  {
    path: './venous-le/VenousLEForm.tsx',
    interfacePattern: /interface\s+(VenousFormStateV\d+)\b/,
    studyTypeLiteral: 'venousLEBilateral',
  },
  {
    path: './arterial-le/ArterialLEForm.tsx',
    interfacePattern: /interface\s+(ArterialFormStateV\d+)\b/,
    studyTypeLiteral: 'arterialLE',
  },
  {
    path: './carotid/CarotidForm.tsx',
    interfacePattern: /interface\s+(CarotidFormStateV\d+)\b/,
    studyTypeLiteral: 'carotid',
  },
];

/**
 * Discover the declared schemaVersion for a form by looking inside its
 * state interface body. Returns the matched interface name + numeric
 * version so dependent assertions can verify cross-file consistency.
 */
function discoverSchema(src: string, interfacePattern: RegExp): { interfaceName: string; version: number } {
  const ifaceMatch = src.match(interfacePattern);
  if (!ifaceMatch || !ifaceMatch[1]) {
    throw new Error(`expected matching interface for ${interfacePattern}`);
  }
  const interfaceName = ifaceMatch[1];
  // Extract the body of that interface and pull the schemaVersion literal.
  const bodyRe = new RegExp(
    `interface\\s+${interfaceName}[^\\{]*\\{([\\s\\S]*?)\\n\\}`,
  );
  const bodyMatch = src.match(bodyRe);
  if (!bodyMatch || !bodyMatch[1]) {
    throw new Error(`expected interface body for ${interfaceName}`);
  }
  const versionMatch = bodyMatch[1].match(/schemaVersion\s*:\s*(\d+)\s*;/);
  if (!versionMatch || !versionMatch[1]) {
    throw new Error(`expected schemaVersion: <N>; in ${interfaceName}`);
  }
  return { interfaceName, version: Number(versionMatch[1]) };
}

describe('Wave 3.2 — form-state interfaces declare schemaVersion', () => {
  for (const f of FORMS) {
    it(`${f.path} declares a schemaVersion field`, () => {
      const src = readForm(f.path);
      const { version } = discoverSchema(src, f.interfacePattern);
      expect(Number.isFinite(version) && version >= 1, 'schemaVersion must be a positive integer').toBe(true);
    });
  }
});

describe('Wave 3.2 — initialState seeds the same schemaVersion', () => {
  for (const f of FORMS) {
    it(`${f.path} seeds the interface's schemaVersion in its initial state`, () => {
      const src = readForm(f.path);
      const { interfaceName, version } = discoverSchema(src, f.interfacePattern);
      // Allow either `function initialState(): X { ... return { schemaVersion: N, ...`
      // OR `const INITIAL_STATE: X = { schemaVersion: N, ...` (venous-LE pattern).
      const fnRe = new RegExp(
        `function\\s+initialState\\s*\\(\\)\\s*:\\s*${interfaceName}\\s*\\{[\\s\\S]*?return\\s*\\{\\s*schemaVersion\\s*:\\s*${version}\\s*,`,
      );
      const constRe = new RegExp(
        `const\\s+INITIAL_STATE\\s*:\\s*${interfaceName}\\s*=\\s*\\{\\s*schemaVersion\\s*:\\s*${version}\\s*,`,
      );
      const matches = fnRe.test(src) || constRe.test(src);
      expect(matches, `expected initialState seed of schemaVersion ${version} in ${f.path}`).toBe(true);
    });
  }
});

describe('Wave 3.2 — hydration paths validate schemaVersion + studyType', () => {
  for (const f of FORMS) {
    it(`${f.path} guards both schemaVersion and studyType before hydrating`, () => {
      const src = readForm(f.path);
      const { version } = discoverSchema(src, f.interfacePattern);
      // Phase 3b allows two shapes: the legacy inline `schemaVersion === N`
      // check inside a `loadDraft<...>(...)` initializer, OR a dedicated
      // `isHydratable...State` type guard. Either pattern is acceptable as
      // long as both invariants are enforced somewhere in the file.
      const versionRe = new RegExp(`schemaVersion\\s*===\\s*${version}\\b`);
      const studyRe = new RegExp(`studyType\\s*===\\s*['"]${f.studyTypeLiteral}['"]`);
      expect(src, `expected schemaVersion === ${version} guard in ${f.path}`).toMatch(versionRe);
      expect(src, `expected studyType === '${f.studyTypeLiteral}' guard in ${f.path}`).toMatch(studyRe);
    });
  }
});
