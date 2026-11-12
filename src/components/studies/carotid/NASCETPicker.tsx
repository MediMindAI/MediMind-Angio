// SPDX-License-Identifier: Apache-2.0
/**
 * NASCETPicker — bilateral carotid stenosis-category picker.
 *
 * Two axis cards (Right ICA, Left ICA) each with 5 severity categories
 * (< 50 %, 50–69 %, ≥ 70 %, near-occlusion, occluded). The category is
 * auto-filled per side from the live SRU velocity calculator (PSV / EDV /
 * ICA-CCA ratio); clicking another category overrides it, clicking the manual
 * pick again returns to the auto value.
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

  // What the report actually uses: the manual pick, else the SRU calculation
  // (same fallback as the diagram, narrative, PDF and FHIR).
  const summary = formatSummary(
    {
      right: value.right ?? rightSuggestion,
      left: value.left ?? leftSuggestion,
    },
    (cat) => t(`carotid.nascet.${cat}`, nascetCategoryFallback(cat)),
  );

  const preview = (
    <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
      <Text className={classes.previewLabel}>{t('carotid.nascet.preview', 'NASCET')}</Text>
      <span className={classes.previewChip}>{summary}</span>
    </Group>
  );

  return (
    <EMRCollapsibleSection
      variant="soft"
      title={t('carotid.nascet.title', 'NASCET stenosis classification')}
      subtitle={t('carotid.nascet.subtitle', 'Bilateral ICA severity per SRU 2003 velocity criteria')}
      icon={IconStethoscope}
      defaultOpen
      testId="nascet-section"
      rightSection={preview}
    >
      <div className={classes.body}>
        <Group align="stretch" grow preventGrowOverflow={false} wrap="wrap">
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
        {suggestion && value !== undefined && suggestion !== value ? (
          <button
            type="button"
            className={classes.suggestChip}
            onClick={() => onSelect(suggestion)}
            title={t('carotid.nascet.applySuggestion', 'Apply SRU suggestion')}
            aria-label={t('carotid.nascet.applySuggestion', 'Apply SRU suggestion')}
          >
            {t('carotid.nascet.suggest', 'Suggest')}: {t(`carotid.nascet.${suggestion}`, nascetCategoryFallback(suggestion))}
          </button>
        ) : suggestion && value === undefined ? (
          <span className={classes.suggestApplied} data-testid={`nascet-${side}-auto`}>
            {t('carotid.nascet.auto', 'Auto (SRU)')}
          </span>
        ) : suggestion && suggestion === value ? (
          // Applied-state confirmation so the chip doesn't silently vanish —
          // the clinician sees the pick matches the SRU velocity suggestion.
          <span className={classes.suggestApplied}>
            {`✓ ${t('carotid.nascet.matchesSru', 'matches SRU')}`}
          </span>
        ) : null}
      </Group>
      <Stack gap={4}>
        {NASCET_CATEGORY_VALUES.map((cat) => {
          // Manual pick wins; otherwise the auto-calculated category shows selected.
          const selected = (value ?? suggestion) === cat;
          const role = nascetCategoryColorRole(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(value === cat ? undefined : cat)}
              className={`${classes.option} ${selected ? classes.optionSelected : ''}`}
              data-role={role}
              aria-pressed={selected}
              data-testid={`nascet-${side}-${cat}`}
            >
              {/* U-1006: no separate English code chip — the translated label
                  already carries the category (percent ranges read the same). */}
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

function formatSummary(
  value: CarotidNascetClassification,
  label: (cat: NascetCategory) => string,
): string {
  const r = value.right ? label(value.right) : '—';
  const l = value.left ? label(value.left) : '—';
  return `R: ${r} · L: ${l}`;
}

export default NASCETPicker;
