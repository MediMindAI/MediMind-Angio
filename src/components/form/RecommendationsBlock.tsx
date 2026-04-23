// SPDX-License-Identifier: Apache-2.0
/**
 * RecommendationsBlock — editable list of clinician recommendations.
 *
 * Each recommendation has a free-text body + priority select. Empty state
 * prompts the user to add the first item.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { IconClipboardList, IconPlus, IconTrash } from '@tabler/icons-react';
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

  return (
    <section className={classes.card} aria-labelledby="recs-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconClipboardList size={20} stroke={1.75} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text className={classes.title} id="recs-title">
              {t('venousLE.recommendations.title')}
            </Text>
            <Text className={classes.subtitle}>
              {t('venousLE.recommendations.subtitle')}
            </Text>
          </Box>
          <EMRButton
            variant="onGradient"
            size="xs"
            icon={IconPlus}
            onClick={add}
            data-testid="add-recommendation"
          >
            {t('venousLE.recommendations.add')}
          </EMRButton>
        </Group>
      </header>

      <div className={classes.body}>
        {items.length === 0 ? (
          <div className={classes.empty}>{t('venousLE.recommendations.empty')}</div>
        ) : (
          <Stack gap="md">
            {items.map((r, idx) => (
              <div key={r.id} className={classes.item}>
                <div className={classes.itemHeader}>
                  <span className={classes.itemIndex}>#{idx + 1}</span>
                  <EMRButton
                    variant="ghost"
                    size="xs"
                    icon={IconTrash}
                    onClick={() => remove(r.id)}
                    aria-label={t('common.close', 'Remove')}
                    data-testid={`remove-recommendation-${r.id}`}
                  >
                    {''}
                  </EMRButton>
                </div>
                <div className={classes.itemBody}>
                  <Box className={classes.itemTextarea}>
                    <EMRTextarea
                      placeholder={t('venousLE.recommendations.placeholder')}
                      value={r.text}
                      onChange={(v) => update(r.id, { text: v })}
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
        )}
      </div>
    </section>
  );
});

export default RecommendationsBlock;
