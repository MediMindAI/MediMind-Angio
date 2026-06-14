// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousFindingsTable — zone-sectioned PDF findings block.
 *
 * The iliac/pelvic study's findings are heterogeneous per zone, so this prints
 * one labelled group per zone (renal / iliac-caval / gonadal / plexus / escape
 * points / extrapelvic), each listing only its populated fields. All strings are
 * pre-resolved (the @react-pdf reconciler has no `t()`): `labels.field[id]` and
 * `labels.value['<ns>.<value>']` carry the localized text.
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
import {
  cavalStenosisSeverity,
  effectiveCavalVelocityRatio,
  CAVAL_LEVELS_FOR_BASE,
  LRV_LEVELS,
} from '../../studies/iliac-pelvic-venous/config';

export interface IliacPelvicVenousFindingsTableLabels {
  readonly heading: string;
  readonly none: string;
  readonly zone: Readonly<
    Record<
      'technique' | 'renal' | 'caval' | 'gonadal' | 'plexus' | 'escape' | 'extrapelvic' | 'special',
      string
    >
  >;
  readonly segment: Readonly<Record<string, string>>;
  readonly side: Readonly<Record<'left' | 'right', string>>;
  readonly field: Readonly<Record<string, string>>;
  /** Enum value labels keyed by `<namespace>.<value>`. */
  readonly value: Readonly<Record<string, string>>;
  readonly yes: string;
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
});

