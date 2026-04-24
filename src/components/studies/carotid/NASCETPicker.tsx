// SPDX-License-Identifier: Apache-2.0
/**
 * NASCETPicker — bilateral carotid stenosis-category picker.
 *
 * Two axis cards (Right ICA, Left ICA) each with 5 severity categories
 * (< 50 %, 50–69 %, ≥ 70 %, near-occlusion, occluded). Auto-suggest chip
 * appears per side based on live SRU velocity criteria; user can override.
 */

import { memo, useCallback } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { EMRCollapsibleSection } from '../../common';
import { useTranslation } from '../../../contexts/TranslationContext';
import {
  NASCET_CATEGORY_VALUES,
  type CarotidFindings,
  type CarotidNascetClassification,
  type NascetCategory,
} from './config';
import {
  suggestNascetCategory,
  nascetCategoryFallback,
  nascetCategoryColorRole,
} from './stenosisCalculator';
import classes from './NASCETPicker.module.css';

export interface NASCETPickerProps {
  readonly findings: CarotidFindings;
  readonly value: CarotidNascetClassification;
  readonly onChange: (next: CarotidNascetClassification) => void;
}

export const NASCETPicker = memo(function NASCETPicker({
  findings,
  value,
  onChange,
}: NASCETPickerProps): React.ReactElement {
  const { t } = useTranslation();

  const setSide = useCallback(
    (side: 'left' | 'right', cat: NascetCategory | undefined) => {
      onChange({ ...value, [side]: cat });
    },
    [value, onChange],
  );

  const rightSuggestion = suggestNascetCategory(findings, 'right');
  const leftSuggestion = suggestNascetCategory(findings, 'left');

  const summary = formatSummary(value);

  const preview = (
    <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
      <Text className={classes.previewLabel}>{t('carotid.nascet.preview', 'NASCET')}</Text>
      <span className={classes.previewChip}>{summary}</span>
    </Group>
  );

  return (
    <EMRCollapsibleSection
      title={t('carotid.nascet.title', 'NASCET stenosis classification')}
      subtitle={t('carotid.nascet.subtitle', 'Bilateral ICA severity per SRU 2003 velocity criteria')}
      icon={IconStethoscope}
      defaultOpen={false}
      testId="nascet-section"
      rightSection={preview}
    >
      <div className={classes.body}>
        <Group align="stretch" grow wrap="wrap">
          <AxisCard
            side="right"
            value={value.right}
            suggestion={rightSuggestion}
            onSelect={(cat) => setSide('right', cat)}
          />
          <AxisCard
            side="left"
            value={value.left}
            suggestion={leftSuggestion}
            onSelect={(cat) => setSide('left', cat)}
          />
        </Group>
      </div>
    </EMRCollapsibleSection>
  );
});

function AxisCard({
  side,
  value,
  suggestion,
  onSelect,
}: {
  side: 'left' | 'right';
  value: NascetCategory | undefined;
  suggestion: NascetCategory | undefined;
  onSelect: (cat: NascetCategory | undefined) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box className={classes.axis}>
      <Group justify="space-between" align="center" wrap="nowrap" className={classes.axisHead}>
        <Text className={classes.axisTitle}>
          {side === 'right' ? t('carotid.side.right', 'Right ICA') : t('carotid.side.left', 'Left ICA')}
        </Text>
        {suggestion && suggestion !== value ? (
          <button
            type="button"
            className={classes.suggestChip}
            onClick={() => onSelect(suggestion)}
            aria-label={t('carotid.nascet.applySuggestion', 'Apply SRU suggestion')}
          >
            {t('carotid.nascet.suggest', 'Suggest')}: {t(`carotid.nascet.${suggestion}`, nascetCategoryFallback(suggestion))}
          </button>
        ) : null}
      </Group>
      <Stack gap={4}>
        {NASCET_CATEGORY_VALUES.map((cat) => {
          const selected = value === cat;
          const role = nascetCategoryColorRole(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(selected ? undefined : cat)}
              className={`${classes.option} ${selected ? classes.optionSelected : ''}`}
              data-role={role}
              aria-pressed={selected}
              data-testid={`nascet-${side}-${cat}`}
            >
              <span className={classes.code}>{nascetCategoryFallback(cat)}</span>
              <span className={classes.desc}>
                {t(`carotid.nascet.${cat}`, nascetCategoryFallback(cat))}
              </span>
            </button>
          );
        })}
      </Stack>
    </Box>
  );
}

function formatSummary(value: CarotidNascetClassification): string {
  const r = value.right ? nascetCategoryFallback(value.right) : '—';
  const l = value.left ? nascetCategoryFallback(value.left) : '—';
  return `R: ${r} · L: ${l}`;
}

export default NASCETPicker;
