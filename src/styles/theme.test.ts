// SPDX-License-Identifier: Apache-2.0
/**
 * Theme token guard — ensures every CSS custom property referenced by
 * component module.css files is actually defined in theme.css.
 *
 * Why: prior to Wave 4.4 we had `--emr-border-radius-md` referenced in
 * 5+ modules but never defined (silent sharp corners), and
 * `--emr-info-light` defined as forbidden Chakra blue (#63b3ed) — a
 * landmine waiting for someone to use it. This test fails fast when
 * either side of the contract drifts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Paths resolved from cwd (vitest runs from repo root). jsdom's
// `import.meta.url` is about:blank, so we cannot derive paths from it.
const repoRoot = process.cwd();
const themeCssPath = join(repoRoot, 'src', 'styles', 'theme.css');
const componentsRoot = join(repoRoot, 'src', 'components');

function readThemeCss(): string {
  return readFileSync(themeCssPath, 'utf-8');
}

/** Walk a directory recursively, returning all *.module.css absolute paths. */
function walkModuleCss(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkModuleCss(full));
    } else if (entry.endsWith('.module.css')) {
      out.push(full);
    }
  }
  return out;
}

/** Collect every distinct --emr-* variable definition in theme.css. */
function collectDefinedVars(themeCss: string): Set<string> {
  const defined = new Set<string>();
  const re = /^\s*(--emr-[a-z0-9-]+)\s*:/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(themeCss)) !== null) {
    const name = m[1];
    if (name) defined.add(name);
  }
  return defined;
}

/** Collect every distinct --emr-* variable referenced in module.css files. */
function collectReferencedVars(): Set<string> {
  const referenced = new Set<string>();
  const re = /var\((--emr-[a-z0-9-]+)/g;
  for (const path of walkModuleCss(componentsRoot)) {
    const css = readFileSync(path, 'utf-8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const name = m[1];
      if (name) referenced.add(name);
    }
  }
  return referenced;
}

describe('theme.css token coverage (Wave 4.4)', () => {
  it('defines --emr-border-radius-md, --emr-line-height-normal', () => {
    const theme = readThemeCss();
    const defined = collectDefinedVars(theme);
    expect(defined.has('--emr-border-radius-md')).toBe(true);
    expect(defined.has('--emr-line-height-normal')).toBe(true);
  });

  it('--emr-info-light does not use forbidden Chakra blue (#63b3ed)', () => {
    const theme = readThemeCss();
    const m = /--emr-info-light\s*:\s*([^;]+);/i.exec(theme);
    expect(m).not.toBeNull();
    const value = (m?.[1] ?? '').trim().toLowerCase();
    expect(value).not.toBe('#63b3ed');
  });

  it('every --emr-* variable referenced in component module.css is defined in theme.css', () => {
    const theme = readThemeCss();
    const defined = collectDefinedVars(theme);
    const referenced = collectReferencedVars();
    const undef = [...referenced].filter((v) => !defined.has(v)).sort();
    expect(undef).toEqual([]);
  });
});
