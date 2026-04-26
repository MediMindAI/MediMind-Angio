// SPDX-License-Identifier: Apache-2.0
/**
 * encounterMigration — legacy-draft promotion tests (Phase 1.c).
 *
 * Covers the contract from the encounter-pivot plan §1c:
 *   - Single legacy draft → one EncounterDraft with header copied + full
 *     legacy state preserved under studies[studyType].
 *   - Idempotency: second invocation is a no-op (skipped count > 0).
 *   - All 6 legacy keys plant → 6 distinct encounters.
 *   - Malformed JSON: logged in errors[], other valid entries still migrate.
 *   - `indicationNotes` fallback when only deprecated `indication` is
 *     present (Wave 4.9 alias).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyDrafts } from './encounterMigration';
import {
  listEncounters,
  clearAllEncounters,
  _resetStoreForTests,
} from './encounterStore';
import { keyStudyDraft } from '../constants/storage-keys';
import type { StudyType } from '../types/study';

const ALL_LEGACY_STUDIES: ReadonlyArray<StudyType> = [
  'venousLEBilateral',
  'venousLERight',
  'venousLELeft',
  'arterialLE',
  'carotid',
  'ivcDuplex',
];

function plantLegacyVenousDraft(): {
  header: Record<string, unknown>;
  state: Record<string, unknown>;
} {
  const header = {
    patientName: 'Jane Roe',
    patientId: '01001011116',
    patientBirthDate: '1975-03-22',
    patientGender: 'female',
    studyDate: '2026-04-20',
    operatorName: 'Dr. Sonographer',
    referringPhysician: 'Dr. Referrer',
    institution: 'St. Mary Hospital',
    medications: 'warfarin',
    informedConsent: true,
    informedConsentSignedAt: '2026-04-20T09:30:00Z',
    icd10Codes: [
      { code: 'I83.819', display: 'Varicose veins of unspecified lower extremity' },
    ],
    indicationNotes: 'Bilateral leg pain + visible varices',
    accessionNumber: 'A-12345', // per-study field — preserved in legacy state
    cptCode: { code: '93970', display: 'Duplex scan' }, // per-study
    quality: 'good',
    protocol: 'reflux',
  };
  const state = {
    schemaVersion: 1,
    studyType: 'venousLEBilateral',
    header,
    findings: {
      gsv: { competency: 'incompetent', refluxMs: 1500 },
    },
    view: 'right',
    impression: 'GSV reflux on the right.',
    impressionEdited: false,
    ceap: undefined,
    recommendations: [],
    sonographerComments: '',
    clinicianComments: '',
  };
  localStorage.setItem(keyStudyDraft('venousLEBilateral'), JSON.stringify(state));
  return { header, state };
}

beforeEach(async () => {
  _resetStoreForTests();
  await clearAllEncounters();
  localStorage.clear();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
});

describe('encounterMigration — legacy draft promotion', () => {
  it('migrates a single legacy venous draft into a synthetic encounter', async () => {
    const { header: legacyHeader, state: legacyState } = plantLegacyVenousDraft();

    const result = await migrateLegacyDrafts();
    expect(result.migrated).toBe(1);
    expect(result.errors).toEqual([]);

    const encounters = await listEncounters();
    expect(encounters).toHaveLength(1);
    const enc = encounters[0]!;
    expect(enc.selectedStudyTypes).toEqual(['venousLEBilateral']);
    expect(enc.schemaVersion).toBe(2);

    // Encounter-level fields lifted from the legacy header.
    expect(enc.header.patientName).toBe(legacyHeader.patientName);
    expect(enc.header.patientId).toBe(legacyHeader.patientId);
    expect(enc.header.patientBirthDate).toBe(legacyHeader.patientBirthDate);
    expect(enc.header.patientGender).toBe('female');
    expect(enc.header.operatorName).toBe(legacyHeader.operatorName);
    expect(enc.header.referringPhysician).toBe(legacyHeader.referringPhysician);
    expect(enc.header.institution).toBe(legacyHeader.institution);
    expect(enc.header.medications).toBe(legacyHeader.medications);
    expect(enc.header.informedConsent).toBe(true);
    expect(enc.header.informedConsentSignedAt).toBe(legacyHeader.informedConsentSignedAt);
    expect(enc.header.indicationNotes).toBe(legacyHeader.indicationNotes);
    expect(enc.header.icd10Codes).toEqual(legacyHeader.icd10Codes);
    // encounterDate defaults to the legacy studyDate when present.
    expect(enc.header.encounterDate).toBe(legacyHeader.studyDate);

    // The full legacy state is preserved under studies[studyType] — Phase 3
    // will split per-study fields; Phase 1 must not lose findings.
    expect(enc.studies.venousLEBilateral).toEqual(legacyState);

    // The migrated flag is set so subsequent runs skip this key.
    expect(localStorage.getItem(`${keyStudyDraft('venousLEBilateral')}-migrated`)).toBe('1');
    // Wave 4.1 safety net — original draft is NOT deleted.
    expect(localStorage.getItem(keyStudyDraft('venousLEBilateral'))).not.toBeNull();
  });

  it('is idempotent — running twice produces no duplicate encounters', async () => {
    plantLegacyVenousDraft();

    const first = await migrateLegacyDrafts();
    expect(first.migrated).toBe(1);

    const second = await migrateLegacyDrafts();
    expect(second.migrated).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    const encounters = await listEncounters();
    expect(encounters).toHaveLength(1);
  });

  it('migrates all 6 legacy study keys into 6 distinct encounters', async () => {
    for (const studyType of ALL_LEGACY_STUDIES) {
      const state = {
        schemaVersion: 1,
        studyType,
        header: {
          patientName: `Patient for ${studyType}`,
          studyDate: '2026-04-20',
        },
      };
      localStorage.setItem(keyStudyDraft(studyType), JSON.stringify(state));
    }

    const result = await migrateLegacyDrafts();
    expect(result.migrated).toBe(6);
    expect(result.errors).toEqual([]);

    const encounters = await listEncounters();
    expect(encounters).toHaveLength(6);
    const types = new Set(encounters.flatMap((e) => e.selectedStudyTypes));
    expect(types.size).toBe(6);
    for (const studyType of ALL_LEGACY_STUDIES) {
      expect(types.has(studyType)).toBe(true);
    }
  });

  it('logs malformed JSON to errors[] without crashing — valid siblings still migrate', async () => {
    // Valid sibling.
    plantLegacyVenousDraft();
    // Garbage payload.
    localStorage.setItem(keyStudyDraft('arterialLE'), '{not valid json');

    const result = await migrateLegacyDrafts();
    expect(result.migrated).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain(keyStudyDraft('arterialLE'));

    const encounters = await listEncounters();
    expect(encounters).toHaveLength(1);
    expect(encounters[0]!.selectedStudyTypes).toEqual(['venousLEBilateral']);
  });

  it('falls back to deprecated `indication` for indicationNotes when needed', async () => {
    const state = {
      schemaVersion: 1,
      studyType: 'arterialLE',
      header: {
        patientName: 'Old Draft Patient',
        studyDate: '2026-04-20',
        // Wave 4.9 deprecated alias — old drafts wrote the visit note here.
        indication: 'Claudication, left calf',
      },
    };
    localStorage.setItem(keyStudyDraft('arterialLE'), JSON.stringify(state));

    const result = await migrateLegacyDrafts();
    expect(result.migrated).toBe(1);

    const encounters = await listEncounters();
    expect(encounters).toHaveLength(1);
    expect(encounters[0]!.header.indicationNotes).toBe('Claudication, left calf');
  });
});
