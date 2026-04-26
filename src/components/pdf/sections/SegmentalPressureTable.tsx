// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentalPressureTable (PDF) — full-width 2-row pressure matrix with
 * ABI + TBI footer badges.
 *
 * Structure (8 cols):
 *   —   | Brachial | HighThigh | LowThigh | Calf | AnkleDP | AnklePT | Toe
 *   R   | ...                                                        |
 *   L   | ...                                                        |
 * Footer: ABI R / ABI L / TBI R / TBI L badges — tinted by severity band.
 *
 * Label keys come from arterialLE translation namespace. Abbreviated
 * short forms (`brachialShort`, `toeShort`, …) keep Georgian/Russian
 * within column width at full page width (595pt − 2×56.7pt).
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY, PDF_BAND_COLORS } from '../pdfTheme';
import type { SegmentalPressures } from '../../studies/arterial-le/config';
import type { AbiBand } from '../../studies/arterial-le/config';
import {
  computeAbi,
  computeTbi,
  abiBandColorRole,
} from '../../studies/arterial-le/abiCalculator';

export interface SegmentalPressureTableLabels {
  readonly title: string;
  readonly sideRight: string;
  readonly sideLeft: string;
  readonly brachial: string;
  readonly highThigh: string;
  readonly lowThigh: string;
  readonly calf: string;
  readonly ankleDp: string;
  readonly anklePt: string;
  readonly toe: string;
  readonly abi: string;
  readonly tbi: string;
  readonly abiBand: Record<AbiBand, string>;
  readonly emptyDash: string;
}

export interface SegmentalPressureTableProps {
  readonly pressures: SegmentalPressures;
  readonly labels: SegmentalPressureTableLabels;
}

const COL_FLEX = {
  side: 0.6,
  brachial: 1.0,
  highThigh: 1.1,
  lowThigh: 1.1,
  calf: 1.0,
  ankleDp: 1.0,
  anklePt: 1.0,
  toe: 0.8,
} as const;

// Band tints sourced from `PDF_BAND_COLORS` (Wave 4.3 — single source of
// truth in `pdfTheme.ts`). Same color role system as the form's ABI
// badges, flattened to @react-pdf inline styles.

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 4,
    marginBottom: 6,
    fontFamily: PDF_FONT_FAMILY,
  },
  titleBar: {
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
  headCell: {
    fontSize: 7.5,
    lineHeight: 1.1,
    overflow: 'hidden',
    textAlign: 'center',
  },
  sideCell: {
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cell: {
    fontSize: PDF_FONT_SIZES.label,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: PDF_THEME.border,
    borderStyle: 'solid',
  },
  badgeLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: PDF_THEME.textMuted,
    marginRight: 4,
  },
  badgeValue: {
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
    color: PDF_THEME.text,
    marginRight: 6,
  },
  bandChip: {
    fontSize: 7.5,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});

function fmt(n: number | undefined, dash: string): string {
  if (n === undefined || Number.isNaN(n)) return dash;
  return `${Math.round(n)}`;
}

function PressureBadge({
  label,
  value,
  band,
  bandLabel,
}: {
  readonly label: string;
  readonly value: string;
  readonly band: AbiBand;
  readonly bandLabel: string;
}): ReactElement {
  const role = abiBandColorRole(band);
  const bg = PDF_BAND_COLORS[role].bg;
  const fg = PDF_BAND_COLORS[role].fg;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
      <Text style={{ ...styles.bandChip, backgroundColor: bg, color: fg }}>
        {bandLabel}
      </Text>
    </View>
  );
}

