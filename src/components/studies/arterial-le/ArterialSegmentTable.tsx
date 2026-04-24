// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialSegmentTable — per-segment findings grid for bilateral LE arterial
 * duplex. One row per (segment × active side), columns:
 *
 *   Segment · Waveform · PSV (cm/s) · Stenosis % · Plaque · Occluded · Note
 *
 * Structurally mirrors venous SegmentTable but with arterial parameters.
 */

import { memo, useCallback, useMemo } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { IconHeartbeat } from '@tabler/icons-react';
import {
  EMRNumberInput,
  EMRSelect,
  EMRCheckbox,
} from '../../shared/EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';
import { WaveformSelector } from './WaveformSelector';
import {
  ARTERIAL_LE_SEGMENTS,
  PLAQUE_MORPHOLOGY_VALUES,
  STENOSIS_CATEGORY_VALUES,
  type ArterialLEFullSegmentId,
  type ArterialLESegmentBase,
  type ArterialSegmentFinding,
  type ArterialSegmentFindings,
  type PlaqueMorphology,
  type StenosisCategory,
} from './config';
import classes from './ArterialSegmentTable.module.css';

export type ArterialTableView = 'left' | 'right' | 'bilateral';

export interface ArterialSegmentTableProps {
  readonly findings: ArterialSegmentFindings;
  readonly view: ArterialTableView;
  readonly onFindingChange: (
    id: ArterialLEFullSegmentId,
    patch: Partial<ArterialSegmentFinding>,
  ) => void;
}

interface Row {
  readonly fullId: ArterialLEFullSegmentId;
  readonly base: ArterialLESegmentBase;
  readonly side: 'left' | 'right';
  readonly finding: ArterialSegmentFinding | undefined;
}

