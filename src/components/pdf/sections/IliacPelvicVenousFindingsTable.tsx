// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousFindingsTable — zone-sectioned PDF findings block.
 *
 * Prints the technique/context block, then the iliac & caval table shaped
 * like a standard pelvic venous duplex report (IVC + LRV · RIGHT · LEFT sections,
 * one row per vein level, same columns — AP diameter included — on every row),
 * then the left gonadal vein.
 * Only rows with data are printed. All strings are pre-resolved (the @react-pdf
 * reconciler has no `t()`): `labels.field[id]`, `labels.column[id]`,
 * `labels.row[rowBase]` and `labels.value['<ns>.<value>']` carry the text.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import type {
  IliacPelvicVenousFindings,
  IliacContext,
  IliacCavalFinding,
  IliacCavalFullId,
} from '../../studies/iliac-pelvic-venous/config';
import { MIDLINE_ROWS, SIDE_ROW_BASES, rowBaseOf } from '../../studies/iliac-pelvic-venous/config';

/** Table columns, in print order (the first is the vein-level label). */
export const ILIAC_PDF_COLUMNS = [
  'segment',
  'patency',
  'filling',
  'phasicity',
  'competency',
  'apDiameterMm',
  'peakVelocityCmS',
] as const;
export type IliacPdfColumn = (typeof ILIAC_PDF_COLUMNS)[number];

export interface IliacPelvicVenousFindingsTableLabels {
  readonly heading: string;
  readonly none: string;
  readonly zone: Readonly<Record<'technique' | 'caval' | 'gonadal', string>>;
  /** Table section titles. */
  readonly section: Readonly<Record<'ivc' | 'right' | 'left', string>>;
  readonly column: Readonly<Record<IliacPdfColumn, string>>;
  /** Vein-level row labels keyed by row base (`civ-prox`, `cfv`, `ivc-mid`, `lrv` …). */
  readonly row: Readonly<Record<string, string>>;
  readonly field: Readonly<Record<string, string>>;
  /** Enum value labels keyed by `<namespace>.<value>`. */
  readonly value: Readonly<Record<string, string>>;
  readonly yes: string;
  readonly no: string;
}

export interface IliacPelvicVenousFindingsTableProps {
  readonly findings: IliacPelvicVenousFindings;
  /** Zone-0 technique/context — lives on `parameters.context`, not in findings. */
  readonly context?: IliacContext;
  readonly labels: IliacPelvicVenousFindingsTableLabels;
}

const styles = StyleSheet.create({
  block: { marginBottom: 6, fontFamily: PDF_FONT_FAMILY },
  heading: {
    fontSize: PDF_FONT_SIZES.body,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginBottom: 3,
  },
  zoneTitle: {
    fontSize: PDF_FONT_SIZES.footnote,
    fontWeight: 'bold',
    color: PDF_THEME.secondary,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 1,
  },
  row: { flexDirection: 'row', marginBottom: 0.5 },
  label: { fontSize: PDF_FONT_SIZES.footnote, color: PDF_THEME.textMuted, width: 150 },
  value: { fontSize: PDF_FONT_SIZES.footnote, color: PDF_THEME.text, flexGrow: 1 },
  empty: { fontSize: PDF_FONT_SIZES.footnote, color: PDF_THEME.textMuted, fontStyle: 'italic' },
  sectionTitle: {
    fontSize: PDF_FONT_SIZES.footnote,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginTop: 3,
    marginBottom: 1,
  },
  tRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    paddingVertical: 1,
  },
  tHead: { fontSize: PDF_FONT_SIZES.footnote, fontWeight: 'bold', color: PDF_THEME.textMuted },
  tCell: { fontSize: PDF_FONT_SIZES.footnote, color: PDF_THEME.text, flex: 1, textAlign: 'center' },
  tFirst: { fontSize: PDF_FONT_SIZES.footnote, color: PDF_THEME.text, width: 70 },
});

const SECTIONS: ReadonlyArray<{ key: 'ivc' | 'right' | 'left'; rows: ReadonlyArray<IliacCavalFullId> }> = [
  { key: 'ivc', rows: MIDLINE_ROWS },
  { key: 'right', rows: SIDE_ROW_BASES.map((b) => `${b}-right` as const) },
  { key: 'left', rows: SIDE_ROW_BASES.map((b) => `${b}-left` as const) },
];

/** True when the row has at least one recorded column. */
function hasData(f: IliacCavalFinding | undefined): f is IliacCavalFinding {
  return (
    !!f &&
    (f.patency !== undefined ||
      f.filling !== undefined ||
      f.phasicity !== undefined ||
      f.competency !== undefined ||
      f.apDiameterMm !== undefined ||
      f.peakVelocityCmS !== undefined)
  );
}

