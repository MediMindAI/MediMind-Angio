#!/usr/bin/env npx tsx
// SPDX-License-Identifier: Apache-2.0
/**
 * check-i18n — CLI parity checker for the ka / en / ru translation namespaces.
 *
 * Verifies every namespace (core + per-study + ceap) has identical dotted-key
 * sets across all three locales. Exits non-zero (and prints the offending
 * keys) on any drift, so it can gate CI / pre-commit. Mirrors the assertions
 * in src/translations/i18n.test.ts; run via `npm run i18n:check`.
 *
 * Second pass (UX-ANGIO-020 / U-1004): every literal `t('some.key')` in
 * src/** must exist in the merged ka locale. Parity alone let keys that were
 * missing from ALL three locales ship, so the Georgian UI printed the English
 * fallback. Static keys only — template keys (`t(`a.${x}`)`) are skipped, as
 * is a call whose fallback is itself a `t(…)` (an optional override key that
 * already resolves to a translated string). Comments and *.test.* files are
 * ignored. `src/components/common/` and `src/components/shared/` hold the
 * MediMind wrapper library ported as-is; most of it is never rendered in
 * angio, so misses there are reported as a warning count, not a failure.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import enCore from '../src/translations/en.json';
import kaCore from '../src/translations/ka.json';
import ruCore from '../src/translations/ru.json';
import enArterial from '../src/translations/arterial-le/en.json';
import kaArterial from '../src/translations/arterial-le/ka.json';
import ruArterial from '../src/translations/arterial-le/ru.json';
import enCarotid from '../src/translations/carotid/en.json';
import kaCarotid from '../src/translations/carotid/ka.json';
import ruCarotid from '../src/translations/carotid/ru.json';
import enCeap from '../src/translations/ceap/en.json';
import kaCeap from '../src/translations/ceap/ka.json';
import ruCeap from '../src/translations/ceap/ru.json';
import enVenous from '../src/translations/venous-le/en.json';
import kaVenous from '../src/translations/venous-le/ka.json';
import ruVenous from '../src/translations/venous-le/ru.json';
import enIliac from '../src/translations/iliac-pelvic-venous/en.json';
import kaIliac from '../src/translations/iliac-pelvic-venous/ka.json';
import ruIliac from '../src/translations/iliac-pelvic-venous/ru.json';
import enSvp from '../src/translations/svp/en.json';
import kaSvp from '../src/translations/svp/ka.json';
import ruSvp from '../src/translations/svp/ru.json';

/** Recursively flatten a nested translation object into sorted dotted paths. */
function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

interface Namespace {
  readonly name: string;
  readonly en: unknown;
  readonly ka: unknown;
  readonly ru: unknown;
}

const NAMESPACES: ReadonlyArray<Namespace> = [
  { name: 'core', en: enCore, ka: kaCore, ru: ruCore },
  { name: 'arterial-le', en: enArterial, ka: kaArterial, ru: ruArterial },
  { name: 'carotid', en: enCarotid, ka: kaCarotid, ru: ruCarotid },
  { name: 'ceap', en: enCeap, ka: kaCeap, ru: ruCeap },
  { name: 'venous-le', en: enVenous, ka: kaVenous, ru: ruVenous },
  { name: 'iliac-pelvic-venous', en: enIliac, ka: kaIliac, ru: ruIliac },
  { name: 'svp', en: enSvp, ka: kaSvp, ru: ruSvp },
];

function diff(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((k) => !setB.has(k));
}

let failed = false;

for (const ns of NAMESPACES) {
  const en = flatten(ns.en);
  const ka = flatten(ns.ka);
  const ru = flatten(ns.ru);

  const problems: string[] = [];
  const missingKa = diff(en, ka);
  const missingRu = diff(en, ru);
  const extraKa = diff(ka, en);
  const extraRu = diff(ru, en);

  if (missingKa.length) problems.push(`  ka missing ${missingKa.length}: ${missingKa.join(', ')}`);
  if (missingRu.length) problems.push(`  ru missing ${missingRu.length}: ${missingRu.join(', ')}`);
  if (extraKa.length) problems.push(`  ka extra ${extraKa.length}: ${extraKa.join(', ')}`);
  if (extraRu.length) problems.push(`  ru extra ${extraRu.length}: ${extraRu.join(', ')}`);

  if (problems.length) {
    failed = true;
    console.error(`✗ [${ns.name}] key-set mismatch (en has ${en.length} keys):`);
    for (const p of problems) console.error(p);
  } else {
    console.log(`✓ [${ns.name}] ${en.length} keys — en/ka/ru in parity`);
  }
}

if (failed) {
  console.error('\ni18n parity check FAILED — back-fill the missing/extra keys above.');
  process.exit(1);
}

console.log('\nAll namespaces in en/ka/ru parity.');

// ---------------------------------------------------------------------------
// Pass 2: keys referenced in src/** but defined in no locale.
// ---------------------------------------------------------------------------

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const WRAPPER_LIBRARY = ['components/common/', 'components/shared/'];
// t( + quoted static key; the lookahead skips calls whose fallback is t(…).
const T_CALL = /\bt\(\s*(['"`])([\w.-]+)\1(?!\s*,\s*t\()/g;

const kaKeys = new Set(NAMESPACES.flatMap((ns) => flatten(ns.ka)));
const isDefined = (key: string): boolean =>
  kaKeys.has(key) || kaKeys.has(`${key}_one`) || kaKeys.has(`${key}_other`);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const missing = new Map<string, string[]>();
const wrapperMissing = new Set<string>();
for (const file of sourceFiles(SRC)) {
  const rel = relative(SRC, file);
  // Blank out comments (keeping line numbers) so JSDoc examples don't count.
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
  for (const m of code.matchAll(T_CALL)) {
    const key = m[2]!;
    if (isDefined(key)) continue;
    if (WRAPPER_LIBRARY.some((dir) => rel.startsWith(dir))) {
      wrapperMissing.add(key);
      continue;
    }
    const line = code.slice(0, m.index).split('\n').length;
    missing.set(key, [...(missing.get(key) ?? []), `${rel}:${line}`]);
  }
}

if (wrapperMissing.size) {
  console.warn(
    `\n⚠ ${wrapperMissing.size} keys used only by the ported wrapper library (${WRAPPER_LIBRARY.join(', ')}) are not in any locale — add them when a wrapper goes into use.`,
  );
}

if (missing.size) {
  console.error(`\n✗ ${missing.size} keys used in src/ are defined in no locale:`);
  for (const [key, where] of missing) console.error(`  ${key}  (${where.join(', ')})`);
  console.error('\ni18n usage check FAILED — add the keys above to ka/en/ru.');
  process.exit(1);
}

console.log('All static t() keys used in src/ exist in the locales.');
