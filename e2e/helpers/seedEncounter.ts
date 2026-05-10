// SPDX-License-Identifier: Apache-2.0
import type { Page } from '@playwright/test';

/**
 * Seed a synthetic encounter into localStorage so tests can navigate
 * directly to /encounter/:id/:studyType without driving the intake UI
 * five times. The encounter store has a localStorage cache that the
 * sync-init path reads on first render, so this is enough to land on
 * a populated venous-LE form.
 */
export async function seedVenousEncounter(
  page: Page,
  options: {
    encounterId?: string;
    patientName?: string;
    encounterDate?: string;
  } = {},
): Promise<{ encounterId: string }> {
  const encounterId = options.encounterId ?? 'e2e-venous-' + Date.now();
  const patientName = options.patientName ?? 'E2E Test Patient';
  const encounterDate = options.encounterDate ?? new Date().toISOString().slice(0, 10);

  // Seed both the IDB-backed encounter store's localStorage mirror AND
  // the legacy single-study draft slot, so whichever path the form takes
  // it finds initialized state.
  await page.addInitScript(
    ({ id, name, date }) => {
      const draft = {
        schemaVersion: 2,
        encounterId: id,
        header: {
          patientName: name,
          patientId: '01001011116',
          patientBirthDate: '1980-05-12',
          patientGender: 'male',
          encounterDate: date,
        },
        selectedStudyTypes: ['venousLEBilateral'],
        studies: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
    },
    { id: encounterId, name: patientName, date: encounterDate },
  );

  return { encounterId };
}

/**
 * Navigate to the venous LE form for an encounter.
 */
export async function gotoVenousForm(page: Page, encounterId: string): Promise<void> {
  await page.goto(`/encounter/${encounterId}/venousLEBilateral`);
  // The anatomy diagrams render after the form mounts + the SVG fetch
  // resolves. Wait for at least one segment hit-zone to be present.
  await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', {
    timeout: 10_000,
  });
  // Hit-zones are deliberately transparent (visibility=hidden by Playwright's
  // heuristic), so wait for attachment rather than visibility.
  await page.waitForSelector('[data-segment-id="cfv-right"]', {
    timeout: 10_000,
    state: 'attached',
  });
}
