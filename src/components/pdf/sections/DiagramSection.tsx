/**
 * DiagramSection — renders the anterior + posterior anatomy diagrams + legend.
 *
 * Takes pre-resolved `AnatomyToPdfResult` payloads for the two views. The
 * loading step MUST happen upstream (in PDFGenerator or test script)
 * because @react-pdf's render pipeline is sync with async asset prep;
 * async data must be resolved into props before mounting the Document.
 */
import type { ReactElement } from 'react';
import { View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer';
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
  const vbWidth = Number.isFinite(parts[2]) ? parts[2] : 600;
  const vbHeight = Number.isFinite(parts[3]) ? parts[3] : 900;
  const aspect = vbHeight && vbWidth ? vbHeight / vbWidth : 1.5;
  const heightPt = widthPt * aspect;

  return (
    <Svg width={widthPt} height={heightPt} viewBox={data.viewBox}>
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
  );
}

export function DiagramSection({
  anterior,
  posterior,
  labels,
  viewWidthPt = 150,
}: DiagramSectionProps): ReactElement {
  const competencies: Array<Competency> = ['normal', 'ablated', 'incompetent', 'inconclusive'];

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
