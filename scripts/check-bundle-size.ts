// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.2 — bundle-size gate.
 *
 * Asserts the production build keeps the PDF rendering library out of
 * the main entry chunk, so the first page-load doesn't pull 1.4 MB of
 * `@react-pdf/renderer` for users who never click "Download PDF".
 *
 * Two invariants:
 *   1. There is at least one chunk file matching `pdf-*.js` in
 *      `dist/assets/` (i.e. the lazy import in `FormActions.renderPdfBlob`
 *      actually splits @react-pdf/renderer into its own chunk).
 *   2. The main entry chunk (`index-*.js`) is under MAIN_CHUNK_LIMIT_KB.
 *
 * Usage:
 *   npm run build && npx tsx scripts/check-bundle-size.ts
 *
 * Exits with code 1 on failure so CI can fail the build.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');
const MAIN_CHUNK_LIMIT_KB = 700;
const PDF_CHUNK_PREFIX = 'pdf-';
const MAIN_CHUNK_PREFIX = 'index-';

interface ChunkInfo {
  readonly name: string;
  readonly sizeKb: number;
}

function listChunks(prefix: string): ReadonlyArray<ChunkInfo> {
  let entries: ReadonlyArray<string>;
  try {
    entries = readdirSync(ASSETS_DIR);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[check-bundle-size] Cannot read ${ASSETS_DIR}. Did you run \`npm run build\` first?`,
    );
    throw err;
  }
  return entries
    .filter((n) => n.startsWith(prefix) && n.endsWith('.js'))
    .map((name) => {
      const sizeBytes = statSync(join(ASSETS_DIR, name)).size;
      return { name, sizeKb: sizeBytes / 1024 };
    });
}

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`[check-bundle-size] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[check-bundle-size] OK: ${msg}`);
}

const pdfChunks = listChunks(PDF_CHUNK_PREFIX);
if (pdfChunks.length === 0) {
  fail(
    `No chunk found matching \`${PDF_CHUNK_PREFIX}*.js\` in dist/assets. ` +
      `This means @react-pdf/renderer is bundled into the main entry — ` +
      `the lazy import in FormActions.renderPdfBlob is broken.`,
  );
}
ok(
  `pdf chunk separated: ${pdfChunks
    .map((c) => `${c.name} (${c.sizeKb.toFixed(1)} KB)`)
    .join(', ')}`,
);

const mainChunks = listChunks(MAIN_CHUNK_PREFIX);
if (mainChunks.length === 0) {
  fail(`No main entry chunk \`${MAIN_CHUNK_PREFIX}*.js\` found.`);
}
const mainChunk = mainChunks[0];
if (!mainChunk) {
  fail(`No main entry chunk found.`);
}
if (mainChunk.sizeKb > MAIN_CHUNK_LIMIT_KB) {
  fail(
    `Main chunk ${mainChunk.name} = ${mainChunk.sizeKb.toFixed(1)} KB ` +
      `exceeds the ${MAIN_CHUNK_LIMIT_KB} KB limit. Investigate with ` +
      `\`npx vite-bundle-visualizer\` or check the rollup output for ` +
      `recently-added eager imports.`,
  );
}
ok(
  `main chunk ${mainChunk.name} = ${mainChunk.sizeKb.toFixed(1)} KB ` +
    `(< ${MAIN_CHUNK_LIMIT_KB} KB limit)`,
);

// eslint-disable-next-line no-console
console.log('[check-bundle-size] all gates pass');
