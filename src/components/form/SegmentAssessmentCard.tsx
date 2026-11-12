// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentAssessmentCard — the venous segment-entry card.
 *
 * Owns the shared header, tabs, and bulk-actions toolbar (including the
 * Templates dropdown), and the segment rows below them.
 *
 * Layout (UX-ANGIO-026 L1, default `layout="merged"`): ONE record per
 * segment × side carrying every field — the 4 categorical selects and the
 * 3 numeric inputs. At ≥1200px a record is one table row (the arterial /
 * carotid shape); below that it collapses into a named card (segment name +
 * side in the header). A card with nothing abnormal in it stays one line
 * (with a summary of what was entered) until it is opened, so a normal or
 * empty study looks quieter than an abnormal one. Every field stays
 * reachable — a compact card never disappears.
 *
 * `layout="split"` keeps the legacy pair (categorical SegmentTable 7/12 +
 * numeric ReflexTimeTable 5/12, both headless) behind a flag.
 */

import { memo, useCallback, useId, useMemo, useState } from 'react';
import { Box, Grid, Group, Text, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconStethoscope,
  IconTrash,
} from '@tabler/icons-react';
import { EMRTabs, EMRButton, EMRTooltip } from '../common';
import { EMRNumberInput, EMRSelect } from '../shared/EMRFormFields';
import type { EMRSelectOption } from '../shared/EMRFormFields';
import { useTranslation } from '../../contexts/TranslationContext';
import { SegmentTable, type SegmentTableView } from './SegmentTable';
import { ReflexTimeTable } from './ReflexTimeTable';
import { TemplatePicker } from './TemplatePicker';
import {
  COMPRESSIBILITY_VALUES,
  PHASICITY_VALUES,
  REFLUX_THRESHOLDS,
  THROMBOSIS_VALUES,
  VENOUS_LE_SEGMENTS,
  deriveCompetency,
  hasPathologicalReflux,
  isDeepSegment,
} from '../studies/venous-le/config';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../studies/venous-le/config';
import type { Competency } from '../../types/anatomy';
import type { VenousLETemplate } from '../studies/venous-le/templates';
import type { CustomTemplate } from '../../services/customTemplatesService';
import classes from './SegmentAssessmentCard.module.css';

type Side = 'left' | 'right';

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
  /**
   * Single-leg study (venousLERight / venousLELeft, UX-ANGIO-012 L4): hides
   * the side tabs and the copy-side actions — every row is this leg.
   */
  readonly lockedSide?: Side | null;
  /** `merged` (default): one record per segment. `split`: legacy table pair. */
  readonly layout?: 'merged' | 'split';
}

// ---------------------------------------------------------------------------
// Field definitions (same keys + option lists as SegmentTable / ReflexTimeTable)
// ---------------------------------------------------------------------------

/** Mirrors SegmentTable's competency override list (W3-perforator: keep in sync). */
const COMPETENCY_VALUES: ReadonlyArray<Competency> = [
  'normal',
  'occluded',
  'incompetent',
  'inconclusive',
  'ablated',
];

type CategoricalId = 'compressibility' | 'thrombosis' | 'phasicity' | 'competencyOverride';
type NumericId = 'refluxDurationMs' | 'apDiameterMm' | 'depthMm';

const CATEGORICAL: ReadonlyArray<{
  readonly id: CategoricalId;
  readonly titleKey: string;
  readonly helpKey: string;
  readonly valueKeyPrefix: string;
  readonly options: ReadonlyArray<string>;
}> = [
  {
    id: 'compressibility',
    titleKey: 'venousLE.param.compressibility',
    helpKey: 'venousLE.help.compressibility',
    valueKeyPrefix: 'venousLE.compressibility',
    options: COMPRESSIBILITY_VALUES,
  },
  {
    id: 'thrombosis',
    titleKey: 'venousLE.param.thrombosis',
    helpKey: 'venousLE.help.thrombosis',
    valueKeyPrefix: 'venousLE.thrombosis',
    options: THROMBOSIS_VALUES,
  },
  {
    id: 'phasicity',
    titleKey: 'venousLE.param.phasicity',
    helpKey: 'venousLE.help.phasicity',
    valueKeyPrefix: 'venousLE.phasicity',
    options: PHASICITY_VALUES,
  },
  {
    id: 'competencyOverride',
    titleKey: 'venousLE.param.competency',
    helpKey: 'venousLE.help.competency',
    valueKeyPrefix: 'venousLE.competency',
    options: COMPETENCY_VALUES,
  },
];