const PER_SIDE_CAVAL = ['civ', 'eiv', 'iiv', 'cfv'] as const;

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

  // Zone 1 — renal
  const renal = findings.renal;
  if (renal && Object.keys(renal).length > 0) {
    zoneTitle(labels.zone.renal);
    fieldRow('peakVelocityRatio', renal.peakVelocityRatio);
    fieldRow('apDiameterRatio', renal.apDiameterRatio);
    for (const lvl of LRV_LEVELS) {
      fieldRow(`lrvVelocity_${lvl}`, renal.levels?.[lvl]?.velocityCmS, 'cm/s');
    }
    fieldRow('hilarDiameterMm', renal.levels?.distal?.diameterMm, 'mm');
    if (renal.beakSign) fieldRow('beakSign', labels.yes);
    if (renal.hilarVarices) fieldRow('hilarVarices', labels.yes);
    if (renal.retroAortic) fieldRow('retroAortic', labels.yes);
    if (renal.confirmatoryImagingRecommended) fieldRow('confirmImaging', labels.yes);
  }

  // Zone 2 — iliac & caval
  if (findings.caval && Object.keys(findings.caval).length > 0) {
    zoneTitle(labels.zone.caval);
    const order: IliacCavalFullId[] = ['ivc'];
    for (const base of PER_SIDE_CAVAL) {
      for (const side of ['left', 'right'] as const) {
        order.push(`${base}-${side}` as IliacCavalFullId);
      }
    }
    for (const id of order) {
      const f: IliacCavalFinding | undefined = findings.caval[id];
      if (!f || Object.keys(f).length === 0) continue;
      const parts: string[] = [];
      const p = vlabel('patency', f.patency);
      if (p) parts.push(p);
      const c = vlabel('cavalCompressibility', f.compressibility);
      if (c) parts.push(c);
      const th = f.thrombusChronicity && f.thrombusChronicity !== 'none'
        ? vlabel('thrombusChronicity', f.thrombusChronicity)
        : undefined;
      if (th) parts.push(th);
      const base = (
        id === 'ivc' ? 'ivc' : id.slice(0, id.lastIndexOf('-'))
      ) as keyof typeof CAVAL_LEVELS_FOR_BASE;
      const lvlParts = CAVAL_LEVELS_FOR_BASE[base]
        .map((lvl) => {
          const v = f.levels?.[lvl]?.velocityCmS;
          return v !== undefined ? `${vlabel('level', lvl) ?? lvl} ${v}` : undefined;
        })
        .filter((x): x is string => x !== undefined);
      if (lvlParts.length > 0) parts.push(lvlParts.join(', '));
      const effRatio = effectiveCavalVelocityRatio(f);
      if (effRatio !== undefined) {
        const sev = cavalStenosisSeverity(effRatio);
        const sevLabel = sev !== 'none' ? ` (${vlabel('severity', sev) ?? sev})` : '';
        parts.push(`${labels.field['velocityRatio'] ?? 'ratio'} ${effRatio.toFixed(1)}${sevLabel}`);
      }
      if (f.stenosisPct !== undefined) parts.push(`${f.stenosisPct}%`);
      const ph = vlabel('cfvPhasicity', f.phasicity);
      if (ph) parts.push(ph);
      const vr = vlabel('valsalvaResponse', f.valsalvaResponse);
      if (vr) parts.push(`${labels.field['valsalvaResponse'] ?? 'Valsalva'}: ${vr}`);
      if (f.reflux) parts.push(labels.field['reflux'] ?? 'reflux');
      if (f.collateralsPresent) parts.push(labels.field['collaterals'] ?? 'collaterals');
      if (f.confirmatoryImagingRecommended) {
        parts.push(labels.field['confirmImaging'] ?? 'confirmatory imaging');
      }
      rows.push(
        <View style={styles.row} key={`caval-${id}`}>
          <Text style={styles.label}>{labels.segment[id] ?? id}</Text>
          <Text style={styles.value}>{parts.join(' · ') || '—'}</Text>
        </View>,
      );
    }
  }

  // Zone 3 — gonadal
  for (const side of ['left', 'right'] as const) {
    const g = findings.gonadal?.[side];
    if (!g || Object.keys(g).length === 0) continue;
    zoneTitle(`${labels.zone.gonadal} — ${labels.side[side]}`);
    fieldRow('diameterMm', g.diameterMm, 'mm');
    if (g.refluxPresent) fieldRow('refluxPresent', labels.yes);
    fieldRow('refluxTrigger', vlabel('refluxTrigger', g.refluxTrigger));
    fieldRow('refluxDurationS', g.refluxDurationS, 's');
    fieldRow('refluxType', vlabel('refluxType', g.refluxType));
    fieldRow('flowDirection', vlabel('flowDirection', g.flowDirection));
  }

  // Zone 4 — plexus
  for (const side of ['left', 'right'] as const) {
    const pl = findings.plexus?.[side];
    if (!pl || Object.keys(pl).length === 0) continue;
    zoneTitle(`${labels.zone.plexus} — ${labels.side[side]}`);
    fieldRow('largestDiameterMm', pl.largestDiameterMm, 'mm');
    fieldRow('refluxDurationS', pl.refluxDurationS, 's');
    fieldRow('flowVelocityCmS', pl.flowVelocityCmS, 'cm/s');
    fieldRow('tortuosity', vlabel('tortuosity', pl.tortuosity));
    if (pl.crossingVeins) fieldRow('crossingVeins', labels.yes);
    if (pl.crossPelvicCollateral) fieldRow('crossPelvicCollateral', labels.yes);
  }

  // Zone 5 — escape points + extrapelvic
  const escapePoints = findings.escapePoints ?? [];
  if (escapePoints.length > 0) {
    zoneTitle(labels.zone.escape);
    for (const ep of escapePoints) {
      const typeLabel = vlabel('escapePoint', ep.type) ?? ep.type;
      rows.push(
        <View style={styles.row} key={`ep-${ep.id}`}>
          <Text style={styles.label}>
            {typeLabel} ({labels.side[ep.side]})
          </Text>
          <Text style={styles.value}>{ep.diameterMm !== undefined ? `${ep.diameterMm} mm` : '—'}</Text>
        </View>,
      );
    }
  }
  const ev = findings.extrapelvic;
  if (ev) {
    const present = (['vulvar', 'perineal', 'gluteal', 'posteromedialThigh', 'sciatic'] as const).filter(
      (k) => ev[k] === true,
    );
    if (present.length > 0) {
      zoneTitle(labels.zone.extrapelvic);
      rows.push(
        <View style={styles.row} key="extrapelvic">
          <Text style={styles.value}>
            {present.map((k) => labels.field[`extrapelvic.${k}`] ?? k).join(' · ')}
          </Text>
        </View>,
      );
    }
  }

  // Zone 6 — special considerations (SMAS / MALS)
  const sc = findings.specialConsiderations;
  const smas = sc?.smas;
  const mals = sc?.mals;
  const hasSmas = smas !== undefined && (smas.smaAortaAngleDeg !== undefined || !!smas.note);
  const hasMals =
    mals !== undefined &&
    (mals.caInspiratoryPsvCmS !== undefined ||
      mals.caExpiratoryPsvCmS !== undefined ||
      mals.chaPsvCmS !== undefined ||
      mals.splenicPsvCmS !== undefined ||
      mals.hookSign === true);
  if (hasSmas || hasMals) {
    zoneTitle(labels.zone.special);
    if (smas) fieldRow('smaAortaAngle', smas.smaAortaAngleDeg, '°');
    if (mals) {
      fieldRow('caInspiratoryPsv', mals.caInspiratoryPsvCmS, 'cm/s');
      fieldRow('caExpiratoryPsv', mals.caExpiratoryPsvCmS, 'cm/s');
      fieldRow('chaPsv', mals.chaPsvCmS, 'cm/s');
      fieldRow('splenicPsv', mals.splenicPsvCmS, 'cm/s');
      if (mals.hookSign) fieldRow('hookSign', labels.yes);
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{labels.heading}</Text>
      {rows.length > 0 ? rows : <Text style={styles.empty}>{labels.none}</Text>}
    </View>
  );
}

export default IliacPelvicVenousFindingsTable;
