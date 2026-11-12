/**
 * FindingsTable — per-segment reflux-time table (Right + Left).
 *
 * The Corestudycast-style table has four columns:
 *   Segment | Reflux (ms) | AP diameter (mm) | Depth (mm)
 *
 * Rows with reflux duration above the pathological threshold are rendered
 * in the semantic error color so they jump off the page.
 *
 * Under the numbers, each row prints the categorical values the clinician
 * entered (competency override, compressibility, thrombosis, phasicity) as
 * text — UX-ANGIO-003 / U-1033: a reflux or clot finding must never print as
 * a bare "—". Normal values are not printed (U-1011). A row appears when it
 * has a number OR a printed categorical value; segments with nothing
 * abnormal recorded are left out.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import type { VenousSegmentFindings, VenousLESegmentBase } from '../../studies/venous-le/config';
import {
  VENOUS_LE_SEGMENTS,
  hasPathologicalReflux,
  deriveCompetency,
} from '../../studies/venous-le/config';

/**
 * Categorical fields printed as text under each row, in this order. Which
 * fields print is clinical sign-off S4 (decisions.md) — edit this list to
 * change it; labels come from `labels.field` / `labels.value`.
 */
export const PRINTED_CATEGORICAL_FIELDS = [
  'competencyOverride',
  'compressibility',
  'thrombosis',
  'phasicity',
] as const;
export type PrintedCategoricalField = (typeof PRINTED_CATEGORICAL_FIELDS)[number];

/**
 * The NORMAL value of each printed field. Normal values are not printed —
 * "pertinent findings" reporting (S4 / U-1011, decided under founder
 * delegation 2026-11-12, pending clinician review): an all-normal bilateral
 * report stays at 2 pages instead of growing to 4. Abnormal values print.
 */
const NORMAL_CATEGORICAL_VALUE: Readonly<Record<PrintedCategoricalField, string>> = {
  competencyOverride: 'normal',
  compressibility: 'normal',
  thrombosis: 'none',
  phasicity: 'respirophasic',
};

export interface FindingsTableLabels {
  readonly right: string;
  readonly left: string;
  readonly segment: string;
  readonly refluxMs: string;
  readonly apMm: string;
  readonly depthMm: string;
  readonly segmentName: Record<VenousLESegmentBase, string>;
  readonly emptyDash: string;
  /**
   * Field names for the categorical line (e.g. "Compressibility").
   * Optional only so hand-built label fixtures (scripts/test-pdf.ts) keep
   * compiling; `buildReportLabels` always fills it. Missing → raw key.
   */
  readonly field?: Readonly<Record<PrintedCategoricalField, string>>;
  /** Value labels keyed `${field}.${value}` (e.g. "compressibility.partial"). Missing → raw value. */
  readonly value?: Readonly<Record<string, string>>;
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
  rowLine: {
    flexDirection: 'row',
  },
  categorical: {
    fontSize: PDF_FONT_SIZES.footnote,
    lineHeight: 1.25,
    color: PDF_THEME.text,
    paddingTop: 1,
  },
});

interface RenderRow {
  readonly segmentBase: VenousLESegmentBase;
  readonly refluxMs: number | undefined;
  readonly apMm: number | undefined;
  readonly depthMm: number | undefined;
  readonly pathological: boolean;
  /** "Field: value" parts for the categorical line; empty when none. */
  readonly categorical: ReadonlyArray<string>;
  /** The entered values colour the diagram reflux/occluded → print red. */
  readonly categoricalAbnormal: boolean;
}

function buildRows(
  findings: VenousSegmentFindings,
  side: Side,
  labels: FindingsTableLabels,
): ReadonlyArray<RenderRow> {
  const rows: RenderRow[] = [];
  for (const base of VENOUS_LE_SEGMENTS) {
    const key = `${base}-${side}` as keyof typeof findings;
    const f = findings[key];
    if (!f) continue;
    const { refluxDurationMs, apDiameterMm, depthMm } = f;
    const categorical: string[] = [];
    for (const field of PRINTED_CATEGORICAL_FIELDS) {
      const v = f[field];
      // Normal values ("no thrombosis", full compressibility, …) are skipped.
      if (v === undefined || v === NORMAL_CATEGORICAL_VALUE[field]) continue;
      const text = labels.value?.[`${field}.${v}`] ?? v;
      // Some "nothing found" values are labelled with the dash itself
      // (thrombosis 'none' → "—"); printing "Thrombosis: —" adds nothing.
      if (text === labels.emptyDash) continue;
      categorical.push(`${labels.field?.[field] ?? field}: ${text}`);
    }
    const anyValue =
      refluxDurationMs !== undefined ||
      apDiameterMm !== undefined ||
      depthMm !== undefined ||
      categorical.length > 0;
    if (!anyValue) continue;
    const competency = deriveCompetency(base, f);
    rows.push({
      segmentBase: base,
      refluxMs: refluxDurationMs,
      apMm: apDiameterMm,
      depthMm,
      pathological: hasPathologicalReflux(base, f),
      categorical,
      categoricalAbnormal: competency === 'incompetent' || competency === 'occluded',
    });
  }
  return rows;
}

/** Reflux is stored in ms but reported in seconds (e.g. 3200 → "3.2"). */
function formatMs(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return String(Math.round(n / 10) / 100);
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
  const rows = buildRows(findings, side, labels);
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
            <View key={`${side}-${r.segmentBase}`} style={styles.row} wrap={false}>
              <View style={styles.rowLine}>
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
              {r.categorical.length > 0 ? (
                <Text
                  style={
                    r.categoricalAbnormal
                      ? { ...styles.categorical, ...styles.cellRed }
                      : styles.categorical
                  }
                >
                  {r.categorical.join(' · ')}
                </Text>
              ) : null}
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
