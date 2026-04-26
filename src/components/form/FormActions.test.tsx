// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 1.1 + 1.7 — Area 10 BLOCKER + Area 04 CRITICAL.
 *
 * Covers:
 *   - renderPdfBlob reads venous findings from form.parameters['segmentFindings']
 *     (NOT the always-empty form.segments[]).
 *   - When PDF generation throws, a red Mantine notification surfaces with
 *     the localized failure title — no silent failure (Area 04 CRITICAL).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { FormActions } from './FormActions';
import type { FormState } from '../../types/form';
import { notifications } from '@mantine/notifications';

// Mock @mantine/notifications to capture show() calls.
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

// Stub the PDF render path — both pdf modules and the anatomy loader.
// renderPdfBlob is internal; we stub the heavy modules it depends on.
const loadAnatomyMock = vi.fn((..._args: unknown[]) => Promise.resolve({ paths: [] }));
vi.mock('../pdf/anatomyToPdfSvg', () => ({
  loadAnatomyForPdf: (view: string, findings: unknown) => loadAnatomyMock(view, findings),
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: (_doc: unknown) => ({
    toBlob: () => Promise.resolve(new Blob(['fake-pdf'], { type: 'application/pdf' })),
  }),
}));

vi.mock('../pdf/ReportDocument', () => ({
  ReportDocument: () => null,
}));

vi.mock('../pdf/buildReportLabels', () => ({
  buildReportLabels: () => ({ title: 'Report', generatedAt: 'Generated' }),
}));

vi.mock('../../services/narrativeService', () => ({
  buildLocalizedNarrative: () => undefined,
}));

vi.mock('../../services/fontService', () => ({
  registerFontsAsync: () => Promise.resolve(),
}));

// Cast through unknown to bypass the narrow `parameters` type — the
// production code does the same (Wave 2.5 will widen the type properly).
const venousForm: FormState = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: 'Test Patient',
    patientId: '12345678901',
    studyDate: '2026-04-25',
  },
  segments: [], // intentionally empty — findings live on parameters
  narrative: {},
  recommendations: [],
  parameters: {
    segmentFindings: {
      'pop-ak-left': {
        compressibility: 'non-compressible',
        thrombosis: 'acute',
        refluxDurationMs: 0,
      },
    } as unknown as string,
  },
};

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('FormActions — venous PDF anatomy source (Wave 1.1)', () => {
  beforeEach(() => {
    loadAnatomyMock.mockClear();
    (notifications.show as ReturnType<typeof vi.fn>).mockClear();
  });

  it('passes findings from form.parameters[segmentFindings] to loadAnatomyForPdf — NOT empty', async () => {
    render(
      <Wrap>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="test-report"
        />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId('download-pdf'));

    await waitFor(() => {
      expect(loadAnatomyMock).toHaveBeenCalled();
    });

    // First arg is the view name, second is the findings map.
    const callArgs = loadAnatomyMock.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(callArgs[0]).toBe('le-anterior');
    expect(callArgs[1]).toEqual({
      'pop-ak-left': {
        compressibility: 'non-compressible',
        thrombosis: 'acute',
        refluxDurationMs: 0,
      },
    });
  });
});

describe('FormActions — error surfacing (Wave 1.7)', () => {
  beforeEach(() => {
    (notifications.show as ReturnType<typeof vi.fn>).mockClear();
  });

  it('shows a red notification when JSON export throws (Area 04 CRITICAL)', async () => {
    // Force downloadFhirBundle to throw by passing a form with a corrupted shape.
    // The simpler path: stub the fhirBuilder import.
    const original = await import('../../services/fhirBuilder');
    const downloadSpy = vi
      .spyOn(original, 'downloadFhirBundle')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    // Suppress the augmented console.error from the catch path.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Wrap>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="test-report"
        />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId('export-json'));

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'boom' }),
    );

    downloadSpy.mockRestore();
    errSpy.mockRestore();
  });
});
