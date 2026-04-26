// SPDX-License-Identifier: Apache-2.0
/**
 * FormActions — sticky bottom action bar.
 *
 * Left: last-saved indicator.
 * Right: Save draft · Preview PDF · Download PDF · Export FHIR JSON.
 *
 * Download PDF uses the existing `@react-pdf/renderer` pipeline via the
 * lazy-import pattern. Export JSON uses `downloadFhirBundle`.
 */

import { memo, useCallback, useState } from 'react';
import { Group, Text } from '@mantine/core';
import {
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
} from '@tabler/icons-react';
import { EMRButton } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';
import type { FormState } from '../../types/form';
import { downloadFhirBundle } from '../../services/fhirBuilder';
import { buildReportLabels } from '../pdf/buildReportLabels';
import { buildLocalizedNarrative } from '../../services/narrativeService';
import type { VenousSegmentFindings } from '../studies/venous-le/config';
import classes from './FormActions.module.css';

export interface FormActionsProps {
  readonly form: FormState;
  readonly lastSavedAt: Date | null;
  readonly hasUnsavedChanges: boolean;
  readonly onSaveDraft: () => void;
  /** The filename used for both PDF and JSON exports. */
  readonly baseFilename: string;
}

/** Format a Date as HH:MM:SS. */
function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

  const handleSaveDraft = useCallback(() => {
    onSaveDraft();
  }, [onSaveDraft]);

  const renderPdfBlob = useCallback(async (): Promise<Blob> => {
    const [
      { pdf },
      { ReportDocument },
      { registerFontsAsync },
      { loadAnatomyForPdf },
      { isVenousForm },
      { deriveArterialCompetency },
      { deriveCarotidCompetency },
    ] = await Promise.all([
      import('@react-pdf/renderer'),
      import('../pdf/ReportDocument'),
      import('../../services/fontService'),
      import('../pdf/anatomyToPdfSvg'),
      import('../../types/form'),
      import('../studies/arterial-le/config'),
      import('../studies/carotid/config'),
    ]);
    await registerFontsAsync();
    const labels = buildReportLabels(t, form, lang);
    const { SEVERITY_COLORS } = await import('../../constants/theme-colors');

    // Resolve anatomy SVGs for venous forms before rendering.
    let anatomy: Parameters<typeof ReportDocument>[0]['anatomy'];
    let localized: ReturnType<typeof buildLocalizedNarrative> | undefined;
    if (isVenousForm(form)) {
      // Findings live on `parameters.segmentFindings` — `form.segments[]` is
      // always empty for current venous studies. Reading from segments would
      // paint every leg "normal" regardless of disease (Area 10 BLOCKER).
      const rawFindings = form.parameters['segmentFindings'];
      const findings: VenousSegmentFindings =
        rawFindings && typeof rawFindings === 'object'
          ? (rawFindings as unknown as VenousSegmentFindings)
          : {};
      const [anterior, posterior] = await Promise.all([
        loadAnatomyForPdf('le-anterior', findings),
        loadAnatomyForPdf('le-posterior', findings),
      ]);
      anatomy = { anterior, posterior };

      // Build localized narrative for the PDF from the same findings map.
      localized = buildLocalizedNarrative(findings, t);
    } else if (form.studyType === 'arterialLE') {
      const rawFindings = form.parameters['segmentFindings'];
      const arterialFindings =
        rawFindings && typeof rawFindings === 'object'
          ? (rawFindings as unknown as Record<
              string,
              Parameters<typeof deriveArterialCompetency>[0]
            >)
          : {};
      const competencyFn = (fullId: string): { fill: string; stroke: string } => {
        const band = deriveArterialCompetency(arterialFindings[fullId]);
        return SEVERITY_COLORS[band];
      };
      const anterior = await loadAnatomyForPdf(
        'le-arterial-anterior',
        {},
        { competencyFn },
      );
      anatomy = { anterior, posterior: null };
    } else if (form.studyType === 'carotid') {
      const rawFindings = form.parameters['segmentFindings'];
      const carotidFindings =
        rawFindings && typeof rawFindings === 'object'
          ? (rawFindings as unknown as Record<
              string,
              Parameters<typeof deriveCarotidCompetency>[0]
            >)
          : {};
      const rawNascet = form.parameters['nascet'];
      const nascet =
        rawNascet && typeof rawNascet === 'object'
          ? (rawNascet as unknown as {
              right?: Parameters<typeof deriveCarotidCompetency>[1];
              left?: Parameters<typeof deriveCarotidCompetency>[1];
            })
          : {};
      const competencyFn = (fullId: string): { fill: string; stroke: string } => {
        const side = fullId.endsWith('-left') ? 'left' : fullId.endsWith('-right') ? 'right' : null;
        const nascetCat = side ? nascet[side] : undefined;
        const band = deriveCarotidCompetency(carotidFindings[fullId], nascetCat);
        return SEVERITY_COLORS[band];
      };
      const anterior = await loadAnatomyForPdf('neck-carotid', {}, { competencyFn });
      anatomy = { anterior, posterior: null };
    } else {
      anatomy = { anterior: null, posterior: null };
    }

    // Pre-resolve recommendation text via t() so PDFs render the same
    // localized prose the web UI shows. The PDF layer can't access React
    // context, so we bake the resolved string into `text` before handing
    // the form off to @react-pdf.
    const localizedForm = {
      ...form,
      recommendations: form.recommendations.map((r) => ({
        ...r,
        text: r.textKey ? t(r.textKey, r.text) : r.text,
      })),
    };

    return pdf(
      <ReportDocument
        form={localizedForm}
        labels={labels}
        anatomy={anatomy}
        rightFindings={localized?.rightFindings}
        leftFindings={localized?.leftFindings}
        conclusions={localized?.conclusions}
        generatedAt={new Date().toISOString()}
      />
    ).toBlob();
  }, [form, t]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const blob = await renderPdfBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${baseFilename}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FormActions] PDF download failed', err);
    } finally {
      setPdfLoading(false);
    }
  }, [renderPdfBlob, baseFilename]);

  const handlePreviewPdf = useCallback(async () => {
    setPdfPreviewing(true);
    try {
      const blob = await renderPdfBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke a bit later so the new tab has time to pull the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FormActions] PDF preview failed', err);
    } finally {
      setPdfPreviewing(false);
    }
  }, [renderPdfBlob]);

  const handleExportJson = useCallback(() => {
    try {
      downloadFhirBundle(form, `${baseFilename}.json`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FormActions] JSON export failed', err);
    }
  }, [form, baseFilename]);

  const savedText = lastSavedAt
    ? `${t('venousLE.actions.lastSaved')} ${formatTime(lastSavedAt)}`
    : t('venousLE.actions.neverSaved');

  return (
    <div className={`${classes.bar} no-print`} role="region" aria-label="Actions">
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

          <EMRButton
            variant="subtle"
            size="sm"
            icon={IconEye}
            onClick={handlePreviewPdf}
            loading={pdfPreviewing}
            data-testid="preview-pdf"
          >
            {t('venousLE.actions.previewPDF')}
          </EMRButton>

          <EMRButton
            variant="primary"
            size="sm"
            icon={IconDownload}
            onClick={handleDownloadPdf}
            loading={pdfLoading}
            data-testid="download-pdf"
          >
            {t('venousLE.actions.downloadPDF')}
          </EMRButton>

          <EMRButton
            variant="ghost"
            size="sm"
            icon={IconCode}
            onClick={handleExportJson}
            data-testid="export-json"
          >
            {t('venousLE.actions.exportJSON')}
          </EMRButton>
        </Group>
      </div>
    </div>
  );
});

export default FormActions;
