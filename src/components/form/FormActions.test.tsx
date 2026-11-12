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
 *       2-study encounter, active complete + other empty → the active
 *         study's own <ReportDocument> exports, inline note names the other
 *         (UX-ANGIO-008).
 *       2-study encounter, active empty → exports disabled, inline reason.
 *   - UX-ANGIO-001 L3 / 002 L2: stale-tab notice + reload, failed-save notice,
 *     save time read from the context (survives reload), neutral dot.
 *   - UX-ANGIO-014: print renders the same document the preview renders.
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
import type { EncounterContextValue } from '../../contexts/EncounterContext';
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
  buildLocalizedNarrativeFromForm: () => undefined,
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
  ctx = {},
  children,
}: {
  encounter: EncounterDraft | null;
  ctx?: Partial<EncounterContextValue>;
  children: React.ReactNode;
}): React.ReactElement {
  const value: EncounterContextValue = {
    ...ctx,
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

  it('2-study encounter: active study complete + other empty → active study PDF downloads, combined stays locked', async () => {
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

    const downloadBtn = screen.getByTestId('download-pdf');
    expect(downloadBtn).not.toBeDisabled();
    expect(screen.getByTestId('preview-pdf')).not.toBeDisabled();
    expect(screen.getByTestId('print-pdf')).not.toBeDisabled();
    // The reason is visible inline (not hover-only) and names the empty study.
    const note = screen.getByTestId('export-note');
    expect(note.textContent).toMatch(/this study only/i);
    expect(note.textContent).not.toContain('{studies}');
    expect(downloadBtn.getAttribute('aria-describedby')).toBe(note.id);

    fireEvent.click(downloadBtn);
    await waitFor(() => {
      expect(pdfRenderTarget).toHaveBeenCalled();
    });
    const renderedDoc = pdfRenderTarget.mock.calls[0]?.[0] as {
      type: { displayName?: string; name?: string };
      props: { form: FormState };
    };
    expect(renderedDoc?.type?.displayName ?? renderedDoc?.type?.name).toBe('ReportDocument');
    expect(renderedDoc.props.form.studyType).toBe('venousLEBilateral');
  });

  it('2-study encounter: active study empty → exports disabled with an inline reason', () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
      studies: { venousLEBilateral: venousForm },
    });
    const emptyArterial: FormState = { ...arterialForm, parameters: {} };

    render(
      <WrapWithEncounter encounter={encounter}>
        <FormActions
          form={emptyArterial}
          onSaveDraft={() => {}}
          baseFilename="arterial-le-test"
        />
      </WrapWithEncounter>,
    );

    expect(screen.getByTestId('download-pdf')).toBeDisabled();
    expect(screen.getByTestId('preview-pdf')).toBeDisabled();
    expect(screen.getByTestId('print-pdf')).toBeDisabled();
    expect(screen.getByTestId('export-note').textContent).toMatch(/Record at least one finding/i);
  });

  it('caller exportsDisabled reason renders inline', () => {
    render(
      <Wrap>
        <FormActions
          form={venousForm}
          onSaveDraft={() => {}}
          baseFilename="t"
          exportsDisabled
          exportsDisabledReason="Enter at least one finding before exporting."
        />
      </Wrap>,
    );
    expect(screen.getByTestId('download-pdf')).toBeDisabled();
    expect(screen.getByTestId('export-note').textContent).toBe(
      'Enter at least one finding before exporting.',
    );
  });

  it('exactly one primary action: only Download PDF is not secondary-weight', () => {
    render(
      <Wrap>
        <FormActions form={venousForm} onSaveDraft={() => {}} baseFilename="t" />
      </Wrap>,
    );
    for (const id of ['save-draft', 'preview-pdf', 'print-pdf']) {
      expect(screen.getByTestId(id).className).not.toMatch(/primaryButton/);
    }
    expect(screen.getByTestId('download-pdf').className).toMatch(/primaryButton/);
  });
});

