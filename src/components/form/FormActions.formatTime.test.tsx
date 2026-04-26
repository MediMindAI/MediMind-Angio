// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.5 — Area 02 MEDIUM (FormActions.formatTime locale awareness).
 *
 * Pre-fix: `formatTime(d)` called `toLocaleTimeString(undefined, …)`, which
 * defers to the host locale. On a US-English host the formatter falls back
 * to a 12-hour clock with AM/PM, mis-tagging Russian / Georgian UIs that
 * never show AM/PM elsewhere.
 *
 * Post-fix: `formatTime(d, lang)` honours the active app locale and forces
 * `hour12: false`, so the rendered "Last saved" string never contains
 * AM/PM regardless of system locale.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { FormActions } from './FormActions';
import type { FormState } from '../../types/form';
import { STORAGE_KEYS } from '../../constants/storage-keys';

const venousForm: FormState = {
  studyType: 'venousLEBilateral',
  header: { patientName: 'X', patientId: '1', studyDate: '2026-04-25' },
  segments: [],
  narrative: {},
  recommendations: [],
  parameters: {},
};

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('FormActions formatTime — 24-hour clock regardless of locale (Wave 4.5)', () => {
  it('renders no AM/PM marker in Russian UI', () => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ru');

    // Pick a time in the afternoon so a buggy 12-hour formatter would emit "PM".
    const lastSaved = new Date('2026-04-25T14:35:42Z');

    render(
      <Wrap>
        <FormActions
          form={venousForm}
          lastSavedAt={lastSaved}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="t"
        />
      </Wrap>,
    );

    // Saved-text container always renders the formatted time. Even before
    // translations resolve, the time string is appended verbatim.
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\bAM\b|\bPM\b/i);

    localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
  });
});
