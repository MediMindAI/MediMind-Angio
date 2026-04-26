// SPDX-License-Identifier: Apache-2.0
/**
 * ReflexTimeTable — numeric measurements per segment
 *
 * A compact table of EMRNumberInputs for the three numeric axes:
 *   - Reflux duration (ms)
 *   - AP diameter (mm)
 *   - Depth from skin (mm)
 *
 * Only segments that already have *any* finding appear as rows — keeps the
 * table short and focused. Pathological reflux rows are badged red.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { IconRuler2 } from '@tabler/icons-react';
import { EMRNumberInput } from '../shared/EMRFormFields';
import {
  VENOUS_LE_SEGMENTS,
  hasPathologicalReflux,
  isDeepSegment,
  REFLUX_THRESHOLDS,
} from '../studies/venous-le/config';
import type {
  VenousLEFullSegmentId,
  VenousLESegmentBase,
  VenousSegmentFinding,
  VenousSegmentFindings,
} from '../studies/venous-le/config';
import type { SegmentTableView } from './SegmentTable';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './ReflexTimeTable.module.css';

export interface ReflexTimeTableProps {
  readonly findings: VenousSegmentFindings;
  readonly onFindingChange: (
    id: VenousLEFullSegmentId,
    patch: Partial<VenousSegmentFinding>,
  ) => void;
  /** Restrict rows to one side; null = both sides */
  readonly restrictSide?: 'left' | 'right' | null;
  /**
   * Scope-matched view (mirrors the SegmentTable tab). When supplied,
   * overrides `restrictSide`: scope 'right' → right only; 'bilateral' → both.
   */
  readonly view?: SegmentTableView;
  /**
   * Render every (segment × side) row for the active scope, even when the
   * finding is empty. Used for side-by-side alignment with SegmentTable.
   */
  readonly showAllRows?: boolean;
  /**
   * Skip the outer card's header, and skip the empty-state placeholder.
   * The parent card supplies its own chrome.
   */
  readonly headless?: boolean;
}

interface Row {
  readonly fullId: VenousLEFullSegmentId;
  readonly base: VenousLESegmentBase;
  readonly side: 'left' | 'right';
  /** May be `undefined` when `showAllRows` renders empty segments. */
  readonly finding: VenousSegmentFinding | undefined;
}