const NUMERIC: ReadonlyArray<{
  readonly id: NumericId;
  readonly labelKey: string;
  /** Column-header label (desktop rows); falls back to `labelKey`. */
  readonly headerKey?: string;
  readonly ariaKey: string;
  readonly max: number;
  readonly decimalScale: number;
}> = [
  {
    id: 'refluxDurationMs',
    labelKey: 'venousLE.refluxTable.ms',
    headerKey: 'venousLE.refluxTable.msShort',
    ariaKey: 'venousLE.param.refluxDurationMs',
    max: 60,
    decimalScale: 2,
  },
  {
    id: 'apDiameterMm',
    labelKey: 'venousLE.refluxTable.ap',
    ariaKey: 'venousLE.param.apDiameterMm',
    max: 50,
    decimalScale: 1,
  },
  {
    id: 'depthMm',
    labelKey: 'venousLE.refluxTable.depth',
    ariaKey: 'venousLE.param.depthMm',
    max: 100,
    decimalScale: 1,
  },
];

// Implausibility hard-reject gate — same thresholds as ReflexTimeTable
// (Wave 4.9, Part 10 MEDIUM). Reflux is typed in seconds, stored in ms.
const HARD_REJECT_REFLUX_MS = 10000;
const HARD_REJECT_DIAMETER_MM = 25;

