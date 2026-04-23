/**
 * PDFGenerator — button that lazy-loads @react-pdf, pre-loads anatomy
 * SVG payloads, generates a PDF blob, and triggers a browser download.
 *
 * Lazy loading strategy:
 *   - @react-pdf/renderer is heavy (~250 KB min). We dynamic-import it
 *     only when the user actually clicks the button, so the main bundle
 *     stays lean.
 *   - The `ReportDocument` component + anatomy helpers are co-imported in
 *     the same dynamic chunk so everything lands together in Vite's `pdf`
 *     manualChunk (see vite.config.ts).
 *
 * We also resolve any async data the document needs (anatomy SVGs) BEFORE
 * rendering, because @react-pdf's render pipeline is synchronous once
 * mounted. Anything that needs `await` must happen here.
 */

import { useCallback, useState, type ReactElement } from 'react';
import { Button } from '@mantine/core';
import type { FormState } from '../../types/form';
import type { ReportLabels, ReportOrg, ReportAnatomy } from './ReportDocument';
import { isVenousForm } from '../../types/form';

export interface PDFGeneratorProps {
  /** Filename for the downloaded PDF. Extension (.pdf) is added if missing. */
  readonly filename: string;
  /** Pre-translated label bag (the PDF layer doesn't share React context). */
  readonly labels: ReportLabels;
  /** The form state to render. */
  readonly form: FormState;
  /** Organization header info. */
  readonly org?: ReportOrg;
  /** Render a "PRELIMINARY" watermark for draft reports. */
  readonly preliminary?: boolean;
  /** Optional caller-supplied anatomy overrides (skips loader). */
  readonly anatomyOverride?: ReportAnatomy;
  /** Optional caller-supplied pre-formatted per-side findings. */
  readonly rightFindings?: string;
  readonly leftFindings?: string;
  readonly conclusions?: ReadonlyArray<string>;
  /** Button label. */
  readonly buttonLabel?: string;
}

function normalizeFilename(raw: string): string {
  const stripped = raw.replace(/[\\/:*?"<>|]/g, '_').trim() || 'report';
  return stripped.toLowerCase().endsWith('.pdf') ? stripped : `${stripped}.pdf`;
}

export function PDFGenerator(props: PDFGeneratorProps): ReactElement {
  const {
    filename,
    labels,
    form,
    org,
    preliminary,
    anatomyOverride,
    rightFindings,
    leftFindings,
    conclusions,
    buttonLabel,
  } = props;

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      // Lazy-load the heavy deps together so they share a chunk.
      const [
        { pdf },
        { ReportDocument },
        { registerFontsAsync },
        anatomyMod,
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ReportDocument'),
        import('../../services/fontService'),
        import('./anatomyToPdfSvg'),
      ]);

      await registerFontsAsync();

      // --- Resolve anatomy SVG payloads (venous only) ---
      let anatomy: ReportAnatomy;
      if (anatomyOverride) {
        anatomy = anatomyOverride;
      } else if (isVenousForm(form)) {
        const findings = deriveInlineFindings(form);
        const [anterior, posterior] = await Promise.all([
          anatomyMod.loadAnatomyForPdf('le-anterior', findings),
          anatomyMod.loadAnatomyForPdf('le-posterior', findings),
        ]);
        anatomy = { anterior, posterior };
      } else {
        anatomy = { anterior: null, posterior: null };
      }

      const generatedAt = new Date().toISOString();

      const blob = await pdf(
        <ReportDocument
          form={form}
          labels={labels}
          org={org}
          preliminary={preliminary}
          anatomy={anatomy}
          rightFindings={rightFindings}
          leftFindings={leftFindings}
          conclusions={conclusions}
          generatedAt={generatedAt}
        />
      ).toBlob();

      const resolvedName = normalizeFilename(filename);
      objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = resolvedName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error generating PDF';
      setError(message);
      // eslint-disable-next-line no-console
      console.error('[PDFGenerator] Failed to generate PDF:', err);
    } finally {
      if (objectUrl !== null) {
        setTimeout(() => {
          if (objectUrl !== null) {
            URL.revokeObjectURL(objectUrl);
          }
        }, 1000);
      }
      setGenerating(false);
    }
  }, [
    filename,
    labels,
    form,
    org,
    preliminary,
    anatomyOverride,
    rightFindings,
    leftFindings,
    conclusions,
  ]);

  return (
    <div>
      <Button onClick={handleGenerate} loading={generating} disabled={generating}>
        {generating ? 'Generating PDF…' : (buttonLabel ?? 'Download PDF')}
      </Button>
      {error !== null && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            color: '#e53e3e',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Inline copy of the `deriveVenousFindings` shape used by ReportDocument,
 * so we can feed the anatomy converter the same data the table uses.
 * Kept local to avoid circular imports between PDFGenerator + ReportDocument.
 */
function deriveInlineFindings(form: FormState): Record<
  string,
  {
    refluxDurationMs?: number;
    apDiameterMm?: number;
    depthMm?: number;
    compressibility?: 'normal' | 'partial' | 'non-compressible' | 'inconclusive';
    thrombosis?: 'none' | 'acute' | 'chronic' | 'indeterminate';
  }
> {
  if (!isVenousForm(form)) return {};
  const out: Record<
    string,
    {
      refluxDurationMs?: number;
      apDiameterMm?: number;
      depthMm?: number;
      compressibility?: 'normal' | 'partial' | 'non-compressible' | 'inconclusive';
      thrombosis?: 'none' | 'acute' | 'chronic' | 'indeterminate';
    }
  > = {};
  for (const seg of form.segments) {
    if (seg.side !== 'left' && seg.side !== 'right') continue;
    const key = `${seg.segmentId}-${seg.side}`;
    const entry: {
      refluxDurationMs?: number;
      apDiameterMm?: number;
      depthMm?: number;
      compressibility?: 'normal' | 'partial' | 'non-compressible' | 'inconclusive';
      thrombosis?: 'none' | 'acute' | 'chronic' | 'indeterminate';
    } = {};
    if (typeof seg.refluxDurationMs === 'number') entry.refluxDurationMs = seg.refluxDurationMs;
    if (typeof seg.diameterMm === 'number') entry.apDiameterMm = seg.diameterMm;
    // Use the derived competency from SegmentState as a compressibility hint
    // so the anatomy diagram still colors even if the form hasn't stored
    // the raw categorical yet.
    if (seg.competency === 'incompetent') entry.compressibility = 'non-compressible';
    else if (seg.competency === 'inconclusive') entry.compressibility = 'inconclusive';
    out[key] = entry;
  }
  return out;
}
