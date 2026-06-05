#!/usr/bin/env npx tsx
// SPDX-License-Identifier: Apache-2.0
/**
 * check-i18n — CLI parity checker for the ka / en / ru translation namespaces.
 *
 * Verifies every namespace (core + per-study + ceap) has identical dotted-key
 * sets across all three locales. Exits non-zero (and prints the offending
 * keys) on any drift, so it can gate CI / pre-commit. Mirrors the assertions
 * in src/translations/i18n.test.ts; run via `npm run i18n:check`.
 */

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
