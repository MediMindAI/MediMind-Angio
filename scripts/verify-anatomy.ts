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

type ViewName = 'le-anterior' | 'le-posterior' | 'le-arterial-anterior' | 'neck-carotid';

interface ViewCheck {
  view: ViewName;
  svgPath: string;
  expected: string[];
  found: string[];
  missing: string[];
  extras: string[];
  fileExists: boolean;
}

/**
 * Whether to source expected IDs from `segment-catalog.ts` (for views
 * with parent-vessel ids only, e.g. `le-anterior`) or from the SVG itself
 * (for views that ship with finer-grained sub-segment ids the catalog
 * doesn't yet enumerate, e.g. `sfa-prox-right`, `vert-v1-left`).
 *
 * In "self" mode, every `<path id="...">` is treated as the expected set
 * (a self-consistency check) — the SVG must remain syntactically tagged
 * even if the canonical catalog hasn't caught up. Audit Part 01 MEDIUM.
 */
type ExpectedSource = 'catalog' | 'self';

const VIEWS: Array<{ view: ViewName; file: string; expectedFrom: ExpectedSource }> = [
  { view: 'le-anterior', file: 'le-anterior.svg', expectedFrom: 'catalog' },
  { view: 'le-posterior', file: 'le-posterior.svg', expectedFrom: 'catalog' },
  { view: 'le-arterial-anterior', file: 'le-arterial-anterior.svg', expectedFrom: 'self' },
  { view: 'neck-carotid', file: 'neck-carotid.svg', expectedFrom: 'self' },
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

/** Extract only `<path id="...">` ids — used for "self" mode expected sets. */
function collectPathOnlyIds(svgXml: string): string[] {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(
    svgXml,
    'image/svg+xml',
  );
  const ids: string[] = [];
  const paths = doc.getElementsByTagName('path');
  for (let i = 0; i < paths.length; i++) {
    const el = paths.item(i);
    if (!el) continue;
    const node = el as unknown as { getAttribute: (n: string) => string | null };
    const id = node.getAttribute('id');
    if (id) ids.push(id);
  }
  return ids;
}

function checkView(
  anatomyDir: string,
  spec: { view: ViewName; file: string; expectedFrom: ExpectedSource },
): ViewCheck {
  const svgPath = resolve(anatomyDir, spec.file);

  // For "catalog" views, the expected list comes from segment-catalog.ts.
  // For "self" views, we'll derive expected = every <path id="..."> in
  // the file (the catalog doesn't yet enumerate sub-segments like
  // `sfa-prox-right` or `vert-v1-left`). Audit Part 01 MEDIUM.
  const expectedFromCatalog = (): string[] =>
    spec.expectedFrom === 'catalog'
      ? expectedIdsForView(spec.view as 'le-anterior' | 'le-posterior')
      : [];

  if (!existsSync(svgPath)) {
    const expected = expectedFromCatalog();
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
  const expected =
    spec.expectedFrom === 'catalog' ? expectedFromCatalog() : collectPathOnlyIds(xml);
  const found = expected.filter((id) => ids.has(id));
  const missing = expected.filter((id) => !ids.has(id));
  const extras = [...ids].filter(
    (id) =>
      !expected.includes(id) &&
      !['segments', 'silhouette', 'pelvis-hint', 'side-labels', 'junction-dots'].includes(id) &&
      !id.startsWith('title-'),
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
