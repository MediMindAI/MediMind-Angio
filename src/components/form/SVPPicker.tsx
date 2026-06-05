// SPDX-License-Identifier: Apache-2.0
/**
 * SVPPicker — collapsible SVP (Symptoms–Varices–Pathophysiology) classification
 * picker for pelvic venous disorders. Mirrors CEAPPicker, with one structural
 * difference: the P axis is a REPEATABLE LIST of per-segment rows
 * (anatomy × laterality × hemodynamics × etiology), not a fixed single-select.
 *
 * S and V are chip multi-selects ("none" = S0/V0, mutually exclusive with any
 * real code). Sits inside an EMRCollapsibleSection so it stays out of the way.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Text, Select, ActionIcon, Button, Stack } from '@mantine/core';
import { IconSitemap, IconPlus, IconTrash } from '@tabler/icons-react';
import { EMRCollapsibleSection } from '../common';
import { EMRCheckbox } from '../shared/EMRFormFields';
import type {
  SvpClassification,
  SvpEtiology,
  SvpHemodynamic,
  SvpLaterality,
  SvpPathoSegment,
  SvpS,
  SvpSegment,
  SvpV,
} from '../../types/svp';
import { formatSvpClassification, svpSDescription, svpVDescription } from '../../services/svpService';
import { useTranslation } from '../../contexts/TranslationContext';
import { makeId } from '../../utils/idHelpers';
import classes from './SVPPicker.module.css';

export interface SVPPickerProps {
  readonly value: SvpClassification | undefined;
  readonly onChange: (next: SvpClassification | undefined) => void;
}

const S_CODES: ReadonlyArray<SvpS> = ['S0', 'S1', 'S2', 'S3a', 'S3b', 'S3c'];
const V_CODES: ReadonlyArray<SvpV> = ['V0', 'V1', 'V2', 'V3a', 'V3b'];
const SEGMENTS: ReadonlyArray<SvpSegment> = ['IVC', 'LRV', 'GV', 'CIV', 'EIV', 'IIV', 'PELV'];
const LATERALITIES: ReadonlyArray<SvpLaterality> = ['L', 'R', 'B'];
const ETIOLOGIES: ReadonlyArray<SvpEtiology> = ['T', 'NT', 'C'];
const DEFAULT_ROW: SvpPathoSegment = {
  segment: 'CIV',
  laterality: 'L',
  hemodynamics: ['O'],
  etiology: 'NT',
};
const EMPTY: SvpClassification = { s: ['S0'], v: ['V0'], p: [] };

export const SVPPicker = memo(function SVPPicker({
  value,
  onChange,
}: SVPPickerProps): React.ReactElement {
  const { t } = useTranslation();
  const current: SvpClassification = value ?? EMPTY;

  const toggleS = useCallback(
    (code: SvpS, on: boolean) => {
      let next: SvpS[];
      if (code === 'S0') {
        next = on ? ['S0'] : [];
      } else {
        next = on
          ? Array.from(new Set<SvpS>([...current.s, code]))
          : current.s.filter((x) => x !== code);
        next = next.filter((x) => x !== 'S0');
      }
      if (next.length === 0) next = ['S0'];
      onChange({ ...current, s: next });
    },
    [current, onChange],
  );

  const toggleV = useCallback(
    (code: SvpV, on: boolean) => {
      let next: SvpV[];
      if (code === 'V0') {
        next = on ? ['V0'] : [];
      } else {
        next = on
          ? Array.from(new Set<SvpV>([...current.v, code]))
          : current.v.filter((x) => x !== code);
        next = next.filter((x) => x !== 'V0');
      }
      if (next.length === 0) next = ['V0'];
      onChange({ ...current, v: next });
    },
    [current, onChange],
  );

  const addRow = useCallback(() => {
    onChange({ ...current, p: [...current.p, { ...DEFAULT_ROW, id: makeId('svp') }] });
  }, [current, onChange]);

  const removeRow = useCallback(
    (i: number) => {
      onChange({ ...current, p: current.p.filter((_, idx) => idx !== i) });
    },
    [current, onChange],
  );

  const updateRow = useCallback(
    (i: number, patch: Partial<SvpPathoSegment>) => {
      onChange({
        ...current,
        p: current.p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
      });
    },
    [current, onChange],
  );

  const toggleHemo = useCallback(
    (i: number, h: SvpHemodynamic, on: boolean) => {
      const row = current.p[i];
      if (!row) return;
      const next = on
        ? Array.from(new Set<SvpHemodynamic>([...row.hemodynamics, h]))
        : row.hemodynamics.filter((x) => x !== h);
      updateRow(i, { hemodynamics: next.length > 0 ? next : ['O'] });
    },
    [current.p, updateRow],
  );

  const formatted = useMemo(() => formatSvpClassification(current), [current]);

  const preview = (
    <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
      <Text className={classes.previewLabel}>{t('svp.preview', 'SVP:')}</Text>
      <span className={classes.previewChip}>{formatted}</span>
    </Group>
  );

  return (
    <EMRCollapsibleSection
      title={t('svp.section.title', 'SVP Classification')}
      subtitle={t('svp.section.subtitle', 'Symptoms · Varices · Pathophysiology (Meissner 2021)')}
      icon={IconSitemap}
      defaultOpen={false}
      testId="svp-section"
      rightSection={preview}
    >
      <div className={classes.body}>
        <Stack gap="md">
          {/* S axis */}
          <Box className={classes.axis}>
            <Text className={classes.axisTitle}>{t('svp.section.sAxis', 'S — Symptoms')}</Text>
            <div className={classes.chipRow}>
              {S_CODES.map((code) => (
                <span key={code} className={classes.pill}>
                  <EMRCheckbox
                    label={`${code} — ${t(svpSDescription(code), code)}`}
                    checked={current.s.includes(code)}
                    onChange={(on) => toggleS(code, on)}
                    size="sm"
                    data-testid={`svp-s-${code}`}
                  />
                </span>
              ))}
            </div>
          </Box>

          {/* V axis */}
          <Box className={classes.axis}>
            <Text className={classes.axisTitle}>{t('svp.section.vAxis', 'V — Varices')}</Text>
            <div className={classes.chipRow}>
              {V_CODES.map((code) => (
                <span key={code} className={classes.pill}>
                  <EMRCheckbox
                    label={`${code} — ${t(svpVDescription(code), code)}`}
                    checked={current.v.includes(code)}
                    onChange={(on) => toggleV(code, on)}
                    size="sm"
                    data-testid={`svp-v-${code}`}
                  />
                </span>
              ))}
            </div>
          </Box>

          {/* P axis — repeatable per-segment rows */}
          <Box className={classes.axis}>
            <Group justify="space-between" mb="xs">
              <Text className={classes.axisTitle} style={{ marginBottom: 0, border: 'none', paddingBottom: 0 }}>
                {t('svp.section.pAxis', 'P — Pathophysiology')}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addRow}
                data-testid="svp-p-add"
              >
                {t('svp.p.add', 'Add segment')}
              </Button>
            </Group>

            {current.p.length === 0 ? (
              <Text size="xs" c="dimmed" className={classes.pEmpty}>
                {t('svp.p.empty', 'No pathophysiology segments recorded.')}
              </Text>
            ) : null}

            <Stack gap="xs">
              {current.p.map((row, i) => (
                <div key={row.id ?? `p-${i}`} className={classes.pRow}>
                  <Group gap="xs" align="flex-end" wrap="wrap">
                    <Select
                      label={t('svp.p.col.segment', 'Segment')}
                      data={SEGMENTS.map((s) => ({ value: s, label: t(`svp.segment.${s}`, s) }))}
                      value={row.segment}
                      onChange={(v) => updateRow(i, { segment: (v as SvpSegment) ?? 'CIV' })}
                      w={140}
                      size="xs"
                      data-testid={`svp-p-segment-${i}`}
                    />
                    <Select
                      label={t('svp.p.col.laterality', 'Side')}
                      data={LATERALITIES.map((l) => ({ value: l, label: t(`svp.laterality.${l}`, l) }))}
                      value={row.laterality ?? null}
                      onChange={(v) => updateRow(i, { laterality: (v as SvpLaterality) ?? undefined })}
                      disabled={row.segment === 'IVC'}
                      clearable
                      w={110}
                      size="xs"
                      data-testid={`svp-p-laterality-${i}`}
                    />
                    <span className={classes.pill}>
                      <EMRCheckbox
                        label={t('svp.h.O', 'O')}
                        checked={row.hemodynamics.includes('O')}
                        onChange={(on) => toggleHemo(i, 'O', on)}
                        size="sm"
                      />
                    </span>
                    <span className={classes.pill}>
                      <EMRCheckbox
                        label={t('svp.h.R', 'R')}
                        checked={row.hemodynamics.includes('R')}
                        onChange={(on) => toggleHemo(i, 'R', on)}
                        size="sm"
                      />
                    </span>
                    <Select
                      label={t('svp.p.col.etiology', 'Etiology')}
                      data={ETIOLOGIES.map((e) => ({ value: e, label: t(`svp.e.${e}`, e) }))}
                      value={row.etiology}
                      onChange={(v) => updateRow(i, { etiology: (v as SvpEtiology) ?? 'NT' })}
                      w={140}
                      size="xs"
                      data-testid={`svp-p-etiology-${i}`}
                    />
                    <span className={classes.pill}>
                      <EMRCheckbox
                        label={t('svp.p.incomplete', 'interim')}
                        checked={row.incomplete ?? false}
                        onChange={(on) => updateRow(i, { incomplete: on })}
                        size="sm"
                      />
                    </span>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => removeRow(i)}
                      aria-label={t('svp.p.remove', 'Remove')}
                      data-testid={`svp-p-remove-${i}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </div>
              ))}
            </Stack>
          </Box>
        </Stack>
      </div>
    </EMRCollapsibleSection>
  );
});

export default SVPPicker;
