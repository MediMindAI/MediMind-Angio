// SPDX-License-Identifier: Apache-2.0
/**
 * FormActions — sticky bottom action bar.
 *
 * Left: last-saved indicator (read from EncounterContext: the last CONFIRMED
 * save, so it survives a reload; a failed save and a stale-tab state show as
 * persistent notices above the bar — UX-ANGIO-001 L3 / 002 L2).
 * Right: Save draft · Preview PDF · Print · Download PDF (the one primary).
 *
 * Download PDF uses the existing `@react-pdf/renderer` pipeline via the
 * lazy-import pattern.
 *
 * Phase 4c — encounter-mode wiring
 * --------------------------------
 * When `useEncounter()` exposes ≥ 2 selected studies, the export buttons
 * pivot to the unified path:
 *   - PDF: `<UnifiedReportDocument>` (Phase 4b) over every study form
 *
 * If any selected study has no findings yet, the combined report stays
 * locked; when the ACTIVE study is complete, preview / print / download fall
 * back to the single-study renderer for that study alone (UX-ANGIO-008), and
 * an inline note names the unfinished studies.
 *
 * Reads encounter context via `useContext(EncounterCtx)` — the optional
 * variant — so legacy single-study callers (which don't mount an
 * EncounterProvider, e.g. existing test harness) keep working.
 */

import { memo, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { EMRButton, EMRNotice, EMRTooltip } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';
import { EncounterCtx } from '../../contexts/EncounterContext';
import type { FormState } from '../../types/form';
import type { EncounterDraft } from '../../types/encounter';
import type { StudyType } from '../../types/study';
import { projectStudyToFormState } from '../../services/encounterProjection';
import { buildReportLabels } from '../pdf/buildReportLabels';
import { buildLocalizedNarrative, buildLocalizedNarrativeFromForm } from '../../services/narrativeService';
import { localDateToIso } from '../../services/dateHelpers';
import {
  isArterialFindings,
  isCarotidFindings,
  isCarotidNascet,
  isVenousFindings,
} from '../../types/parameters';
import type { VenousSegmentFindings } from '../studies/venous-le/config';
import type { AnatomyToPdfResult } from '../pdf/anatomyToPdfSvg';
import classes from './FormActions.module.css';

export interface FormActionsProps {
  readonly form: FormState;
  /**
   * Legacy fallback only. Under an EncounterProvider the bar reads the
   * confirmed save time from the context (UX-ANGIO-002 L2); this prop is used
   * only when no provider is mounted. Kept so the 4 study forms compile.
   */
  readonly lastSavedAt?: Date | null;
  /** Accepted and ignored (UX-ANGIO-002 L2): the save dot is always neutral. */
  readonly hasUnsavedChanges?: boolean;
  readonly onSaveDraft: () => void;
  /** The filename used for both PDF and JSON exports. */
  readonly baseFilename: string;
  /**
   * Caller-driven export gate (audit M7) — when true, PDF/JSON export is
   * disabled regardless of mode (e.g. an untouched form that would otherwise
   * emit a confident "normal" report). ORs with the unified-mode gate.
   */
  readonly exportsDisabled?: boolean;
  /** Inline reason shown under the buttons when `exportsDisabled` is set. */
  readonly exportsDisabledReason?: string;
}

/**
 * Format a Date as HH:MM:SS using the active app locale.
 *
 * `Intl.DateTimeFormat` honours the supplied locale tag — passing the active
 * `lang` from `TranslationContext` ensures Russian/Georgian/English UI all
 * see a consistent 24-hour clock instead of falling back to the host
 * locale's preference (which can flip to AM/PM on US English systems).
 */
function formatTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * A study slot is "complete" when its mirrored state carries at least one
 * finding. Phase 4c keeps the predicate simple — Phase 5 may upgrade to
 * "% of required parameters filled" semantics. We treat any object with a
 * non-empty `parameters.segmentFindings` map OR any non-empty `findings`
 * map (per-study reducer state) as complete.
 */
function isStudyComplete(encounter: EncounterDraft, studyType: StudyType): boolean {
  const slot = encounter.studies[studyType];
  if (!slot || typeof slot !== 'object') return false;
  const candidate = slot as {
    findings?: Record<string, unknown>;
    parameters?: { segmentFindings?: Record<string, unknown> };
  };
  if (candidate.findings && Object.keys(candidate.findings).length > 0) return true;
  if (
    candidate.parameters?.segmentFindings &&
    Object.keys(candidate.parameters.segmentFindings).length > 0
  ) {
    return true;
  }
  return false;
}

/** Translation key for a study's short name (all venous variants share one). */
function studyShortKey(studyType: StudyType): string {
  return `studies.${studyType.startsWith('venousLE') ? 'venousLE' : studyType}.short`;
}

/**
 * Which report the export buttons produce (UX-ANGIO-008):
 *   - 'combined': every study in a multi-study visit is complete → one PDF.
 *   - 'single':   a one-study visit, a legacy mount, OR a multi-study visit
 *                 whose ACTIVE study is complete while another is not → the
 *                 active study's own PDF (existing single-study renderer).
 *   - 'blocked':  multi-study visit and the active study itself is empty.
 * The combined report keeps its all-complete rule; an empty study is never
 * silently dropped from it.
 */
type ExportMode = 'combined' | 'single' | 'blocked';

/**
 * Load a PDF blob URL into an off-screen iframe and open the print dialog
 * (UX-ANGIO-014). Falls back to opening the PDF in a new tab when the browser
 * refuses to print a framed PDF. Returns the iframe so the caller can remove
 * it later — it must stay mounted while the print dialog is open.
 */
function printPdfUrl(url: string, frameClass: string | undefined): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  if (frameClass) frame.className = frameClass;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.setAttribute('data-testid', 'print-frame');
  const openInTab = (): void => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      openInTab();
      return;
    }
    try {
      win.focus();
      win.print();
    } catch {
      openInTab();
    }
  };
  frame.src = url;
  document.body.appendChild(frame);
  return frame;
}

