/**
 * DiagramSection — renders the anterior + posterior anatomy diagrams + legend.
 *
 * Takes pre-resolved `AnatomyToPdfResult` payloads for the two views. The
 * loading step MUST happen upstream (in PDFGenerator or test script)
 * because @react-pdf's render pipeline is sync with async asset prep;
 * async data must be resolved into props before mounting the Document.
 */
import type { ReactElement } from 'react';
import { View, Text, Svg, Path, Image, StyleSheet } from '@react-pdf/renderer';
import type { AnatomyToPdfResult } from '../anatomyToPdfSvg';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import { COMPETENCY_COLORS } from '../../../constants/theme-colors';
import type { Competency } from '../../../types/anatomy';

export interface DiagramSectionLabels {
  readonly anterior: string;
  readonly posterior: string;
  readonly legendLabel: string;
  readonly legend: Record<Competency, string>;
}

export interface DiagramSectionProps {
  readonly anterior: AnatomyToPdfResult | null;
  readonly posterior: AnatomyToPdfResult | null;
  readonly labels: DiagramSectionLabels;
  /** Target rendered width in points for each view. */
  readonly viewWidthPt?: number;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: PDF_FONT_FAMILY,
  },
  viewsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  viewColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    flexGrow: 1,
  },
  viewLabel: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    marginRight: 4,
  },
  legendText: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.text,
  },
});

function renderAnatomy(
  data: AnatomyToPdfResult | null,
  widthPt: number
): ReactElement | null {
  if (!data) return null;
  // viewBox is "minX minY width height".
  const parts = data.viewBox.split(/\s+/).map((n) => Number(n));
  const vbX = Number.isFinite(parts[0]) ? parts[0] : 0;
  const vbY = Number.isFinite(parts[1]) ? parts[1] : 0;
  const vbWidth = Number.isFinite(parts[2]) ? parts[2] : 600;
  const vbHeight = Number.isFinite(parts[3]) ? parts[3] : 900;
  const aspect = vbHeight && vbWidth ? vbHeight / vbWidth : 1.5;
  const heightPt = widthPt * aspect;

  // Resolve the backdrop image URL. The SVG ships with an absolute path
  // (e.g. `/anatomy/le-reference.png`) so the browser can also render the
  // SVG directly via dangerouslySetInnerHTML. We hand that path straight
  // to `resolveAssetUrl`, which prepends origin + base so @react-pdf can
  // fetch it. Also tolerate older SVGs that ship a bare filename.
  const backdropSrc = data.backdropHref
    ? resolveAssetUrl(
        data.backdropHref.startsWith('/')
          ? data.backdropHref
          : `anatomy/${data.backdropHref}`,
      )
    : undefined;

  return (
    <View style={{ position: 'relative', width: widthPt, height: heightPt }}>
      {backdropSrc ? (
        <Image
          src={backdropSrc}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: widthPt,
            height: heightPt,
          }}
        />
      ) : null}
      <Svg
        width={widthPt}
        height={heightPt}
        viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {data.elements.map((el, idx) => (
          <Path
            key={`${el.kind}-${el.id ?? idx}`}
            d={el.d}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * Resolve a public-folder asset to an absolute URL the PDF renderer can fetch.
 * In the browser, public assets live at the site root (or under
 * `import.meta.env.BASE_URL` for GitHub-Pages deploys); in Node, we read
 * directly from disk via a `file://` URL.
 */
function resolveAssetUrl(relativePath: string): string {
  // Strip any leading slash so we don't end up with `///` after concat.
  const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  if (typeof window !== 'undefined') {
    const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
    const base = meta.env?.BASE_URL ?? '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    // Prepend window.location.origin so @react-pdf/renderer's <Image> can
    // fetch the asset. Its render pipeline doesn't auto-resolve root-
    // relative URLs against the page origin the way an HTML <img> does;
    // without the origin, the backdrop fails to load and the PDF shows
    // only the SVG paths over a blank page.
    return `${window.location.origin}${normalizedBase}${clean}`;
  }
  // Node — used by scripts/test-pdf.ts. Match anatomyToPdfSvg's path logic.
  const segments = clean.split('/');
  return ['file://', process.cwd(), 'public', ...segments].join('/');
}

export function DiagramSection({
  anterior,
  posterior,
  labels,
  viewWidthPt = 150,
}: DiagramSectionProps): ReactElement {
  const competencies: Array<Competency> = ['normal', 'occluded', 'incompetent', 'inconclusive', 'ablated'];

  return (
    <View style={styles.wrapper}>
      <View style={styles.viewsRow}>
        <View style={styles.viewColumn}>
          <Text style={styles.viewLabel}>{labels.anterior}</Text>
          {renderAnatomy(anterior, viewWidthPt)}
        </View>
        <View style={styles.viewColumn}>
          <Text style={styles.viewLabel}>{labels.posterior}</Text>
          {renderAnatomy(posterior, viewWidthPt)}
        </View>
      </View>
      <View style={styles.legendRow}>
        {competencies.map((c) => {
          const { fill, stroke } = COMPETENCY_COLORS[c];
          return (
            <View key={c} style={styles.legendItem}>
              <View
                style={{
                  ...styles.legendSwatch,
                  backgroundColor: fill,
                  borderWidth: 1,
                  borderColor: stroke,
                  borderStyle: 'solid',
                }}
              />
              <Text style={styles.legendText}>{labels.legend[c]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
