// Shared by add.mjs and render.mjs: where findings live, how lines are read, how a row is checked.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA = JSON.parse(readFileSync(join(here, 'schema.json'), 'utf8'));
export const DEFAULT_DIR = join(here, '..', '..', 'qa-reports', 'findings');

/** Program names become file names, so they may hold nothing that walks out of the folder. */
export function programFile(dir, program) {
  if (!/^[\w.-]+$/u.test(program ?? '') || program.startsWith('.')) {
    throw new Error(`Bad program name: ${program}`);
  }
  return join(dir, `${program}.jsonl`);
}

export function readLines(file) {
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${file} line ${index + 1} is not JSON: fix it by hand, it was not written by add.mjs`);
      }
    });
}

/** Later lines with the same id update the row. Order of first appearance is kept. */
export function currentRows(lines) {
  const rows = new Map();
  for (const line of lines) {
    rows.set(line.id, { ...rows.get(line.id), ...line });
  }
  return [...rows.values()];
}

export function validate(row) {
  const errors = [];
  for (const field of SCHEMA.required) {
    if (typeof row[field] !== 'string' || !row[field].trim()) {
      errors.push(`${field} is required`);
    }
  }
  for (const [field, value] of Object.entries(row)) {
    const rule = SCHEMA.properties[field];
    if (!rule) {
      errors.push(`unknown field ${field}`);
    } else if (typeof value !== 'string') {
      errors.push(`${field} must be text`);
    } else if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    } else if (rule.pattern && !new RegExp(rule.pattern, 'u').test(value)) {
      errors.push(`${field} has the wrong shape, expected ${rule.pattern}`);
    }
  }
  return errors;
}