/**
 * Lazily resolve every module needed to build per-study assets. Returned as
 * an opaque bag so callers can reuse it across multiple studies in unified
 * mode without re-doing dynamic imports — also sidesteps a vitest race
 * where parallel `Promise.all` dynamic imports occasionally bypass mocks.
 */
type AssetDeps = {
  loadAnatomyForPdf: typeof import('../pdf/anatomyToPdfSvg').loadAnatomyForPdf;
  isVenousForm: typeof import('../../types/form').isVenousForm;
  arterialCompetencyForSvgId: typeof import('../studies/arterial-le/config').arterialCompetencyForSvgId;
  resolveCarotidBand: typeof import('../studies/carotid/config').resolveCarotidBand;
  carotidDiagramColor: typeof import('../studies/carotid/config').carotidDiagramColor;
  effectiveNascet: typeof import('../studies/carotid/stenosisCalculator').effectiveNascet;
  SEVERITY_COLORS: typeof import('../../constants/theme-colors').SEVERITY_COLORS;
};

async function loadAssetDeps(): Promise<AssetDeps> {
  const [
    { loadAnatomyForPdf },
    { isVenousForm },
    { arterialCompetencyForSvgId },
    { resolveCarotidBand, carotidDiagramColor },
    { effectiveNascet },
    { SEVERITY_COLORS },
  ] = await Promise.all([
    import('../pdf/anatomyToPdfSvg'),
    import('../../types/form'),
    import('../studies/arterial-le/config'),
    import('../studies/carotid/config'),
    import('../studies/carotid/stenosisCalculator'),
    import('../../constants/theme-colors'),
  ]);
  return {
    loadAnatomyForPdf,
    isVenousForm,
    arterialCompetencyForSvgId,
    resolveCarotidBand,
    carotidDiagramColor,
    effectiveNascet,
    SEVERITY_COLORS,
  };
}

/**
 * Resolve per-study PDF assets — anatomy SVG + localized narrative — using
 * the same lazy-import pattern the single-study path uses. Mirrors the
 * branching logic at the top of `renderPdfBlob` so Phase 4b's
 * `<UnifiedReportDocument>` receives one assets object per study.
 */
