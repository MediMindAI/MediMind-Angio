// SPDX-License-Identifier: Apache-2.0
/**
 * dateHelpers - single source of truth for date <-> ISO conversions.
 *
 * Pattern B (Wave 2 Task 2.1): every component that round-trips a Mantine
 * DatePicker value must use these helpers. Hand-rolled
 * d.toISOString().slice(0, 10) is forbidden - it shifts dates back by one
 * day in any timezone east of UTC (e.g. Tbilisi UTC+4 -> April 25 picked,
 * "2026-04-24" written) because Date.toISOString() always converts to UTC.
 *
 * - For "calendar dates" (birthDate, studyDate, consent-signed-on date) we
 *   use the LOCAL getFullYear/getMonth/getDate accessors. The picker hands
 *   us a Date whose midnight is in the user's wall-clock TZ, and the user's
 *   intent is clearly the wall-clock date - so we read it back the same way.
 *
 * - For "instants" (consent-stamp moment, audit timestamp, generatedAt) we
 *   keep full ISO 8601 with the trailing Z so the timestamp is a
 *   well-defined moment regardless of which timezone the reader is in.
 *
 * - For HUMAN display we go through Intl.DateTimeFormat and emit the
 *   timezone abbreviation, so a Tbilisi sonographer at 14:15 vs a NY
 *   reviewer reading the same FHIR generatedAt see clearly distinct,
 *   reconcilable timestamps.
 */

/** Format a Date as 'YYYY-MM-DD' using LOCAL components (no UTC drift). */
export function localDateToIso(d: Date | null): string | undefined {
  if (!d) return undefined;
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse 'YYYY-MM-DD' to a local-midnight Date (no UTC drift). */
export function isoToLocalDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return null;
  // Guard against e.g. month=13, day=32 silently rolling over.
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Full ISO 8601 timestamp with the trailing Z - for consent / audit
 * signing and any other "well-defined moment in time" payloads.
 */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

export interface FormatIsoOptions {
  /** BCP-47 locale tag (defaults to 'en'). */
  readonly lang?: string;
  /** When true, append HH:MM + timezone abbreviation. */
  readonly includeTime?: boolean;
}

/**
 * Format an ISO timestamp for human display.
 *
 * - Date-only: returns YYYY-MM-DD (locale-formatted via Intl).
 * - includeTime: appends time with the timezone abbreviation, so distant
 *   readers can reconcile timestamps without ambiguity.
 */
export function formatIsoForDisplay(
  iso: string | undefined,
  opts: FormatIsoOptions = {},
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const lang = opts.lang ?? 'en';
  if (opts.includeTime) {
    const formatter = new Intl.DateTimeFormat(lang, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    return formatter.format(d);
  }
  return new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Format a date or instant as 'DD.MM.YYYY' (or 'DD.MM.YYYY HH:mm' with
 * `includeTime`), in LOCAL wall-clock time and the same in every UI language.
 *
 * Why (U-1007): `formatIsoForDisplay` defaults to the 'en' locale, so the PDF
 * printed '11/12/2026, 03:37 PM' — a Georgian reader takes that as
 * 11 December. Day.month.year with a 24-hour clock is how Georgian (and
 * Russian) clinical documents write dates, and it can't be misread.
 *
 * - A date-only value ('YYYY-MM-DD') is read as a calendar date through
 *   `isoToLocalDate` (no UTC midnight shift in Tbilisi or anywhere else) and
 *   never gets a time, even with `includeTime`.
 * - An instant ('…T…Z' / with offset) is shown in the reader's local time.
 */
export function formatDottedDate(
  iso: string | undefined,
  opts: { readonly includeTime?: boolean } = {},
): string {
  if (!iso) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly ? isoToLocalDate(iso) : new Date(iso);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const pad = (n: number): string => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (!opts.includeTime || dateOnly) return date;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
