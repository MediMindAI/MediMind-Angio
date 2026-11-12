// SPDX-License-Identifier: Apache-2.0
/**
 * UX-ANGIO-021 — stylesheet order guard. `import App` evaluates every
 * component CSS module; Mantine's CSS must load BEFORE it, otherwise
 * Mantine's equal-specificity rules beat the EMR wrapper classes (every
 * secondary/ghost/danger EMRButton rendered solid navy). theme.css and
 * print.css stay AFTER App so theme overrides keep winning.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom: import.meta.url is about:blank — resolve from the repo root (as theme.test.ts does).
const src = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
const lineOf = (needle: string): number => src.split('\n').findIndex((l) => l.includes(needle));

describe('main.tsx stylesheet order', () => {
  const app = lineOf("import App from './App'");

  it.each(['@mantine/core/styles.css', '@mantine/dates/styles.css', '@mantine/notifications/styles.css'])(
    '%s loads before App',
    (sheet) => {
      expect(lineOf(sheet)).toBeGreaterThan(-1);
      expect(lineOf(sheet)).toBeLessThan(app);
    },
  );

  it.each(['./styles/theme.css', './styles/print.css'])('%s loads after App', (sheet) => {
    expect(lineOf(sheet)).toBeGreaterThan(app);
  });
});