async function resolveStudyAssets(
  studyForm: FormState,
  t: ReturnType<typeof useTranslation>['t'],
  deps?: AssetDeps,
): Promise<{
  anatomy: { anterior: unknown; posterior: unknown };
  localized: ReturnType<typeof buildLocalizedNarrative> | undefined;
}> {
  const {
    loadAnatomyForPdf,
    isVenousForm,
    arterialCompetencyForSvgId,
    resolveCarotidBand,
    carotidDiagramColor,
    effectiveNascet,
    SEVERITY_COLORS,
  } = deps ?? (await loadAssetDeps());

  let anatomy: { anterior: unknown; posterior: unknown } = {
    anterior: null,
    posterior: null,
  };
  let localized: ReturnType<typeof buildLocalizedNarrative> | undefined;

  if (isVenousForm(studyForm)) {
    const rawFindings = studyForm.parameters['segmentFindings'];
    const findings: VenousSegmentFindings = isVenousFindings(rawFindings) ? rawFindings : {};
    const rawDrawings = studyForm.parameters['drawings'];
    const drawings = Array.isArray(rawDrawings)
      ? (rawDrawings as ReadonlyArray<import('../../types/drawing').DrawingStroke>)
      : [];
    // Venous now carries every vessel (deep + superficial) on the anterior
    // view, so the posterior diagram is redundant — omit it from the report.
    const anterior = await loadAnatomyForPdf('le-anterior', findings, { drawings });
    anatomy = { anterior, posterior: null };
    // No auto-generated narrative for venous — the doctor writes the per-limb
    // findings and conclusion by hand (they ride on `form.narrative`).
  } else if (studyForm.studyType === 'arterialLE') {
    const rawFindings = studyForm.parameters['segmentFindings'];
    const arterialFindings = isArterialFindings(rawFindings) ? rawFindings : {};
    const competencyFn = (fullId: string): { fill: string; stroke: string } => {
      const band = arterialCompetencyForSvgId(arterialFindings, fullId);
      return SEVERITY_COLORS[band];
    };
    const rawArterialDrawings = studyForm.parameters['drawings'];
    const arterialDrawings = Array.isArray(rawArterialDrawings)
      ? (rawArterialDrawings as ReadonlyArray<import('../../types/drawing').DrawingStroke>)
      : [];
    const anterior = await loadAnatomyForPdf('le-arterial-anterior', {}, {
      competencyFn,
      drawings: arterialDrawings,
    });
    anatomy = { anterior, posterior: null };
    localized = buildLocalizedNarrativeFromForm(studyForm, t);
  } else if (studyForm.studyType === 'carotid') {
    const rawFindings = studyForm.parameters['segmentFindings'];
    const carotidFindings = isCarotidFindings(rawFindings) ? rawFindings : {};
    const rawNascet = studyForm.parameters['nascet'];
    // Mirror the form: explicit NASCET, else the SRU velocity suggestion, so the
    // PDF diagram colors the ICA/bulb identically to the on-screen diagram.
    const nascet = effectiveNascet(
      carotidFindings,
      isCarotidNascet(rawNascet) ? rawNascet : {},
    );
    const competencyFn = (fullId: string): { fill: string; stroke: string } => {
      const band = resolveCarotidBand(carotidFindings, nascet, fullId);
      return carotidDiagramColor(fullId, band);
    };
    const rawDrawings = studyForm.parameters['drawings'];
    const drawings = Array.isArray(rawDrawings)
      ? (rawDrawings as ReadonlyArray<import('../../types/drawing').DrawingStroke>)
      : [];
    const anterior = await loadAnatomyForPdf('neck-carotid', {}, { competencyFn, drawings });
    anatomy = { anterior, posterior: null };
    localized = buildLocalizedNarrativeFromForm(studyForm, t);
  } else if (studyForm.studyType === 'iliacPelvicVenous') {
    // Static illustration backdrop + clinician free-draw/text; no competency
    // coloring. Pass empty findings + no competencyFn so only the backdrop
    // image and the drawings/text reach the PDF.
    const rawDrawings = studyForm.parameters['drawings'];
    const drawings = Array.isArray(rawDrawings)
      ? (rawDrawings as ReadonlyArray<import('../../types/drawing').DrawingStroke>)
      : [];
    const anterior = await loadAnatomyForPdf('abdominal-pelvic', {}, { drawings });
    anatomy = { anterior, posterior: null };
    localized = buildLocalizedNarrativeFromForm(studyForm, t);
  }

  return { anatomy, localized };
}

