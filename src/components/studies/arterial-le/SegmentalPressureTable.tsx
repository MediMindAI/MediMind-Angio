// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentalPressureTable — 7-row × 2-column grid of blood-pressure inputs
 * (mmHg) for bilateral LE arterial study. Auto-computes ABI and TBI per
 * side with severity-tinted badges next to the ankle and toe rows.
 *
 * Rows: Brachial · High thigh · Low thigh · Calf · Ankle DP · Ankle PT · Toe
 * Each row: left input · right input.
 * Plus a footer row: ABI L / ABI R badges + TBI L / TBI R badges.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { IconGauge } from '@tabler/icons-react';
import { EMRNumberInput } from '../../shared/EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';
import type { SegmentalPressures } from './config';
import {
  computeAbi,
  computeTbi,
  abiBandI18nKey,
  abiBandColorRole,
  type AbiResult,
  type TbiResult,
} from './abiCalculator';
import classes from './SegmentalPressureTable.module.css';

export interface SegmentalPressureTableProps {
  readonly pressures: SegmentalPressures;
  readonly onChange: (next: SegmentalPressures) => void;
}

type RowKey =
  | 'brachial'
  | 'highThigh'
  | 'lowThigh'
  | 'calf'
  | 'ankleDp'
  | 'anklePt'
  | 'toe';

interface RowDef {
  readonly key: RowKey;
  readonly labelKey: string;
  readonly labelFallback: string;
  readonly leftProp: keyof SegmentalPressures;
  readonly rightProp: keyof SegmentalPressures;
}

const ROWS: ReadonlyArray<RowDef> = [
  { key: 'brachial',  labelKey: 'arterialLE.pressures.brachial',  labelFallback: 'Brachial',        leftProp: 'brachialL',  rightProp: 'brachialR' },
  { key: 'highThigh', labelKey: 'arterialLE.pressures.highThigh', labelFallback: 'High thigh',      leftProp: 'highThighL', rightProp: 'highThighR' },
  { key: 'lowThigh',  labelKey: 'arterialLE.pressures.lowThigh',  labelFallback: 'Low thigh',       leftProp: 'lowThighL',  rightProp: 'lowThighR' },
  { key: 'calf',      labelKey: 'arterialLE.pressures.calf',      labelFallback: 'Calf',            leftProp: 'calfL',      rightProp: 'calfR' },
  { key: 'ankleDp',   labelKey: 'arterialLE.pressures.ankleDp',   labelFallback: 'Ankle DP',        leftProp: 'ankleDpL',   rightProp: 'ankleDpR' },
  { key: 'anklePt',   labelKey: 'arterialLE.pressures.anklePt',   labelFallback: 'Ankle PT',        leftProp: 'anklePtL',   rightProp: 'anklePtR' },
  { key: 'toe',       labelKey: 'arterialLE.pressures.toe',       labelFallback: 'Toe',             leftProp: 'toeL',       rightProp: 'toeR' },
];

