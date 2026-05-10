// SPDX-License-Identifier: Apache-2.0
/**
 * FormActions — sticky bottom action bar.
 *
 * Left: last-saved indicator.
 * Right: Save draft · Preview PDF · Download PDF · Export FHIR JSON.
 *
 * Download PDF uses the existing `@react-pdf/renderer` pipeline via the
 * lazy-import pattern. Export JSON uses `downloadFhirBundle` (single-study)
 * or `buildEncounterBundle` (unified, ≥ 2 studies).
 *
 * Phase 4c — encounter-mode wiring
 * --------------------------------
 * When `useEncounter()` exposes ≥ 2 selected studies, the export buttons
 * pivot to the unified path:
 *   - PDF: `<UnifiedReportDocument>` (Phase 4b) over every study form
 *   - FHIR: `buildEncounterBundle` (Phase 4a) — one Patient + one Encounter
 *     + N DiagnosticReports
 *
 * If any selected study has no findings yet, the unified buttons disable
 * with a tooltip and the per-study escape hatch falls back to the legacy
 * single-study path (TODO Phase 5).
 *
 * Reads encounter context via `useContext(EncounterCtx)` — the optional
 * variant — so legacy single-study callers (which don't mount an
 * EncounterProvider, e.g. existing test harness) keep working.
 */

import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { Group, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
} from '@tabler/icons-react';
import { EMRButton } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';
import { EncounterCtx } from '../../contexts/EncounterContext';
import type { FormState } from '../../types/form';
import type { EncounterDraft } from '../../types/encounter';
import type { StudyType } from '../../types/study';
import { downloadFhirBundle } from '../../services/fhirBuilder';
import { projectStudyToFormState } from '../../services/encounterProjection';
import { buildReportLabels } from '../pdf/buildReportLabels';
import { buildLocalizedNarrative } from '../../services/narrativeService';
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
  readonly lastSavedAt: Date | null;
  readonly hasUnsavedChanges: boolean;
  readonly onSaveDraft: () => void;
  /** The filename used for both PDF and JSON exports. */
  readonly baseFilename: string;
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

/**
 * Lazily resolve every module needed to build per-study assets. Returned as
 * an opaque bag so callers can reuse it across multiple studies in unified
 * mode without re-doing dynamic imports — also sidesteps a vitest race
 * where parallel `Promise.all` dynamic imports occasionally bypass mocks.
 */
type AssetDeps = {
  loadAnatomyForPdf: typeof import('../pdf/anatomyToPdfSvg').loadAnatomyForPdf;
  isVenousForm: typeof import('../../types/form').isVenousForm;
  deriveArterialCompetency: typeof import('../studies/arterial-le/config').deriveArterialCompetency;
  deriveCarotidCompetency: typeof import('../studies/carotid/config').deriveCarotidCompetency;
  SEVERITY_COLORS: typeof import('../../constants/theme-colors').SEVERITY_COLORS;
};

