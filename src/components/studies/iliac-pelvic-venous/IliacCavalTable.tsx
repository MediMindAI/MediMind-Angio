// SPDX-License-Identifier: Apache-2.0
/**
 * IliacCavalTable — zone-2 (iliac & caval) findings editor. The only zone that
 * warrants a tabular layout: IVC (midline) + common/external/internal iliac +
 * common femoral veins, per side. A view toggle (right/bilateral/left) keeps the
 * grid narrow. Phasicity + Valsalva response only render on the CFV rows.
 *
 * Layout mirrors CarotidSegmentTable: a fixed-column CSS grid (see the .module.css)
 * with a single header row + horizontal scroll on desktop, collapsing to stacked
 * cards under 992px. Inputs are the shared EMR* wrappers for styling/a11y parity.
 *
 * Contradiction locks (audit M3): an `occluded` segment carries no measurable
 * flow, so velocity/stenosis/phasicity/Valsalva are disabled + cleared; a `full`-
 * compressibility vein has no thrombus, so thrombus chronicity is disabled + cleared.
 */

import { memo, useCallback } from 'react';
import { EMRSelect, EMRNumberInput, EMRCheckbox } from '../../shared/EMRFormFields';
import { EMRViewToggle } from '../../common';
import { useTranslation } from '../../../contexts/TranslationContext';
import {
  type IliacCavalFindings,
  type IliacCavalFinding,
  type IliacCavalFullId,
  type IliacCavalBase,
  type CavalLevel,
  type VesselLevelMeasurement,
  type Side,
  type Patency,
  type CavalCompressibility,
  type ThrombusChronicity,
  type CfvPhasicity,
  type ValsalvaResponse,
  PATENCY_VALUES,
  CAVAL_COMPRESSIBILITY_VALUES,
  THROMBUS_CHRONICITY_VALUES,
  CFV_PHASICITY_VALUES,
  VALSALVA_RESPONSE_VALUES,
  CAVAL_LEVELS_FOR_BASE,
  ILIAC_THRESHOLDS,
  effectiveCavalVelocityRatio,
  cavalStenosisSeverity,
} from './config';
import { numInputToNumber as toNum } from '../../../utils/numberInput';
import classes from './IliacCavalTable.module.css';

export type CavalView = 'right' | 'bilateral' | 'left';

export interface IliacCavalTableProps {
  readonly findings: IliacCavalFindings;
  readonly view: CavalView;
  readonly onViewChange: (view: CavalView) => void;
  readonly onChange: (id: IliacCavalFullId, patch: Partial<IliacCavalFinding>) => void;
  readonly onLevelChange: (
    id: IliacCavalFullId,
    level: CavalLevel,
    patch: Partial<VesselLevelMeasurement>,
  ) => void;
}

const PER_SIDE_BASES = ['civ', 'eiv', 'iiv', 'cfv'] as const;

/** The vein base for a full id (`cfv-left` → `cfv`, `ivc` → `ivc`). */
function baseOf(id: IliacCavalFullId): IliacCavalBase {
  return (id === 'ivc' ? 'ivc' : id.slice(0, id.lastIndexOf('-'))) as IliacCavalBase;
}

/** Levels that capture a B-mode diameter per protocol: CFV SFJ-level + IVC. */
function levelCapturesDiameter(base: IliacCavalBase, level: CavalLevel): boolean {
  if (base === 'cfv') return level === 'sfj';
  return base === 'ivc';
}

/** Header columns, in grid order. Each maps to an `iliacPelvicVenous.field.*` key. */
const COLUMNS = [
  'segment',
  'patency',
  'compressibility',
  'thrombus',
  'velocityRatio',
  'stenosisPct',
  'phasicity',
  'valsalvaResponse',
  'collaterals',
  'reflux',
  'confirmImaging',
] as const;