export const ArterialSegmentTable = memo(function ArterialSegmentTable({
  findings,
  view,
  onFindingChange,
}: ArterialSegmentTableProps): React.ReactElement {
  const { t } = useTranslation();

  const sides = useMemo<ReadonlyArray<'left' | 'right'>>(
    () => (view === 'bilateral' ? ['right', 'left'] : [view]),
    [view],
  );

  const rows = useMemo<ReadonlyArray<Row>>(() => {
    const out: Row[] = [];
    for (const base of ARTERIAL_LE_SEGMENTS) {
      for (const side of sides) {
        const fullId = `${base}-${side}` as ArterialLEFullSegmentId;
        out.push({ fullId, base, side, finding: findings[fullId] });
      }
    }
    return out;
  }, [findings, sides]);

  const setField = useCallback(
    <K extends keyof ArterialSegmentFinding>(
      id: ArterialLEFullSegmentId,
      key: K,
      value: ArterialSegmentFinding[K],
    ) => {
      onFindingChange(id, { [key]: value } as Partial<ArterialSegmentFinding>);
    },
    [onFindingChange],
  );

  const plaqueOptions = useMemo(
    () =>
      PLAQUE_MORPHOLOGY_VALUES.map((v) => ({
        value: v,
        label: t(`arterialLE.plaque.${v}`, defaultPlaqueLabel(v)),
      })),
    [t],
  );

  const stenosisOptions = useMemo(
    () =>
      STENOSIS_CATEGORY_VALUES.map((v) => ({
        value: v,
        label: t(`arterialLE.stenosis.${v}`, defaultStenosisLabel(v)),
      })),
    [t],
  );

  return (
    <section className={classes.card} aria-labelledby="arterial-segment-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconHeartbeat size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="arterial-segment-title">
              {t('arterialLE.segmentTable.title', 'Segmental assessment')}
            </Text>
            <Text className={classes.subtitle}>
              {t('arterialLE.segmentTable.subtitle', 'Waveform, PSV, stenosis, and plaque per segment')}
            </Text>
          </Box>
        </Group>
      </header>

      <div className={classes.body}>
        <div className={classes.tableWrap} role="table">
          <div className={classes.headRow} role="row">
            <div className={`${classes.cell} ${classes.segmentCell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.segmentTable.segment', 'Segment')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.param.waveform', 'Waveform')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.param.psvCmS', 'PSV')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.param.stenosisCategory', 'Stenosis')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.param.plaqueMorphology', 'Plaque')}
            </div>
            <div className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {t('arterialLE.param.occluded', 'Occl.')}
            </div>
          </div>

          {rows.map((r) => {
            const segLabel = t(`arterialLE.segment.${r.base}`, r.base);
            const sideChip = r.side === 'left' ? 'L' : 'R';
            return (
              <div key={r.fullId} className={classes.row} role="row">
                <div className={`${classes.cell} ${classes.segmentCell}`}>
                  <span className={classes.segmentLabel}>{segLabel}</span>
                  <span className={classes.segmentSide} data-side={r.side}>
                    {sideChip}
                  </span>
                </div>

                <div className={classes.cell} data-label={t('arterialLE.param.waveform', 'Waveform')}>
                  <WaveformSelector
                    value={r.finding?.waveform}
                    onChange={(v) => setField(r.fullId, 'waveform', v)}
                    size="sm"
                    data-testid={`arterial-${r.fullId}-waveform`}
                    aria-label={`${segLabel} ${sideChip} waveform`}
                  />
                </div>

                <div className={classes.cell} data-label={t('arterialLE.param.psvCmS', 'PSV (cm/s)')}>
                  <EMRNumberInput
                    aria-label={`${segLabel} ${sideChip} PSV`}
                    value={r.finding?.psvCmS ?? ''}
                    onChange={(v) => setField(
                      r.fullId,
                      'psvCmS',
                      typeof v === 'number' ? v : v === '' ? undefined : Number(v),
                    )}
                    min={0}
                    max={800}
                    step={10}
                    size="sm"
                    data-testid={`arterial-${r.fullId}-psv`}
                  />
                </div>

                <div className={classes.cell} data-label={t('arterialLE.param.stenosisCategory', 'Stenosis')}>
                  <EMRSelect
                    aria-label={`${segLabel} ${sideChip} stenosis`}
                    value={r.finding?.stenosisCategory ?? ''}
                    onChange={(v) =>
                      setField(
                        r.fullId,
                        'stenosisCategory',
                        v === '' ? undefined : (v as StenosisCategory),
                      )
                    }
                    data={stenosisOptions}
                    size="sm"
                    data-testid={`arterial-${r.fullId}-stenosis`}
                  />
                </div>

                <div className={classes.cell} data-label={t('arterialLE.param.plaqueMorphology', 'Plaque')}>
                  <EMRSelect
                    aria-label={`${segLabel} ${sideChip} plaque`}
                    value={r.finding?.plaqueMorphology ?? ''}
                    onChange={(v) =>
                      setField(
                        r.fullId,
                        'plaqueMorphology',
                        v === '' ? undefined : (v as PlaqueMorphology),
                      )
                    }
                    data={plaqueOptions}
                    size="sm"
                    data-testid={`arterial-${r.fullId}-plaque`}
                  />
                </div>

                <div className={classes.cell} data-label={t('arterialLE.param.occluded', 'Occl.')}>
                  <EMRCheckbox
                    aria-label={`${segLabel} ${sideChip} occluded`}
                    checked={r.finding?.occluded ?? false}
                    onChange={(c) => setField(r.fullId, 'occluded', c)}
                    size="sm"
                    data-testid={`arterial-${r.fullId}-occluded`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

function defaultStenosisLabel(v: StenosisCategory): string {
  switch (v) {
    case 'none':     return '< 30 %';
    case 'mild':     return '30–49 %';
    case 'moderate': return '50–69 %';
    case 'severe':   return '70–99 %';
    case 'occluded': return 'Occluded';
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

export default ArterialSegmentTable;