export function IliacPelvicVenousFindingsTable({
  findings,
  context,
  labels,
}: IliacPelvicVenousFindingsTableProps): ReactElement {
  const rows: ReactElement[] = [];

  const vlabel = (ns: string, value: string | undefined): string | undefined =>
    value ? (labels.value[`${ns}.${value}`] ?? value) : undefined;
  const fieldRow = (fieldId: string, value: string | number | undefined, unit = ''): void => {
    if (value === undefined || value === '') return;
    rows.push(
      <View style={styles.row} key={`${fieldId}-${rows.length}`}>
        <Text style={styles.label}>{labels.field[fieldId] ?? fieldId}</Text>
        <Text style={styles.value}>
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
      </View>,
    );
  };
  const zoneTitle = (text: string): void => {
    rows.push(
      <Text style={styles.zoneTitle} key={`zt-${rows.length}`}>
        {text}
      </Text>,
    );
  };

  // Zone 0 — technique / context (audit H3 — previously dropped from the PDF).
  const ctx = context;
  if (
    ctx &&
    (ctx.sex ||
      (ctx.symptoms && ctx.symptoms.length > 0) ||
      (ctx.riskFactors && ctx.riskFactors.length > 0) ||
      (ctx.approaches && ctx.approaches.length > 0) ||
      (ctx.positions && ctx.positions.length > 0) ||
      ctx.valsalvaPerformed)
  ) {
    zoneTitle(labels.zone.technique);
    fieldRow('sex', vlabel('sex', ctx.sex));
    if (ctx.symptoms && ctx.symptoms.length > 0) {
      fieldRow('symptoms', ctx.symptoms.map((s) => vlabel('symptom', s) ?? s).join(', '));
    }
    if (ctx.riskFactors && ctx.riskFactors.length > 0) {
      fieldRow('riskFactors', ctx.riskFactors.map((r) => vlabel('riskFactor', r) ?? r).join(', '));
    }
    if (ctx.approaches && ctx.approaches.length > 0) {
      fieldRow('approaches', ctx.approaches.map((a) => vlabel('approach', a) ?? a).join(', '));
    }
    if (ctx.positions && ctx.positions.length > 0) {
      fieldRow('positions', ctx.positions.map((p) => vlabel('position', p) ?? p).join(', '));
    }
    if (ctx.valsalvaPerformed) fieldRow('valsalva', labels.yes);
  }

  // Iliac & caval table — IVC / RIGHT / LEFT, only rows with data.
  const caval = findings.caval ?? {};
  const sections = SECTIONS.map((sec) => ({
    ...sec,
    rows: sec.rows.filter((id) => hasData(caval[id])),
  })).filter((sec) => sec.rows.length > 0);
  if (sections.length > 0) {
    zoneTitle(labels.zone.caval);
    for (const sec of sections) {
      rows.push(
        <Text style={styles.sectionTitle} key={`sec-${sec.key}`}>
          {labels.section[sec.key]}
        </Text>,
      );
      rows.push(
        <View style={styles.tRow} key={`head-${sec.key}`}>
          {ILIAC_PDF_COLUMNS.map((col, i) => (
            <Text key={col} style={[i === 0 ? styles.tFirst : styles.tCell, styles.tHead]}>
              {labels.column[col]}
            </Text>
          ))}
        </View>,
      );
      for (const id of sec.rows) {
        const f = caval[id] ?? {};
        const rowBase = rowBaseOf(id);
        const cells = [
          labels.row[rowBase] ?? rowBase,
          vlabel('patency', f.patency),
          vlabel('filling', f.filling),
          vlabel('phasicity', f.phasicity),
          vlabel('competency', f.competency),
          f.apDiameterMm,
          f.peakVelocityCmS,
        ];
        rows.push(
          <View style={styles.tRow} key={`caval-${id}`}>
            {cells.map((c, i) => (
              <Text key={ILIAC_PDF_COLUMNS[i]} style={i === 0 ? styles.tFirst : styles.tCell}>
                {c ?? '—'}
              </Text>
            ))}
          </View>,
        );
      }
    }
  }

  // Left gonadal vein — diameter + reflux
  const g = findings.gonadal?.left;
  if (g && (g.diameterMm !== undefined || g.refluxPresent !== undefined)) {
    zoneTitle(labels.zone.gonadal);
    fieldRow('diameterMm', g.diameterMm, 'mm');
    if (g.refluxPresent !== undefined) fieldRow('reflux', g.refluxPresent ? labels.yes : labels.no);
  }

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{labels.heading}</Text>
      {rows.length > 0 ? rows : <Text style={styles.empty}>{labels.none}</Text>}
    </View>
  );
}

export default IliacPelvicVenousFindingsTable;
