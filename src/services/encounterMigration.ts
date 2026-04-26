// SPDX-License-Identifier: Apache-2.0
/**
 * encounterMigration — one-shot promotion of legacy per-study drafts
 * (`angio-study-draft-<studyType>`) to the new encounter-keyed shape.
 *
 * Phase 1 (encounter-pivot plan §1c). Wired in Phase 2/3 from `main.tsx`;
 * Phase 1 ships the helper + tests only — no boot-time call yet.
 *
 * Behavior summary
 * ----------------
 *   For each known legacy study key in `localStorage`:
 *     1. Skip if a `<key>-migrated` sibling flag is already set.
 *     2. Parse the JSON. If parse fails → log to `errors[]`, continue.
 *     3. Mint a new encounter UUID. Lift encounter-level fields from
 *        `state.header` into `EncounterHeader`. Preserve the FULL legacy
 *        state (header included) under `studies[studyType]` — Phase 3 will
 *        refactor the per-study shape; Phase 1 keeps it intact for safety.
 *     4. Persist via `saveEncounter`.
 *     5. Set `<key>-migrated = '1'`. Do NOT delete the original — Wave 4.1
 *        keeps legacy entries around for 30 days as a safety net.
 *
 * Idempotent — safe to invoke on every app boot.
 *
 * `indicationNotes` precedence: Wave 4.9 renamed `header.indication` to
 * `header.indicationNotes`. Existing drafts may have either field; the
 * migration prefers `indicationNotes` and falls back to the deprecated
 * `indication` so legacy drafts don't lose their visit-level note.
 */

import type {
  EncounterDraft,
  EncounterHeader,
  EncounterId,
} from '../types/encounter';
import type { StudyType } from '../types/study';
import type { IndicationCode } from '../types/form';
import { saveEncounter } from './encounterStore';
import { keyStudyDraft } from '../constants/storage-keys';

/**
 * Every legacy per-study draft key that may exist in the wild. Pinned to
 * the closed list of supported `StudyType`s — adding a new study requires
 * touching this array AND the `StudyType` union.
 */
const LEGACY_STUDY_TYPES: ReadonlyArray<StudyType> = [
  'venousLEBilateral',
  'venousLERight',
  'venousLELeft',
  'arterialLE',
  'carotid',
  'ivcDuplex',
];

/** Tally returned to callers + persisted to logs by the boot wiring (Phase 2/3). */
export interface MigrationResult {
  readonly migrated: number;
  readonly skipped: number;
  readonly errors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers — defensive against malformed legacy payloads.
// ---------------------------------------------------------------------------

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function asString(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}

function asBoolean(x: unknown): boolean | undefined {
  return typeof x === 'boolean' ? x : undefined;
}

function asGender(x: unknown): EncounterHeader['patientGender'] {
  if (x === 'male' || x === 'female' || x === 'other' || x === 'unknown') return x;
  return undefined;
}

function asIcdCodes(x: unknown): ReadonlyArray<IndicationCode> | undefined {
  if (!Array.isArray(x)) return undefined;
  const codes: IndicationCode[] = [];
  for (const item of x) {
    if (isObject(item) && typeof item.code === 'string' && typeof item.display === 'string') {
      codes.push({ code: item.code, display: item.display });
    }
  }
  return codes.length > 0 ? codes : undefined;
}

/**
 * Lift the encounter-level fields out of a legacy `state.header`.
 * `encounterDate` defaults to `header.studyDate` so single-study migrations
 * don't lose the original scan date; if neither is present, today.
 */
function buildEncounterHeader(legacyHeader: Record<string, unknown>): EncounterHeader {
  const indicationNotes =
    asString(legacyHeader.indicationNotes) ??
    asString(legacyHeader.indication); // Wave 4.9 deprecated alias

  const studyDate = asString(legacyHeader.studyDate);
  const encounterDate = studyDate ?? new Date().toISOString().slice(0, 10);

  return {
    patientName: asString(legacyHeader.patientName) ?? '',
    patientId: asString(legacyHeader.patientId),
    patientBirthDate: asString(legacyHeader.patientBirthDate),
    patientGender: asGender(legacyHeader.patientGender),
    operatorName: asString(legacyHeader.operatorName),
    referringPhysician: asString(legacyHeader.referringPhysician),
    institution: asString(legacyHeader.institution),
    medications: asString(legacyHeader.medications),
    informedConsent: asBoolean(legacyHeader.informedConsent),
    informedConsentSignedAt: asString(legacyHeader.informedConsentSignedAt),
    icd10Codes: asIcdCodes(legacyHeader.icd10Codes),
    indicationNotes,
    encounterDate,
  };
}

function newEncounterId(): EncounterId {
  // `crypto.randomUUID` is available in modern browsers + Node 19+. The
  // test setup polyfills it for jsdom.
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Promote every legacy per-study draft to a synthetic single-study
 * encounter. Idempotent — already-migrated keys are skipped via the
 * `<key>-migrated` localStorage flag (Wave 4.1 pattern).
 */
export async function migrateLegacyDrafts(): Promise<MigrationResult> {
  const storage = safeStorage();
  if (!storage) return { migrated: 0, skipped: 0, errors: [] };

  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const studyType of LEGACY_STUDY_TYPES) {
    const lsKey = keyStudyDraft(studyType);
    const flagKey = `${lsKey}-migrated`;

    if (storage.getItem(flagKey) === '1') {
      skipped += 1;
      continue;
    }

    const raw = storage.getItem(lsKey);
    if (!raw) continue; // nothing to migrate for this study type

    let legacyState: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed)) {
        errors.push(`[encounterMigration] ${lsKey}: parsed value is not an object`);
        continue;
      }
      legacyState = parsed;
    } catch (err) {
      errors.push(`[encounterMigration] ${lsKey}: JSON parse failed (${String(err)})`);
      continue;
    }

    const legacyHeader = isObject(legacyState.header) ? legacyState.header : {};
    const header = buildEncounterHeader(legacyHeader);
    const now = new Date().toISOString();
    const draft: EncounterDraft = {
      schemaVersion: 2,
      encounterId: newEncounterId(),
      header,
      selectedStudyTypes: [studyType],
      // Preserve the FULL legacy state — Phase 3 will split header fields
      // out of per-study reducers; Phase 1 keeps the payload intact so a
      // partial migration can't lose findings.
      studies: { [studyType]: legacyState },
      createdAt: now,
      updatedAt: now,
    };

    try {
      await saveEncounter(draft);
      try {
        storage.setItem(flagKey, '1');
      } catch {
        // ignore — flag is a hint, the encounter is already persisted.
      }
      migrated += 1;
    } catch (err) {
      errors.push(`[encounterMigration] ${lsKey}: saveEncounter failed (${String(err)})`);
    }
  }

  return { migrated, skipped, errors };
}
