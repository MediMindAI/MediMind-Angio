// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentTable — the core segment-by-parameter grid.
 *
 * Each row is one vein segment on a given side; each column is one of five
 * categorical parameters (compressibility, thrombosis, spontaneity, phasicity,
 * augmentation). The table has three views:
 *   - left   — rows are the 20 `segment-left` ids
 *   - right  — rows are the 20 `segment-right` ids
 *   - bilateral — both sides shown interleaved (desktop) or stacked (mobile)
 *
 * Rows memoize so typing in one cell only re-renders that row.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconStethoscope,
  IconTrash,
} from '@tabler/icons-react';
import { EMRTabs, EMRButton } from '../common';
import { EMRSelect } from '../shared/EMRFormFields';
import type { EMRSelectOption } from '../shared/EMRFormFields';
import {
  AUGMENTATION_VALUES,
  COMPRESSIBILITY_VALUES,
  PHASICITY_VALUES,
  SPONTANEITY_VALUES,
  THROMBOSIS_VALUES,
  VENOUS_LE_SEGMENTS,
} from '../studies/venous-le/config';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../studies/venous-le/config';
import type { Competency } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './SegmentTable.module.css';

const COMPETENCY_VALUES: ReadonlyArray<Competency | 'auto'> = [
  'auto',
  'normal',
  'incompetent',
  'ablated',
  'inconclusive',
];

export type SegmentTableView = 'left' | 'right' | 'bilateral';

/** Ordered parameter definitions — stable across renders. */
const PARAMS: ReadonlyArray<{
  readonly id: keyof VenousSegmentFinding;
  readonly titleKey: string;
  readonly helpKey: string;
  readonly options: ReadonlyArray<string>;
}> = [
  {
    id: 'compressibility',
    titleKey: 'venousLE.param.compressibility',
    helpKey: 'venousLE.help.compressibility',
    options: COMPRESSIBILITY_VALUES,
  },
  {
    id: 'thrombosis',
    titleKey: 'venousLE.param.thrombosis',
    helpKey: 'venousLE.help.thrombosis',
    options: THROMBOSIS_VALUES,
  },
  {
    id: 'spontaneity',
    titleKey: 'venousLE.param.spontaneity',
    helpKey: 'venousLE.help.spontaneity',
    options: SPONTANEITY_VALUES,
  },
  {
    id: 'phasicity',
    titleKey: 'venousLE.param.phasicity',
    helpKey: 'venousLE.help.phasicity',
    options: PHASICITY_VALUES,
  },
  {
    id: 'augmentation',
    titleKey: 'venousLE.param.augmentation',
    helpKey: 'venousLE.help.augmentation',
    options: AUGMENTATION_VALUES,
  },
];

