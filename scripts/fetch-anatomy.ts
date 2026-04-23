/**
 * Secondary strategy: fetch raw anatomical SVG sources from public domains
 * (Wikimedia Commons). These are stored in `scripts/.raw/` and later consumed
 * by `tag-anatomy.ts` for best-effort ID assignment.
 *
 * The PRIMARY pipeline is `author-le-svgs.ts`. This script exists so we have
 * a paper trail if/when we want to re-trace from a public-domain base image.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Source {
  name: string;
  url: string;
  license: string;
  attribution: string;
}

const SOURCES: Source[] = [
  {
    name: 'venous-system-en.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Venous_system_en.svg',
    license: 'CC-BY-SA-3.0',
    attribution: 'Mikael Häggström, via Wikimedia Commons',
  },
];

async function fetchOne(src: Source, outDir: string): Promise<boolean> {
  try {
    console.log(`[fetch] GET ${src.url}`);
    const res = await fetch(src.url, {
      headers: {
        // Wikimedia requires a descriptive UA
        'User-Agent':
          'medimind-angio-anatomy-fetch/0.1 (contact: team@medimind.md) node/' + process.version,
        Accept: 'image/svg+xml,text/xml,*/*',
      },
    });
    if (!res.ok) {
      console.warn(`[fetch] ${src.name}: HTTP ${res.status} ${res.statusText}`);
      return false;
    }
    const body = await res.text();
    if (!body.includes('<svg')) {
      console.warn(`[fetch] ${src.name}: response did not contain <svg — skipping`);
      return false;
    }
    const outPath = resolve(outDir, src.name);
    writeFileSync(outPath, body, 'utf8');
    const metaPath = resolve(outDir, `${src.name}.license.json`);
    writeFileSync(
      metaPath,
      JSON.stringify(
        { source_url: src.url, license: src.license, attribution: src.attribution },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(`[fetch] wrote ${outPath} (${body.length} bytes)`);
    return true;
  } catch (err) {
    console.warn(`[fetch] ${src.name}: ${(err as Error).message}`);
    return false;
  }
}

async function main(): Promise<void> {
  const outDir = resolve(process.cwd(), 'scripts/.raw');
  mkdirSync(outDir, { recursive: true });

  const results = await Promise.all(SOURCES.map((src) => fetchOne(src, outDir)));
  const ok = results.filter(Boolean).length;
  console.log(`[fetch] complete: ${ok}/${SOURCES.length} sources downloaded`);
  // Non-zero exit only if ALL failed — a single success is useful
  if (ok === 0) {
    console.warn(
      '[fetch] no sources downloaded; anatomy pipeline will rely on author-le-svgs.ts only',
    );
    // Still exit 0 — the primary path (authored SVGs) doesn't need raw sources.
  }
}

main().catch((err) => {
  console.error('[fetch] fatal:', err);
  process.exit(1);
});