export const SegmentalPressureTable = memo(function SegmentalPressureTable({
  pressures,
  onChange,
}: SegmentalPressureTableProps): React.ReactElement {
  const { t } = useTranslation();

  const setField = useCallback(
    (prop: keyof SegmentalPressures, value: number | string) => {
      const next: SegmentalPressures = { ...pressures };
      if (value === '' || value === null || value === undefined) {
        (next as Record<string, unknown>)[prop as string] = undefined;
      } else {
        const num = typeof value === 'number' ? value : Number(value);
        (next as Record<string, unknown>)[prop as string] = Number.isNaN(num) ? undefined : num;
      }
      onChange(next);
    },
    [pressures, onChange],
  );

  const abiL = useMemo(() => computeAbi(pressures, 'L'), [pressures]);
  const abiR = useMemo(() => computeAbi(pressures, 'R'), [pressures]);
  const tbiL = useMemo(() => computeTbi(pressures, 'L'), [pressures]);
  const tbiR = useMemo(() => computeTbi(pressures, 'R'), [pressures]);

  return (
    <section className={classes.card} aria-labelledby="pressures-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconGauge size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="pressures-title">
              {t('arterialLE.pressures.title', 'Segmental pressures')}
            </Text>
            <Text className={classes.subtitle}>
              {t('arterialLE.pressures.subtitle', 'Cuff pressures in mmHg. ABI and TBI auto-compute.')}
            </Text>
          </Box>
        </Group>
      </header>

      <div className={classes.body}>
        <div className={classes.headRow} role="row">
          <div className={classes.labelCell} role="columnheader">
            {t('arterialLE.pressures.level', 'Level')}
          </div>
          <div className={classes.sideHead} role="columnheader" data-side="left">
            L
          </div>
          <div className={classes.sideHead} role="columnheader" data-side="right">
            R
          </div>
        </div>

        {ROWS.map((row) => (
          <div key={row.key} className={classes.row} role="row">
            <div className={classes.labelCell}>
              {t(row.labelKey, row.labelFallback)}
            </div>
            <div className={classes.inputCell}>
              <EMRNumberInput
                aria-label={`${t(row.labelKey, row.labelFallback)} L`}
                value={(pressures[row.leftProp] as number | undefined) ?? ''}
                onChange={(v) => setField(row.leftProp, v)}
                min={0}
                max={300}
                step={5}
                size="sm"
                data-testid={`pressure-${row.key}-L`}
              />
            </div>
            <div className={classes.inputCell}>
              <EMRNumberInput
                aria-label={`${t(row.labelKey, row.labelFallback)} R`}
                value={(pressures[row.rightProp] as number | undefined) ?? ''}
                onChange={(v) => setField(row.rightProp, v)}
                min={0}
                max={300}
                step={5}
                size="sm"
                data-testid={`pressure-${row.key}-R`}
              />
            </div>
          </div>
        ))}

        <Stack gap="xs" className={classes.abiFooter}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <AbiBadge label={t('arterialLE.abi.label', 'ABI')} side="L" result={abiL} />
            <AbiBadge label={t('arterialLE.abi.label', 'ABI')} side="R" result={abiR} />
          </Group>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <TbiBadge label={t('arterialLE.tbi.label', 'TBI')} side="L" result={tbiL} />
            <TbiBadge label={t('arterialLE.tbi.label', 'TBI')} side="R" result={tbiR} />
          </Group>
        </Stack>
      </div>
    </section>
  );
});

function AbiBadge({
  label,
  side,
  result,
}: {
  label: string;
  side: 'L' | 'R';
  result: AbiResult;
}): React.ReactElement {
  const { t } = useTranslation();
  const role = abiBandColorRole(result.band);
  const bandLabel = t(abiBandI18nKey(result.band), fallbackBandLabel(result.band));
  const valueStr = result.abi === null ? '—' : result.abi.toFixed(2);
  return (
    <div className={classes.badgeRow}>
      <span className={classes.badgeLabel}>
        {label} {side}
      </span>
      <span className={classes.badgeValue}>{valueStr}</span>
      <span className={`${classes.bandChip} ${classes[`band-${role}`]}`}>{bandLabel}</span>
    </div>
  );
}

function TbiBadge({
  label,
  side,
  result,
}: {
  label: string;
  side: 'L' | 'R';
  result: TbiResult;
}): React.ReactElement {
  const { t } = useTranslation();
  const role = abiBandColorRole(result.band);
  const bandLabel = t(abiBandI18nKey(result.band), fallbackBandLabel(result.band));
  const valueStr = result.tbi === null ? '—' : result.tbi.toFixed(2);
  return (
    <div className={classes.badgeRow}>
      <span className={classes.badgeLabel}>
        {label} {side}
      </span>
      <span className={classes.badgeValue}>{valueStr}</span>
      <span className={`${classes.bandChip} ${classes[`band-${role}`]}`}>{bandLabel}</span>
    </div>
  );
}

/**
 * English defaults for every ABI band — used as the second-arg fallback to
 * `t(arterialLE.abi.band.<band>, <english>)`. All three locales (en/ka/ru)
 * already define every key under `arterialLE.abi.band.*`, so this is purely
 * a resilience net; if a locale strips a key in the future, the English
 * default still renders.
 */
const FALLBACK_BAND_LABELS: Readonly<Record<
  'non-compressible' | 'normal' | 'mild' | 'moderate' | 'severe' | 'unknown',
  string
>> = {
  'non-compressible': 'Non-compressible',
  normal: 'Normal',
  mild: 'Mild PAD',
  moderate: 'Moderate PAD',
  severe: 'Severe / CLI',
  unknown: '—',
};

function fallbackBandLabel(
  band: 'non-compressible' | 'normal' | 'mild' | 'moderate' | 'severe' | 'unknown',
): string {
  return FALLBACK_BAND_LABELS[band];
}

export default SegmentalPressureTable;
