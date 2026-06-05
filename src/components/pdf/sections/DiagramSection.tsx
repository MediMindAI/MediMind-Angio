/**
 * DiagramSection — renders the anterior + posterior anatomy diagrams + legend.
 *
 * Takes pre-resolved `AnatomyToPdfResult` payloads for the two views. The
 * loading step MUST happen upstream (in PDFGenerator or test script)
 * because @react-pdf's render pipeline is sync with async asset prep;
 * async data must be resolved into props before mounting the Document.
 */
import type { ReactElement } from 'react';
import { View, Text, Svg, Path, Image, Line, Rect, StyleSheet, Defs, ClipPath, G } from '@react-pdf/renderer';
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

/** One legend entry when a study supplies its own colour scale. */
export interface DiagramLegendItem {
  readonly key: string;
  readonly label: string;
  readonly fill: string;
  readonly stroke: string;
  /** Render the diagonal-stripe swatch (used for the "inconclusive" band). */
  readonly striped?: boolean;
}

export interface DiagramSectionProps {
  readonly anterior: AnatomyToPdfResult | null;
  readonly posterior: AnatomyToPdfResult | null;
  readonly labels: DiagramSectionLabels;
  /** Target rendered width in points for each view. */
  readonly viewWidthPt?: number;
  /**
   * Explicit legend entries. When omitted, the default venous competency
   * legend is rendered. Carotid passes its 5-band severity scale here so the
   * diagram doesn't show venous terms (Part: clinician feedback).
   */
  readonly legendItems?: ReadonlyArray<DiagramLegendItem>;
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
        {(() => {
          // Clip the vessel layer to the silhouette so distal veins can't spill
          // past the leg outline (mirrors the web SVG's #leg-clip). Outlines
          // render unclipped underneath; segments/drawings are clipped.
          const outlineD = data.elements
            .filter((el) => el.kind === 'outline')
            .map((el) => el.d)
            .join(' ');
          const renderPath = (el: typeof data.elements[number], idx: number): ReactElement => {
            // Clinician text annotation — real vector <Text> in the registered
            // Georgian font, anchored at (x, y) in viewBox space.
            if (el.kind === 'text') {
              return (
                <Text
                  key={`text-${el.id ?? idx}`}
                  x={el.x ?? 0}
                  y={el.y ?? 0}
                  fill={el.fill}
                  style={{ fontFamily: PDF_FONT_FAMILY, fontSize: el.fontSize ?? 28, fontWeight: 'bold' }}
                >
                  {el.text ?? ''}
                </Text>
              );
            }
            return (
              <Path
                key={`${el.kind}-${el.id ?? idx}`}
                d={el.d}
                fill={el.fill}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                {...(el.strokeDasharray ? { strokeDasharray: el.strokeDasharray } : {})}
              />
            );
          };
          const outlines = data.elements.filter((el) => el.kind === 'outline');
          // Vein segments are clipped to the silhouette so distal veins can't
          // spill past the leg. Clinician annotations (freehand + text) mirror
          // the web's unclipped overlay, so a label in the margin isn't cut off.
          const segments = data.elements.filter((el) => el.kind === 'segment');
          const annotations = data.elements.filter(
            (el) => el.kind === 'drawing' || el.kind === 'text',
          );
          return (
            <>
              {outlineD ? (
                <Defs>
                  <ClipPath id="leg-clip-pdf">
                    <Path d={outlineD} />
                  </ClipPath>
                </Defs>
              ) : null}
              {outlines.map(renderPath)}
              {outlineD ? (
                <G clipPath="url(#leg-clip-pdf)">{segments.map(renderPath)}</G>
              ) : (
                segments.map(renderPath)
              )}
              {annotations.map(renderPath)}
            </>
          );
        })()}
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
  legendItems,
}: DiagramSectionProps): ReactElement {
  // Default to the venous competency legend; a study may override it via
  // `legendItems` (carotid supplies its 5-band severity scale).
  const items: ReadonlyArray<DiagramLegendItem> =
    legendItems ??
    (['normal', 'occluded', 'incompetent', 'inconclusive', 'ablated'] as Array<Competency>).map(
      (c) => ({
        key: c,
        label: labels.legend[c],
        fill: COMPETENCY_COLORS[c].fill,
        stroke: COMPETENCY_COLORS[c].stroke,
        striped: c === 'inconclusive',
      }),
    );

  return (
    <View style={styles.wrapper}>
      <View style={styles.viewsRow}>
        <View style={styles.viewColumn}>
          <Text style={styles.viewLabel}>{labels.anterior}</Text>
          {renderAnatomy(anterior, viewWidthPt)}
        </View>
        {/* Posterior column only renders when a posterior diagram was
            resolved. Venous now carries every vessel on the anterior view,
            and arterial/carotid have no posterior at all — so this avoids a
            stray empty "Posterior view" column. */}
        {posterior ? (
          <View style={styles.viewColumn}>
            <Text style={styles.viewLabel}>{labels.posterior}</Text>
            {renderAnatomy(posterior, viewWidthPt)}
          </View>
        ) : null}
      </View>
      <View style={styles.legendRow}>
        {items.map((item) => {
          const { fill, stroke } = item;
          // Inconclusive renders as diagonal grey/white stripes to match
          // the anatomy fill pattern (web uses an SVG <pattern>; PDF lacks
          // <Pattern> in @react-pdf v4, so emit a tiny <Svg> with three
          // diagonal lines instead).
          const isInconclusive = item.striped === true;
          return (
            <View key={item.key} style={styles.legendItem}>
              {isInconclusive ? (
                <Svg
                  width={10}
                  height={10}
                  viewBox="0 0 10 10"
                  style={{ ...styles.legendSwatch, marginRight: 4 }}
                >
                  <Rect x={0} y={0} width={10} height={10} fill="#ffffff" />
                  <Line x1={-2} y1={4} x2={4} y2={-2} stroke="#9ca3af" strokeWidth={1.5} />
                  <Line x1={-2} y1={9} x2={9} y2={-2} stroke="#9ca3af" strokeWidth={1.5} />
                  <Line x1={3} y1={12} x2={12} y2={3} stroke="#9ca3af" strokeWidth={1.5} />
                  <Rect
                    x={0}
                    y={0}
                    width={10}
                    height={10}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={0.75}
                  />
                </Svg>
              ) : (
                <View
                  style={{
                    ...styles.legendSwatch,
                    backgroundColor: fill,
                    borderWidth: 1,
                    borderColor: stroke,
                    borderStyle: 'solid',
                  }}
                />
              )}
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
