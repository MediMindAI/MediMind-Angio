/**
 * PDFGenerator — button that lazy-loads @react-pdf, generates a PDF blob,
 * and triggers a browser download.
 *
 * Lazy loading strategy:
 *   - @react-pdf/renderer is heavy (~250 KB min). We dynamic-import it
 *     only when the user actually clicks the button, so the main bundle
 *     stays lean.
 *   - The `ReportDocument` component is co-imported in the same dynamic
 *     chunk so both land in Vite's `pdf` manualChunk (see vite.config.ts).
 *
 * The button itself uses Mantine UI. Keeping it a plain `Button` for
 * Phase 0 — the real version will be an EMRButton once we port the
 * component library.
 */

import { useCallback, useState, type ReactElement } from 'react';
import { Button } from '@mantine/core';

export interface PDFGeneratorProps {
  /** Filename for the downloaded PDF. Extension (.pdf) is added if missing. */
  readonly filename: string;
  /** i18n-ready label bag passed through to the PDF document. */
  readonly labels: Readonly<Record<string, string>>;
  /** Opaque payload forwarded to the document renderer. */
  readonly data: unknown;
}

/**
 * Sanitize a candidate filename — strip path separators, trim whitespace,
 * ensure `.pdf` suffix. Keeps Unicode (Georgian) as-is since browsers
 * handle UTF-8 in Content-Disposition for blob URLs.
 */
function normalizeFilename(raw: string): string {
  const stripped = raw.replace(/[\\/:*?"<>|]/g, '_').trim() || 'report';
  return stripped.toLowerCase().endsWith('.pdf') ? stripped : `${stripped}.pdf`;
}

export function PDFGenerator({ filename, labels, data }: PDFGeneratorProps): ReactElement {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      // Lazy-load the heavy deps together so they share a chunk.
      const [{ pdf }, { ReportDocument }, { registerFontsAsync }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ReportDocument'),
        import('../../services/fontService'),
      ]);

      // Register Georgian fonts before we render anything.
      await registerFontsAsync();

      const blob = await pdf(<ReportDocument labels={labels} data={data} />).toBlob();

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
      // Free the object URL — browsers GC eventually but explicit is better.
      if (objectUrl !== null) {
        // Defer revocation until after the download dialog opens.
        setTimeout(() => {
          if (objectUrl !== null) {
            URL.revokeObjectURL(objectUrl);
          }
        }, 1000);
      }
      setGenerating(false);
    }
  }, [filename, labels, data]);

  return (
    <div>
      <Button onClick={handleGenerate} loading={generating} disabled={generating}>
        {generating ? 'Generating PDF…' : 'Generate PDF'}
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