describe('FormActions — truthful save line + stale tab (UX-ANGIO-001 L3 / 002 L2)', () => {
  it('reads the confirmed save time from the context, not the stale prop', () => {
    const saved = new Date('2026-04-25T10:11:12');
    render(
      <WrapWithEncounter encounter={buildEncounter()} ctx={{ lastSavedAt: saved, saveError: null }}>
        <FormActions
          form={venousForm}
          lastSavedAt={null}
          hasUnsavedChanges
          onSaveDraft={() => {}}
          baseFilename="t"
        />
      </WrapWithEncounter>,
    );
    expect(screen.getByTestId('save-status').textContent).toContain('10:11:12');
    expect(screen.queryByTestId('save-failed-notice')).toBeNull();
    expect(screen.queryByTestId('stale-tab-notice')).toBeNull();
  });

  it('a failed save shows a persistent notice and keeps the last confirmed time', () => {
    const saved = new Date('2026-04-25T09:08:07');
    render(
      <WrapWithEncounter
        encounter={buildEncounter()}
        ctx={{ lastSavedAt: saved, saveError: 'write-failed' }}
      >
        <FormActions form={venousForm} onSaveDraft={() => {}} baseFilename="t" />
      </WrapWithEncounter>,
    );
    expect(screen.getByTestId('save-failed-notice').textContent).toMatch(/Saving failed/i);
    expect(screen.getByTestId('save-status').textContent).toContain('09:08:07');
    expect(
      screen.getByTestId('save-status').closest('[data-save-state]')?.getAttribute('data-save-state'),
    ).toBe('failed');
  });

  it('a full local cache shows the cache warning', () => {
    render(
      <WrapWithEncounter encounter={buildEncounter()} ctx={{ lastSavedAt: null, saveError: 'cache-failed' }}>
        <FormActions form={venousForm} onSaveDraft={() => {}} baseFilename="t" />
      </WrapWithEncounter>,
    );
    expect(screen.getByTestId('save-failed-notice').textContent).toMatch(/storage is full/i);
  });

  it('staleFromOtherTab shows the reload notice; the button reloads the page', () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    });
    try {
      render(
        <WrapWithEncounter encounter={buildEncounter()} ctx={{ staleFromOtherTab: true }}>
          <FormActions form={venousForm} onSaveDraft={() => {}} baseFilename="t" />
        </WrapWithEncounter>,
      );
      expect(screen.getByTestId('stale-tab-notice').textContent).toMatch(/another window/i);
      fireEvent.click(screen.getByTestId('reload-page'));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});

describe('FormActions — one-click print (UX-ANGIO-014)', () => {
  it('print renders the same document preview renders and loads it into a hidden frame', async () => {
    const createUrl = vi.fn(() => 'blob:fake-pdf');
    const revokeUrl = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      render(
        <Wrap>
          <FormActions form={venousForm} onSaveDraft={() => {}} baseFilename="t" />
        </Wrap>,
      );

      fireEvent.click(screen.getByTestId('preview-pdf'));
      await waitFor(() => expect(pdfRenderTarget).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('print-pdf'));
      await waitFor(() => expect(pdfRenderTarget).toHaveBeenCalledTimes(2));

      const previewDoc = pdfRenderTarget.mock.calls[0]?.[0] as { type: unknown; props: { form: FormState } };
      const printDoc = pdfRenderTarget.mock.calls[1]?.[0] as { type: unknown; props: { form: FormState } };
      expect(printDoc.type).toBe(previewDoc.type);
      expect(printDoc.props.form).toEqual(previewDoc.props.form);

      await waitFor(() => {
        const frame = document.querySelector('[data-testid="print-frame"]');
        expect(frame).not.toBeNull();
        expect(frame?.getAttribute('src')).toBe('blob:fake-pdf');
      });
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      openSpy.mockRestore();
      document.querySelectorAll('[data-testid="print-frame"]').forEach((f) => f.remove());
    }
  });
});

describe('FormActions — PDF filename (U-1001)', () => {
  it('single-study PDF filename carries the patient name like venous does', async () => {
    const encounter = buildEncounter({
      selectedStudyTypes: ['arterialLE'],
      studies: { arterialLE: arterialForm },
    });
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake-pdf');
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    try {
      render(
        <WrapWithEncounter encounter={encounter}>
          <FormActions form={arterialForm} onSaveDraft={() => {}} baseFilename="arterial-le-2026-04-25" />
        </WrapWithEncounter>,
      );
      fireEvent.click(screen.getByTestId('download-pdf'));
      await waitFor(() => expect(downloads).toEqual(['arterial-le-Test-Patient-2026-04-25.pdf']));
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
