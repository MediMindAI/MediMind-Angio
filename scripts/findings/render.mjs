#!/usr/bin/env node
// Print a program's findings as one markdown table per status (ID · Demo/step · Type · What we saw · Better would be · Status).
//
//   node scripts/findings/render.mjs --program demo5
//   node scripts/findings/render.mjs --program demo5 --out documentation/level-up/runs/demo5-findings.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { currentRows, DEFAULT_DIR, programFile, readLines, SCHEMA } from './lib.mjs';

const TITLES = {
  open: 'Open',
  in_progress: 'In progress',
  fixed: 'Fixed, not yet re-walked',
  verified: 'Fixed and verified',
  decided: 'Decided',
  accepted: 'Accepted as-is',
};
const STATUS_WORDS = { in_progress: 'IN PROGRESS' };
const LOUD = new Set(['critical', 'high']);

function cell(text) {
  return String(text ?? '').replace(/\s*\n\s*/gu, ' ').replace(/\|/gu, '\\|').trim();
}

/** "BUG — OPEN (HIGH)", once closed "BUG — FIXED (was HIGH)": the same words the hand-made table uses. */
function typeCell(row) {
  const status = STATUS_WORDS[row.status] ?? row.status.toUpperCase();
  const closed = !['open', 'in_progress'].includes(row.status);
  const severity = LOUD.has(row.severity) ? ` (${closed ? 'was ' : ''}${row.severity.toUpperCase()})` : '';
  return `${row.kind} — ${status}${severity}`;
}

export function renderRow(row) {
  const status = row.status.replace('_', ' ');
  return `| ${[
    row.id,
    `${row.case} · ${row.step}`,
    typeCell(row),
    row.evidence,
    row.decision || 'open',
    `${status} (${row.owner})`,
  ]
    .map(cell)
    .join(' | ')} |`;
}

export function render(lines) {
  const rows = currentRows(lines);
  const blocks = [];
  for (const status of SCHEMA.properties.status.enum) {
    const group = rows.filter((row) => row.status === status);
    if (group.length) {
      blocks.push(
        [
          `### ${TITLES[status]} (${group.length})`,
          '',
          '| ID | Demo · step | Type | What we saw | Better would be | Status |',
          '|---|---|---|---|---|---|',
          ...group.map(renderRow),
        ].join('\n')
      );
    }
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : 'No findings yet.\n';
}

function main() {
  const { values } = parseArgs({ options: { program: { type: 'string' }, dir: { type: 'string' }, out: { type: 'string' } } });
  const text = render(readLines(programFile(values.dir ?? DEFAULT_DIR, values.program)));
  if (values.out) {
    mkdirSync(dirname(values.out), { recursive: true });
    writeFileSync(values.out, text);
    console.log(`Wrote ${values.out}`);
  } else {
    process.stdout.write(text);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
