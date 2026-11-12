// node --test scripts/findings/findings.test.mjs
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { nextId } from './add.mjs';
import { currentRows, programFile, readLines, validate } from './lib.mjs';
import { render, renderRow } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'findings-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const base = ['--case', '5 short', '--step', '3G', '--kind', 'BUG', '--severity', 'high', '--owner', 'R2', '--evidence', 'Line empty'];
const add = (program, ...args) =>
  execFileSync('node', [join(here, 'add.mjs'), '--program', program, '--dir', dir, ...args], { encoding: 'utf8', stdio: 'pipe' });

test('next id is one above the highest, and never reuses a gap', () => {
  assert.equal(nextId([], 'U', 1000), 'U-1000');
  assert.equal(nextId([{ id: 'U-1000' }, { id: 'U-1005' }, { id: 'X-9000' }], 'U', 1000), 'U-1006');
});

test('add appends rows with the next free id', () => {
  add('one', ...base);
  add('one', ...base);
  const rows = readLines(programFile(dir, 'one'));
  assert.deepEqual(rows.map((row) => row.id), ['U-1', 'U-2']);
  assert.equal(rows[0].status, 'open');
  assert.ok(rows[0].at);
});

test('--from starts above the old hand-made table', () => {
  add('from', '--from', '1000', ...base);
  assert.equal(readLines(programFile(dir, 'from'))[0].id, 'U-1000');
});

test('six sessions adding at once get six different ids', async () => {
  const run = promisify(execFile);
  await Promise.all(
    Array.from({ length: 6 }, () => run('node', [join(here, 'add.mjs'), '--program', 'race', '--dir', dir, ...base]))
  );
  const ids = readLines(programFile(dir, 'race')).map((row) => row.id);
  assert.equal(new Set(ids).size, 6);
});

test('an update appends a line; the row shows the newest values', () => {
  add('upd', ...base);
  add('upd', '--update', 'U-1', '--status', 'fixed', '--decision', 'fixed 12:55 (R2)');
  const lines = readLines(programFile(dir, 'upd'));
  assert.equal(lines.length, 2);
  const [row] = currentRows(lines);
  assert.equal(row.status, 'fixed');
  assert.equal(row.evidence, 'Line empty');
});

test('a bad row is refused and writes nothing', () => {
  assert.throws(() => add('bad', '--case', 'x', '--kind', 'NOPE'));
  assert.deepEqual(readLines(programFile(dir, 'bad')), []);
  assert.ok(validate({ id: 'U-1' }).some((error) => error.includes('case is required')));
  assert.throws(() => add('bad', '--update', 'U-9', '--status', 'fixed'));
});

test('a program name cannot walk out of the folder', () => {
  assert.throws(() => programFile(dir, '../../etc'));
  assert.throws(() => programFile(dir, undefined));
});

const row = {
  id: 'U-925', case: '5 short', step: '3G IV-300/ა', kind: 'BUG', severity: 'high', status: 'fixed', owner: 'R2',
  evidence: 'Transfer | line\nempty', decision: 'Fill it',
};

test('a row has the columns of ten-case-demo-program.md and escapes the pipe', () => {
  assert.equal(
    renderRow(row),
    '| U-925 | 5 short · 3G IV-300/ა | BUG — FIXED (was HIGH) | Transfer \\| line empty | Fill it | fixed (R2) |'
  );
  assert.equal(
    renderRow({ ...row, id: 'U-1', status: 'open', severity: 'low', decision: undefined }),
    '| U-1 | 5 short · 3G IV-300/ა | BUG — OPEN | Transfer \\| line empty | open | open (R2) |'
  );
});

test('render groups by status, open first, with the same header as the old table', () => {
  const text = render([row, { ...row, id: 'U-1', status: 'open' }]);
  assert.ok(text.indexOf('### Open (1)') < text.indexOf('### Fixed, not yet re-walked (1)'));
  assert.ok(text.includes('| ID | Demo · step | Type | What we saw | Better would be | Status |\n|---|---|---|---|---|---|'));
  assert.equal(render([]), 'No findings yet.\n');
});

