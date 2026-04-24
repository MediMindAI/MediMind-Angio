// SPDX-License-Identifier: Apache-2.0
/**
 * CEAPPicker — collapsible CEAP 2020 classification picker.
 *
 * Four axes (C/E/A/P) + modifier flags. `C` is a radio group, `E` is a radio
 * group, `A` is a single-select radio (the type is narrow, multi-select is a
 * future upgrade), `P` is a radio group. Modifiers (r/s/a/n) are checkboxes.
 *
 * The whole thing sits inside an EMRCollapsibleSection so it stays out of the
 * way when the user doesn't need it.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Grid, Group, Stack, Text } from '@mantine/core';
import { IconCategory2 } from '@tabler/icons-react';
import { EMRCollapsibleSection } from '../common';
import { EMRRadioGroup, EMRCheckbox } from '../shared/EMRFormFields';
import type { EMRRadioOption } from '../shared/EMRFormFields';
import type {
  CeapA,
  CeapC,
  CeapClassification,
  CeapE,
  CeapModifier,
  CeapP,
} from '../../types/ceap';
import { formatCeapClassification } from '../../services/ceapService';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './CEAPPicker.module.css';

export interface CEAPPickerProps {
  readonly value: CeapClassification | undefined;
  readonly onChange: (next: CeapClassification | undefined) => void;
}

const C_CODES: ReadonlyArray<CeapC> = ['C0', 'C1', 'C2', 'C2r', 'C3', 'C4a', 'C4b', 'C4c', 'C5', 'C6', 'C6r'];
const E_CODES: ReadonlyArray<CeapE> = ['Ec', 'Ep', 'Es', 'Esi', 'Ese', 'En'];
const A_CODES: ReadonlyArray<CeapA> = ['As', 'Ap', 'Ad', 'An'];
const P_CODES: ReadonlyArray<CeapP> = ['Pr', 'Po', 'Pro', 'Pn'];
const MODIFIERS: ReadonlyArray<CeapModifier> = ['r', 's', 'a', 'n'];

// C-axis descriptive labels (English fallback used if translation missing).
const C_DESCRIPTIONS: Readonly<Record<CeapC, string>> = {
  C0: 'No visible / palpable signs',
  C1: 'Telangiectasies / reticular veins',
  C2: 'Varicose veins',
  C2r: 'Recurrent varicose veins',
  C3: 'Edema',
  C4a: 'Pigmentation / eczema',
  C4b: 'Lipodermatosclerosis',
  C4c: 'Corona phlebectatica',
  C5: 'Healed venous ulcer',
  C6: 'Active venous ulcer',
  C6r: 'Recurrent active venous ulcer',
};

const E_DESCRIPTIONS: Readonly<Record<CeapE, string>> = {
  Ec: 'Congenital',
  Ep: 'Primary',
  Es: 'Secondary',
  Esi: 'Secondary intravenous',
  Ese: 'Secondary extravenous',
  En: 'No cause identified',
};

const A_DESCRIPTIONS: Readonly<Record<CeapA, string>> = {
  As: 'Superficial',
  Ap: 'Perforators',
  Ad: 'Deep',
  An: 'No anatomical location',
};

const P_DESCRIPTIONS: Readonly<Record<CeapP, string>> = {
  Pr: 'Reflux',
  Po: 'Obstruction',
  Pro: 'Reflux + obstruction',
  Pn: 'No pathophysiology',
};

/** Empty default classification for first interaction. */
const EMPTY: CeapClassification = {
  c: 'C0',
  e: 'En',
  a: 'An',
  p: 'Pn',
  modifiers: [],
};

