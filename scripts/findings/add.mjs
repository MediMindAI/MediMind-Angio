#!/usr/bin/env node
// Append one finding, or one update to a finding, to qa-reports/findings/<program>.jsonl.
// Sessions call this instead of editing a shared markdown table: one appended line never conflicts.
//
//   node scripts/findings/add.mjs --program demo5 --case "5 short" --step 3G --kind BUG --severity high \
//     --owner R2 --evidence "Transfer line empty on a real move (shot 3G.png)" --decision "Fill it from the move"
//   node scripts/findings/add.mjs --program demo5 --update U-1004 --status fixed --decision "fixed 12:55 (R2)"
//
// Options: --prefix U (default) · --from 1000 (first id; use one above the old table) · --status open (default)
//          --dir <folder> (default qa-reports/findings)
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { currentRows, DEFAULT_DIR, programFile, readLines, validate } from './lib.mjs';

const LOCK_TRIES = 200;
const LOCK_WAIT_MS = 50;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** mkdir is atomic: two sessions taking the same "next free id" is what this lock prevents. */
function withLock(file, action) {
  const lock = `${file}.lock`;
  for (let attempt = 0; attempt < LOCK_TRIES; attempt += 1) {
    try {
      mkdirSync(lock);
      try {
        return action();
      } finally {
        rmSync(lock, { recursive: true, force: true });
      }
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      sleep(LOCK_WAIT_MS);
    }
  }
  throw new Error(`Could not take ${lock}. If no other add.mjs is running, delete that folder and retry.`);
}

export function nextId(lines, prefix, from) {
  let highest = from - 1;
  for (const line of lines) {
    const match = /^([A-Z]+)-(\d+)$/u.exec(line.id ?? '');
    if (match && match[1] === prefix) {
      highest = Math.max(highest, Number(match[2]));
    }
  }
  return `${prefix}-${highest + 1}`;
}

function main() {
  const { values } = parseArgs({
    options: {
      program: { type: 'string' },
      dir: { type: 'string' },
      prefix: { type: 'string', default: 'U' },
      from: { type: 'string', default: '1' },
      update: { type: 'string' },
      case: { type: 'string' },
      step: { type: 'string' },
      kind: { type: 'string' },
      severity: { type: 'string' },
      status: { type: 'string' },
      owner: { type: 'string' },
      evidence: { type: 'string' },
      decision: { type: 'string' },
    },
  });
  const { program, dir = DEFAULT_DIR, prefix, from, update, ...fields } = values;
  const file = programFile(dir, program);
  mkdirSync(dirname(file), { recursive: true });
  const line = withLock(file, () => {
    const lines = readLines(file);
    let row;
    if (update) {
      const existing = currentRows(lines).find((candidate) => candidate.id === update);
      if (!existing) {
        throw new Error(`${update} is not in ${file}`);
      }
      row = { ...existing, ...fields };
    } else {
      row = { id: nextId(lines, prefix, Number(from)), status: 'open', ...fields };
    }
    row.at = new Date().toISOString();
    const errors = validate(row);
    if (errors.length) {
      throw new Error(`Finding not saved: ${errors.join('; ')}`);
    }
    appendFileSync(file, `${JSON.stringify(update ? { id: update, ...fields, at: row.at } : row)}\n`);
    return row;
  });
  console.log(`${line.id} ${line.status} → ${file}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
