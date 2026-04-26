// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.7 — Part 05 MEDIUM (custom-template validation).
 *
 * Covers:
 *   - `loadCustomTemplates` filters out malformed entries (wrong shape /
 *     wrong scope / missing fields) instead of returning them and letting
 *     the form crash on a downstream cast.
 *   - Well-formed entries flow through unchanged.
 *
 * Why these guards exist: templates live in localStorage and can be
 * hand-edited. Before this wave a missing `kind` or a string `findings`
 * would have surfaced as a runtime crash inside the study reducer.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { loadCustomTemplates } from './customTemplatesService';

const STUDY = 'venousLEBilateral' as const;
const KEY = `custom-templates.${STUDY}`;

function setStored(value: unknown): void {
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('customTemplatesService — loadCustomTemplates validation (Part 05 MEDIUM)', () => {
  const wellFormed = {
    id: 'tpl-1',
    name: 'Normal',
    description: 'No findings',
    kind: 'normal',
    scope: 'bilateral' as const,
    findings: { 'cfv-left': { compressibility: 'normal' } },
    createdAt: '2026-04-25T00:00:00.000Z',
    schemaVersion: 1 as const,
  };

  it('returns a well-formed template unchanged', () => {
    setStored([wellFormed]);
    const out = loadCustomTemplates(STUDY);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('tpl-1');
  });

  it('rejects an entry whose findings is a string instead of a map', () => {
    setStored([{ ...wellFormed, findings: 'not-an-object' }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry whose findings is an array (not a keyed map)', () => {
    setStored([{ ...wellFormed, findings: ['a', 'b'] }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry whose findings is null', () => {
    setStored([{ ...wellFormed, findings: null }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry with an unknown scope value', () => {
    setStored([{ ...wellFormed, scope: 'middle' }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry with extras as an array (must be a map or undefined)', () => {
    setStored([{ ...wellFormed, extras: ['not', 'a', 'map'] }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry with the wrong schemaVersion', () => {
    setStored([{ ...wellFormed, schemaVersion: 2 }]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('rejects an entry missing required string fields', () => {
    const { name: _name, ...withoutName } = wellFormed;
    setStored([withoutName]);
    expect(loadCustomTemplates(STUDY)).toHaveLength(0);
  });

  it('drops malformed entries while keeping well-formed siblings', () => {
    setStored([wellFormed, { ...wellFormed, id: 'tpl-2', findings: null }]);
    const out = loadCustomTemplates(STUDY);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('tpl-1');
  });
});
