/**
 * FindingsTable — per-segment reflux-time table (Right + Left).
 *
 * The Corestudycast-style table has four columns:
 *   Segment | Reflux (ms) | AP diameter (mm) | Depth (mm)
 *
 * Rows with reflux duration above the pathological threshold are rendered
 * in the semantic error color so they jump off the page. Rows where every
 * numeric cell is empty are filtered out — tables in final reports only
 * list segments the operator actually measured.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import type { VenousSegmentFindings, VenousLESegmentBase } from '../../studies/venous-le/config';
import {
  VENOUS_LE_SEGMENTS,
  hasPathologicalReflux,
} from '../../studies/venous-le/config';

export interface FindingsTableLabels {
  readonly right: string;
  readonly left: string;
  readonly segment: string;
  readonly refluxMs: string;
  readonly apMm: string;
  readonly depthMm: string;
  readonly segmentName: Record<VenousLESegmentBase, string>;
  readonly emptyDash: string;
}

export interface FindingsTableProps {
  readonly findings: VenousSegmentFindings;
  readonly labels: FindingsTableLabels;
  /**
   * When set, render only the given side (no vertical stacking of Right over
   * Left). Used by the page-1 layout that puts the two side tables in a
   * horizontal row so each table owns ~50% of the page width and column
   * headers have room to breathe.
   */
  readonly singleSide?: Side;
}

type Side = 'left' | 'right';

const COL_FLEX = {
  segment: 2.4,
  reflux: 1.3,
  ap: 1.4,
  depth: 1.4,
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
  emptyMessage: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cell: {
    fontSize: PDF_FONT_SIZES.label,
    lineHeight: 1.25,
    // Clip rather than overflow into the neighbor column when a localization
    // ends up longer than the allocated flex slot. Same defensive guard the
    // header cell has — Georgian compound words don't break mid-word.
    overflow: 'hidden',
  },
  headCell: {
    fontSize: 7.5,
    lineHeight: 1.1,
    // Clip rather than overflow into the neighbor column when a localization
    // ends up longer than the allocated flex slot.
    overflow: 'hidden',
  },
  cellRight: {
    textAlign: 'right',
  },
  cellRed: {
    color: PDF_THEME.error,
    fontWeight: 'bold',
  },
});

interface RenderRow {
  readonly segmentBase: VenousLESegmentBase;
  readonly refluxMs: number | undefined;
  readonly apMm: number | undefined;
  readonly depthMm: number | undefined;
  readonly pathological: boolean;
}

function buildRows(findings: VenousSegmentFindings, side: Side): ReadonlyArray<RenderRow> {
  const rows: RenderRow[] = [];
  for (const base of VENOUS_LE_SEGMENTS) {
    const key = `${base}-${side}` as keyof typeof findings;
    const f = findings[key];
    if (!f) continue;
    const { refluxDurationMs, apDiameterMm, depthMm } = f;
    const anyValue =
      refluxDurationMs !== undefined ||
      apDiameterMm !== undefined ||
      depthMm !== undefined;
    if (!anyValue) continue;
    rows.push({
      segmentBase: base,
      refluxMs: refluxDurationMs,
      apMm: apDiameterMm,
      depthMm,
      pathological: hasPathologicalReflux(base, f),
    });
  }
  return rows;
}

function formatMs(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return String(Math.round(n));
}

function formatMm(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return n.toFixed(1);
}

function SideTable({
  side,
  labels,
  findings,
}: {
  readonly side: Side;
  readonly labels: FindingsTableLabels;
  readonly findings: VenousSegmentFindings;
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
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.reflux,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.refluxMs}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.ap,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.apMm}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.depth,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.depthMm}
        </Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyMessage}>—</Text>
      ) : (
        rows.map((r) => {
          const segLabel = labels.segmentName[r.segmentBase] ?? r.segmentBase;
          const refluxStyle = r.pathological
            ? { ...styles.cell, ...styles.cellRight, ...styles.cellRed }
            : { ...styles.cell, ...styles.cellRight };
          return (
            <View key={`${side}-${r.segmentBase}`} style={styles.row}>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.cell }}>
                {segLabel}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.reflux, ...refluxStyle }}>
                {formatMs(r.refluxMs, labels.emptyDash)}
              </Text>
              <Text
                style={{
                  flexBasis: 0,
                  flexGrow: COL_FLEX.ap,
                  ...styles.cell,
                  ...styles.cellRight,
                }}
              >
                {formatMm(r.apMm, labels.emptyDash)}
              </Text>
              <Text
                style={{
                  flexBasis: 0,
                  flexGrow: COL_FLEX.depth,
                  ...styles.cell,
                  ...styles.cellRight,
                }}
              >
                {formatMm(r.depthMm, labels.emptyDash)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export function FindingsTable({
  findings,
  labels,
  singleSide,
}: FindingsTableProps): ReactElement {
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