/**
 * Produce a localized FormState — pre-resolves recommendation textKeys via
 * `t()` so @react-pdf (which has no access to React context) renders the
 * same prose the web UI shows.
 */
function localizeForm(
  form: FormState,
  t: ReturnType<typeof useTranslation>['t'],
): FormState {
  return {
    ...form,
    recommendations: form.recommendations.map((r) => ({
      ...r,
      text: r.textKey ? t(r.textKey, r.text) : r.text,
    })),
  } as FormState;
}

export const FormActions = memo(function FormActions({
  form,
  lastSavedAt: lastSavedAtProp = null,
  onSaveDraft,
  baseFilename,
  exportsDisabled: exportsDisabledProp = false,
  exportsDisabledReason,
}: FormActionsProps): React.ReactElement {
  const { t, lang } = useTranslation();
  // Matches the FormActions.module.css phone breakpoint (icon-only buttons).
  const isPhone = useMediaQuery('(max-width: 576px)') ?? false;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreviewing, setPdfPreviewing] = useState(false);
  const [pdfPrinting, setPdfPrinting] = useState(false);
  const exportNoteId = useId();
  // The print iframe must outlive the (modal) print dialog, so it is kept
  // until the next print or unmount instead of on a timer.
  const printFrameRef = useRef<{ frame: HTMLIFrameElement; url: string } | null>(null);
  useEffect(
    () => () => {
      const prev = printFrameRef.current;
      if (prev) {
        prev.frame.remove();
        URL.revokeObjectURL(prev.url);
      }
    },
    [],
  );

  // Phase 4c — read encounter optionally so legacy single-study mounts
  // (which don't wrap in <EncounterProvider>) keep working unchanged.
  const encounterCtx = useContext(EncounterCtx);
  const encounter = encounterCtx?.encounter ?? null;

  const { isUnifiedMode, exportMode, unfinishedTypes, studyForms } = useMemo((): {
    isUnifiedMode: boolean;
    exportMode: ExportMode;
    unfinishedTypes: ReadonlyArray<StudyType>;
    studyForms: FormState[];
  } => {
    if (!encounter) {
      return { isUnifiedMode: false, exportMode: 'single', unfinishedTypes: [], studyForms: [form] };
    }
    const unified = encounter.selectedStudyTypes.length >= 2;
    if (!unified) {
      return { isUnifiedMode: false, exportMode: 'single', unfinishedTypes: [], studyForms: [form] };
    }
    const unfinished = encounter.selectedStudyTypes.filter(
      (type) => !isStudyComplete(encounter, type),
    );
    const mode: ExportMode =
      unfinished.length === 0
        ? 'combined'
        : isStudyComplete(encounter, form.studyType)
          ? 'single'
          : 'blocked';
    // Collect each study's mirrored state. The active study uses the live
    // `form` prop (already projected via the per-study form's toFormState);
    // others come from `encounter.studies`. Those slots are RAW Phase-3b
    // V1/V2 reducer state — `findings` is a top-level field, NOT inside a
    // `parameters` bag. We project them through `projectStudyToFormState`
    // so downstream PDF / FHIR builders see the unified `FormState` shape
    // they expect (parameters.segmentFindings etc.).
    //
    // Without this projection, `resolveStudyAssets` blew up reading
    // `studyForm.parameters['segmentFindings']` on the non-active studies.
    const collected: Array<FormState | null> = encounter.selectedStudyTypes.map((type) => {
      if (type === form.studyType) return form;
      const slot = encounter.studies[type];
      return projectStudyToFormState(type, slot, encounter);
    });
    const validForms = collected.filter((f): f is FormState => Boolean(f && f.studyType));
    return {
      isUnifiedMode: unified,
      exportMode: mode,
      unfinishedTypes: unfinished,
      studyForms: validForms,
    };
  }, [encounter, form]);

  const handleSaveDraft = useCallback(() => {
    onSaveDraft();
  }, [onSaveDraft]);

  /**
   * Single-study PDF blob — the pre-Phase-4c path. Used for the 1-study
   * encounter case AND the per-study escape hatch when not all studies are
   * complete in unified mode.
   */
  const renderSingleStudyPdfBlob = useCallback(
    async (targetForm: FormState): Promise<Blob> => {
      const [{ pdf }, { ReportDocument }, { registerFontsAsync }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../pdf/ReportDocument'),
        import('../../services/fontService'),
      ]);
      await registerFontsAsync();
      const labels = buildReportLabels(t, targetForm, lang);
      const { anatomy, localized } = await resolveStudyAssets(targetForm, t);
      const localizedForm = localizeForm(targetForm, t);

      return pdf(
        <ReportDocument
          form={localizedForm}
          labels={labels}
          // Cast — anatomy resolution is internally typed but shape is
          // stable across the resolveStudyAssets implementation.
          anatomy={anatomy as Parameters<typeof ReportDocument>[0]['anatomy']}
          rightFindings={localized?.rightFindings}
          leftFindings={localized?.leftFindings}
          conclusions={localized?.conclusions}
          generatedAt={new Date().toISOString()}
          lang={lang}
        />,
      ).toBlob();
    },
    [t, lang],
  );

  /**
   * Unified PDF blob — Phase 4c hand-off to Phase 4b's UnifiedReportDocument.
   * Renders ALL study forms in the encounter into a single multi-study PDF.
   */
  const renderUnifiedPdfBlob = useCallback(async (): Promise<Blob> => {
    if (!encounter) {
      throw new Error('Unified export requested without encounter context');
    }
    const [{ pdf }, { UnifiedReportDocument }, { registerFontsAsync }] = await Promise.all([
      import('@react-pdf/renderer'),
      // Phase 4b: UnifiedReportDocument. The merge gate after all three
      // Phase 4 agents land validates the exact prop wiring.
      import('../pdf/UnifiedReportDocument'),
      import('../../services/fontService'),
    ]);
    await registerFontsAsync();

    const localizedForms = studyForms.map((f) => localizeForm(f, t));
    // Load dynamic-import deps ONCE and reuse across all per-study asset
    // resolutions — sidesteps a vitest race observed when N parallel
    // resolveStudyAssets calls each issued their own dynamic imports.
    const deps = await loadAssetDeps();
    const resolvedAssets = await Promise.all(
      localizedForms.map((f) => resolveStudyAssets(f, t, deps)),
    );
    const perStudyAssets = localizedForms.map((f, idx) => ({
      form: f,
      labels: buildReportLabels(t, f, lang),
      anatomy: resolvedAssets[idx]!.anatomy as {
        anterior: AnatomyToPdfResult | null;
        posterior: AnatomyToPdfResult | null;
      },
      localized: resolvedAssets[idx]!.localized,
    }));

    return pdf(
      <UnifiedReportDocument
        encounter={encounter}
        studyForms={localizedForms}
        perStudyAssets={perStudyAssets}
        generatedAt={new Date().toISOString()}
        lang={lang}
      />,
    ).toBlob();
  }, [encounter, studyForms, t, lang]);

  const isCombined = exportMode === 'combined';

  /**
   * The one blob preview, print and download all share — so the printed PDF
   * is byte-for-byte the previewed one (UX-ANGIO-014 §4.4).
   */
  const renderExportBlob = useCallback(
    (): Promise<Blob> => (isCombined ? renderUnifiedPdfBlob() : renderSingleStudyPdfBlob(form)),
    [isCombined, renderUnifiedPdfBlob, renderSingleStudyPdfBlob, form],
  );

  const handleDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const blob = await renderExportBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const patientSlug = (encounter?.header.patientName || 'patient').replace(/\s+/g, '-');
      // Every study's PDF carries the patient name like venous does (U-1001):
      // `carotid-2026-11-12` → `carotid-<patient>-2026-11-12`.
      const singleName = baseFilename.includes(`-${patientSlug}-`)
        ? baseFilename
        : baseFilename.replace(/-(\d{4}-\d{2}-\d{2}|report)$/, `-${patientSlug}-$1`);
      const filename = isCombined
        ? `encounter-${patientSlug}-${
            encounter?.header.encounterDate ?? localDateToIso(new Date()) ?? ''
          }.pdf`
        : `${singleName}.pdf`;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notifications.show({
        color: 'red',
        title: t('formActions.pdfDownloadFailed'),
        message,
      });
       
      console.error('[FormActions] PDF download failed', {
        err,
        patientId: form.header.patientId,
        studyType: form.studyType,
        unified: isUnifiedMode,
        exportMode,
      });
    } finally {
      setPdfLoading(false);
    }
  }, [
    isUnifiedMode,
    exportMode,
    isCombined,
    renderExportBlob,
    form,
    baseFilename,
    encounter?.header.patientName,
    encounter?.header.encounterDate,
    t,
  ]);

  const handlePreviewPdf = useCallback(async () => {
    setPdfPreviewing(true);
    try {
      const blob = await renderExportBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke a bit later so the new tab has time to pull the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notifications.show({
        color: 'red',
        title: t('formActions.pdfPreviewFailed'),
        message,
      });
       
      console.error('[FormActions] PDF preview failed', {
        err,
        patientId: form.header.patientId,
        studyType: form.studyType,
        unified: isUnifiedMode,
        exportMode,
      });
    } finally {
      setPdfPreviewing(false);
    }
  }, [
    isUnifiedMode,
    exportMode,
    renderExportBlob,
    form,
    t,
  ]);

  const handlePrintPdf = useCallback(async () => {
    setPdfPrinting(true);
    try {
      const blob = await renderExportBlob();
      const url = URL.createObjectURL(blob);
      const prev = printFrameRef.current;
      if (prev) {
        prev.frame.remove();
        URL.revokeObjectURL(prev.url);
      }
      printFrameRef.current = { frame: printPdfUrl(url, classes.printFrame), url };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notifications.show({
        color: 'red',
        title: t('formActions.pdfPrintFailed', 'Failed to print PDF'),
        message,
      });
      console.error('[FormActions] PDF print failed', {
        err,
        patientId: form.header.patientId,
        studyType: form.studyType,
        unified: isUnifiedMode,
        exportMode,
      });
    } finally {
      setPdfPrinting(false);
    }
  }, [isUnifiedMode, exportMode, renderExportBlob, form, t]);

  // UX-ANGIO-002 L2 — the context is the one source of truth for save state
  // (confirmed save time, survives reload). The prop is a legacy fallback for
  // mounts without an EncounterProvider.
  const ctxSaveState = encounterCtx !== null && encounterCtx.lastSavedAt !== undefined;
  const lastSavedAt = ctxSaveState ? (encounterCtx.lastSavedAt ?? null) : lastSavedAtProp;
  const saveError = encounterCtx?.saveError ?? null;
  const staleFromOtherTab = encounterCtx?.staleFromOtherTab ?? false;

  const savedText = lastSavedAt
    ? `${t('venousLE.actions.lastSaved')} ${formatTime(lastSavedAt, lang)}`
    : t('venousLE.actions.neverSaved');

  const exportsDisabled = exportMode === 'blocked' || exportsDisabledProp;

  // UX-ANGIO-008 — the reason is shown inline (not only in a hover tooltip),
  // naming the studies that are not finished yet.
  const unfinishedNames = unfinishedTypes
    .map((type) => t(studyShortKey(type), type))
    .join(', ');
  let exportNote: string | null = null;
  if (exportMode === 'blocked') {
    exportNote = t(
      'formActions.recordThisStudyFirst',
      'Record at least one finding in this study to export its PDF. Not finished: {studies}',
    ).replace('{studies}', unfinishedNames);
  } else if (isUnifiedMode && exportMode === 'single') {
    exportNote = t(
      'formActions.thisStudyOnly',
      'The PDF contains this study only. The combined report unlocks when every study is done. Not finished: {studies}',
    ).replace('{studies}', unfinishedNames);
  } else if (exportsDisabledProp && exportsDisabledReason) {
    exportNote = exportsDisabledReason;
  }
  const describedBy = exportNote ? exportNoteId : undefined;
  const saveDraftLabel = t('venousLE.actions.saveDraft');
  const previewLabel = t('venousLE.actions.previewPDF');
  const printLabel = t('venousLE.actions.printPDF', 'Print');

  return (
    <div className={`${classes.bar} no-print`} role="region" aria-label={t('common.actionsRegion', 'Actions')}>
      {(staleFromOtherTab || saveError) && (
        <div className={classes.notices}>
          {staleFromOtherTab && (
            <EMRNotice
              color="info"
              icon={IconRefresh}
              title={t(
                'venousLE.actions.staleOtherTab',
                'This visit was changed in another window. Reload the page.',
              )}
              data-testid="stale-tab-notice"
            >
              <EMRButton
                variant="secondary"
                size="sm"
                icon={IconRefresh}
                onClick={() => window.location.reload()}
                data-testid="reload-page"
                className={classes.noticeAction}
              >
                {t('venousLE.actions.reloadPage', 'Reload page')}
              </EMRButton>
            </EMRNotice>
          )}
          {saveError && (
            <EMRNotice
              color="info"
              icon={IconAlertTriangle}
              title={
                saveError === 'write-failed'
                  ? t(
                      'venousLE.actions.saveFailed',
                      'Saving failed. Your answers are only on screen for now. Do not close the page.',
                    )
                  : t(
                      'venousLE.actions.saveCacheFailed',
                      'Browser storage is full. A reload may show older answers.',
                    )
              }
              data-testid="save-failed-notice"
            />
          )}
        </div>
      )}

      <div className={classes.inner}>
        <div className={classes.status} data-save-state={saveError ? 'failed' : lastSavedAt ? 'saved' : 'never'}>
          <span className={classes.dot} aria-hidden />
          <Text className={classes.statusText} data-testid="save-status">{savedText}</Text>
        </div>

        <Group gap="xs" wrap="wrap" className={classes.buttons}>
          {/* On phones these three collapse to 44px icon-only buttons (the
              label span is hidden by CSS); the aria-label and tooltip carry
              the name. Download PDF keeps its full label as the one primary. */}
          <EMRTooltip label={saveDraftLabel} disabled={!isPhone}>
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconDeviceFloppy}
              onClick={handleSaveDraft}
              aria-label={saveDraftLabel}
              className={classes.iconOnlyOnPhone}
              data-testid="save-draft"
            >
              <span className={classes.phoneHiddenLabel}>{saveDraftLabel}</span>
            </EMRButton>
          </EMRTooltip>

          <EMRTooltip label={previewLabel} disabled={!isPhone}>
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconEye}
              onClick={handlePreviewPdf}
              loading={pdfPreviewing}
              disabled={exportsDisabled}
              aria-label={previewLabel}
              aria-describedby={describedBy}
              className={classes.iconOnlyOnPhone}
              data-testid="preview-pdf"
            >
              <span className={classes.phoneHiddenLabel}>{previewLabel}</span>
            </EMRButton>
          </EMRTooltip>

          <EMRTooltip label={printLabel} disabled={!isPhone}>
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconPrinter}
              onClick={handlePrintPdf}
              loading={pdfPrinting}
              disabled={exportsDisabled}
              aria-label={printLabel}
              aria-describedby={describedBy}
              className={classes.iconOnlyOnPhone}
              data-testid="print-pdf"
            >
              <span className={classes.phoneHiddenLabel}>{printLabel}</span>
            </EMRButton>
          </EMRTooltip>

          <EMRButton
            variant="primary"
            size="sm"
            icon={IconDownload}
            onClick={handleDownloadPdf}
            loading={pdfLoading}
            disabled={exportsDisabled}
            aria-describedby={describedBy}
            className={classes.primaryOnPhone}
            data-testid="download-pdf"
          >
            {t('venousLE.actions.downloadPDF')}
          </EMRButton>
        </Group>

        {exportNote && (
          <Text id={exportNoteId} className={classes.exportNote} data-testid="export-note">
            {exportNote}
          </Text>
        )}
      </div>
    </div>
  );
});

export default FormActions;
