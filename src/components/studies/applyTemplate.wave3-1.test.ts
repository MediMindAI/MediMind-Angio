// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.1 (Pattern F) — APPLY_TEMPLATE clinician-comments reset guards.
 *
 * Audit Part 10 HIGH x3: all 3 study reducers (venous, arterial, carotid)
 * previously preserved `clinicianComments` across template applies via the
 * `{ ...state, ...overrides }` pattern. Combined with confirmation-dialog
 * copy that didn't enumerate `clinicianComments`, a clinician could:
 *
 *   1. Set up Patient A's report; type interpretation prose into the
 *      "Clinician comments" field.
 *   2. Apply a template for Patient B.
 *   3. The dialog says "this will replace findings/CEAP/recommendations" —
 *      it is silent on clinician comments.
 *   4. Patient B silently inherits Patient A's interpretation prose.
 *
 * Cross-patient PHI contamination vector. Severity HIGH per audit.
 *
 * The fix (Wave 3.1):
 *   - Each reducer's APPLY_TEMPLATE case now hard-resets
 *     `clinicianComments: ''`. Templates never carry clinician prose, so
 *     the reset is safe. Sonographer comments still flow from the template
 *     (or fall back to existing) because templates legitimately may carry
 *     scanner-side technical notes.
 *   - The 9 confirmation-dialog translation entries (en/ka/ru × 3 forms)
 *     are updated to enumerate "clinician comments" so the user is
 *     informed before confirming.
 *
 * These tests are static-source guards rather than reducer unit tests
 * because the per-form reducers are intentionally module-private (no
 * `export` keyword). Lane A Task 3.2 also targets these same form-state
 * interfaces (schemaVersion); keeping the surface area small avoids
 * merge-conflict churn between concurrent waves.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import enArterial from '../../translations/arterial-le/en.json';
import kaArterial from '../../translations/arterial-le/ka.json';
import ruArterial from '../../translations/arterial-le/ru.json';
import enCarotid from '../../translations/carotid/en.json';
import kaCarotid from '../../translations/carotid/ka.json';
import ruCarotid from '../../translations/carotid/ru.json';
import enVenous from '../../translations/venous-le/en.json';
import kaVenous from '../../translations/venous-le/ka.json';
import ruVenous from '../../translations/venous-le/ru.json';

const here = dirname(fileURLToPath(import.meta.url));

function readForm(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

/**
 * Extract the body of the APPLY_TEMPLATE switch case from a reducer source.
 * Returns the substring between `case 'APPLY_TEMPLATE':` (or `case 'APPLY_TEMPLATE': {`)
 * and the next `case ` or `default:` token.
 */
function applyTemplateCaseBody(source: string): string {
  const start = source.indexOf("case 'APPLY_TEMPLATE'");
  expect(start, "expected an APPLY_TEMPLATE case in reducer source").toBeGreaterThan(-1);
  // Find the next `case ` or `default:` after the start.
  const after = source.slice(start + "case 'APPLY_TEMPLATE'".length);
  const nextCase = after.search(/\n\s*case '/);
  const nextDefault = after.search(/\n\s*default\s*[:{]/);
  const candidates = [nextCase, nextDefault].filter((n) => n >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : after.length;
  return after.slice(0, end);
}

describe('Wave 3.1 — APPLY_TEMPLATE resets clinicianComments (Part 10 HIGH ×3)', () => {
  it('venous reducer APPLY_TEMPLATE case resets clinicianComments', () => {
    const src = readForm('./venous-le/VenousLEForm.tsx');
    const body = applyTemplateCaseBody(src);
    expect(body).toMatch(/clinicianComments\s*:\s*['"]['"]/);
  });

  it('arterial reducer APPLY_TEMPLATE case resets clinicianComments', () => {
    const src = readForm('./arterial-le/ArterialLEForm.tsx');
    const body = applyTemplateCaseBody(src);
    expect(body).toMatch(/clinicianComments\s*:\s*['"]['"]/);
  });

  it('carotid reducer APPLY_TEMPLATE case resets clinicianComments', () => {
    const src = readForm('./carotid/CarotidForm.tsx');
    const body = applyTemplateCaseBody(src);
    expect(body).toMatch(/clinicianComments\s*:\s*['"]['"]/);
  });
});

describe('Wave 3.1 — confirmation dialog enumerates clinician comments', () => {
  // English: literal "clinician comments" should appear in body copy.
  it('venous applyTemplateConfirmBody (en) mentions clinician comments', () => {
    expect(enVenous.venousLE.actions.applyTemplateConfirmBody).toMatch(/clinician comments/i);
  });
  it('arterial applyTemplateConfirmBody (en) mentions clinician comments', () => {
    expect(enArterial.arterialLE.actions.applyTemplateConfirmBody).toMatch(
      /clinician comments/i,
    );
  });
  it('carotid applyTemplateConfirmBody (en) mentions clinician comments', () => {
    expect(enCarotid.carotid.actions.applyTemplateConfirmBody).toMatch(/clinician comments/i);
  });

  // Georgian: კლინიცისტ-stem (clinician).
  it('venous applyTemplateConfirmBody (ka) mentions კლინიცისტ-', () => {
    expect(kaVenous.venousLE.actions.applyTemplateConfirmBody).toMatch(/კლინიცისტ/);
  });
  it('arterial applyTemplateConfirmBody (ka) mentions კლინიცისტ-', () => {
    expect(kaArterial.arterialLE.actions.applyTemplateConfirmBody).toMatch(/კლინიცისტ/);
  });
  it('carotid applyTemplateConfirmBody (ka) mentions კლინიცისტ-', () => {
    expect(kaCarotid.carotid.actions.applyTemplateConfirmBody).toMatch(/კლინიცისტ/);
  });

  // Russian: клиницист- stem.
  it('venous applyTemplateConfirmBody (ru) mentions клиницист-', () => {
    expect(ruVenous.venousLE.actions.applyTemplateConfirmBody).toMatch(/клиницист/);
  });
  it('arterial applyTemplateConfirmBody (ru) mentions клиницист-', () => {
    expect(ruArterial.arterialLE.actions.applyTemplateConfirmBody).toMatch(/клиницист/);
  });
  it('carotid applyTemplateConfirmBody (ru) mentions клиницист-', () => {
    expect(ruCarotid.carotid.actions.applyTemplateConfirmBody).toMatch(/клиницист/);
  });
});
