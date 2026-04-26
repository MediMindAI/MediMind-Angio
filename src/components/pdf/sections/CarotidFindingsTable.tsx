// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidFindingsTable — per-vessel carotid table for PDF page 1.
 *
 * Six columns:
 *   Vessel | PSV | EDV | Flow Dir. | Plaque | ICA/CCA
 *
 * Only the `ica-prox` row renders a numeric ICA/CCA ratio (from
 * `icaCcaRatio()`). Other rows show an em-dash in that column.
 *
 * Row-red triggers when any of:
 *   - `flowDirection === 'absent'` or `'retrograde'`
 *   - `plaquePresent && (plaqueSurface === 'irregular' || plaqueUlceration)`
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY, PDF_BAND_COLORS } from '../pdfTheme';
import type {
  CarotidFindings,
  CarotidVesselFinding,
  CarotidVesselBase,
  FlowDirection,
  PlaqueMorphology,
  PlaqueSurface,
} from '../../studies/carotid/config';
import { CAROTID_VESSELS } from '../../studies/carotid/config';
import { icaCcaRatio } from '../../studies/carotid/stenosisCalculator';

export interface CarotidFindingsTableLabels {
  readonly right: string;
  readonly left: string;
  readonly vessel: string;
  readonly psv: string;
  readonly edv: string;
  readonly flow: string;
  readonly plaque: string;
  readonly ratio: string;
  readonly ulcerationMark: string;
  readonly vesselName: Record<CarotidVesselBase, string>;
  readonly flowName: Record<FlowDirection, string>;
  readonly plaqueName: Record<PlaqueMorphology, string>;
  readonly surfaceName: Record<PlaqueSurface, string>;
  readonly emptyDash: string;
}

export interface CarotidFindingsTableProps {
  readonly findings: CarotidFindings;
  readonly labels: CarotidFindingsTableLabels;
  readonly singleSide?: 'left' | 'right';
}

type Side = 'left' | 'right';

const COL_FLEX = {
  vessel: 2.0,
  psv: 0.9,
  edv: 0.9,
  flow: 1.3,
  plaque: 1.5,
  ratio: 0.9,
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
  readonly vesselBase: CarotidVesselBase;
  readonly finding: CarotidVesselFinding;
  readonly pathological: boolean;
}

function isPathological(f: CarotidVesselFinding): boolean {
  if (f.flowDirection === 'absent' || f.flowDirection === 'retrograde') return true;
  if (f.plaquePresent && (f.plaqueSurface === 'irregular' || f.plaqueUlceration)) {
    return true;
  }
  return false;
}

function hasAnyValue(f: CarotidVesselFinding): boolean {
  return (
    f.psvCmS !== undefined ||
    f.edvCmS !== undefined ||
    f.flowDirection !== undefined ||
    f.plaquePresent === true ||
    f.plaqueMorphology !== undefined ||
    f.plaqueLengthMm !== undefined ||
    f.subclavianStealPhase !== undefined
  );
}

function buildRows(
  findings: CarotidFindings,
  side: Side,
): ReadonlyArray<RenderRow> {
  const rows: RenderRow[] = [];
  for (const base of CAROTID_VESSELS) {
    const key = `${base}-${side}` as keyof typeof findings;
    const f = findings[key];
    if (!f) continue;
    if (!hasAnyValue(f)) continue;
    rows.push({
      vesselBase: base,
      finding: f,
      pathological: isPathological(f),
    });
  }
  return rows;
}

function formatVelocity(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return `${Math.round(n)}`;
}

function formatPlaque(
  f: CarotidVesselFinding,
  labels: CarotidFindingsTableLabels,
): string {
  if (!f.plaquePresent) return labels.emptyDash;
  const morph = f.plaqueMorphology;
  const surface = f.plaqueSurface;
  const pieces: string[] = [];
  if (morph && morph !== 'none') pieces.push(labels.plaqueName[morph]);
  if (surface) pieces.push(labels.surfaceName[surface]);
  let text = pieces.length > 0 ? pieces.join('·') : labels.plaqueName['soft'];
  if (f.plaqueUlceration) text += ` ${labels.ulcerationMark}`;
  return text;
}

function formatRatio(
  vesselBase: CarotidVesselBase,
  findings: CarotidFindings,
  side: Side,
  dash: string,
): string {
  if (vesselBase !== 'ica-prox') return dash;
  const ratio = icaCcaRatio(findings, side);
  if (ratio === null || !Number.isFinite(ratio)) return dash;
  return ratio.toFixed(1);
}

function SideTable({
  side,
  labels,
  findings,
}: {
  readonly side: Side;
  readonly labels: CarotidFindingsTableLabels;
  readonly findings: CarotidFindings;
}): ReactElement {
  const rows = buildRows(findings, side);
  const headerLabel = side === 'right' ? labels.right : labels.left;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sideHeader}>{headerLabel}</Text>
      <View style={styles.columnHeader}>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.vessel, ...styles.headCell }}>
          {labels.vessel}
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
            flexGrow: COL_FLEX.edv,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.edv}
        </Text>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.flow, ...styles.headCell }}>
          {labels.flow}
        </Text>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.plaque, ...styles.headCell }}>
          {labels.plaque}
        </Text>
        <Text
          style={{
            flexBasis: 0,
            flexGrow: COL_FLEX.ratio,
            ...styles.headCell,
            ...styles.cellRight,
          }}
        >
          {labels.ratio}
        </Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyMessage}>—</Text>
      ) : (
        rows.map((r) => {
          const vLabel = labels.vesselName[r.vesselBase] ?? r.vesselBase;
          const rowStyle = r.pathological ? { ...styles.row, ...styles.rowRed } : styles.row;
          const cellStyle = r.pathological
            ? { ...styles.cell, ...styles.cellRed }
            : styles.cell;
          const cellRightStyle = r.pathological
            ? { ...styles.cell, ...styles.cellRight, ...styles.cellRed }
            : { ...styles.cell, ...styles.cellRight };
          const flowText =
            r.finding.flowDirection !== undefined
              ? labels.flowName[r.finding.flowDirection]
              : labels.emptyDash;
          return (
            <View key={`${side}-${r.vesselBase}`} style={rowStyle}>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.vessel, ...cellStyle }}>
                {vLabel}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.psv, ...cellRightStyle }}>
                {formatVelocity(r.finding.psvCmS, labels.emptyDash)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.edv, ...cellRightStyle }}>
                {formatVelocity(r.finding.edvCmS, labels.emptyDash)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.flow, ...cellStyle }}>
                {flowText}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.plaque, ...cellStyle }}>
                {formatPlaque(r.finding, labels)}
              </Text>
              <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.ratio, ...cellRightStyle }}>
                {formatRatio(r.vesselBase, findings, side, labels.emptyDash)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export function CarotidFindingsTable({
  findings,
  labels,
  singleSide,
}: CarotidFindingsTableProps): ReactElement {
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

export default CarotidFindingsTable;
