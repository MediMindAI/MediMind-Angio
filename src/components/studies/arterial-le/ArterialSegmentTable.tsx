// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialSegmentTable — per-segment findings grid for bilateral LE arterial
 * duplex. One row per (segment × active side), columns:
 *
 *   Segment · Waveform · PSV (cm/s) · Stenosis % · Plaque · Occluded · Note
 *
 * Structurally mirrors venous SegmentTable but with arterial parameters.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { IconHeartbeat, IconChevronDown } from '@tabler/icons-react';
import {
  EMRNumberInput,
  EMRSelect,
  EMRCheckbox,
  EMRTextarea,
} from '../../shared/EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';
import { WaveformSelector } from './WaveformSelector';
import {
  ARTERIAL_LE_SEGMENTS,
  PLAQUE_MORPHOLOGY_VALUES,
  STENOSIS_CATEGORY_VALUES,
  VISUALIZATION_QUALITY_VALUES,
  type ArterialLEFullSegmentId,
  type ArterialLESegmentBase,
  type ArterialSegmentFinding,
  type ArterialSegmentFindings,
  type PlaqueMorphology,
  type StenosisCategory,
  type VisualizationQuality,
} from './config';
import { defaultPlaqueLabel } from '../shared/labels';
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

  // Per-row expand state for the secondary-fields panel (stenosis %, Vr,
  // plaque length, insonation quality, note). Keeps the main grid compact.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const qualityOptions = useMemo(
    () =>
      VISUALIZATION_QUALITY_VALUES.map((v) => ({
        value: v,
        label: t(`arterialLE.visualizationQuality.${v}`, defaultQualityLabel(v)),
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
            const isOpen = expanded.has(r.fullId);
            const f = r.finding;
            const hasDetails =
              f?.stenosisPct !== undefined ||
              f?.velocityRatio !== undefined ||
              f?.plaqueLengthMm !== undefined ||
              (f?.visualizationQuality !== undefined && f.visualizationQuality !== 'adequate') ||
              (f?.note !== undefined && f.note.trim() !== '');
            return (
              <div key={r.fullId} role="presentation">
              <div className={classes.row} role="row">
                <div className={`${classes.cell} ${classes.segmentCell}`}>
                  <span className={classes.segmentLabel}>{segLabel}</span>
                  <span className={classes.segmentSide} data-side={r.side}>
                    {sideChip}
                  </span>
                  <button
                    type="button"
                    className={classes.expandBtn}
                    data-open={isOpen || undefined}
                    data-has-details={hasDetails || undefined}
                    onClick={() => toggleExpanded(r.fullId)}
                    aria-expanded={isOpen}
                    aria-label={t('arterialLE.segmentTable.toggleDetails', 'More fields')}
                    data-testid={`arterial-${r.fullId}-expand`}
                  >
                    <IconChevronDown size={15} stroke={2} />
                  </button>
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

              {isOpen && (
                <div className={classes.detailsPanel} data-testid={`arterial-${r.fullId}-details`}>
                  <div className={classes.detailField}>
                    <span className={classes.detailLabel}>
                      {t('arterialLE.param.stenosisPct', 'Stenosis %')}
                    </span>
                    <EMRNumberInput
                      aria-label={`${segLabel} ${sideChip} stenosis percent`}
                      value={f?.stenosisPct ?? ''}
                      onChange={(v) => setField(
                        r.fullId,
                        'stenosisPct',
                        typeof v === 'number' ? v : v === '' ? undefined : Number(v),
                      )}
                      min={0}
                      max={100}
                      step={5}
                      size="sm"
                      data-testid={`arterial-${r.fullId}-stenosisPct`}
                    />
                  </div>
                  <div className={classes.detailField}>
                    <span className={classes.detailLabel}>
                      {t('arterialLE.param.velocityRatio', 'Velocity ratio')}
                    </span>
                    <EMRNumberInput
                      aria-label={`${segLabel} ${sideChip} velocity ratio`}
                      value={f?.velocityRatio ?? ''}
                      onChange={(v) => setField(
                        r.fullId,
                        'velocityRatio',
                        typeof v === 'number' ? v : v === '' ? undefined : Number(v),
                      )}
                      min={0}
                      max={10}
                      step={0.1}
                      size="sm"
                      data-testid={`arterial-${r.fullId}-velocityRatio`}
                    />
                  </div>
                  <div className={classes.detailField}>
                    <span className={classes.detailLabel}>
                      {t('arterialLE.param.plaqueLengthMm', 'Plaque length (mm)')}
                    </span>
                    <EMRNumberInput
                      aria-label={`${segLabel} ${sideChip} plaque length`}
                      value={f?.plaqueLengthMm ?? ''}
                      onChange={(v) => setField(
                        r.fullId,
                        'plaqueLengthMm',
                        typeof v === 'number' ? v : v === '' ? undefined : Number(v),
                      )}
                      min={0}
                      max={200}
                      step={1}
                      size="sm"
                      data-testid={`arterial-${r.fullId}-plaqueLengthMm`}
                    />
                  </div>
                  <div className={classes.detailField}>
                    <span className={classes.detailLabel}>
                      {t('arterialLE.param.visualizationQuality', 'Image quality')}
                    </span>
                    <EMRSelect
                      aria-label={`${segLabel} ${sideChip} image quality`}
                      value={f?.visualizationQuality ?? ''}
                      onChange={(v) =>
                        setField(
                          r.fullId,
                          'visualizationQuality',
                          v === '' ? undefined : (v as VisualizationQuality),
                        )
                      }
                      data={qualityOptions}
                      size="sm"
                      data-testid={`arterial-${r.fullId}-quality`}
                    />
                  </div>
                  <div className={`${classes.detailField} ${classes.detailNote}`}>
                    <span className={classes.detailLabel}>
                      {t('arterialLE.param.note', 'Note')}
                    </span>
                    <EMRTextarea
                      aria-label={`${segLabel} ${sideChip} note`}
                      value={f?.note ?? ''}
                      onChange={(v) => setField(r.fullId, 'note', v === '' ? undefined : v)}
                      autosize
                      minRows={1}
                      size="sm"
                      data-testid={`arterial-${r.fullId}-note`}
                    />
                  </div>
                </div>
              )}
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

function defaultQualityLabel(v: VisualizationQuality): string {
  switch (v) {
    case 'adequate':       return 'Adequate';
    case 'limited':        return 'Limited';
    case 'non-visualized': return 'Not visualized';
  }
}

export default ArterialSegmentTable;
