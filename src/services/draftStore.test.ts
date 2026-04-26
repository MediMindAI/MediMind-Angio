// SPDX-License-Identifier: Apache-2.0
/**
 * draftStore — IndexedDB persistence tests (Wave 4.1).
 *
 * Covers:
 *   - save → load round-trip preserves a complex object
 *   - clearDraftAsync removes a single record
 *   - clearAllDrafts removes every record AND wipes the legacy localStorage
 *     shadow so sync `loadDraft` can't keep returning stale PHI
 *   - listDrafts returns newest-first and ignores corrupt records
 *   - migrateLocalStorageDrafts is idempotent and copies plain-JSON drafts
 *     into IDB without deleting the originals (30-day safety net)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  saveDraft,
  loadDraftAsync,
  clearDraftAsync,
  clearAllDrafts,
  listDrafts,
  migrateLocalStorageDrafts,
  _resetStoreForTests,
} from './draftStore';
import { keyStudyDraft } from '../constants/storage-keys';

beforeEach(async () => {
  _resetStoreForTests();
  await clearAllDrafts();
  localStorage.clear();
});

afterEach(async () => {
  _resetStoreForTests();
  localStorage.clear();
});

describe('draftStore — IDB-backed persistence', () => {
  it('round-trips a complex object', async () => {
    const value = {
      header: { patientName: 'John Doe', personalId: '01001011116' },
      schemaVersion: 1,
      studyType: 'venousLEBilateral' as const,
      sections: [
        { id: 'gsv', competency: 'incompetent', refluxMs: 1200 },
        { id: 'cfv', competency: 'normal', refluxMs: null },
      ],
      meta: { signed: false, language: 'ka', notes: 'ვენური რეფლუქსი' },
    };

    await saveDraft('venousLEBilateral', value);
    const round = await loadDraftAsync<typeof value>('venousLEBilateral');

    expect(round).toEqual(value);
  });

  it('clearDraftAsync removes one draft without touching others', async () => {
    await saveDraft('a', { v: 1 });
    await saveDraft('b', { v: 2 });

    await clearDraftAsync('a');

    expect(await loadDraftAsync('a')).toBeNull();
    expect(await loadDraftAsync<{ v: number }>('b')).toEqual({ v: 2 });
  });

  it('clearAllDrafts wipes IDB + matching localStorage drafts', async () => {
    await saveDraft('s1', { v: 1 });
    await saveDraft('s2', { v: 2 });
    localStorage.setItem(keyStudyDraft('s1'), '{"v":1}');
    localStorage.setItem(keyStudyDraft('s2'), '{"v":2}');
    // unrelated key must survive
    localStorage.setItem('emr-language', 'ka');

    await clearAllDrafts();

    expect((await listDrafts()).length).toBe(0);
    expect(localStorage.getItem(keyStudyDraft('s1'))).toBeNull();
    expect(localStorage.getItem(keyStudyDraft('s2'))).toBeNull();
    expect(localStorage.getItem('emr-language')).toBe('ka');
  });

  it('listDrafts returns newest-first by updatedAt', async () => {
    await saveDraft('first', { v: 1 });
    // Force a measurable timestamp gap. Date.now() resolution is 1ms in
    // jsdom, but two synchronous saves can land in the same tick.
    await new Promise((r) => setTimeout(r, 5));
    await saveDraft('second', { v: 2 });
    await new Promise((r) => setTimeout(r, 5));
    await saveDraft('third', { v: 3 });

    const drafts = await listDrafts();
    expect(drafts.map((d) => d.studyId)).toEqual(['third', 'second', 'first']);
  });

  it('migrateLocalStorageDrafts copies plain-JSON drafts into IDB', async () => {
    const stored = { schemaVersion: 1, studyType: 'venousLEBilateral', v: 99 };
    localStorage.setItem(keyStudyDraft('venousLEBilateral'), JSON.stringify(stored));

    await migrateLocalStorageDrafts();

    const round = await loadDraftAsync<typeof stored>('venousLEBilateral');
    expect(round).toEqual(stored);
    expect(localStorage.getItem(keyStudyDraft('venousLEBilateral'))).not.toBeNull();
    expect(localStorage.getItem(`${keyStudyDraft('venousLEBilateral')}-migrated`)).toBe('1');
  });

  it('migrateLocalStorageDrafts is idempotent', async () => {
    localStorage.setItem(keyStudyDraft('a'), JSON.stringify({ v: 1 }));

    await migrateLocalStorageDrafts();
    await saveDraft('a', { v: 2 });
    await migrateLocalStorageDrafts();

    const round = await loadDraftAsync<{ v: number }>('a');
    expect(round).toEqual({ v: 2 });
  });

  it('migrateLocalStorageDrafts swallows JSON parse errors', async () => {
    localStorage.setItem(keyStudyDraft('broken'), '{not json');

    await expect(migrateLocalStorageDrafts()).resolves.toBeUndefined();
    expect(await loadDraftAsync('broken')).toBeNull();
  });
});
