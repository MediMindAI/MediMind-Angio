// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 1.1 + 1.7 + Phase 4c — Area 10 BLOCKER + Area 04 CRITICAL +
 * encounter-mode export branching.
 *
 * Covers:
 *   - renderPdfBlob reads venous findings from form.parameters['segmentFindings']
 *     (NOT the always-empty form.segments[]).
 *   - When PDF generation throws, a red Mantine notification surfaces with
 *     the localized failure title — no silent failure (Area 04 CRITICAL).
 *   - Phase 4c — encounter-mode wiring:
 *       1-study encounter → existing single-study `<ReportDocument>` path.
 *       2-study encounter (all complete) → `<UnifiedReportDocument>` PDF +
 *         `buildEncounterBundle` JSON, with both forms passed through.
 *       2-study encounter (one missing) → exports disabled with tooltip.
 *       null encounter (legacy mount) → single-study path, unchanged.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { EncounterCtx } from '../../contexts/EncounterContext';
import { FormActions } from './FormActions';
import type { FormState } from '../../types/form';
import type { EncounterDraft } from '../../types/encounter';
import { notifications } from '@mantine/notifications';

// ---------------------------------------------------------------------------
// Mocks — bypass the heavy PDF + anatomy + narrative pipeline so tests stay
// focused on FormActions' branching logic.
// ---------------------------------------------------------------------------

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

const { loadAnatomyMock } = vi.hoisted(() => ({
  loadAnatomyMock: vi.fn((..._args: unknown[]) =>
    Promise.resolve({ viewBox: '0 0 100 100', elements: [] }),
  ),
}));
vi.mock('../pdf/anatomyToPdfSvg', () => ({
  loadAnatomyForPdf: loadAnatomyMock,
  loadRawAnatomySvg: () => Promise.resolve('<svg viewBox="0 0 100 100"></svg>'),
}));

// Track the rendered PDF doc element so tests can inspect which component
// was passed to `pdf()` — single-study vs unified.
const pdfRenderTarget = vi.fn();
vi.mock('@react-pdf/renderer', () => ({
  pdf: (doc: unknown) => {
    pdfRenderTarget(doc);
    return {
      toBlob: () => Promise.resolve(new Blob(['fake-pdf'], { type: 'application/pdf' })),
    };
  },
}));

// Stub the single-study renderer so we can detect whether it was the chosen
// PDF target. The stub returns a marker we can identify by name.
function ReportDocumentStub(): null {
  return null;
}
ReportDocumentStub.displayName = 'ReportDocument';
vi.mock('../pdf/ReportDocument', () => ({
  ReportDocument: ReportDocumentStub,
}));

