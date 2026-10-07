// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialFindingsTable — per-segment arterial LE table for PDF page 1.
 *
 * One full-width table with the segment names listed ONCE in the middle
 * and each side's values on either side of them (clinician request,
 * 2026-10-07 — no more two duplicated R / L lists):
 *
 *   Right: Flow | PV | PVR | Stenosis % | Occlusion ‖ Segment ‖ Left: same
 *
 * A row is printed when either side has a value. Red tint is applied per
 * side when that side is pathological:
 *   - `occluded === true`
 *   - `stenosisCategory in {severe, occluded}`
 *   - `waveform === 'absent'`
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY, PDF_BAND_COLORS } from '../pdfTheme';
import type {
  ArterialSegmentFindings,
  ArterialSegmentFinding,
  ArterialLESegmentBase,
  StenosisCategory,
  VisualizationQuality,
  Waveform,
} from '../../studies/arterial-le/config';
import { ARTERIAL_LE_SEGMENTS } from '../../studies/arterial-le/config';

export interface ArterialFindingsTableLabels {
  readonly right: string;
  readonly left: string;
  readonly segment: string;
  readonly waveform: string;
  readonly psv: string;
  readonly pvr: string;
  readonly stenosis: string;
  readonly occluded: string;
  readonly occludedMark: string;
  readonly segmentName: Record<ArterialLESegmentBase, string>;
  readonly waveformName: Record<Waveform, string>;
  readonly stenosisName: Record<StenosisCategory, string>;
  readonly qualityName: Record<VisualizationQuality, string>;
  readonly noteLabel: string;
  readonly emptyDash: string;
}

export interface ArterialFindingsTableProps {
  readonly findings: ArterialSegmentFindings;
  readonly labels: ArterialFindingsTableLabels;
}

type Side = 'left' | 'right';

// Per-side value columns (same order on both sides) + the centre segment
// column, which gets the most room so Georgian names wrap cleanly.
const COL_FLEX = {
  waveform: 1.9,
  psv: 0.8,
  pvr: 0.6,
  stenosis: 1.25,
  occluded: 1.35,
  segment: 3.7,
} as const;
const SIDE_FLEX =
  COL_FLEX.waveform + COL_FLEX.psv + COL_FLEX.pvr + COL_FLEX.stenosis + COL_FLEX.occluded;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
    fontFamily: PDF_FONT_FAMILY,
  },
  sideHeaderRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sideHeader: {
    backgroundColor: PDF_THEME.primary,
    color: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
  },
  columnHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    paddingVertical: 3,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: PDF_THEME.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
  },
  sideCells: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 3,
  },
  sideCellsRed: {
    backgroundColor: PDF_BAND_COLORS.error.bg,
  },
  segmentCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderLeftColor: PDF_THEME.border,
    borderRightColor: PDF_THEME.border,
    borderLeftStyle: 'solid',
    borderRightStyle: 'solid',
  },
  emptyMessage: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cell: {
    fontSize: 7.5,
    lineHeight: 1.25,
    textAlign: 'center',
    paddingHorizontal: 2,
    // Clip text to the cell's flex-computed width. Without this, long
    // Georgian compound words (which Yoga can't break mid-word) paint past
    // the column boundary and visually overlap the next cell's text.
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 7.5,
    lineHeight: 1.25,
    textAlign: 'center',
    fontWeight: 'bold',
    color: PDF_THEME.text,
  },
  cellRed: {
    color: PDF_BAND_COLORS.error.fg,
    fontWeight: 'bold',
  },
  headCell: {
    fontSize: 7,
    lineHeight: 1.1,
    textAlign: 'center',
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  detailRow: {
    paddingHorizontal: 6,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
  },
  detailText: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    lineHeight: 1.2,
  },
});

function isPathological(f: ArterialSegmentFinding | undefined): boolean {
  if (!f) return false;
  if (f.occluded === true) return true;
  if (f.waveform === 'absent') return true;
  const cat = f.stenosisCategory;
  if (cat === 'severe' || cat === 'occluded') return true;
  return false;
}

function hasAnyValue(f: ArterialSegmentFinding | undefined): boolean {
  if (!f) return false;
  return (
    f.waveform !== undefined ||
    f.psvCmS !== undefined ||
    f.velocityRatio !== undefined ||
    f.stenosisPct !== undefined ||
    f.stenosisCategory !== undefined ||
    f.occluded === true ||
    (f.visualizationQuality !== undefined && f.visualizationQuality !== 'adequate') ||
    (f.note !== undefined && f.note.trim() !== '')
  );
}

