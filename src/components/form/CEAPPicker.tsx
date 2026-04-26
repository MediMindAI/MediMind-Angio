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

// CEAP descriptive labels are sourced from `translations/ceap/{en,ka,ru}.json`.
// Translation key suffixes are derived by stripping the leading axis letter and
// lowercasing — e.g. `C4a` → `ceap.c.4a`, `Esi` → `ceap.e.si`. The single
// exception is `Pro`, which maps to the historical key `ceap.p.rO` (kept for
// backward compatibility with `ceapService.ts`).
function pAxisKey(code: CeapP): string {
  return code === 'Pro' ? 'rO' : code.slice(1).toLowerCase();
}

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
        label: t(`ceap.c.${code.slice(1).toLowerCase()}`, code),
      })),
    [t],
  );

  const eOptions = useMemo<EMRRadioOption[]>(
    () =>
      E_CODES.map((code) => ({
        value: code,
        label: t(`ceap.e.${code.slice(1).toLowerCase()}`, code),
      })),
    [t],
  );

  const aOptions = useMemo<EMRRadioOption[]>(
    () =>
      A_CODES.map((code) => ({
        value: code,
        label: t(`ceap.a.${code.slice(1).toLowerCase()}`, code),
      })),
    [t],
  );

  const pOptions = useMemo<EMRRadioOption[]>(
    () =>
      P_CODES.map((code) => ({
        value: code,
        label: t(`ceap.p.${pAxisKey(code)}`, code),
      })),
    [t],
  );

  const update = useCallback(
    <K extends keyof CeapClassification>(key: K, v: CeapClassification[K]): void => {
      const next: CeapClassification = { ...current, [key]: v };
      // If any axis becomes non-"none", strip `n` from modifiers — `n` is
      // valid only when c/e/a/p are all baseline.
      const anyAxisActive =
        next.c !== 'C0' ||
        next.e !== 'En' ||
        next.a !== 'An' ||
        next.p !== 'Pn';
      if (anyAxisActive && (next.modifiers ?? []).includes('n')) {
        onChange({
          ...next,
          modifiers: (next.modifiers ?? []).filter((m) => m !== 'n'),
        });
        return;
      }
      onChange(next);
    },
    [current, onChange],
  );

  const toggleModifier = useCallback(
    (mod: CeapModifier, checked: boolean): void => {
      let next: CeapModifier[];
      if (checked) {
        next = Array.from(new Set<CeapModifier>([...(current.modifiers ?? []), mod]));
        // CEAP 2020: `s` (symptomatic) and `a` (asymptomatic) are mutually
        // exclusive — the patient is one or the other, never both.
        if (mod === 's') next = next.filter((m) => m !== 'a');
        if (mod === 'a') next = next.filter((m) => m !== 's');
        // `n` (no venous pathology) is meaningful only when c/e/a/p are all
        // "no..." — gated at the option level via `nDisabled` below.
      } else {
        next = (current.modifiers ?? []).filter((m) => m !== mod);
      }
      onChange({ ...current, modifiers: next });
    },
    [current, onChange],
  );

  // CEAP 2020: `n` modifier is only valid when the patient has no findings
  // on any axis. Disable the checkbox whenever the picker shows otherwise.
  const nDisabled =
    current.c !== 'C0' ||
    current.e !== 'En' ||
    current.a !== 'An' ||
    current.p !== 'Pn';

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
                    disabled={mod === 'n' ? nDisabled : false}
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