/** Short column label for the segment column (visible at narrow widths). */
const SEGMENT_SHORT_LABELS: Readonly<Record<VenousLESegmentBase, string>> = {
  cfv: 'CFV',
  eiv: 'EIV',
  'fv-prox': 'FV-P',
  'fv-mid': 'FV-M',
  'fv-dist': 'FV-D',
  pfv: 'PFV',
  'gsv-ak': 'GSV-AK',
  'gsv-prox-calf': 'GSV-PC',
  'gsv-mid-calf': 'GSV-MC',
  'gsv-dist-calf': 'GSV-DC',
  'pop-ak': 'POP-AK',
  'pop-fossa': 'POP-F',
  'pop-bk': 'POP-BK',
  ptv: 'PTV',
  per: 'PER',
  ssv: 'SSV',
  gastroc: 'GAST',
  soleal: 'SOL',
  sfj: 'SFJ',
  spj: 'SPJ',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SegmentTableProps {
  readonly view: SegmentTableView;
  readonly onViewChange: (view: SegmentTableView) => void;
  readonly findings: VenousSegmentFindings;
  readonly onFindingChange: (
    id: VenousLEFullSegmentId,
    patch: Partial<VenousSegmentFinding>,
  ) => void;
  /** Segment id currently highlighted on the diagram (drives row emphasis). */
  readonly highlightId: VenousLEFullSegmentId | null;
  readonly onHighlight: (id: VenousLEFullSegmentId | null) => void;
  /** Fill every segment (current view scope) with compressibility=normal, clear others. */
  readonly onSetAllNormal: () => void;
  /** Clear every segment (current view scope). */
  readonly onClearAll: () => void;
  /** Copy findings from one side to the other. */
  readonly onCopySide: (from: 'left' | 'right') => void;
  /**
   * When true, render only the column header + rows (no outer card/header/
   * tabs/toolbar) — the parent is expected to supply those chrome elements.
   * Defaults to false for back-compat with standalone usages.
   */
  readonly headless?: boolean;
}

// ---------------------------------------------------------------------------
// Cell primitive — memoized by (id, paramId, value) via rowMemo below
// ---------------------------------------------------------------------------

interface CellProps {
  readonly label: string;
  readonly tooltip?: string;
  readonly value: string | undefined;
  readonly options: ReadonlyArray<EMRSelectOption>;
  readonly onChange: (next: string | undefined) => void;
  readonly testId?: string;
}

const ParamCell = memo(function ParamCell({
  label,
  tooltip,
  value,
  options,
  onChange,
  testId,
}: CellProps): React.ReactElement {
  const select = (
    <EMRSelect
      aria-label={label}
      value={value ?? null}
      onChange={(v: string | null) => onChange(v ?? undefined)}
      data={options as EMRSelectOption[]}
      size="sm"
      clearable
      data-testid={testId}
      fullWidth
    />
  );
  if (!tooltip) return select;
  return (
    <Tooltip
      label={tooltip}
      openDelay={500}
      withArrow
      multiline
      events={{ hover: true, focus: false, touch: false }}
      position="top"
      maw={280}
    >
      <div style={{ width: '100%' }}>{select}</div>
    </Tooltip>
  );
});

// ---------------------------------------------------------------------------
// Row — one segment × one side, rendered once per view
// ---------------------------------------------------------------------------

interface SegmentRowProps {
  readonly fullId: VenousLEFullSegmentId;
  readonly base: VenousLESegmentBase;
  readonly side: 'left' | 'right';
  readonly fullLabel: string;
  readonly shortLabel: string;
  readonly finding: VenousSegmentFinding | undefined;
  readonly paramTitles: ReadonlyArray<string>;
  readonly paramValueLabels: ReadonlyArray<ReadonlyArray<EMRSelectOption>>;
  readonly paramTooltips: ReadonlyArray<string>;
  readonly competencyOptions: ReadonlyArray<EMRSelectOption>;
  readonly competencyLabel: string;
  readonly competencyTooltip: string;
  readonly highlighted: boolean;
  readonly onFindingChange: (
    id: VenousLEFullSegmentId,
    patch: Partial<VenousSegmentFinding>,
  ) => void;
  readonly onHighlight: (id: VenousLEFullSegmentId | null) => void;
}

const SegmentRow = memo(function SegmentRow({
  fullId,
  base: _base,
  side,
  fullLabel,
  shortLabel,
  finding,
  paramTitles,
  paramValueLabels,
  paramTooltips,
  competencyOptions,
  competencyLabel,
  competencyTooltip,
  highlighted,
  onFindingChange,
  onHighlight,
}: SegmentRowProps): React.ReactElement {
  // A single stable "change" handler per parameter.
  const makeHandler = useCallback(
    (paramId: keyof VenousSegmentFinding) => (next: string | undefined) => {
      onFindingChange(fullId, { [paramId]: next } as Partial<VenousSegmentFinding>);
    },
    [fullId, onFindingChange],
  );

  const handleCompetencyChange = useCallback(
    (next: string | undefined) => {
      if (!next || next === 'auto') {
        onFindingChange(fullId, { competencyOverride: undefined });
        return;
      }
      onFindingChange(fullId, { competencyOverride: next as Competency });
    },
    [fullId, onFindingChange],
  );

  const handleFocusRow = useCallback(() => {
    onHighlight(fullId);
  }, [fullId, onHighlight]);

  const rowClass = [classes.row, highlighted ? classes.rowHighlighted : '']
    .filter(Boolean)
    .join(' ');

  const competencyValue = finding?.competencyOverride ?? 'auto';

  return (
    <div
      className={rowClass}
      onFocusCapture={handleFocusRow}
      onClick={handleFocusRow}
      data-testid={`segment-row-${fullId}`}
    >
      <div className={`${classes.cell} ${classes.segmentCell}`}>
        <Tooltip label={fullLabel} withArrow position="right" openDelay={250}>
          <UnstyledButton
            className={classes.segmentButton}
            onClick={handleFocusRow}
            aria-label={fullLabel}
            type="button"
          >
            <span className={classes.segmentShort}>{shortLabel}</span>
            <span className={classes.segmentSide} data-side={side}>
              {side === 'left' ? 'L' : 'R'}
            </span>
          </UnstyledButton>
        </Tooltip>
      </div>

      {PARAMS.map((p, i) => {
        const value = finding?.[p.id] as string | undefined;
        return (
          <div
            key={p.id}
            className={`${classes.cell} ${classes.paramCell}`}
            data-param={p.id}
            data-label={paramTitles[i]}
          >
            <ParamCell
              label={paramTitles[i] ?? ''}
              tooltip={paramTooltips[i]}
              value={value}
              options={paramValueLabels[i] ?? []}
              onChange={makeHandler(p.id)}
              testId={`cell-${fullId}-${p.id}`}
            />
          </div>
        );
      })}

      <div
        className={`${classes.cell} ${classes.paramCell}`}
        data-param="competencyOverride"
        data-label={competencyLabel}
      >
        <ParamCell
          label={competencyLabel}
          tooltip={competencyTooltip}
          value={competencyValue}
          options={competencyOptions as EMRSelectOption[]}
          onChange={handleCompetencyChange}
          testId={`cell-${fullId}-competencyOverride`}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SegmentTable = memo(function SegmentTable({
  view,
  onViewChange,
  findings,
  onFindingChange,
  highlightId,
  onHighlight,
  onSetAllNormal,
  onClearAll,
  onCopySide,
  headless = false,
}: SegmentTableProps): React.ReactElement {
  const { t } = useTranslation();

  // Stable per-render translated strings — avoid recomputing per row.
  const paramTitles = useMemo(() => PARAMS.map((p) => t(p.titleKey)), [t]);

  const paramTooltips = useMemo(
    () => PARAMS.map((p) => t(p.helpKey, '')),
    [t],
  );

  const paramValueLabels = useMemo<ReadonlyArray<ReadonlyArray<EMRSelectOption>>>(
    () =>
      PARAMS.map((p) =>
        p.options.map((v) => ({
          value: v,
          label: t(`venousLE.${p.id as string}.${v}`, v),
        })),
      ),
    [t],
  );

  const competencyLabel = t('venousLE.param.competency', 'Competency');
  const competencyTooltip = t(
    'venousLE.help.competency',
    'Auto = derived from findings. Pick a value to override the diagram color.',
  );

  const competencyOptions = useMemo<ReadonlyArray<EMRSelectOption>>(
    () =>
      COMPETENCY_VALUES.map((v) => ({
        value: v,
        label: t(`venousLE.competency.${v}`, v),
      })),
    [t],
  );

  // Rows: one per segment for the active view's side(s).
  const rows = useMemo(() => {
    const sides: ReadonlyArray<'left' | 'right'> =
      view === 'bilateral' ? ['left', 'right'] : [view];
    const out: Array<{
      readonly fullId: VenousLEFullSegmentId;
      readonly base: VenousLESegmentBase;
      readonly side: 'left' | 'right';
      readonly fullLabel: string;
      readonly shortLabel: string;
    }> = [];
    for (const base of VENOUS_LE_SEGMENTS) {
      for (const side of sides) {
        const fullId = `${base}-${side}` as VenousLEFullSegmentId;
        out.push({
          fullId,
          base,
          side,
          fullLabel: t(`venousLE.segment.${base}`, base),
          shortLabel: SEGMENT_SHORT_LABELS[base] ?? base.toUpperCase(),
        });
      }
    }
    return out;
  }, [t, view]);

  // Headless mode: render only the table grid. The parent is expected to
  // supply the outer card shell + header + tabs + toolbar. This powers the
  // unified Segmental Assessment card which stitches this table together
  // with the numeric ReflexTimeTable.
  if (headless) {
    return (
      <div
        className={`${classes.tableWrap} ${classes.tableWrapHeadless}`}
        role="table"
        aria-label={t('venousLE.segmentTable.title')}
      >
        <div className={classes.headRow} role="row">
          <div
            className={`${classes.cell} ${classes.segmentCell} ${classes.headCell}`}
            role="columnheader"
          >
            {t('venousLE.segmentTable.segment')}
          </div>
          {paramTitles.map((title, i) => (
            <div
              key={PARAMS[i]?.id ?? i}
              className={`${classes.cell} ${classes.paramCell} ${classes.headCell}`}
              role="columnheader"
              data-param={PARAMS[i]?.id}
            >
              {title}
            </div>
          ))}
          <div
            className={`${classes.cell} ${classes.paramCell} ${classes.headCell}`}
            role="columnheader"
            data-param="competencyOverride"
          >
            {competencyLabel}
          </div>
        </div>

        {rows.map((r) => (
          <SegmentRow
            key={r.fullId}
            fullId={r.fullId}
            base={r.base}
            side={r.side}
            fullLabel={r.fullLabel}
            shortLabel={r.shortLabel}
            finding={findings[r.fullId]}
            paramTitles={paramTitles}
            paramValueLabels={paramValueLabels}
            paramTooltips={paramTooltips}
            competencyOptions={competencyOptions}
            competencyLabel={competencyLabel}
            competencyTooltip={competencyTooltip}
            highlighted={highlightId === r.fullId}
            onFindingChange={onFindingChange}
            onHighlight={onHighlight}
          />
        ))}
      </div>
    );
  }

  return (
    <section className={classes.card} aria-labelledby="segment-table-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconStethoscope size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="segment-table-title">
              {t('venousLE.segmentTable.title')}
            </Text>
            <Text className={classes.subtitle}>
              {t('venousLE.segmentTable.subtitle')}
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

      {/* Bulk-action toolbar */}
      <Box className={classes.bulkToolbar}>
        <Group gap="xs" wrap="wrap">
          <Tooltip
            label={t('venousLE.bulk.allNormalTooltip', 'Fill every segment with normal findings (⌘N)')}
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
            label={t('venousLE.bulk.copyRightToLeftTooltip', 'Duplicate right-side findings to left (⌘D)')}
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
            label={t('venousLE.bulk.copyLeftToRightTooltip', 'Duplicate left-side findings to right')}
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
        </Group>
      </Box>

      <div className={classes.tableWrap} role="table" aria-label={t('venousLE.segmentTable.title')}>
        {/* Column header */}
        <div className={classes.headRow} role="row">
          <div className={`${classes.cell} ${classes.segmentCell} ${classes.headCell}`} role="columnheader">
            {t('venousLE.segmentTable.segment')}
          </div>
          {paramTitles.map((title, i) => (
            <div
              key={PARAMS[i]?.id ?? i}
              className={`${classes.cell} ${classes.paramCell} ${classes.headCell}`}
              role="columnheader"
              data-param={PARAMS[i]?.id}
            >
              {title}
            </div>
          ))}
          <div
            className={`${classes.cell} ${classes.paramCell} ${classes.headCell}`}
            role="columnheader"
            data-param="competencyOverride"
          >
            {competencyLabel}
          </div>
        </div>

        {/* Rows */}
        {rows.map((r) => (
          <SegmentRow
            key={r.fullId}
            fullId={r.fullId}
            base={r.base}
            side={r.side}
            fullLabel={r.fullLabel}
            shortLabel={r.shortLabel}
            finding={findings[r.fullId]}
            paramTitles={paramTitles}
            paramValueLabels={paramValueLabels}
            paramTooltips={paramTooltips}
            competencyOptions={competencyOptions}
            competencyLabel={competencyLabel}
            competencyTooltip={competencyTooltip}
            highlighted={highlightId === r.fullId}
            onFindingChange={onFindingChange}
            onHighlight={onHighlight}
          />
        ))}

        {/* Mobile: cards-style stacked view is handled purely by CSS grid rules */}
      </div>
    </section>
  );
});

export default SegmentTable;
