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
  readonly transMm: string;
  readonly depthMm: string;
  readonly segmentName: Record<VenousLESegmentBase, string>;
  readonly emptyDash: string;
}

export interface FindingsTableProps {
  readonly findings: VenousSegmentFindings;
  readonly labels: FindingsTableLabels;
}

type Side = 'left' | 'right';

const COL_FLEX = {
  segment: 3,
  reflux: 1.4,
  ap: 1.1,
  trans: 1.1,
  depth: 1.1,
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
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: PDF_FONT_SIZES.footnote,
    fontWeight: 'bold',
    color: PDF_THEME.text,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 6,
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
  readonly transMm: number | undefined;
  readonly depthMm: number | undefined;
  readonly pathological: boolean;
}

function buildRows(findings: VenousSegmentFindings, side: Side): ReadonlyArray<RenderRow> {
  const rows: RenderRow[] = [];
  for (const base of VENOUS_LE_SEGMENTS) {
    const key = `${base}-${side}` as keyof typeof findings;
    const f = findings[key];
    if (!f) continue;
    const { refluxDurationMs, apDiameterMm, transDiameterMm, depthMm } = f;
    const anyValue =
      refluxDurationMs !== undefined ||
      apDiameterMm !== undefined ||
      transDiameterMm !== undefined ||
      depthMm !== undefined;
    if (!anyValue) continue;
    rows.push({
      segmentBase: base,
      refluxMs: refluxDurationMs,
      apMm: apDiameterMm,
      transMm: transDiameterMm,
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
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.segment, ...styles.cell }}>
          {labels.segment}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.reflux,
            ...styles.cell,
            ...styles.cellRight,
          }}
        >
          {labels.refluxMs}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.ap,
            ...styles.cell,
            ...styles.cellRight,
          }}
        >
          {labels.apMm}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.trans,
            ...styles.cell,
            ...styles.cellRight,
          }}
        >
          {labels.transMm}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.depth,
            ...styles.cell,
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
                  flexGrow: COL_FLEX.trans,
                  ...styles.cell,
                  ...styles.cellRight,
                }}
              >
                {formatMm(r.transMm, labels.emptyDash)}
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

export function FindingsTable({ findings, labels }: FindingsTableProps): ReactElement {
  return (
    <View>
      <SideTable side="right" findings={findings} labels={labels} />
      <SideTable side="left" findings={findings} labels={labels} />
    </View>
  );
}
