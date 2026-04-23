/**
 * Build-time verification: every SVG in `public/anatomy/` must contain all
 * expected segment IDs from `segment-catalog.ts`. Exits 1 if any are missing.
 *
 * Usage: `npx tsx scripts/verify-anatomy.ts`
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';

import { expectedIdsForView } from './segment-catalog.js';

type ViewName = 'le-anterior' | 'le-posterior';

interface ViewCheck {
  view: ViewName;
  svgPath: string;
  expected: string[];
  found: string[];
  missing: string[];
  extras: string[];
  fileExists: boolean;
}

const VIEWS: Array<{ view: ViewName; file: string }> = [
  { view: 'le-anterior', file: 'le-anterior.svg' },
  { view: 'le-posterior', file: 'le-posterior.svg' },
];

function collectPathIds(svgXml: string): string[] {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(
    svgXml,
    'image/svg+xml',
  );
  const ids: string[] = [];
  // Walk every element — id may live on <path>, <circle>, <g>, etc.
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all.item(i);
    if (!el) continue;
    const node = el as unknown as { getAttribute: (n: string) => string | null };
    const id = node.getAttribute('id');
    if (id) ids.push(id);
  }
  return ids;
}

function checkView(anatomyDir: string, spec: { view: ViewName; file: string }): ViewCheck {
  const svgPath = resolve(anatomyDir, spec.file);
  const expected = expectedIdsForView(spec.view);
  if (!existsSync(svgPath)) {
    return {
      view: spec.view,
      svgPath,
      expected,
      found: [],
      missing: expected.slice(),
      extras: [],
      fileExists: false,
    };
  }
  const xml = readFileSync(svgPath, 'utf8');
  const ids = new Set(collectPathIds(xml));
  const found = expected.filter((id) => ids.has(id));
  const missing = expected.filter((id) => !ids.has(id));
  const extras = [...ids].filter(
    (id) => !expected.includes(id) && !['segments', 'silhouette', 'pelvis-hint', 'side-labels'].includes(id) && !id.startsWith('title-'),
  );
  return {
    view: spec.view,
    svgPath,
    expected,
    found,
    missing,
    extras,
    fileExists: true,
  };
}

function formatReport(checks: ViewCheck[]): { ok: boolean; report: string } {
  const lines: string[] = [];
  let ok = true;
  for (const c of checks) {
    lines.push('');
    lines.push(`=== ${c.view} ===`);
    lines.push(`  file: ${c.svgPath}`);
    if (!c.fileExists) {
      ok = false;
      lines.push(`  ERROR: file missing — run \`npm run anatomy:tag\` first`);
      continue;
    }
    lines.push(`  coverage: ${c.found.length}/${c.expected.length}`);
    if (c.missing.length > 0) {
      ok = false;
      lines.push(`  MISSING (${c.missing.length}):`);
      for (const id of c.missing) lines.push(`    - ${id}`);
    } else {
      lines.push(`  all expected IDs present`);
    }
    if (c.extras.length > 0) {
      lines.push(`  extras (not in expected list, harmless): ${c.extras.join(', ')}`);
    }
  }
  return { ok, report: lines.join('\n') };
}

function main(): void {
  const anatomyDir = resolve(process.cwd(), 'public/anatomy');
  const checks = VIEWS.map((spec) => checkView(anatomyDir, spec));
  const { ok, report } = formatReport(checks);
  console.log(report);
  console.log('');
  if (ok) {
    console.log('[verify] OK — all views fully tagged.');
    process.exit(0);
  }
  console.error('[verify] FAILED — anatomy coverage incomplete.');
  process.exit(1);
}

main();