// Stub the unified renderer (Phase 4b). Same trick — identifiable by
// displayName. Tests assert the correct component is the PDF target.
function UnifiedReportDocumentStub(): null {
  return null;
}
UnifiedReportDocumentStub.displayName = 'UnifiedReportDocument';
vi.mock('../pdf/UnifiedReportDocument', () => ({
  UnifiedReportDocument: UnifiedReportDocumentStub,
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

// Phase 4a — buildEncounterBundle stub. Tests assert it is called with the
// encounter + studyForms when in unified mode. Defined via vi.hoisted() so
// the mock factory (which is hoisted to top of file) can reference it.
const { buildEncounterBundleMock } = vi.hoisted(() => ({
  buildEncounterBundleMock: vi.fn((_input?: unknown) => ({
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [],
  })),
}));
vi.mock('../../services/fhirBuilder', async () => {
  // Preserve the real downloadFhirBundle export so single-study tests still hit it.
  const actual = await vi.importActual<typeof import('../../services/fhirBuilder')>(
    '../../services/fhirBuilder',
  );
  return {
    ...actual,
    buildEncounterBundle: buildEncounterBundleMock,
  };
});

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

const arterialForm: FormState = {
  studyType: 'arterialLE',
  header: {
    patientName: 'Test Patient',
    patientId: '12345678901',
    studyDate: '2026-04-25',
  },
  segments: [],
  narrative: {},
  recommendations: [],
  parameters: {
    segmentFindings: {
      'sfa-left': { stenosisPct: 50 },
    } as unknown as string,
  },
};

function buildEncounter(overrides: Partial<EncounterDraft> = {}): EncounterDraft {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    encounterId: 'enc-1',
    header: {
      patientName: 'Test Patient',
      patientId: '12345678901',
      encounterDate: '2026-04-25',
    },
    selectedStudyTypes: ['venousLEBilateral'],
    studies: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as EncounterDraft;
}

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

/**
 * Render FormActions inside a real EncounterCtx provider so the optional
 * `useContext(EncounterCtx)` lookup in FormActions resolves to our test
 * encounter. We don't need the full `EncounterProvider` (which loads from
 * IDB) — a stub Provider with hand-built value is enough.
 */
function WrapWithEncounter({
  encounter,
  children,
}: {
  encounter: EncounterDraft | null;
  children: React.ReactNode;
}): React.ReactElement {
  const value = {
    encounter,
    isLoading: false,
    updateHeader: () => {},
    addStudy: () => {},
    removeStudy: () => {},
    setStudyState: () => {},
    clearEncounter: () => Promise.resolve(),
  };
  return (
    <MantineProvider>
      <TranslationProvider>
        <EncounterCtx.Provider value={value}>{children}</EncounterCtx.Provider>
      </TranslationProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  loadAnatomyMock.mockClear();
  pdfRenderTarget.mockClear();
  buildEncounterBundleMock.mockClear();
  (notifications.show as ReturnType<typeof vi.fn>).mockClear();
});

// NB: do NOT call `vi.restoreAllMocks()` here — it tears down the
// `vi.mock()` factories above (anatomyToPdfSvg, @react-pdf/renderer,
// fhirBuilder, etc.) and the next test sees the real modules.

describe('FormActions — venous PDF anatomy source (Wave 1.1)', () => {
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

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'boom' }),
      );
    });

    downloadSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe('FormActions — Phase 4c encounter-mode branching', () => {
  it('1-study encounter renders single-study <ReportDocument> on Download PDF', async () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['venousLEBilateral'],
      studies: { venousLEBilateral: venousForm },
    });

    render(
      <WrapWithEncounter encounter={encounter}>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="venous-le-test-2026-04-25"
        />
      </WrapWithEncounter>,
    );

    fireEvent.click(screen.getByTestId('download-pdf'));

    await waitFor(() => {
      expect(pdfRenderTarget).toHaveBeenCalled();
    });

    // The rendered element should be the single-study ReportDocument stub.
    const renderedDoc = pdfRenderTarget.mock.calls[0]?.[0] as { type: { displayName?: string; name?: string } };
    expect(renderedDoc?.type?.displayName ?? renderedDoc?.type?.name).toBe('ReportDocument');
  });

  it('null encounter (legacy mount) falls back to single-study path', async () => {
    render(
      <Wrap>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="venous-le-test"
        />
      </Wrap>,
    );

    fireEvent.click(screen.getByTestId('download-pdf'));

    await waitFor(() => {
      expect(pdfRenderTarget).toHaveBeenCalled();
    });

    const renderedDoc = pdfRenderTarget.mock.calls[0]?.[0] as { type: { displayName?: string; name?: string } };
    expect(renderedDoc?.type?.displayName ?? renderedDoc?.type?.name).toBe('ReportDocument');
  });

  it('2-study encounter (both complete) renders <UnifiedReportDocument> on Download PDF', async () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
      studies: {
        venousLEBilateral: venousForm,
        arterialLE: arterialForm,
      },
    });

    render(
      <WrapWithEncounter encounter={encounter}>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="venous-le-test-2026-04-25"
        />
      </WrapWithEncounter>,
    );

    const downloadBtn = screen.getByTestId('download-pdf');
    expect(downloadBtn).not.toBeDisabled();

    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(pdfRenderTarget).toHaveBeenCalled();
    });

    const renderedDoc = pdfRenderTarget.mock.calls[0]?.[0] as {
      type: { displayName?: string; name?: string };
      props: { studyForms: FormState[]; encounter: EncounterDraft };
    };
    expect(renderedDoc?.type?.displayName ?? renderedDoc?.type?.name).toBe('UnifiedReportDocument');
    // Both forms should be passed through, in selectedStudyTypes order.
    expect(renderedDoc.props.studyForms).toHaveLength(2);
    expect(renderedDoc.props.studyForms[0]?.studyType).toBe('venousLEBilateral');
    expect(renderedDoc.props.studyForms[1]?.studyType).toBe('arterialLE');
    expect(renderedDoc.props.encounter.encounterId).toBe('enc-1');
  });

  it('2-study encounter (both complete) calls buildEncounterBundle on Export FHIR', async () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
      studies: {
        venousLEBilateral: venousForm,
        arterialLE: arterialForm,
      },
    });

    // Stub out the actual download mechanism; we only care that
    // buildEncounterBundle was invoked with the right shape.
    const createUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    const revokeUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    render(
      <WrapWithEncounter encounter={encounter}>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="venous-le-test-2026-04-25"
        />
      </WrapWithEncounter>,
    );

    fireEvent.click(screen.getByTestId('export-json'));

    await waitFor(() => {
      expect(buildEncounterBundleMock).toHaveBeenCalled();
    });

    const callInput = buildEncounterBundleMock.mock.calls[0]?.[0] as {
      encounter: EncounterDraft;
      studyForms: FormState[];
    };
    expect(callInput.encounter.encounterId).toBe('enc-1');
    expect(callInput.studyForms).toHaveLength(2);
    expect(callInput.studyForms.map((f) => f.studyType)).toEqual([
      'venousLEBilateral',
      'arterialLE',
    ]);

    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
  });

  it('2-study encounter with one study missing findings disables exports + shows tooltip', async () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
      // Only venous has findings; arterial slot is missing entirely.
      studies: {
        venousLEBilateral: venousForm,
      },
    });

    render(
      <WrapWithEncounter encounter={encounter}>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges={false}
          onSaveDraft={() => {}}
          baseFilename="venous-le-test-2026-04-25"
        />
      </WrapWithEncounter>,
    );

    expect(screen.getByTestId('download-pdf')).toBeDisabled();
    expect(screen.getByTestId('preview-pdf')).toBeDisabled();
    expect(screen.getByTestId('export-json')).toBeDisabled();

    // Mantine Tooltip renders its label only when visible (hover/focus).
    // Hover the disabled-button wrapper to trigger Mantine's positioning,
    // then assert the localized "complete all studies" message appears.
    const downloadBtn = screen.getByTestId('download-pdf');
    fireEvent.mouseEnter(downloadBtn.parentElement!);

    await waitFor(() => {
      const tooltips = screen.queryAllByText(/Complete all studies/i);
      expect(tooltips.length).toBeGreaterThan(0);
    });
  });
});
