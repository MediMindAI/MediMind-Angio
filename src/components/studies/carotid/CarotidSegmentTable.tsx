// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidSegmentTable — bilateral vessel findings grid.
 *
 * Columns: Vessel · PSV · EDV · Flow · Plaque · Ratio (ICA-prox only) · Note
 * One row per (vessel × active side).
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { IconActivityHeartbeat } from '@tabler/icons-react';
import {
  EMRNumberInput,
  EMRSelect,
  EMRCheckbox,
} from '../../shared/EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';
import {
  CAROTID_VESSELS,
  FLOW_DIRECTION_VALUES,
  PLAQUE_MORPHOLOGY_VALUES,
  isVertebral,
  type CarotidFindings,
  type CarotidVesselFinding,
  type CarotidVesselFullId,
  type CarotidVesselBase,
  type FlowDirection,
  type PlaqueMorphology,
} from './config';
import { icaCcaRatio } from './stenosisCalculator';
import classes from './CarotidSegmentTable.module.css';

export type CarotidTableView = 'left' | 'right' | 'bilateral';

export interface CarotidSegmentTableProps {
  readonly findings: CarotidFindings;
  readonly view: CarotidTableView;
  readonly onFindingChange: (
    id: CarotidVesselFullId,
    patch: Partial<CarotidVesselFinding>,
  ) => void;
}

interface Row {
  readonly fullId: CarotidVesselFullId;
  readonly base: CarotidVesselBase;
  readonly side: 'left' | 'right';
  readonly finding: CarotidVesselFinding | undefined;
}