function segmentsForView(view: CavalView): IliacCavalFullId[] {
  const sides: Side[] = view === 'bilateral' ? ['left', 'right'] : [view];
  const out: IliacCavalFullId[] = ['ivc'];
  for (const base of PER_SIDE_BASES) {
    for (const side of sides) out.push(`${base}-${side}` as IliacCavalFullId);
  }
  return out;
}

export const IliacCavalTable = memo(function IliacCavalTable({
  findings,
  view,
  onViewChange,
  onChange,
  onLevelChange,
}: IliacCavalTableProps): React.ReactElement {
  const { t } = useTranslation();

  const opts = useCallback(
    (values: ReadonlyArray<string>, ns: string) =>
      values.map((v) => ({ value: v, label: t(`iliacPelvicVenous.${ns}.${v}`, v) })),
    [t],
  );

  const fieldLabel = useCallback(
    (id: string) => t(`iliacPelvicVenous.field.${id}`, id),
    [t],
  );

  const segments = segmentsForView(view);

  return (
    <div data-testid="iliac-caval-table">
      <div className={classes.toolbar}>
        <EMRViewToggle
          value={view}
          onChange={(v) => onViewChange(v as CavalView)}
          alwaysShowLabels
          options={[
            { value: 'right', label: t('iliacPelvicVenous.tabs.right', 'Right') },
            { value: 'bilateral', label: t('iliacPelvicVenous.tabs.bilateral', 'Bilateral') },
            { value: 'left', label: t('iliacPelvicVenous.tabs.left', 'Left') },
          ]}
        />
      </div>

      <div className={classes.tableWrap} role="table">
        <div className={classes.headRow} role="row">
          {COLUMNS.map((col) => (
            <div key={col} className={`${classes.cell} ${classes.headCell}`} role="columnheader">
              {fieldLabel(col)}
            </div>
          ))}
        </div>

        {segments.map((id) => {
          const f: IliacCavalFinding = findings[id] ?? {};
          const base = baseOf(id);
          const isCfv = base === 'cfv';
          const isEiv = base === 'eiv';
          const segLabel = t(`iliacPelvicVenous.segment.${id}`, id);
          const stenosisHigh = (f.stenosisPct ?? 0) >= ILIAC_THRESHOLDS.cavalStenosisPct;
          // Ratio is derived from the per-level velocities (falls back to any
          // stored/legacy value); graded by cavalStenosisSeverity for the chip.
          const effRatio = effectiveCavalVelocityRatio(f);
          const ratioHigh = (effRatio ?? 0) >= ILIAC_THRESHOLDS.cavalVelocityRatio;
          const severity = cavalStenosisSeverity(effRatio);
          // Contradiction locks (audit M3).
          const occluded = f.patency === 'occluded';
          const fullyCompressible = f.compressibility === 'full';

          return (
            <div key={id} className={classes.row} role="row" data-testid={`iliac-caval-row-${id}`}>
              <div className={`${classes.cell} ${classes.segmentCell}`}>{segLabel}</div>

              <div className={classes.cell} data-label={fieldLabel('patency')}>
                <EMRSelect
                  aria-label={`${segLabel} ${fieldLabel('patency')}`}
                  data={opts(PATENCY_VALUES, 'patency')}
                  value={f.patency ?? null}
                  onChange={(v) => {
                    const patency = (v as Patency | null) ?? undefined;
                    // No measurable flow through an occluded segment — clear the
                    // velocity/stenosis/phasicity/Valsalva so they can't contradict it.
                    onChange(
                      id,
                      patency === 'occluded'
                        ? {
                            patency,
                            velocityRatio: undefined,
                            stenosisPct: undefined,
                            phasicity: undefined,
                            valsalvaResponse: undefined,
                            levels: {},
                          }
                        : { patency },
                    );
                  }}
                  size="sm"
                  clearable={false}
                  data-testid={`iliac-${id}-patency`}
                />
              </div>

              <div className={classes.cell} data-label={fieldLabel('compressibility')}>
                <EMRSelect
                  aria-label={`${segLabel} ${fieldLabel('compressibility')}`}
                  data={opts(CAVAL_COMPRESSIBILITY_VALUES, 'cavalCompressibility')}
                  value={f.compressibility ?? null}
                  onChange={(v) => {
                    const compressibility = (v as CavalCompressibility | null) ?? undefined;
                    // A fully compressible vein has no thrombus — clear it.
                    onChange(
                      id,
                      compressibility === 'full'
                        ? { compressibility, thrombusChronicity: undefined }
                        : { compressibility },
                    );
                  }}
                  size="sm"
                  clearable={false}
                  data-testid={`iliac-${id}-compressibility`}
                />
              </div>

              <div className={classes.cell} data-label={fieldLabel('thrombus')}>
                <EMRSelect
                  aria-label={`${segLabel} ${fieldLabel('thrombus')}`}
                  data={opts(THROMBUS_CHRONICITY_VALUES, 'thrombusChronicity')}
                  value={f.thrombusChronicity ?? null}
                  onChange={(v) =>
                    onChange(id, { thrombusChronicity: (v as ThrombusChronicity | null) ?? undefined })
                  }
                  disabled={fullyCompressible}
                  size="sm"
                  clearable={false}
                  data-testid={`iliac-${id}-thrombus`}
                />
              </div>

              <div className={classes.cell} data-label={fieldLabel('velocityRatio')}>
                <div className={classes.levelCluster}>
                  {CAVAL_LEVELS_FOR_BASE[base].map((lvl) => {
                    const lvlLabel = t(`iliacPelvicVenous.level.${lvl}`, lvl);
                    const hasDiameter = levelCapturesDiameter(base, lvl);
                    return (
                      <div key={lvl} className={classes.levelRow}>
                        <span className={classes.levelTag} title={lvlLabel}>
                          {lvlLabel}
                        </span>
                        <div className={classes.levelInputs}>
                          <EMRNumberInput
                            aria-label={`${segLabel} ${lvlLabel} ${fieldLabel('velocityCmS')}`}
                            label={fieldLabel('velocityCmS')}
                            value={f.levels?.[lvl]?.velocityCmS ?? ''}
                            onChange={(v) => onLevelChange(id, lvl, { velocityCmS: toNum(v) })}
                            min={0}
                            max={400}
                            step={1}
                            size="sm"
                            disabled={occluded}
                            data-testid={`iliac-${id}-vel-${lvl}`}
                          />
                          {hasDiameter ? (
                            <EMRNumberInput
                              aria-label={`${segLabel} ${lvlLabel} ${fieldLabel('diameterMm')}`}
                              label={fieldLabel('diameterMm')}
                              value={f.levels?.[lvl]?.diameterMm ?? ''}
                              onChange={(v) => onLevelChange(id, lvl, { diameterMm: toNum(v) })}
                              min={0}
                              max={40}
                              step={0.1}
                              decimalScale={1}
                              size="sm"
                              disabled={occluded}
                              data-testid={`iliac-${id}-dia-${lvl}`}
                            />
                          ) : (
                            <span className={classes.diameterSpacer} aria-hidden />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    className={`${classes.derivedRatio} ${ratioHigh ? classes.derivedRatioHigh : ''}`}
                    data-testid={`iliac-${id}-velocity-ratio`}
                  >
                    <span className={classes.derivedRatioLabel}>{fieldLabel('velocityRatio')}</span>
                    <span className={classes.derivedRatioValue}>
                      {effRatio !== undefined ? effRatio.toFixed(1) : '—'}
                      {severity !== 'none'
                        ? ` · ${t(`iliacPelvicVenous.severity.${severity}`, severity)}`
                        : ''}
                    </span>
                  </div>
                  {isEiv ? (
                    <div className={classes.bladderFlags}>
                      <EMRCheckbox
                        label={fieldLabel('bladderArtifact')}
                        checked={f.bladderArtifactSuspected ?? false}
                        onChange={(c) => onChange(id, { bladderArtifactSuspected: c })}
                        size="sm"
                        data-testid={`iliac-${id}-bladder-artifact`}
                      />
                      {f.bladderArtifactSuspected ? (
                        <EMRCheckbox
                          label={fieldLabel('remeasuredAfterVoiding')}
                          checked={f.remeasuredAfterVoiding ?? false}
                          onChange={(c) => onChange(id, { remeasuredAfterVoiding: c })}
                          size="sm"
                          data-testid={`iliac-${id}-remeasured`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={classes.cell} data-label={fieldLabel('stenosisPct')}>
                <EMRNumberInput
                  aria-label={`${segLabel} ${fieldLabel('stenosisPct')}`}
                  value={f.stenosisPct ?? ''}
                  onChange={(v) => onChange(id, { stenosisPct: toNum(v) })}
                  min={0}
                  max={100}
                  step={1}
                  size="sm"
                  disabled={occluded}
                  error={stenosisHigh ? t('iliacPelvicVenous.warn.stenosisPct', '≥ 50%') : undefined}
                  data-testid={`iliac-${id}-stenosis`}
                />
              </div>

              {/* Phasicity + Valsalva are graded on the CFV rows only; other rows
                  render an aligned placeholder so the grid columns stay in register. */}
              <div className={classes.cell} data-label={fieldLabel('phasicity')}>
                {isCfv ? (
                  <EMRSelect
                    aria-label={`${segLabel} ${fieldLabel('phasicity')}`}
                    data={opts(CFV_PHASICITY_VALUES, 'cfvPhasicity')}
                    value={f.phasicity ?? null}
                    onChange={(v) => onChange(id, { phasicity: (v as CfvPhasicity | null) ?? undefined })}
                    disabled={occluded}
                    size="sm"
                    clearable={false}
                    data-testid={`iliac-${id}-phasicity`}
                  />
                ) : (
                  <span className={classes.muted}>—</span>
                )}
              </div>

              <div className={classes.cell} data-label={fieldLabel('valsalvaResponse')}>
                {isCfv ? (
                  <EMRSelect
                    aria-label={`${segLabel} ${fieldLabel('valsalvaResponse')}`}
                    data={opts(VALSALVA_RESPONSE_VALUES, 'valsalvaResponse')}
                    value={f.valsalvaResponse ?? null}
                    onChange={(v) =>
                      onChange(id, { valsalvaResponse: (v as ValsalvaResponse | null) ?? undefined })
                    }
                    disabled={occluded}
                    size="sm"
                    clearable={false}
                    data-testid={`iliac-${id}-valsalva`}
                  />
                ) : (
                  <span className={classes.muted}>—</span>
                )}
              </div>

              <div className={`${classes.cell} ${classes.checkCell}`} data-label={fieldLabel('collaterals')}>
                <EMRCheckbox
                  aria-label={`${segLabel} ${fieldLabel('collaterals')}`}
                  checked={f.collateralsPresent ?? false}
                  onChange={(c) => onChange(id, { collateralsPresent: c })}
                  size="sm"
                  data-testid={`iliac-${id}-collaterals`}
                />
              </div>

              <div className={`${classes.cell} ${classes.checkCell}`} data-label={fieldLabel('reflux')}>
                <EMRCheckbox
                  aria-label={`${segLabel} ${fieldLabel('reflux')}`}
                  checked={f.reflux ?? false}
                  onChange={(c) => onChange(id, { reflux: c })}
                  size="sm"
                  data-testid={`iliac-${id}-reflux`}
                />
              </div>

              <div className={`${classes.cell} ${classes.checkCell}`} data-label={fieldLabel('confirmImaging')}>
                <EMRCheckbox
                  aria-label={`${segLabel} ${fieldLabel('confirmImaging')}`}
                  checked={f.confirmatoryImagingRecommended ?? false}
                  onChange={(c) => onChange(id, { confirmatoryImagingRecommended: c })}
                  size="sm"
                  data-testid={`iliac-${id}-confirm-imaging`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default IliacCavalTable;
