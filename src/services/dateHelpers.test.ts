// SPDX-License-Identifier: Apache-2.0
/**
 * dateHelpers tests - regression guard for the Tbilisi UTC+4 date-shift
 * bug (Wave 2 Task 2.1, Pattern B). The original implementation in
 * `StudyHeader.tsx` did `d.toISOString().slice(0, 10)`, which silently
 * shifted a wall-clock date back one day for any user east of UTC.
 */

import { describe, expect, it } from 'vitest';
import {
  formatIsoForDisplay,
  isoToLocalDate,
  localDateToIso,
  nowIsoTimestamp,
} from './dateHelpers';

describe('localDateToIso', () => {
  it('returns YYYY-MM-DD using local components', () => {
    // Local-midnight April 25, 2026. Month is 0-indexed in `Date`.
    const d = new Date(2026, 3, 25);
    expect(localDateToIso(d)).toBe('2026-04-25');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5);
    expect(localDateToIso(d)).toBe('2026-01-05');
  });

  it('returns undefined for null input', () => {
    expect(localDateToIso(null)).toBeUndefined();
  });

  it('returns undefined for an Invalid Date', () => {
    expect(localDateToIso(new Date('not-a-date'))).toBeUndefined();
  });

  it('round-trips with isoToLocalDate', () => {
    const d = isoToLocalDate('2026-04-25');
    expect(d).not.toBeNull();
    expect(localDateToIso(d)).toBe('2026-04-25');
  });
});

describe('isoToLocalDate', () => {
  it('parses YYYY-MM-DD to a local-midnight Date', () => {
    const d = isoToLocalDate('2026-04-25');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3); // April (0-indexed)
    expect(d!.getDate()).toBe(25);
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it('accepts a full ISO timestamp and reads only the date part', () => {
    const d = isoToLocalDate('2026-04-25T13:45:00Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(25);
  });

  it('returns null for malformed input', () => {
    expect(isoToLocalDate('not-a-date')).toBeNull();
    expect(isoToLocalDate(undefined)).toBeNull();
    expect(isoToLocalDate('')).toBeNull();
    expect(isoToLocalDate('25-04-2026')).toBeNull();
  });

  it('returns null for impossible calendar dates that would silently roll over', () => {
    expect(isoToLocalDate('2026-13-01')).toBeNull();
    expect(isoToLocalDate('2026-02-31')).toBeNull();
  });
});

describe('nowIsoTimestamp', () => {
  it('returns a parseable ISO 8601 instant', () => {
    const iso = nowIsoTimestamp();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    const d = new Date(iso);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});

describe('formatIsoForDisplay', () => {
  it('returns em-dash for empty / undefined / invalid input', () => {
    expect(formatIsoForDisplay(undefined)).toBe('—');
    expect(formatIsoForDisplay('')).toBe('—');
    expect(formatIsoForDisplay('garbage')).toBe('—');
  });

  it('formats date-only output as locale digits', () => {
    const out = formatIsoForDisplay('2026-04-25', { lang: 'en' });
    // `en` locale Intl output for '2026-04-25' is '04/25/2026' on Node ICU.
    // We check digit content rather than exact separators - the locale
    // formatter could legitimately return either form across runtimes.
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/04/);
    expect(out).toMatch(/25/);
  });

  it('appends a timezone abbreviation when includeTime is true', () => {
    const out = formatIsoForDisplay('2026-04-25T10:15:00Z', {
      lang: 'en',
      includeTime: true,
    });
    // Should include hour digits and SOMETHING that looks like a TZ token
    // (e.g. "GMT+4", "EDT", "UTC", "GMT-5"). We don't assume which TZ the
    // test process runs in; we just assert the formatter requested one.
    expect(out).toMatch(/\d{2}/);
    // A short TZ name will contain at least one of: a letter run >= 2 chars,
    // or "GMT" / "UTC" with an optional offset.
    expect(out).toMatch(/[A-Za-z]{2,}|GMT|UTC/);
  });
});

describe('Tbilisi UTC+4 regression guard (Area 02 CRITICAL)', () => {
  it('does NOT shift dates back for users east of UTC', () => {
    // The OLD broken impl was: `d.toISOString().slice(0, 10)`.
    const tbilisiMidnight = new Date(2026, 3, 25, 0, 0, 0); // local midnight April 25
    const oldBuggyResult = tbilisiMidnight.toISOString().slice(0, 10);

    // Our new helper is ALWAYS '2026-04-25' regardless of timezone.
    expect(localDateToIso(tbilisiMidnight)).toBe('2026-04-25');

    // Document the old bug we fixed: in any timezone east of UTC
    // (negative `getTimezoneOffset()` value), the legacy impl produced
    // the previous day. We assert that fact only when the test process
    // actually runs in such a TZ, so the suite is portable.
    const offsetMin = tbilisiMidnight.getTimezoneOffset();
    if (offsetMin < 0) {
      expect(oldBuggyResult).not.toBe('2026-04-25');
    } else {
      // West of (or at) UTC: old impl happened to be correct; sanity-check
      // that our new impl still matches on those machines too.
      expect(oldBuggyResult).toBe('2026-04-25');
    }
  });

  it('round-trip preserves the user-picked wall-clock date', () => {
    // User picks April 25 in the date picker. Mantine hands back local-midnight.
    const picked = new Date(2026, 3, 25);
    const written = localDateToIso(picked);
    expect(written).toBe('2026-04-25');

    // Later, the form re-hydrates the same string.
    const rehydrated = isoToLocalDate(written);
    expect(rehydrated).not.toBeNull();
    // The picker now displays the same wall-clock day the user originally chose.
    expect(rehydrated!.getFullYear()).toBe(2026);
    expect(rehydrated!.getMonth()).toBe(3);
    expect(rehydrated!.getDate()).toBe(25);
  });
});