export const ReflexTimeTable = memo(function ReflexTimeTable({
  findings,
  onFindingChange,
  restrictSide = null,
  view,
  showAllRows = false,
  headless = false,
}: ReflexTimeTableProps): React.ReactElement {
  const { t } = useTranslation();

  // Resolve which sides to render: `view` (new API) wins over legacy `restrictSide`.
  const sidesToRender = useMemo<ReadonlyArray<'left' | 'right'>>(() => {
    if (view) {
      return view === 'bilateral' ? ['left', 'right'] : [view];
    }
    if (restrictSide) return [restrictSide];
    return ['left', 'right'];
  }, [view, restrictSide]);

  // Collect rows — one per (segment × side). When `showAllRows` is set,
  // render every row for scope-alignment with the categorical table; else
  // filter to segments that have at least one finding.
  const rows = useMemo<ReadonlyArray<Row>>(() => {
    const out: Row[] = [];
    for (const base of VENOUS_LE_SEGMENTS) {
      for (const side of sidesToRender) {
        const fullId = `${base}-${side}` as VenousLEFullSegmentId;
        const f = findings[fullId];
        if (!showAllRows) {
          if (!f) continue;
          const hasAny =
            f.compressibility !== undefined ||
            f.thrombosis !== undefined ||
            f.spontaneity !== undefined ||
            f.phasicity !== undefined ||
            f.augmentation !== undefined ||
            f.refluxDurationMs !== undefined ||
            f.apDiameterMm !== undefined ||
            f.transDiameterMm !== undefined ||
            f.depthMm !== undefined;
          if (!hasAny) continue;
        }
        out.push({ fullId, base, side, finding: f });
      }
    }
    return out;
  }, [findings, sidesToRender, showAllRows]);

  // Wave 4.9 — implausibility hard-reject thresholds (Part 10 MEDIUM).
  // Two-tier validation: an inline yellow-icon warning is already shown for
  // pathological reflux (>500/1000 ms thresholds in `hasPathologicalReflux`).
  // These thresholds add a SECOND confirm-on-commit gate for values so
  // extreme they almost certainly indicate a typo (e.g. 30000 ms instead of
  // 3000 ms) — the user has to acknowledge before the value lands in state.
  const HARD_REJECT_REFLUX_MS = 3000;
  const HARD_REJECT_DIAMETER_MM = 25;

  const makeHandler = useCallback(
    (fullId: VenousLEFullSegmentId, field: keyof VenousSegmentFinding) =>
      (v: number | string) => {
        if (v === '' || v === null || v === undefined) {
          onFindingChange(fullId, { [field]: undefined } as Partial<VenousSegmentFinding>);
          return;
        }
        const num = typeof v === 'number' ? v : Number(v);
        if (Number.isNaN(num)) {
          onFindingChange(fullId, { [field]: undefined } as Partial<VenousSegmentFinding>);
          return;
        }
        // Two-tier validation — confirm extreme values before commit.
        if (field === 'refluxDurationMs' && num > HARD_REJECT_REFLUX_MS) {
          const ok =
            typeof window === 'undefined'
              ? true
              : window.confirm(
                  t('venousLE.reflux.implausibleConfirm', {
                    value: String(num),
                  }),
                );
          if (!ok) return;
        }
        if (
          (field === 'apDiameterMm' || field === 'transDiameterMm') &&
          num > HARD_REJECT_DIAMETER_MM
        ) {
          const ok =
            typeof window === 'undefined'
              ? true
              : window.confirm(
                  t('venousLE.diameter.implausibleConfirm', {
                    value: String(num),
                  }),
                );
          if (!ok) return;
        }
        onFindingChange(fullId, { [field]: num } as Partial<VenousSegmentFinding>);
      },
    [onFindingChange, t],
  );

  const tableBody = (
    <div
      className={`${classes.tableWrap} ${headless ? classes.tableWrapHeadless : ''}`}
      role="table"
      aria-label={t('venousLE.refluxTable.title')}
    >
      <div className={classes.headRow} role="row">
        {!headless && (
          <div
            className={`${classes.cell} ${classes.segmentCell} ${classes.headCell}`}
            role="columnheader"
          >
            {t('venousLE.segmentTable.segment')}
          </div>
        )}
        <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
          {t('venousLE.refluxTable.ms')}
        </div>
        <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
          {t('venousLE.refluxTable.ap')}
        </div>
        <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
          {t('venousLE.refluxTable.trans')}
        </div>
        <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
          {t('venousLE.refluxTable.depth')}
        </div>
      </div>

      {rows.map((r) => {
        const isAbnormalReflux = r.finding
          ? hasPathologicalReflux(r.base, r.finding)
          : false;
        const threshold = isDeepSegment(r.base)
          ? REFLUX_THRESHOLDS.deepMs
          : REFLUX_THRESHOLDS.superficialMs;
        const rowClass = [classes.row, isAbnormalReflux ? classes.rowAbnormal : '']
          .filter(Boolean)
          .join(' ');
        return (
          <div key={r.fullId} className={rowClass} role="row">
            {!headless && (
              <div className={`${classes.cell} ${classes.segmentCell}`}>
                <span className={classes.segmentLabel}>
                  {t(`venousLE.segment.${r.base}`, r.base)}
                </span>
                <span className={classes.segmentSide} data-side={r.side}>
                  {r.side === 'left' ? 'L' : 'R'}
                </span>
              </div>
            )}

            <div className={classes.cell} data-label={t('venousLE.refluxTable.ms')}>
              <EMRNumberInput
                aria-label={`${t('venousLE.param.refluxDurationMs')} — ${r.fullId}`}
                value={r.finding?.refluxDurationMs ?? ''}
                onChange={makeHandler(r.fullId, 'refluxDurationMs')}
                min={0}
                max={10000}
                step={100}
                size="sm"
                data-testid={`num-${r.fullId}-refluxDurationMs`}
                warningMode="icon"
                {...(isAbnormalReflux
                  ? { warningMessage: t('venousLE.reflux.abnormal', { threshold }) }
                  : {})}
              />
            </div>

            <div className={classes.cell} data-label={t('venousLE.refluxTable.ap')}>
              <EMRNumberInput
                aria-label={`${t('venousLE.param.apDiameterMm')} — ${r.fullId}`}
                value={r.finding?.apDiameterMm ?? ''}
                onChange={makeHandler(r.fullId, 'apDiameterMm')}
                min={0}
                max={50}
                step={0.1}
                decimalScale={1}
                size="sm"
                data-testid={`num-${r.fullId}-apDiameterMm`}
              />
            </div>

            <div className={classes.cell} data-label={t('venousLE.refluxTable.trans')}>
              <EMRNumberInput
                aria-label={`${t('venousLE.param.transDiameterMm')} — ${r.fullId}`}
                value={r.finding?.transDiameterMm ?? ''}
                onChange={makeHandler(r.fullId, 'transDiameterMm')}
                min={0}
                max={50}
                step={0.1}
                decimalScale={1}
                size="sm"
                data-testid={`num-${r.fullId}-transDiameterMm`}
              />
            </div>

            <div className={classes.cell} data-label={t('venousLE.refluxTable.depth')}>
              <EMRNumberInput
                aria-label={`${t('venousLE.param.depthMm')} — ${r.fullId}`}
                value={r.finding?.depthMm ?? ''}
                onChange={makeHandler(r.fullId, 'depthMm')}
                min={0}
                max={100}
                step={0.1}
                decimalScale={1}
                size="sm"
                data-testid={`num-${r.fullId}-depthMm`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // Headless: just the table grid (no card, no header, no empty state).
  if (headless) {
    return tableBody;
  }

  return (
    <section className={classes.card} aria-labelledby="reflex-table-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconRuler2 size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="reflex-table-title">
              {t('venousLE.refluxTable.title')}
            </Text>
            <Text className={classes.subtitle}>{t('venousLE.refluxTable.subtitle')}</Text>
          </Box>
        </Group>
      </header>

      <div className={classes.body}>
        {rows.length === 0 ? (
          <div className={classes.empty}>{t('venousLE.refluxTable.empty')}</div>
        ) : (
          tableBody
        )}
      </div>
    </section>
  );
});

export default ReflexTimeTable;
