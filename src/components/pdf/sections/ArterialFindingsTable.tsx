// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialFindingsTable — per-segment arterial LE table for PDF page 1.
 *
 * Six columns (mirrors the on-form ArterialSegmentTable but flattened):
 *   Segment | Waveform | PSV | Stenosis | Plaque | Occluded
 *
 * When `singleSide` is set the component renders one side only — that's
 * the shape ReportDocument uses to place R + L side-by-side on page 1.
 *
 * Row tinting (red) triggers when any of:
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
  PlaqueMorphology,
  StenosisCategory,
  Waveform,
} from '../../studies/arterial-le/config';
import { ARTERIAL_LE_SEGMENTS } from '../../studies/arterial-le/config';

export interface ArterialFindingsTableLabels {
  readonly right: string;
  readonly left: string;
  readonly segment: string;
  readonly waveform: string;
  readonly psv: string;
  readonly stenosis: string;
  readonly plaque: string;
  readonly occluded: string;
  readonly occludedMark: string;
  readonly segmentName: Record<ArterialLESegmentBase, string>;
  readonly waveformName: Record<Waveform, string>;
  readonly stenosisName: Record<StenosisCategory, string>;
  readonly plaqueName: Record<PlaqueMorphology, string>;
  readonly emptyDash: string;
}

export interface ArterialFindingsTableProps {
  readonly findings: ArterialSegmentFindings;
  readonly labels: ArterialFindingsTableLabels;
  readonly singleSide?: 'left' | 'right';
}

type Side = 'left' | 'right';

const COL_FLEX = {
  segment: 2.4,
  waveform: 1.3,
  psv: 1.0,
  stenosis: 1.1,
  plaque: 1.3,
  occluded: 0.8,
} as const;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
    fontFamily: PDF_FONT_FAMILY,
  },
  sideHeader: {
    backgroundColor: PDF_THEME.primary,
    color: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
    marginTop: 4,
  },
  columnHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    fontWeight: 'bold',
    color: PDF_THEME.text,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
  },
  rowRed: {
    backgroundColor: PDF_BAND_COLORS.error.bg,
  },
  emptyMessage: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cell: {
    fontSize: PDF_FONT_SIZES.label,
  },
  cellRed: {
    color: PDF_BAND_COLORS.error.fg,
    fontWeight: 'bold',
  },
  headCell: {
    fontSize: 7.5,
    lineHeight: 1.1,
    overflow: 'hidden',
  },
  cellRight: {
    textAlign: 'right',
  },
});

interface RenderRow {
  readonly segmentBase: ArterialLESegmentBase;
  readonly finding: ArterialSegmentFinding;
  readonly pathological: boolean;
}

function isPathological(f: ArterialSegmentFinding): boolean {
  if (f.occluded === true) return true;
  if (f.waveform === 'absent') return true;
  const cat = f.stenosisCategory;
  if (cat === 'severe' || cat === 'occluded') return true;
  return false;
}

function hasAnyValue(f: ArterialSegmentFinding): boolean {
  return (
    f.waveform !== undefined ||
    f.psvCmS !== undefined ||
    f.stenosisPct !== undefined ||
    f.stenosisCategory !== undefined ||
    f.plaqueMorphology !== undefined ||
    f.plaqueLengthMm !== undefined ||
    f.occluded === true
  );
}

function buildRows(
  findings: ArterialSegmentFindings,
  side: Side,
): ReadonlyArray<RenderRow> {
  const rows: RenderRow[] = [];
  for (const base of ARTERIAL_LE_SEGMENTS) {
    const key = `${base}-${side}` as keyof typeof findings;
    const f = findings[key];
    if (!f) continue;
    if (!hasAnyValue(f)) continue;
    rows.push({
      segmentBase: base,
      finding: f,
      pathological: isPathological(f),
    });
  }
  return rows;
}

function formatPsv(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return `${Math.round(n)}`;
}

function formatStenosis(
  f: ArterialSegmentFinding,
  labels: ArterialFindingsTableLabels,
): string {
  if (f.stenosisCategory) return labels.stenosisName[f.stenosisCategory];
  if (f.stenosisPct !== undefined && !Number.isNaN(f.stenosisPct)) {
    return `${Math.round(f.stenosisPct)}%`;
  }
  return labels.emptyDash;
}

function formatPlaque(
  f: ArterialSegmentFinding,
  labels: ArterialFindingsTableLabels,
): string {
  const morph = f.plaqueMorphology;
  if (!morph || morph === 'none') return labels.emptyDash;
  const base = labels.plaqueName[morph];
  if (f.plaqueLengthMm !== undefined && !Number.isNaN(f.plaqueLengthMm)) {
    return `${base} · ${Math.round(f.plaqueLengthMm)}mm`;
  }
  return base;
}

function SideTable({
  side,
  labels,
  findings,
}: {
  readonly side: Side;
  readonly labels: ArterialFindingsTableLabels;
  readonly findings: ArterialSegmentFindings;
}): ReactElement {
  const rows = buildRows(findings, side);
  const headerLabel = side === 'right' ? labels.right : labels.left;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sideHeader}>{headerLabel}</Text>
      <View style={styles.columnHeader}>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.headCell }}>
          {labels.segment}
        </Text>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.waveform, ...styles.headCell }}>
          {labels.waveform}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.psv,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.psv}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.stenosis,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.stenosis}
        </Text>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.plaque, ...styles.headCell }}>
          {labels.plaque}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.occluded,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.occluded}
        </Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyMessage}>—</Text>
      ) : (
        rows.map((r) => {
          const segLabel = labels.segmentName[r.segmentBase] ?? r.segmentBase;
          const rowStyle = r.pathological ? { ...styles.row, ...styles.rowRed } : styles.row;
          const cellStyle = r.pathological
            ? { ...styles.cell, ...styles.cellRed }
            : styles.cell;
          const cellRightStyle = r.pathological
            ? { ...styles.cell, ...styles.cellRight, ...styles.cellRed }
            : { ...styles.cell, ...styles.cellRight };
          const waveformText =
            r.finding.waveform !== undefined
              ? labels.waveformName[r.finding.waveform]
              : labels.emptyDash;
          return (
            <View key={`${side}-${r.segmentBase}`} style={rowStyle}>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...cellStyle }}>
                {segLabel}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.waveform, ...cellStyle }}>
                {waveformText}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.psv, ...cellRightStyle }}>
                {formatPsv(r.finding.psvCmS, labels.emptyDash)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.stenosis, ...cellRightStyle }}>
                {formatStenosis(r.finding, labels)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.plaque, ...cellStyle }}>
                {formatPlaque(r.finding, labels)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.occluded, ...cellRightStyle }}>
                {r.finding.occluded === true ? labels.occludedMark : labels.emptyDash}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export function ArterialFindingsTable({
  findings,
  labels,
  singleSide,
}: ArterialFindingsTableProps): ReactElement {
  if (singleSide) {
    return <SideTable side={singleSide} findings={findings} labels={labels} />;
  }
  return (
    <View>
      <SideTable side="right" findings={findings} labels={labels} />
      <SideTable side="left" findings={findings} labels={labels} />
    </View>
  );
}

export default ArterialFindingsTable;
