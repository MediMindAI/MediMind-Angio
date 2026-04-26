// SPDX-License-Identifier: Apache-2.0
/**
 * encounterStore — IndexedDB persistence tests (Phase 1.b).
 *
 * Mirrors `draftStore.test.ts` patterns. Uses `fake-indexeddb/auto` from
 * `test/setup.ts` so IDB calls work in jsdom.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  saveEncounter,
  loadEncounter,
  loadEncounterSync,
  listEncounters,
  clearEncounter,
  clearAllEncounters,
  keyEncounter,
  _resetStoreForTests,
} from './encounterStore';
import type { EncounterDraft } from '../types/encounter';

function buildDraft(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: overrides.encounterId ?? 'enc-1',
    header: {
      patientName: 'John Doe',
      patientId: '01001011116',
      patientBirthDate: '1980-05-12',
      patientGender: 'male',
      operatorName: 'Dr. Smith',
      referringPhysician: 'Dr. Jones',
      institution: 'Acme Hospital',
      medications: 'aspirin 81mg',
      informedConsent: true,
      informedConsentSignedAt: '2026-04-25T10:00:00Z',
      icd10Codes: [{ code: 'I83.819', display: 'Varicose veins' }],
      indicationNotes: 'Bilateral leg swelling',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['venousLEBilateral'],
    studies: {
      venousLEBilateral: { findings: 'sample legacy state' },
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
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

describe('encounterStore — IDB-backed persistence', () => {
  it('round-trips an EncounterDraft through saveEncounter/loadEncounter', async () => {
    const draft = buildDraft();
    await saveEncounter(draft);

    const round = await loadEncounter(draft.encounterId);
    expect(round).not.toBeNull();
    expect(round?.encounterId).toBe(draft.encounterId);
    expect(round?.header).toEqual(draft.header);
    expect(round?.selectedStudyTypes).toEqual(draft.selectedStudyTypes);
    expect(round?.studies).toEqual(draft.studies);
    expect(round?.schemaVersion).toBe(2);
    // updatedAt is bumped by saveEncounter — assert it's a parseable ISO string.
    expect(typeof round?.updatedAt).toBe('string');
    expect(Number.isFinite(Date.parse(round!.updatedAt))).toBe(true);
  });

  it('loadEncounterSync returns the draft from localStorage', async () => {
    const draft = buildDraft({ encounterId: 'enc-sync' });
    await saveEncounter(draft);

    const sync = loadEncounterSync('enc-sync');
    expect(sync).not.toBeNull();
    expect(sync?.encounterId).toBe('enc-sync');
    expect(sync?.header.patientName).toBe('John Doe');
  });

  it('listEncounters returns newest-first by updatedAt', async () => {
    await saveEncounter(buildDraft({ encounterId: 'enc-old' }));
    // Force measurable timestamp gaps; ISO timestamps are millisecond-resolution
    // and synchronous saves can land in the same tick under jsdom.
    await new Promise((r) => setTimeout(r, 5));
    await saveEncounter(buildDraft({ encounterId: 'enc-mid' }));
    await new Promise((r) => setTimeout(r, 5));
    await saveEncounter(buildDraft({ encounterId: 'enc-new' }));

    const list = await listEncounters();
    expect(list.map((e) => e.encounterId)).toEqual(['enc-new', 'enc-mid', 'enc-old']);
  });

  it('clearEncounter removes one without affecting siblings', async () => {
    await saveEncounter(buildDraft({ encounterId: 'a' }));
    await saveEncounter(buildDraft({ encounterId: 'b' }));

    await clearEncounter('a');

    expect(await loadEncounter('a')).toBeNull();
    expect((await loadEncounter('b'))?.encounterId).toBe('b');
    // localStorage mirror is also cleared for 'a' but not 'b'.
    expect(localStorage.getItem(keyEncounter('a'))).toBeNull();
    expect(localStorage.getItem(keyEncounter('b'))).not.toBeNull();
  });

  it('clearAllEncounters removes every encounter (IDB + localStorage)', async () => {
    await saveEncounter(buildDraft({ encounterId: 'x' }));
    await saveEncounter(buildDraft({ encounterId: 'y' }));
    // Unrelated localStorage key must survive the wipe.
    localStorage.setItem('emr-language', 'ka');

    await clearAllEncounters();

    expect((await listEncounters()).length).toBe(0);
    expect(localStorage.getItem(keyEncounter('x'))).toBeNull();
    expect(localStorage.getItem(keyEncounter('y'))).toBeNull();
    expect(localStorage.getItem('emr-language')).toBe('ka');
  });

  it('loadEncounter returns null for an unknown id', async () => {
    expect(await loadEncounter('does-not-exist')).toBeNull();
    expect(loadEncounterSync('does-not-exist')).toBeNull();
  });

  it('loadEncounter falls back to localStorage when IDB is empty', async () => {
    // Plant a draft in localStorage only — simulates an IDB upgrade race
    // or a write that hit the sync cache but not yet IDB.
    const draft = buildDraft({ encounterId: 'enc-fallback' });
    localStorage.setItem(keyEncounter('enc-fallback'), JSON.stringify(draft));

    const round = await loadEncounter('enc-fallback');
    expect(round?.encounterId).toBe('enc-fallback');
    expect(round?.header.patientName).toBe('John Doe');
  });
});