/** Optional secondary text for one side: image-quality caveat + free-text note. */
function detailText(
  f: ArterialSegmentFinding | undefined,
  labels: ArterialFindingsTableLabels,
): string | null {
  if (!f) return null;
  const parts: string[] = [];
  if (f.visualizationQuality && f.visualizationQuality !== 'adequate') {
    parts.push(labels.qualityName[f.visualizationQuality]);
  }
  const note = f.note?.trim();
  if (note) parts.push(`${labels.noteLabel}: ${note}`);
  return parts.length ? parts.join(' · ') : null;
}

function formatNumber(n: number | undefined, dash: string, digits = 0): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return digits === 0 ? `${Math.round(n)}` : n.toFixed(digits);
}

function formatStenosis(
  f: ArterialSegmentFinding,
  labels: ArterialFindingsTableLabels,
): string {
  if (f.stenosisPct !== undefined && !Number.isNaN(f.stenosisPct)) {
    return `${Math.round(f.stenosisPct)}%`;
  }
  if (f.stenosisCategory) return labels.stenosisName[f.stenosisCategory];
  return labels.emptyDash;
}

function SideHeaderCells({ labels }: { readonly labels: ArterialFindingsTableLabels }): ReactElement {
  return (
    <>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.waveform, ...styles.headCell }}>
        {labels.waveform}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.psv, ...styles.headCell }}>{labels.psv}</Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.pvr, ...styles.headCell }}>{labels.pvr}</Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.stenosis, ...styles.headCell }}>
        {labels.stenosis}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.occluded, ...styles.headCell }}>
        {labels.occluded}
      </Text>
    </>
  );
}

function SideValueCells({
  finding,
  labels,
}: {
  readonly finding: ArterialSegmentFinding | undefined;
  readonly labels: ArterialFindingsTableLabels;
}): ReactElement {
  const dash = labels.emptyDash;
  const red = isPathological(finding);
  const cellStyle = red ? { ...styles.cell, ...styles.cellRed } : styles.cell;
  const wrapStyle = red ? { ...styles.sideCells, ...styles.sideCellsRed } : styles.sideCells;
  const f = finding;
  return (
    <View style={{ flexBasis: 0, flexGrow: SIDE_FLEX, ...wrapStyle }}>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.waveform, ...cellStyle }}>
        {f?.waveform !== undefined ? labels.waveformName[f.waveform] : dash}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.psv, ...cellStyle }}>
        {formatNumber(f?.psvCmS, dash)}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.pvr, ...cellStyle }}>
        {formatNumber(f?.velocityRatio, dash, 1)}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.stenosis, ...cellStyle }}>
        {f ? formatStenosis(f, labels) : dash}
      </Text>
      <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.occluded, ...cellStyle }}>
        {f?.occluded === true ? labels.occludedMark : dash}
      </Text>
    </View>
  );
}

export function ArterialFindingsTable({
  findings,
  labels,
}: ArterialFindingsTableProps): ReactElement {
  const findingFor = (base: ArterialLESegmentBase, side: Side): ArterialSegmentFinding | undefined =>
    findings[`${base}-${side}` as keyof typeof findings];
  const rows = ARTERIAL_LE_SEGMENTS.filter(
    (base) => hasAnyValue(findingFor(base, 'right')) || hasAnyValue(findingFor(base, 'left')),
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.sideHeaderRow}>
        <Text style={{ flexBasis: 0, flexGrow: SIDE_FLEX, ...styles.sideHeader }}>{labels.right}</Text>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.sideHeader }}> </Text>
        <Text style={{ flexBasis: 0, flexGrow: SIDE_FLEX, ...styles.sideHeader, textAlign: 'right' }}>
          {labels.left}
        </Text>
      </View>
      <View style={styles.columnHeader}>
        <SideHeaderCells labels={labels} />
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.headCell }}>
          {labels.segment}
        </Text>
        <SideHeaderCells labels={labels} />
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyMessage}>—</Text>
      ) : (
        rows.map((base) => {
          const right = findingFor(base, 'right');
          const left = findingFor(base, 'left');
          const detailR = detailText(right, labels);
          const detailL = detailText(left, labels);
          const detail = [
            detailR ? `${labels.right}: ${detailR}` : null,
            detailL ? `${labels.left}: ${detailL}` : null,
          ].filter(Boolean).join('   ');
          return (
            <View key={base} wrap={false}>
              <View style={styles.row}>
                <SideValueCells finding={right} labels={labels} />
                <View style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.segmentCell }}>
                  <Text style={styles.segmentText}>{labels.segmentName[base] ?? base}</Text>
                </View>
                <SideValueCells finding={left} labels={labels} />
              </View>
              {detail !== '' && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailText}>{detail}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

export default ArterialFindingsTable;