/** `gsv-prox-thigh` → `GSV Prox Thigh`, `pop-ak` → `POP AK` (SegmentTable's labels). */
function shortLabelFor(base: VenousLESegmentBase): string {
  return base
    .split('-')
    .map((part, i) =>
      i === 0 || part.length <= 2
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');
}

function hasEnteredValue(finding: VenousSegmentFinding | undefined): boolean {
  if (!finding) return false;
  return (
    CATEGORICAL.some((c) => finding[c.id] !== undefined) ||
    NUMERIC.some((n) => finding[n.id] !== undefined)
  );
}

// ---------------------------------------------------------------------------
// One record = one segment × side, every field
// ---------------------------------------------------------------------------

interface ResolvedCategorical {
  readonly id: CategoricalId;
  readonly title: string;
  readonly options: ReadonlyArray<EMRSelectOption>;
}

interface ResolvedNumeric {
  readonly id: NumericId;
  readonly label: string;
  readonly header: string;
  readonly aria: string;
  readonly max: number;
  readonly decimalScale: number;
}

interface SegmentRecordProps {
  readonly fullId: VenousLEFullSegmentId;
  readonly base: VenousLESegmentBase;
  readonly side: Side;
  readonly fullLabel: string;
  readonly sideLabel: string;
  readonly finding: VenousSegmentFinding | undefined;
  readonly categorical: ReadonlyArray<ResolvedCategorical>;
  readonly numeric: ReadonlyArray<ResolvedNumeric>;
  readonly emptyLabel: string;
  readonly collapsible: boolean;
  readonly highlighted: boolean;
  readonly onFindingChange: (
    id: VenousLEFullSegmentId,
    patch: Partial<VenousSegmentFinding>,
  ) => void;
  readonly onNumericChange: (
    id: VenousLEFullSegmentId,
    field: NumericId,
    value: number | string,
  ) => void;
  readonly onHighlight: (id: VenousLEFullSegmentId | null) => void;
  readonly abnormalRefluxMessage: (threshold: number) => string;
}

const SegmentRecord = memo(function SegmentRecord({
  fullId,
  base,
  side,
  fullLabel,
  sideLabel,
  finding,
  categorical,
  numeric,
  emptyLabel,
  collapsible,
  highlighted,
  onFindingChange,
  onNumericChange,
  onHighlight,
  abnormalRefluxMessage,
}: SegmentRecordProps): React.ReactElement {
  const fieldsId = useId();
  const competency = deriveCompetency(base, finding);
  const critical =
    hasEnteredValue(finding) && (competency === 'incompetent' || competency === 'occluded');
  // Below desktop a card opens on its own only when it is abnormal; the
  // clinician's own open/close choice wins once made.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const open = openChoice ?? critical;

  const handleHead = useCallback(() => {
    onHighlight(fullId);
    setOpenChoice(!open);
  }, [fullId, onHighlight, open]);

  const handleFocus = useCallback(() => {
    onHighlight(fullId);
  }, [fullId, onHighlight]);

  // Inline summary of what was entered — shown on a closed card.
  const summary = useMemo(() => {
    if (!finding) return '';
    const parts: string[] = [];
    for (const c of categorical) {
      const v = finding[c.id];
      if (v === undefined) continue;
      const label = c.options.find((o) => o.value === v)?.label ?? v;
      if (label !== '—') parts.push(label);
    }
    for (const n of numeric) {
      const v = finding[n.id];
      if (v === undefined) continue;
      parts.push(`${n.label} ${n.id === 'refluxDurationMs' ? v / 1000 : v}`);
    }
    return parts.join(' · ');
  }, [finding, categorical, numeric]);

  // A segment recorded as fully normal with no measurement shows a quiet ✓
  // instead of repeating the same "full · respirophasic" line on every row —
  // only deviating segments carry a text summary (level-up critic, 768/375).
  const { t } = useTranslation();
  const isDefaultNormal =
    competency === 'normal' &&
    hasEnteredValue(finding) &&
    numeric.every((n) => finding?.[n.id] === undefined);

  const isAbnormalReflux = finding ? hasPathologicalReflux(base, finding) : false;
  const threshold =
    (isDeepSegment(base) ? REFLUX_THRESHOLDS.deepMs : REFLUX_THRESHOLDS.superficialMs) / 1000;

  const recordClass = [
    classes.record,
    highlighted ? classes.recordHighlighted : '',
    critical ? classes.recordCritical : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={recordClass}
      role="row"
      data-open={open ? 'true' : 'false'}
      onFocusCapture={handleFocus}
      data-testid={`segment-row-${fullId}`}
    >
      <div className={classes.recordHeadCell} role="rowheader">
        {/* Desktop rows show the short code, so the full name is a tooltip;
            a card already shows the full name in its header. */}
        <EMRTooltip
          label={fullLabel}
          withArrow
          position="right"
          openDelay={250}
          disabled={collapsible}
        >
          <UnstyledButton
            className={classes.recordHead}
            onClick={handleHead}
            type="button"
            aria-label={`${fullLabel} — ${sideLabel}`}
            {...(collapsible ? { 'aria-expanded': open, 'aria-controls': fieldsId } : {})}
            data-testid={`segment-head-${fullId}`}
          >
            <span className={classes.recordShort}>{shortLabelFor(base)}</span>
            <span className={classes.recordFull}>{fullLabel}</span>
            <span className={classes.recordSide} data-side={side}>
              {side === 'left' ? 'L' : 'R'}
            </span>
            {isDefaultNormal ? (
              <span
                className={classes.recordSummary}
                aria-label={t('venousLE.drawing.color.normal', 'Normal')}
                title={summary}
              >
                <IconCheck size={14} aria-hidden />
              </span>
            ) : (
              <span className={classes.recordSummary}>{summary || emptyLabel}</span>
            )}
            <IconChevronDown size={16} className={classes.recordChevron} aria-hidden />
          </UnstyledButton>
        </EMRTooltip>
      </div>

      <div className={classes.recordFields} id={fieldsId}>
        {categorical.map((c) => (
          <div key={c.id} className={classes.recordField} role="cell" data-label={c.title}>
            <EMRSelect
              aria-label={`${c.title} — ${fullLabel} ${sideLabel}`}
              value={(finding?.[c.id] as string | undefined) ?? null}
              onChange={(v: string | null) =>
                onFindingChange(fullId, { [c.id]: v ?? undefined } as Partial<VenousSegmentFinding>)
              }
              data={c.options as EMRSelectOption[]}
              size="sm"
              clearable
              fullWidth
              data-testid={`cell-${fullId}-${c.id}`}
            />
          </div>
        ))}
        {numeric.map((n) => {
          const raw = finding?.[n.id];
          const value =
            raw === undefined ? '' : n.id === 'refluxDurationMs' ? raw / 1000 : raw;
          return (
            <div key={n.id} className={classes.recordField} role="cell" data-label={n.label}>
              <EMRNumberInput
                aria-label={`${n.aria} — ${fullLabel} ${sideLabel}`}
                value={value}
                onChange={(v: number | string) => onNumericChange(fullId, n.id, v)}
                min={0}
                max={n.max}
                step={0.1}
                decimalScale={n.decimalScale}
                size="sm"
                data-testid={`num-${fullId}-${n.id}`}
                {...(n.id === 'refluxDurationMs'
                  ? {
                      warningMode: 'icon' as const,
                      ...(isAbnormalReflux
                        ? { warningMessage: abnormalRefluxMessage(threshold) }
                        : {}),
                    }
                  : {})}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

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
  lockedSide = null,
  layout = 'merged',
}: SegmentAssessmentCardProps): React.ReactElement {
  const { t } = useTranslation();
  // Below 1200px (Mantine lg) a record is a collapsible card; at 1200px+ it
  // is a table row and always open. Only drives aria — the visual switch is CSS.
  const isRowLayout = useMediaQuery('(min-width: 75em)') ?? false;

  const categorical = useMemo<ReadonlyArray<ResolvedCategorical>>(
    () =>
      CATEGORICAL.map((c) => ({
        id: c.id,
        title: t(c.titleKey),
        options: c.options.map((v) => ({ value: v, label: t(`${c.valueKeyPrefix}.${v}`, v) })),
      })),
    [t],
  );

  const categoricalHelp = useMemo(() => CATEGORICAL.map((c) => t(c.helpKey, '')), [t]);

  const numeric = useMemo<ReadonlyArray<ResolvedNumeric>>(
    () =>
      NUMERIC.map((n) => ({
        id: n.id,
        label: t(n.labelKey),
        header: t(n.headerKey ?? n.labelKey),
        aria: t(n.ariaKey),
        max: n.max,
        decimalScale: n.decimalScale,
      })),
    [t],
  );

  // Right leg first (UX-ANGIO-004); a single-leg study shows only its leg.
  const rows = useMemo(() => {
    const sides: ReadonlyArray<Side> = lockedSide
      ? [lockedSide]
      : view === 'bilateral'
        ? ['right', 'left']
        : [view];
    const out: Array<{
      readonly fullId: VenousLEFullSegmentId;
      readonly base: VenousLESegmentBase;
      readonly side: Side;
      readonly fullLabel: string;
    }> = [];
    for (const base of VENOUS_LE_SEGMENTS) {
      for (const side of sides) {
        out.push({
          fullId: `${base}-${side}` as VenousLEFullSegmentId,
          base,
          side,
          fullLabel: t(`venousLE.segment.${base}`, base),
        });
      }
    }
    return out;
  }, [t, view, lockedSide]);

  const handleNumericChange = useCallback(
    (fullId: VenousLEFullSegmentId, field: NumericId, v: number | string) => {
      if (v === '' || v === null || v === undefined) {
        onFindingChange(fullId, { [field]: undefined } as Partial<VenousSegmentFinding>);
        return;
      }
      const raw = typeof v === 'number' ? v : Number(v);
      // Reflux input is in seconds; persist milliseconds.
      const num = field === 'refluxDurationMs' ? Math.round(raw * 1000) : raw;
      if (Number.isNaN(num)) {
        onFindingChange(fullId, { [field]: undefined } as Partial<VenousSegmentFinding>);
        return;
      }
      if (field === 'refluxDurationMs' && num > HARD_REJECT_REFLUX_MS) {
        const ok =
          typeof window === 'undefined'
            ? true
            : window.confirm(t('venousLE.reflux.implausibleConfirm', { value: String(raw) }));
        if (!ok) return;
      }
      if (field === 'apDiameterMm' && num > HARD_REJECT_DIAMETER_MM) {
        const ok =
          typeof window === 'undefined'
            ? true
            : window.confirm(t('venousLE.diameter.implausibleConfirm', { value: String(num) }));
        if (!ok) return;
      }
      onFindingChange(fullId, { [field]: num } as Partial<VenousSegmentFinding>);
    },
    [onFindingChange, t],
  );

  const abnormalRefluxMessage = useCallback(
    (threshold: number) => t('venousLE.reflux.abnormal', { threshold }),
    [t],
  );

  const sideLabels = useMemo(
    () => ({ right: t('venousLE.tabs.right'), left: t('venousLE.tabs.left') }),
    [t],
  );
  const emptyLabel = t('venousLE.refluxTable.empty');

  // UX-ANGIO-013 — in the both-legs view the bulk action fills both legs, so
  // it says so (label from existing keys; tooltip key handed to i18n).
  const bothLegs = !lockedSide && view === 'bilateral';
  const allNormalLabel = bothLegs
    ? `${t('venousLE.bulk.allNormal', 'All normal')} · ${t('venousLE.tabs.bilateral')}`
    : t('venousLE.bulk.allNormal', 'All normal');
  const allNormalTooltip = bothLegs
    ? t(
        'venousLE.bulk.allNormalBothTooltip',
        'Fill every segment of both legs with normal findings (⌘N)',
      )
    : t('venousLE.bulk.allNormalTooltip', 'Fill every segment with normal findings (⌘N)');

  return (
    <section className={classes.card} aria-labelledby="segment-assessment-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap" className={classes.headGroup}>
          <Box className={classes.iconWrap} aria-hidden>
            <IconStethoscope size={20} stroke={1.75} />
          </Box>
          <Box className={classes.headText}>
            <Text component="h2" className={classes.title} id="segment-assessment-title">
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

      {!lockedSide && (
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
      )}

      <Box className={classes.toolbar}>
        <Group gap="xs" wrap="wrap" className={classes.toolbarInner}>
          <div className={classes.toolbarGroup}>
            <EMRTooltip label={allNormalTooltip} withArrow openDelay={500}>
              <span>
                <EMRButton
                  variant="secondary"
                  size="sm"
                  leftSection={<IconCheck size={14} />}
                  onClick={onSetAllNormal}
                  data-testid="bulk-all-normal"
                >
                  {allNormalLabel}
                </EMRButton>
              </span>
            </EMRTooltip>
            <EMRTooltip
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
            </EMRTooltip>
            {!lockedSide && (
              <>
                <EMRTooltip
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
                </EMRTooltip>
                <EMRTooltip
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
                </EMRTooltip>
              </>
            )}
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
        {layout === 'split' ? (
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
        ) : (
          <div
            className={classes.records}
            role="table"
            aria-label={t('venousLE.assessment.title', 'Segmental Assessment')}
            data-testid="segment-records"
          >
            <div className={classes.recordsHead} role="row">
              <div className={classes.recordsHeadCell} role="columnheader">
                {t('venousLE.segmentTable.segment')}
              </div>
              {categorical.map((c, i) => (
                <EMRTooltip
                  key={c.id}
                  label={categoricalHelp[i] || c.title}
                  withArrow
                  multiline
                  maw={280}
                  openDelay={500}
                >
                  <div className={classes.recordsHeadCell} role="columnheader">
                    {c.title}
                  </div>
                </EMRTooltip>
              ))}
              {numeric.map((n) => (
                <div
                  key={n.id}
                  className={classes.recordsHeadCell}
                  role="columnheader"
                  title={n.label}
                >
                  {n.header}
                </div>
              ))}
            </div>
            {rows.map((r) => (
              <SegmentRecord
                key={r.fullId}
                fullId={r.fullId}
                base={r.base}
                side={r.side}
                fullLabel={r.fullLabel}
                sideLabel={sideLabels[r.side]}
                finding={findings[r.fullId]}
                categorical={categorical}
                numeric={numeric}
                emptyLabel={emptyLabel}
                collapsible={!isRowLayout}
                highlighted={highlightId === r.fullId}
                onFindingChange={onFindingChange}
                onNumericChange={handleNumericChange}
                onHighlight={onHighlight}
                abnormalRefluxMessage={abnormalRefluxMessage}
              />
            ))}
          </div>
        )}
      </Box>
    </section>
  );
});

export default SegmentAssessmentCard;
