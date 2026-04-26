// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentAssessmentCard — unified shell around the categorical
 * SegmentTable + numeric ReflexTimeTable.
 *
 * Owns the shared header, tabs, and bulk-actions toolbar (including the
 * Templates dropdown). Lays the two tables side-by-side on ≥1200px
 * (categorical 7/12, numeric 5/12), stacking on narrower viewports.
 *
 * Both child tables render in `headless` mode — this card supplies the
 * outer chrome so the pair looks like one table in the UI.
 */

import { memo } from 'react';
import { Box, Grid, Group, Text, Tooltip } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconStethoscope,
  IconTrash,
} from '@tabler/icons-react';
import { EMRTabs, EMRButton } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';
import { SegmentTable, type SegmentTableView } from './SegmentTable';
import { ReflexTimeTable } from './ReflexTimeTable';
import { TemplatePicker } from './TemplatePicker';
import type {
  VenousLEFullSegmentId,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../studies/venous-le/config';
import type { VenousLETemplate } from '../studies/venous-le/templates';
import type { CustomTemplate } from '../../services/customTemplatesService';
import classes from './SegmentAssessmentCard.module.css';

export interface SegmentAssessmentCardProps {
  readonly view: SegmentTableView;
  readonly onViewChange: (view: SegmentTableView) => void;
  readonly findings: VenousSegmentFindings;
  readonly onFindingChange: (
    id: VenousLEFullSegmentId,
    patch: Partial<VenousSegmentFinding>,
  ) => void;
  readonly highlightId: VenousLEFullSegmentId | null;
  readonly onHighlight: (id: VenousLEFullSegmentId | null) => void;
  readonly onSetAllNormal: () => void;
  readonly onClearAll: () => void;
  readonly onCopySide: (from: 'left' | 'right') => void;
  readonly onApplyTemplate: (template: VenousLETemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustomTemplate: (id: string) => void;
}

export const SegmentAssessmentCard = memo(function SegmentAssessmentCard({
  view,
  onViewChange,
  findings,
  onFindingChange,
  highlightId,
  onHighlight,
  onSetAllNormal,
  onClearAll,
  onCopySide,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
  customTemplates,
  recentTemplateIds,
  onDeleteCustomTemplate,
}: SegmentAssessmentCardProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <section className={classes.card} aria-labelledby="segment-assessment-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconStethoscope size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="segment-assessment-title">
              {t('venousLE.assessment.title', 'Segmental Assessment')}
            </Text>
            <Text className={classes.subtitle}>
              {t(
                'venousLE.assessment.subtitle',
                'Categorical findings and numeric measurements per segment',
              )}
            </Text>
          </Box>
        </Group>
      </header>

      <Box className={classes.tabsWrap}>
        <EMRTabs
          value={view}
          onChange={(v) => v && onViewChange(v as SegmentTableView)}
          variant="pills"
          size="sm"
          grow
        >
          <EMRTabs.List>
            <EMRTabs.Tab value="right">{t('venousLE.tabs.right')}</EMRTabs.Tab>
            <EMRTabs.Tab value="left">{t('venousLE.tabs.left')}</EMRTabs.Tab>
            <EMRTabs.Tab value="bilateral">{t('venousLE.tabs.bilateral')}</EMRTabs.Tab>
          </EMRTabs.List>
        </EMRTabs>
      </Box>

      <Box className={classes.toolbar}>
        <Group gap="xs" wrap="wrap" className={classes.toolbarInner}>
          <div className={classes.toolbarGroup}>
            <Tooltip
              label={t(
                'venousLE.bulk.allNormalTooltip',
                'Fill every segment with normal findings (⌘N)',
              )}
              withArrow
              openDelay={500}
            >
              <span>
                <EMRButton
                  variant="secondary"
                  size="sm"
                  leftSection={<IconCheck size={14} />}
                  onClick={onSetAllNormal}
                  data-testid="bulk-all-normal"
                >
                  {t('venousLE.bulk.allNormal', 'All normal')}
                </EMRButton>
              </span>
            </Tooltip>
            <Tooltip
              label={t('venousLE.bulk.clearAllTooltip', 'Clear every finding in this tab')}
              withArrow
              openDelay={500}
            >
              <span>
                <EMRButton
                  variant="ghost"
                  size="sm"
                  leftSection={<IconTrash size={14} />}
                  onClick={onClearAll}
                  data-testid="bulk-clear-all"
                >
                  {t('venousLE.bulk.clearAll', 'Clear all')}
                </EMRButton>
              </span>
            </Tooltip>
            <Tooltip
              label={t(
                'venousLE.bulk.copyRightToLeftTooltip',
                'Duplicate right-side findings to left (⌘D)',
              )}
              withArrow
              openDelay={500}
            >
              <span>
                <EMRButton
                  variant="ghost"
                  size="sm"
                  leftSection={<IconArrowRight size={14} />}
                  onClick={() => onCopySide('right')}
                  data-testid="bulk-copy-r-to-l"
                >
                  {t('venousLE.bulk.copyRightToLeft', 'Copy R → L')}
                </EMRButton>
              </span>
            </Tooltip>
            <Tooltip
              label={t(
                'venousLE.bulk.copyLeftToRightTooltip',
                'Duplicate left-side findings to right',
              )}
              withArrow
              openDelay={500}
            >
              <span>
                <EMRButton
                  variant="ghost"
                  size="sm"
                  leftSection={<IconArrowLeft size={14} />}
                  onClick={() => onCopySide('left')}
                  data-testid="bulk-copy-l-to-r"
                >
                  {t('venousLE.bulk.copyLeftToRight', 'Copy L → R')}
                </EMRButton>
              </span>
            </Tooltip>
          </div>
          <div className={classes.toolbarDivider} aria-hidden />
          <div className={classes.toolbarGroup}>
            <TemplatePicker
              onApply={onApplyTemplate}
              onSaveCurrentAsTemplate={onSaveCurrentAsTemplate}
              customTemplates={customTemplates}
              recentTemplateIds={recentTemplateIds}
              onDeleteCustom={onDeleteCustomTemplate}
            />
          </div>
        </Group>
      </Box>

      <Box className={classes.body}>
        <Grid gutter="sm" align="stretch">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <div className={classes.tableCol}>
              <SegmentTable
                headless
                view={view}
                onViewChange={onViewChange}
                findings={findings}
                onFindingChange={onFindingChange}
                highlightId={highlightId}
                onHighlight={onHighlight}
                onSetAllNormal={onSetAllNormal}
                onClearAll={onClearAll}
                onCopySide={onCopySide}
              />
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <div className={classes.tableCol}>
              <ReflexTimeTable
                headless
                view={view}
                showAllRows
                findings={findings}
                onFindingChange={onFindingChange}
              />
            </div>
          </Grid.Col>
        </Grid>
      </Box>
    </section>
  );
});

export default SegmentAssessmentCard;