export const CarotidSegmentTable = memo(function CarotidSegmentTable({
  findings,
  view,
  onFindingChange,
}: CarotidSegmentTableProps): React.ReactElement {
  const { t } = useTranslation();

  const sides = useMemo<ReadonlyArray<'left' | 'right'>>(
    () => (view === 'bilateral' ? ['right', 'left'] : [view]),
    [view],
  );

  const rows = useMemo<ReadonlyArray<Row>>(() => {
    const out: Row[] = [];
    for (const base of CAROTID_VESSELS) {
      for (const side of sides) {
        const fullId = `${base}-${side}` as CarotidVesselFullId;
        out.push({ fullId, base, side, finding: findings[fullId] });
      }
    }
    return out;
  }, [findings, sides]);

  const setField = useCallback(
    <K extends keyof CarotidVesselFinding>(
      id: CarotidVesselFullId,
      key: K,
      value: CarotidVesselFinding[K],
    ) => {
      onFindingChange(id, { [key]: value } as Partial<CarotidVesselFinding>);
    },
    [onFindingChange],
  );

  const flowOptions = useMemo(
    () =>
      FLOW_DIRECTION_VALUES.map((v) => ({
        value: v,
        label: t(`carotid.flow.${v}`, defaultFlowLabel(v)),
      })),
    [t],
  );

  const plaqueOptions = useMemo(
    () =>
      PLAQUE_MORPHOLOGY_VALUES.map((v) => ({
        value: v,
        label: t(`carotid.plaque.${v}`, defaultPlaqueLabel(v)),
      })),
    [t],
  );

  // Compute ICA/CCA ratio once per side so we can show it on ICA-prox rows.
  const ratioRight = icaCcaRatio(findings, 'right');
  const ratioLeft = icaCcaRatio(findings, 'left');

  return (
    <section className={classes.card} aria-labelledby="carotid-segment-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconActivityHeartbeat size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="carotid-segment-title">
              {t('carotid.segmentTable.title', 'Vessel assessment')}
            </Text>
            <Text className={classes.subtitle}>
              {t('carotid.segmentTable.subtitle', 'PSV, EDV, flow direction, and plaque per vessel')}
            </Text>
          </Box>
        </Group>
      </header>

      <div className={classes.body}>
        <div className={classes.tableWrap} role="table">
          <div className={classes.headRow} role="row">
            <div className={`${classes.cell} ${classes.vesselCell} ${classes.headCell}`} role="columnheader">
              {t('carotid.segmentTable.vessel', 'Vessel')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.psv', 'PSV')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.edv', 'EDV')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.flowDirection', 'Flow')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.plaqueMorphology', 'Plaque')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.ulceration', 'Ulc.')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('carotid.param.ratio', 'ICA/CCA')}
            </div>
          </div>

          {rows.map((r) => {
            const vesselLabel = t(`carotid.vessel.${r.base}`, r.base);
            const sideChip = r.side === 'left' ? 'L' : 'R';
            const showRatio = r.base === 'ica-prox';
            const ratioValue = r.side === 'right' ? ratioRight : ratioLeft;
            return (
              <div key={r.fullId} className={classes.row} role="row">
                <div className={`${classes.cell} ${classes.vesselCell}`}>
                  <span className={classes.vesselLabel}>{vesselLabel}</span>
                  <span className={classes.vesselSide} data-side={r.side}>
                    {sideChip}
                  </span>
                </div>

                <div className={classes.cell} data-label="PSV (cm/s)">
                  <EMRNumberInput
                    aria-label={`${vesselLabel} ${sideChip} PSV`}
                    value={r.finding?.psvCmS ?? ''}
                    onChange={(v) =>
                      setField(r.fullId, 'psvCmS', typeof v === 'number' ? v : v === '' ? undefined : Number(v))
                    }
                    min={0}
                    max={700}
                    step={10}
                    size="sm"
                    data-testid={`carotid-${r.fullId}-psv`}
                  />
                </div>

                <div className={classes.cell} data-label="EDV (cm/s)">
                  <EMRNumberInput
                    aria-label={`${vesselLabel} ${sideChip} EDV`}
                    value={r.finding?.edvCmS ?? ''}
                    onChange={(v) =>
                      setField(r.fullId, 'edvCmS', typeof v === 'number' ? v : v === '' ? undefined : Number(v))
                    }
                    min={0}
                    max={300}
                    step={5}
                    size="sm"
                    data-testid={`carotid-${r.fullId}-edv`}
                  />
                </div>

                <div className={classes.cell} data-label={t('carotid.param.flowDirection', 'Flow')}>
                  <EMRSelect
                    aria-label={`${vesselLabel} ${sideChip} flow`}
                    value={r.finding?.flowDirection ?? ''}
                    onChange={(v) =>
                      setField(r.fullId, 'flowDirection', v === '' ? undefined : (v as FlowDirection))
                    }
                    data={flowOptions}
                    size="sm"
                    data-testid={`carotid-${r.fullId}-flow`}
                  />
                  {isVertebral(r.base) ? (
                    <VertebralStealInline
                      value={r.finding?.subclavianStealPhase}
                      onChange={(phase) => setField(r.fullId, 'subclavianStealPhase', phase)}
                    />
                  ) : null}
                </div>

                <div className={classes.cell} data-label={t('carotid.param.plaqueMorphology', 'Plaque')}>
                  <EMRSelect
                    aria-label={`${vesselLabel} ${sideChip} plaque`}
                    value={r.finding?.plaqueMorphology ?? ''}
                    onChange={(v) =>
                      setField(r.fullId, 'plaqueMorphology', v === '' ? undefined : (v as PlaqueMorphology))
                    }
                    data={plaqueOptions}
                    size="sm"
                    data-testid={`carotid-${r.fullId}-plaque`}
                  />
                </div>

                <div className={classes.cell} data-label={t('carotid.param.ulceration', 'Ulc.')}>
                  <EMRCheckbox
                    aria-label={`${vesselLabel} ${sideChip} ulceration`}
                    checked={r.finding?.plaqueUlceration ?? false}
                    onChange={(c) => setField(r.fullId, 'plaqueUlceration', c)}
                    size="sm"
                    data-testid={`carotid-${r.fullId}-ulceration`}
                  />
                </div>

                <div className={classes.cell} data-label={t('carotid.param.ratio', 'ICA/CCA')}>
                  {showRatio && ratioValue !== null ? (
                    <span className={classes.ratioChip}>{ratioValue.toFixed(2)}</span>
                  ) : (
                    <span className={classes.muted}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

function VertebralStealInline({
  value,
  onChange,
}: {
  value: 0 | 1 | 2 | 3 | undefined;
  onChange: (phase: 0 | 1 | 2 | 3 | undefined) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={classes.stealRow} role="radiogroup" aria-label="Subclavian steal phase">
      {[0, 1, 2, 3].map((p) => {
        const selected = value === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? undefined : (p as 0 | 1 | 2 | 3))}
            className={`${classes.stealChip} ${selected ? classes.stealChipSelected : ''}`}
            title={t(`carotid.steal.phase${p}`, defaultStealLabel(p as 0 | 1 | 2 | 3))}
          >
            {p === 0 ? '—' : `Ⅰ·Ⅱ·Ⅲ`[p - 1] ?? String(p)}
          </button>
        );
      })}
    </div>
  );
}

function defaultFlowLabel(v: FlowDirection): string {
  switch (v) {
    case 'antegrade':     return 'Antegrade';
    case 'retrograde':    return 'Retrograde';
    case 'bidirectional': return 'Bidirectional';
    case 'absent':        return 'Absent';
  }
}

function defaultPlaqueLabel(v: PlaqueMorphology): string {
  switch (v) {
    case 'none':      return 'None';
    case 'calcified': return 'Calcified';
    case 'mixed':     return 'Mixed';
    case 'soft':      return 'Soft';
  }
}

function defaultStealLabel(p: 0 | 1 | 2 | 3): string {
  switch (p) {
    case 0: return 'Normal antegrade';
    case 1: return 'Phase I — mid-systolic deceleration';
    case 2: return 'Phase II — alternating (partial retrograde)';
    case 3: return 'Phase III — full retrograde';
  }
}

export default CarotidSegmentTable;
