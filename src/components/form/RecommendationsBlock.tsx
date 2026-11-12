// SPDX-License-Identifier: Apache-2.0
/**
 * RecommendationsBlock — editable list of clinician recommendations.
 *
 * Each recommendation has a free-text body + priority select. Empty state
 * prompts the user to add the first item.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { EMRButton } from '../common';
import { EMRSelect, EMRTextarea } from '../shared/EMRFormFields';
import type { EMRSelectOption } from '../shared/EMRFormFields';
import type { Recommendation } from '../../types/form';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './RecommendationsBlock.module.css';

type Priority = 'routine' | 'urgent' | 'stat';

export interface RecommendationsBlockProps {
  readonly items: ReadonlyArray<Recommendation>;
  readonly onChange: (next: ReadonlyArray<Recommendation>) => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const RecommendationsBlock = memo(function RecommendationsBlock({
  items,
  onChange,
}: RecommendationsBlockProps): React.ReactElement {
  const { t } = useTranslation();

  const priorityOptions = useMemo<EMRSelectOption[]>(
    () => [
      { value: 'routine', label: t('venousLE.recommendations.priorityRoutine') },
      { value: 'urgent', label: t('venousLE.recommendations.priorityUrgent') },
      { value: 'stat', label: t('venousLE.recommendations.priorityStat') },
    ],
    [t],
  );

  const add = useCallback(() => {
    const next: Recommendation = { id: newId(), text: '', priority: 'routine' };
    onChange([...items, next]);
  }, [items, onChange]);

  const update = useCallback(
    (id: string, patch: Partial<Recommendation>) => {
      onChange(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [items, onChange],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(items.filter((r) => r.id !== id));
    },
    [items, onChange],
  );

  // UX-ANGIO-027: an empty list collapses to the header row alone — the
  // muted "none added" line replaces the subtitle and there is no body, so an
  // untouched study's deck is quieter than a populated one.
  const isEmpty = items.length === 0;

  return (
    <section
      className={classes.card}
      aria-labelledby="recs-title"
      data-empty={isEmpty || undefined}
    >
      <header className={classes.head}>
        {/* wrap: on a phone the add button drops under the title instead of
            squeezing it to an ellipsis. */}
        <Group gap="sm" align="center" wrap="wrap">
          <span className={classes.tick} aria-hidden />
          <Box style={{ flex: '1 1 160px', minWidth: 0 }}>
            <Text component="h2" className={classes.title} id="recs-title">
              {t('venousLE.recommendations.title')}
            </Text>
            <Text className={classes.subtitle} data-testid={isEmpty ? 'recommendations-empty' : undefined}>
              {isEmpty
                ? t('venousLE.recommendations.empty')
                : t('venousLE.recommendations.subtitle')}
            </Text>
          </Box>
          <EMRButton
            variant="secondary"
            size="xs"
            icon={IconPlus}
            onClick={add}
            data-testid="add-recommendation"
          >
            {t('venousLE.recommendations.add')}
          </EMRButton>
        </Group>
      </header>

      {isEmpty ? null : (
        <div className={classes.body}>
          <Stack gap="md">
            {items.map((r, idx) => (
              <div
                key={r.id}
                className={classes.item}
                data-priority={r.priority ?? 'routine'}
              >
                <div className={classes.itemHeader}>
                  <span className={classes.itemIndex}>#{idx + 1}</span>
                  <EMRButton
                    variant="ghost"
                    size="xs"
                    icon={IconTrash}
                    onClick={() => remove(r.id)}
                    aria-label={t('venousLE.recommendations.remove', 'Delete recommendation')}
                    data-testid={`remove-recommendation-${r.id}`}
                  >
                    {''}
                  </EMRButton>
                </div>
                <div className={classes.itemBody}>
                  <Box className={classes.itemTextarea}>
                    <EMRTextarea
                      placeholder={t('venousLE.recommendations.placeholder')}
                      value={r.textKey ? t(r.textKey, r.text) : r.text}
                      onChange={(v) => update(r.id, { text: v, textKey: undefined })}
                      minRows={2}
                      maxRows={6}
                      autosize
                      size="sm"
                      data-testid={`recommendation-text-${r.id}`}
                      fullWidth
                    />
                  </Box>
                  <Box className={classes.itemPriority}>
                    <EMRSelect
                      label={t('venousLE.recommendations.priority')}
                      data={priorityOptions}
                      value={r.priority ?? 'routine'}
                      onChange={(v) => update(r.id, { priority: (v as Priority) ?? 'routine' })}
                      size="sm"
                      data-testid={`recommendation-priority-${r.id}`}
                      fullWidth
                    />
                  </Box>
                </div>
              </div>
            ))}
          </Stack>
        </div>
      )}
    </section>
  );
});

export default RecommendationsBlock;
