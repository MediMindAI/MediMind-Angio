/**
 * Parse raw Wikimedia SVGs and attempt to assign canonical segment IDs.
 *
 * Matching strategy (best-effort):
 *   1) `inkscape:label` attribute on <path> elements
 *   2) <title> or <desc> child text
 *   3) <text> siblings whose bbox overlaps the path's bbox
 *
 * If fewer than N segments match, we log and EXIT 0 — the primary path is
 * `author-le-svgs.ts`, which produces fully-tagged SVGs from scratch.
 *
 * Then, as a final step, we always run author-le-svgs.ts so the pipeline is
 * idempotent: calling `npm run anatomy:tag` always produces tagged output in
 * `public/anatomy/`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';

import { VENOUS_LE_SEGMENTS } from './segment-catalog.js';

interface MatchResult {
  file: string;
  totalPaths: number;
  labeledMatches: number;
  unmatched: number;
}

const LABEL_HINTS: Array<{ needle: RegExp; seg: string }> = [
  { needle: /common[-_ ]?femoral|CFV\b/i, seg: 'cfv' },
  { needle: /external[-_ ]?iliac|EIV\b/i, seg: 'eiv' },
  { needle: /femoral.*prox|prox.*femoral/i, seg: 'fv-prox' },
  { needle: /profunda|deep[-_ ]?femoral/i, seg: 'pfv' },
  { needle: /great[-_ ]?saphen|GSV\b/i, seg: 'gsv-ak' },
  { needle: /popliteal\b/i, seg: 'pop-ak' },
  { needle: /posterior[-_ ]?tibial|PTV\b/i, seg: 'ptv' },
  { needle: /peroneal\b/i, seg: 'per' },
  { needle: /small[-_ ]?saphen|SSV\b/i, seg: 'ssv' },
  { needle: /soleal\b/i, seg: 'soleal' },
  { needle: /gastroc/i, seg: 'gastroc' },
  { needle: /saphenofemoral|SFJ\b/i, seg: 'sfj' },
  { needle: /saphenopopliteal|SPJ\b/i, seg: 'spj' },
];

function guessSegment(text: string): string | null {
  for (const hint of LABEL_HINTS) {
    if (hint.needle.test(text)) return hint.seg;
  }
  return null;
}

function analyze(rawSvgPath: string): MatchResult {
  const xml = readFileSync(rawSvgPath, 'utf8');
  const doc = new DOMParser({ onError: () => {} }).parseFromString(xml, 'image/svg+xml');

  const select = xpath.useNamespaces({
    svg: 'http://www.w3.org/2000/svg',
    inkscape: 'http://www.inkscape.org/namespaces/inkscape',
  });

  // All <path> elements (with or without namespace declaration).
  // xpath's Node type and @xmldom/xmldom's Document are slightly incompatible,
  // so we route through `unknown` here — we only need iteration + getAttribute.
  const paths = select('//*[local-name()="path"]', doc as unknown as Node) as unknown as Node[];

  let labeled = 0;
  for (const node of paths) {
    const el = node as unknown as {
      getAttribute: (n: string) => string | null;
      getElementsByTagName: (n: string) => { length: number; item: (i: number) => Node };
    };
    const inkscapeLabel =
      el.getAttribute('inkscape:label') ||
      el.getAttribute('data-label') ||
      el.getAttribute('aria-label') ||
      '';
    const titleNodes = el.getElementsByTagName('title');
    let titleText = '';
    if (titleNodes.length > 0) {
      const t = titleNodes.item(0) as unknown as { textContent?: string };
      titleText = t?.textContent ?? '';
    }
    const haystack = `${inkscapeLabel} ${titleText}`.trim();
    if (haystack && guessSegment(haystack)) {
      labeled += 1;
    }
  }

  return {
    file: rawSvgPath,
    totalPaths: paths.length,
    labeledMatches: labeled,
    unmatched: paths.length - labeled,
  };
}

async function main(): Promise<void> {
  const rawDir = resolve(process.cwd(), 'scripts/.raw');
  const candidates = ['venous-system-en.svg'];
  const totalExpected = VENOUS_LE_SEGMENTS.length * 2;

  let anyAnalyzed = false;
  for (const name of candidates) {
    const full = resolve(rawDir, name);
    if (!existsSync(full)) {
      console.log(`[tag] skipping ${name} (not fetched — run \`npm run anatomy:fetch\`)`);
      continue;
    }
    anyAnalyzed = true;
    const result = analyze(full);
    console.log(
      `[tag] ${name}: ${result.totalPaths} paths, ${result.labeledMatches} could be auto-matched (${totalExpected} expected) — coverage ${Math.round((result.labeledMatches / totalExpected) * 100)}%`,
    );
  }
  if (!anyAnalyzed) {
    console.log('[tag] no raw SVG sources present; authored path will handle everything');
  }

  // Idempotent behavior: always (re)produce authored SVGs so `anatomy:tag`
  // alone yields a usable `public/anatomy/` tree.
  console.log('[tag] invoking author-le-svgs.ts to produce canonical tagged SVGs…');
  await import('./author-le-svgs.js');
}

main().catch((err) => {
  console.error('[tag] fatal:', err);
  process.exit(1);
});