export function SegmentalPressureTable({
  pressures,
  labels,
}: SegmentalPressureTableProps): ReactElement {
  const abiR = computeAbi(pressures, 'R');
  const abiL = computeAbi(pressures, 'L');
  const tbiR = computeTbi(pressures, 'R');
  const tbiL = computeTbi(pressures, 'L');

  const headerCol = (label: string, grow: number): ReactElement => (
    <Text style={{ flexBasis: 0, flexGrow: grow, ...styles.headCell }}>
      {label}
    </Text>
  );

  const dataCell = (n: number | undefined, grow: number, key: string): ReactElement => (
    <Text key={key} style={{ flexBasis: 0, flexGrow: grow, ...styles.cell }}>
      {fmt(n, labels.emptyDash)}
    </Text>
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.titleBar}>{labels.title}</Text>
      <View style={styles.columnHeader}>
        {headerCol('', COL_FLEX.side)}
        {headerCol(labels.brachial, COL_FLEX.brachial)}
        {headerCol(labels.highThigh, COL_FLEX.highThigh)}
        {headerCol(labels.lowThigh, COL_FLEX.lowThigh)}
        {headerCol(labels.calf, COL_FLEX.calf)}
        {headerCol(labels.ankleDp, COL_FLEX.ankleDp)}
        {headerCol(labels.anklePt, COL_FLEX.anklePt)}
        {headerCol(labels.toe, COL_FLEX.toe)}
      </View>
      <View style={styles.row}>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.side, ...styles.sideCell }}>
          {labels.sideRight}
        </Text>
        {dataCell(pressures.brachialR, COL_FLEX.brachial, 'brR')}
        {dataCell(pressures.highThighR, COL_FLEX.highThigh, 'htR')}
        {dataCell(pressures.lowThighR, COL_FLEX.lowThigh, 'ltR')}
        {dataCell(pressures.calfR, COL_FLEX.calf, 'cR')}
        {dataCell(pressures.ankleDpR, COL_FLEX.ankleDp, 'adpR')}
        {dataCell(pressures.anklePtR, COL_FLEX.anklePt, 'aptR')}
        {dataCell(pressures.toeR, COL_FLEX.toe, 'tR')}
      </View>
      <View style={styles.row}>
        <Text style={{ flexBasis: 0, flexGrow: COL_FLEX.side, ...styles.sideCell }}>
          {labels.sideLeft}
        </Text>
        {dataCell(pressures.brachialL, COL_FLEX.brachial, 'brL')}
        {dataCell(pressures.highThighL, COL_FLEX.highThigh, 'htL')}
        {dataCell(pressures.lowThighL, COL_FLEX.lowThigh, 'ltL')}
        {dataCell(pressures.calfL, COL_FLEX.calf, 'cL')}
        {dataCell(pressures.ankleDpL, COL_FLEX.ankleDp, 'adpL')}
        {dataCell(pressures.anklePtL, COL_FLEX.anklePt, 'aptL')}
        {dataCell(pressures.toeL, COL_FLEX.toe, 'tL')}
      </View>
      <View style={styles.badgeRow}>
        <PressureBadge
          label={`${labels.abi} ${labels.sideRight}`}
          value={abiR.abi === null ? labels.emptyDash : abiR.abi.toFixed(2)}
          band={abiR.band}
          bandLabel={labels.abiBand[abiR.band]}
        />
        <PressureBadge
          label={`${labels.abi} ${labels.sideLeft}`}
          value={abiL.abi === null ? labels.emptyDash : abiL.abi.toFixed(2)}
          band={abiL.band}
          bandLabel={labels.abiBand[abiL.band]}
        />
        <PressureBadge
          label={`${labels.tbi} ${labels.sideRight}`}
          value={tbiR.tbi === null ? labels.emptyDash : tbiR.tbi.toFixed(2)}
          band={tbiR.band}
          bandLabel={labels.abiBand[tbiR.band]}
        />
        <PressureBadge
          label={`${labels.tbi} ${labels.sideLeft}`}
          value={tbiL.tbi === null ? labels.emptyDash : tbiL.tbi.toFixed(2)}
          band={tbiL.band}
          bandLabel={labels.abiBand[tbiL.band]}
        />
      </View>
    </View>
  );
}

export default SegmentalPressureTable;
