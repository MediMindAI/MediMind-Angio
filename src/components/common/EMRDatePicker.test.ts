// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { parseTypedDate } from './EMRDatePicker';

describe('parseTypedDate — hand-typed dates', () => {
  it('parses dd.mm.yyyy as a local-midnight date', () => {
    const d = parseTypedDate('05.03.1980');
    expect(d?.getFullYear()).toBe(1980);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(5);
  });

  it('accepts / and - separators, single digits, and bare ddmmyyyy', () => {
    expect(parseTypedDate('5/3/1980')?.getDate()).toBe(5);
    expect(parseTypedDate('05-03-1980')?.getMonth()).toBe(2);
    expect(parseTypedDate('05031980')?.getFullYear()).toBe(1980);
  });

  it('rejects impossible or malformed dates', () => {
    expect(parseTypedDate('31.02.2020')).toBeNull();
    expect(parseTypedDate('1980')).toBeNull();
    expect(parseTypedDate('')).toBeNull();
  });
});