async function loadAssetDeps(): Promise<AssetDeps> {
  const [
    { loadAnatomyForPdf },
    { isVenousForm },
    { deriveArterialCompetency },
    { deriveCarotidCompetency },
    { SEVERITY_COLORS },
  ] = await Promise.all([
    import('../pdf/anatomyToPdfSvg'),
    import('../../types/form'),
    import('../studies/arterial-le/config'),
    import('../studies/carotid/config'),
    import('../../constants/theme-colors'),
  ]);
  return {
    loadAnatomyForPdf,
    isVenousForm,
    deriveArterialCompetency,
    deriveCarotidCompetency,
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
    deriveArterialCompetency,
    deriveCarotidCompetency,
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
    const [anterior, posterior] = await Promise.all([
      loadAnatomyForPdf('le-anterior', findings, { drawings }),
      loadAnatomyForPdf('le-posterior', findings, { drawings }),
    ]);
    anatomy = { anterior, posterior };
    localized = buildLocalizedNarrative(findings, t);
  } else if (studyForm.studyType === 'arterialLE') {
    const rawFindings = studyForm.parameters['segmentFindings'];
    const arterialFindings = isArterialFindings(rawFindings) ? rawFindings : {};
    const competencyFn = (fullId: string): { fill: string; stroke: string } => {
      const band = deriveArterialCompetency(
        arterialFindings[fullId as keyof typeof arterialFindings],
      );
      return SEVERITY_COLORS[band];
    };
    const anterior = await loadAnatomyForPdf('le-arterial-anterior', {}, { competencyFn });
    anatomy = { anterior, posterior: null };
  } else if (studyForm.studyType === 'carotid') {
    const rawFindings = studyForm.parameters['segmentFindings'];
    const carotidFindings = isCarotidFindings(rawFindings) ? rawFindings : {};
    const rawNascet = studyForm.parameters['nascet'];
    const nascet = isCarotidNascet(rawNascet) ? rawNascet : {};
    const competencyFn = (fullId: string): { fill: string; stroke: string } => {
      const side = fullId.endsWith('-left') ? 'left' : fullId.endsWith('-right') ? 'right' : null;
      const nascetCat = side ? nascet[side] : undefined;
      const band = deriveCarotidCompetency(
        carotidFindings[fullId as keyof typeof carotidFindings],
        nascetCat,
      );
      return SEVERITY_COLORS[band];
    };
    const anterior = await loadAnatomyForPdf('neck-carotid', {}, { competencyFn });
    anatomy = { anterior, posterior: null };
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
  lastSavedAt,
  hasUnsavedChanges,
  onSaveDraft,
  baseFilename,
}: FormActionsProps): React.ReactElement {
  const { t, lang } = useTranslation();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreviewing, setPdfPreviewing] = useState(false);

  // Phase 4c — read encounter optionally so legacy single-study mounts
  // (which don't wrap in <EncounterProvider>) keep working unchanged.
  const encounterCtx = useContext(EncounterCtx);
  const encounter = encounterCtx?.encounter ?? null;

  const { isUnifiedMode, allComplete, studyForms } = useMemo(() => {
    if (!encounter) {
      return { isUnifiedMode: false, allComplete: false, studyForms: [form] };
    }
    const unified = encounter.selectedStudyTypes.length >= 2;
    if (!unified) {
      return { isUnifiedMode: false, allComplete: false, studyForms: [form] };
    }
    const complete = encounter.selectedStudyTypes.every((type) =>
      isStudyComplete(encounter, type),
    );
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
    return { isUnifiedMode: unified, allComplete: complete, studyForms: validForms };
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

  const handleDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const blob = isUnifiedMode
        ? await renderUnifiedPdfBlob()
        : await renderSingleStudyPdfBlob(form);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const filename = isUnifiedMode
        ? `encounter-${(encounter?.header.patientName || 'patient').replace(/\s+/g, '-')}-${
            encounter?.header.encounterDate ?? new Date().toISOString().slice(0, 10)
          }.pdf`
        : `${baseFilename}.pdf`;
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
      });
    } finally {
      setPdfLoading(false);
    }
  }, [
    isUnifiedMode,
    renderUnifiedPdfBlob,
    renderSingleStudyPdfBlob,
    form,
    baseFilename,
    encounter?.header.patientName,
    encounter?.header.encounterDate,
    t,
  ]);

  const handlePreviewPdf = useCallback(async () => {
    setPdfPreviewing(true);
    try {
      const blob = isUnifiedMode
        ? await renderUnifiedPdfBlob()
        : await renderSingleStudyPdfBlob(form);
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
      });
    } finally {
      setPdfPreviewing(false);
    }
  }, [
    isUnifiedMode,
    renderUnifiedPdfBlob,
    renderSingleStudyPdfBlob,
    form,
    t,
  ]);

  const handleExportJson = useCallback(async () => {
    try {
      if (isUnifiedMode) {
        if (!encounter) throw new Error('Unified export requested without encounter context');
        // Phase 4a: buildEncounterBundle — stubbed via dynamic import so
        // missing module surfaces a runtime error rather than blocking
        // compile of this file. The merge gate validates the wiring once
        // 4a lands.
        const fhirModule = (await import('../../services/fhirBuilder')) as unknown as {
          buildEncounterBundle?: (input: {
            encounter: EncounterDraft;
            studyForms: ReadonlyArray<FormState>;
          }) => unknown;
        };
        if (typeof fhirModule.buildEncounterBundle !== 'function') {
          throw new Error(
            'buildEncounterBundle not yet available (Phase 4a pending merge)',
          );
        }
        const bundle = fhirModule.buildEncounterBundle({ encounter, studyForms });
        const json = JSON.stringify(bundle, null, 2);
        const blob = new Blob([json], { type: 'application/fhir+json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        const patient = (encounter.header.patientName || 'patient').replace(/\s+/g, '-');
        anchor.download = `encounter-${patient}-${encounter.header.encounterDate}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      downloadFhirBundle(form, `${baseFilename}.json`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notifications.show({
        color: 'red',
        title: t('formActions.jsonExportFailed'),
        message,
      });
       
      console.error('[FormActions] JSON export failed', {
        err,
        patientId: form.header.patientId,
        studyType: form.studyType,
        unified: isUnifiedMode,
      });
    }
  }, [
    isUnifiedMode,
    encounter,
    studyForms,
    form,
    baseFilename,
    t,
  ]);

  const savedText = lastSavedAt
    ? `${t('venousLE.actions.lastSaved')} ${formatTime(lastSavedAt, lang)}`
    : t('venousLE.actions.neverSaved');

  // Phase 4c — disable export buttons in unified mode when any study is
  // missing findings. The clinician sees a tooltip; per-study escape hatch
  // (TODO Phase 5: sub-menu) is deferred — minimum requirement is the
  // disabled buttons + tooltip.
  const exportsDisabled = isUnifiedMode && !allComplete;
  const disabledTooltip = t(
    'formActions.completeAllFirst',
    'Complete all studies in this encounter first',
  );

  // TODO Phase 5: per-study escape hatch sub-menu — render a Menu of
  // "Export this study only" items so a clinician can ship one finished
  // study while another is still pending.

  const previewBtn = (
    <EMRButton
      variant="subtle"
      size="sm"
      icon={IconEye}
      onClick={handlePreviewPdf}
      loading={pdfPreviewing}
      disabled={exportsDisabled}
      data-testid="preview-pdf"
    >
      {t('venousLE.actions.previewPDF')}
    </EMRButton>
  );

  const downloadBtn = (
    <EMRButton
      variant="primary"
      size="sm"
      icon={IconDownload}
      onClick={handleDownloadPdf}
      loading={pdfLoading}
      disabled={exportsDisabled}
      data-testid="download-pdf"
    >
      {t('venousLE.actions.downloadPDF')}
    </EMRButton>
  );

  const exportBtn = (
    <EMRButton
      variant="ghost"
      size="sm"
      icon={IconCode}
      onClick={handleExportJson}
      disabled={exportsDisabled}
      data-testid="export-json"
    >
      {t('venousLE.actions.exportJSON')}
    </EMRButton>
  );

  return (
    <div className={`${classes.bar} no-print`} role="region" aria-label={t('common.actionsRegion', 'Actions')}>
      <div className={classes.inner}>
        <div className={classes.status}>
          <span className={`${classes.dot} ${hasUnsavedChanges ? classes.dotDirty : classes.dotClean}`} aria-hidden />
          <Text className={classes.statusText}>{savedText}</Text>
        </div>

        <Group gap="xs" wrap="wrap" className={classes.buttons}>
          <EMRButton
            variant="secondary"
            size="sm"
            icon={IconDeviceFloppy}
            onClick={handleSaveDraft}
            data-testid="save-draft"
          >
            {t('venousLE.actions.saveDraft')}
          </EMRButton>

          {exportsDisabled ? (
            <Tooltip label={disabledTooltip} data-testid="exports-disabled-tooltip">
              <span>{previewBtn}</span>
            </Tooltip>
          ) : (
            previewBtn
          )}

          {exportsDisabled ? (
            <Tooltip label={disabledTooltip}>
              <span>{downloadBtn}</span>
            </Tooltip>
          ) : (
            downloadBtn
          )}

          {exportsDisabled ? (
            <Tooltip label={disabledTooltip}>
              <span>{exportBtn}</span>
            </Tooltip>
          ) : (
            exportBtn
          )}
        </Group>
      </div>
    </div>
  );
});

export default FormActions;