export const CEAPPicker = memo(function CEAPPicker({
  value,
  onChange,
}: CEAPPickerProps): React.ReactElement {
  const { t } = useTranslation();
  const current: CeapClassification = value ?? EMPTY;

  const cOptions = useMemo<EMRRadioOption[]>(
    () =>
      C_CODES.map((code) => ({
        value: code,
        label: `${code} — ${C_DESCRIPTIONS[code]}`,
      })),
    [],
  );

  const eOptions = useMemo<EMRRadioOption[]>(
    () =>
      E_CODES.map((code) => ({
        value: code,
        label: `${code} — ${E_DESCRIPTIONS[code]}`,
      })),
    [],
  );

  const aOptions = useMemo<EMRRadioOption[]>(
    () =>
      A_CODES.map((code) => ({
        value: code,
        label: `${code} — ${A_DESCRIPTIONS[code]}`,
      })),
    [],
  );

  const pOptions = useMemo<EMRRadioOption[]>(
    () =>
      P_CODES.map((code) => ({
        value: code,
        label: `${code} — ${P_DESCRIPTIONS[code]}`,
      })),
    [],
  );

  const update = useCallback(
    <K extends keyof CeapClassification>(key: K, v: CeapClassification[K]): void => {
      onChange({ ...current, [key]: v });
    },
    [current, onChange],
  );

  const toggleModifier = useCallback(
    (mod: CeapModifier, checked: boolean): void => {
      const next = checked
        ? Array.from(new Set<CeapModifier>([...(current.modifiers ?? []), mod]))
        : (current.modifiers ?? []).filter((m) => m !== mod);
      onChange({ ...current, modifiers: next });
    },
    [current, onChange],
  );

  const formatted = useMemo(() => formatCeapClassification(current), [current]);

  const modifierLabels: Readonly<Record<CeapModifier, string>> = {
    r: t('venousLE.ceap.modifier.r'),
    s: t('venousLE.ceap.modifier.s'),
    a: t('venousLE.ceap.modifier.a'),
    n: t('venousLE.ceap.modifier.n'),
  };

  const preview = (
    <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
      <Text className={classes.previewLabel}>{t('venousLE.ceap.preview')}</Text>
      <span className={classes.previewChip}>{formatted}</span>
    </Group>
  );

  return (
    <EMRCollapsibleSection
      title={t('venousLE.ceap.title')}
      subtitle={t('venousLE.ceap.subtitle')}
      icon={IconCategory2}
      defaultOpen={false}
      testId="ceap-section"
      rightSection={preview}
    >
      <div className={classes.body}>
        <Grid gutter={{ base: 'sm', sm: 'md' }}>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box className={classes.axis}>
              <Text className={classes.axisTitle}>{t('venousLE.ceap.cSection')}</Text>
              <EMRRadioGroup
                options={cOptions}
                value={current.c}
                onChange={(v) => update('c', v as CeapC)}
                orientation="vertical"
                size="sm"
                data-testid="ceap-c"
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box className={classes.axis}>
              <Text className={classes.axisTitle}>{t('venousLE.ceap.eSection')}</Text>
              <EMRRadioGroup
                options={eOptions}
                value={current.e}
                onChange={(v) => update('e', v as CeapE)}
                orientation="vertical"
                size="sm"
                data-testid="ceap-e"
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box className={classes.axis}>
              <Text className={classes.axisTitle}>{t('venousLE.ceap.aSection')}</Text>
              <EMRRadioGroup
                options={aOptions}
                value={current.a}
                onChange={(v) => update('a', v as CeapA)}
                orientation="vertical"
                size="sm"
                data-testid="ceap-a"
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box className={classes.axis}>
              <Text className={classes.axisTitle}>{t('venousLE.ceap.pSection')}</Text>
              <EMRRadioGroup
                options={pOptions}
                value={current.p}
                onChange={(v) => update('p', v as CeapP)}
                orientation="vertical"
                size="sm"
                data-testid="ceap-p"
              />
            </Box>
          </Grid.Col>
          <Grid.Col span={12}>
            <Box className={classes.axis}>
              <Text className={classes.axisTitle}>{t('venousLE.ceap.modifiers')}</Text>
              <Stack gap={8}>
                {MODIFIERS.map((mod) => (
                  <EMRCheckbox
                    key={mod}
                    label={`${mod} — ${modifierLabels[mod]}`}
                    checked={(current.modifiers ?? []).includes(mod)}
                    onChange={(c) => toggleModifier(mod, c)}
                    size="sm"
                    data-testid={`ceap-modifier-${mod}`}
                  />
                ))}
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>
      </div>
    </EMRCollapsibleSection>
  );
});

export default CEAPPicker;
