// SPDX-License-Identifier: Apache-2.0
/**
 * IliacCavalTable — iliac & caval findings editor, shaped like a standard
 * pelvic venous duplex report (clinician feedback 2026-11): three sections
 * (IVC + LRV · RIGHT · LEFT), one row per vein level, the SAME columns on every
 * row: patency/thrombosis · filling · phasicity · competency · AP diameter ·
 * peak velocity (all optional).
 *
 * Layout: a fixed-column CSS grid (see the .module.css) with one header row per
 * section + horizontal scroll on desktop, collapsing to stacked cards under 992px.
 * Below 992px an empty row is ONE line (label + side + neutral status chip) that
 * opens on tap; a populated or opened row shows every field (UX-ANGIO-026 L4).
 *
 * "All normal" (UX-ANGIO-011) is a prop callback — the form owns the reducer and
 * the overwrite confirm.
 *
 * Contradiction lock (audit M3): an `occluded` row carries no measurable flow,
 * so filling/phasicity/competency/velocity are disabled + cleared.
 */

import { memo, useCallback, useState } from 'react';
import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { EMRSelect, EMRNumberInput } from '../../shared/EMRFormFields';
import { EMRBadge, EMRButton } from '../../common';
import { useTranslation } from '../../../contexts/TranslationContext';
import {
  type IliacCavalFindings,
  type IliacCavalFinding,
  type IliacCavalFullId,
  type Patency,
  type Filling,
  type Phasicity,
  type CavalCompetency,
  MIDLINE_ROWS,
  SIDE_ROW_BASES,
  PATENCY_VALUES,
  FILLING_VALUES,
  PHASICITY_VALUES,
  COMPETENCY_VALUES,
  rowBaseOf,
} from './config';
import { numInputToNumber as toNum } from '../../../utils/numberInput';
import classes from './IliacCavalTable.module.css';

export interface IliacCavalTableProps {
  readonly findings: IliacCavalFindings;
  readonly onChange: (id: IliacCavalFullId, patch: Partial<IliacCavalFinding>) => void;
  /** One-click normal fill for all 20 rows (UX-ANGIO-011). Button hidden when absent. */
  readonly onSetAllNormal?: () => void;
}

/** Same breakpoint as the card layout in IliacCavalTable.module.css. */
const COMPACT_QUERY = '(max-width: 992px)';

/** Header columns, in grid order. Each maps to an `iliacPelvicVenous.field.*` key. */
const COLUMNS = [
  'segment',
  'patency',
  'filling',
  'phasicity',
  'competency',
  'apDiameterMm',
  'peakVelocityCmS',
] as const;

const SECTIONS: ReadonlyArray<{ key: 'ivc' | 'right' | 'left'; rows: ReadonlyArray<IliacCavalFullId> }> = [
  { key: 'ivc', rows: MIDLINE_ROWS },
  { key: 'right', rows: SIDE_ROW_BASES.map((b) => `${b}-right` as const) },
  { key: 'left', rows: SIDE_ROW_BASES.map((b) => `${b}-left` as const) },
];

export const IliacCavalTable = memo(function IliacCavalTable({
  findings,
  onChange,
  onSetAllNormal,
}: IliacCavalTableProps): React.ReactElement {
  const { t } = useTranslation();
  const compact = useMediaQuery(COMPACT_QUERY, false, { getInitialValueInEffect: false });
  // Per-row open/closed choice made by a tap. Unset → open only if populated.
  const [openOverride, setOpenOverride] = useState<
    Partial<Record<IliacCavalFullId, boolean>>
  >({});

  const opts = useCallback(
    (values: ReadonlyArray<string>, ns: string) =>
      values.map((v) => ({ value: v, label: t(`iliacPelvicVenous.${ns}.${v}`, v) })),
    [t],
  );

  const fieldLabel = useCallback(
    (id: string) => t(`iliacPelvicVenous.field.${id}`, id),
    [t],
  );

  return (
    <div data-testid="iliac-caval-table">
      {onSetAllNormal && (
        <Group justify="flex-end" className={classes.toolbar}>
          <EMRButton
            variant="secondary"
            size="sm"
            leftSection={<IconCheck size={14} />}
            onClick={onSetAllNormal}
            data-testid="iliac-bulk-set-all-normal"
          >
            {t('iliacPelvicVenous.actions.allNormal', t('venousLE.bulk.allNormal', 'All normal'))}
          </EMRButton>
        </Group>
      )}
      {SECTIONS.map((section) => (
        <div key={section.key} className={classes.section}>
          {/* h3 under the deck's h2. Mantine Text keeps its own size — the global
              heading font-size rule skips .mantine-Text-root (W1-G). Sticky below
              992px so the side never scrolls out of view (UX-ANGIO-026 L4). */}
          <Text component="h3" className={classes.sectionTitle}>
            {t(`iliacPelvicVenous.section.${section.key}`, section.key.toUpperCase())}
          </Text>
          <div className={classes.tableWrap} role="table">
            <div className={classes.headRow} role="row">
              {COLUMNS.map((col) => (
                <div key={col} className={`${classes.cell} ${classes.headCell}`} role="columnheader">
                  {fieldLabel(col)}
                </div>
              ))}
            </div>

            {section.rows.map((id) => {
              const f: IliacCavalFinding = findings[id] ?? {};
              const rowBase = rowBaseOf(id);
              const segLabel = t(`iliacPelvicVenous.row.${rowBase}`, rowBase);
              const sideLabel =
                section.key === 'ivc' ? null : t(`iliacPelvicVenous.side.${section.key}`, section.key);
              const fullLabel = sideLabel === null ? segLabel : `${segLabel} (${sideLabel})`;
              const occluded = f.patency === 'occluded';
              const populated = Object.values(f).some((v) => v !== undefined);
              const open = openOverride[id] ?? populated;
              const showFields = !compact || open;
              const labelContent = (
                <>
                  {segLabel}
                  {/* Below desktop each row is its own card, far from the RIGHT/LEFT
                      section chip — so the card title carries the side too
                      (UX-ANGIO-004 L3). Desktop keeps the narrow label column. */}
                  {sideLabel !== null && (
                    <Box component="span" hiddenFrom="md" data-side={section.key}>
                      {`\u00A0·\u00A0${sideLabel}`}
                    </Box>
                  )}
                </>
              );

              return (
                <div
                  key={id}
                  className={`${classes.row} ${showFields ? '' : classes.rowCollapsed}`}
                  role="row"
                  data-testid={`iliac-caval-row-${id}`}
                >
                  {compact ? (
                    <UnstyledButton
                      className={`${classes.cell} ${classes.segmentCell} ${classes.rowToggle}`}
                      aria-expanded={open}
                      onClick={() => setOpenOverride((prev) => ({ ...prev, [id]: !open }))}
                      data-testid={`iliac-caval-toggle-${id}`}
                    >
                      <span className={classes.rowTitle}>{labelContent}</span>
                      {/* Only recorded rows carry a chip, so they stand out and the
                          side suffix never gets squeezed on a phone (critic, 375). */}
                      {populated && (
                        <EMRBadge variant="neutral" size="sm" className={classes.rowStatus}>
                          {t('iliacPelvicVenous.rowStatus.recorded', 'Recorded')}
                        </EMRBadge>
                      )}
                      <IconChevronDown
                        size={18}
                        aria-hidden
                        className={classes.chevron}
                        data-open={open || undefined}
                      />
                    </UnstyledButton>
                  ) : (
                    <div className={`${classes.cell} ${classes.segmentCell}`}>{labelContent}</div>
                  )}

                  {showFields && (
                    <>
                      <div className={classes.cell} data-label={fieldLabel('patency')}>
                        <EMRSelect
                          aria-label={`${fullLabel} ${fieldLabel('patency')}`}
                          data={opts(PATENCY_VALUES, 'patency')}
                          value={f.patency ?? null}
                          onChange={(v) => {
                            const patency = (v as Patency | null) ?? undefined;
                            // No measurable flow through an occluded segment — clear the
                            // flow columns so they can't contradict it.
                            onChange(
                              id,
                              patency === 'occluded'
                                ? {
                                    patency,
                                    filling: undefined,
                                    phasicity: undefined,
                                    competency: undefined,
                                    peakVelocityCmS: undefined,
                                  }
                                : { patency },
                            );
                          }}
                          size="sm"
                          data-testid={`iliac-${id}-patency`}
                        />
                      </div>

                      <div className={classes.cell} data-label={fieldLabel('filling')}>
                        <EMRSelect
                          aria-label={`${fullLabel} ${fieldLabel('filling')}`}
                          data={opts(FILLING_VALUES, 'filling')}
                          value={f.filling ?? null}
                          onChange={(v) => onChange(id, { filling: (v as Filling | null) ?? undefined })}
                          disabled={occluded}
                          size="sm"
                          data-testid={`iliac-${id}-filling`}
                        />
                      </div>

                      <div className={classes.cell} data-label={fieldLabel('phasicity')}>
                        <EMRSelect
                          aria-label={`${fullLabel} ${fieldLabel('phasicity')}`}
                          data={opts(PHASICITY_VALUES, 'phasicity')}
                          value={f.phasicity ?? null}
                          onChange={(v) => onChange(id, { phasicity: (v as Phasicity | null) ?? undefined })}
                          disabled={occluded}
                          size="sm"
                          data-testid={`iliac-${id}-phasicity`}
                        />
                      </div>

                      <div className={classes.cell} data-label={fieldLabel('competency')}>
                        <EMRSelect
                          aria-label={`${fullLabel} ${fieldLabel('competency')}`}
                          data={opts(COMPETENCY_VALUES, 'competency')}
                          value={f.competency ?? null}
                          onChange={(v) =>
                            onChange(id, { competency: (v as CavalCompetency | null) ?? undefined })
                          }
                          disabled={occluded}
                          size="sm"
                          data-testid={`iliac-${id}-competency`}
                        />
                      </div>

                      {/* AP diameter — optional on every row (Studycast layout). */}
                      <div className={classes.cell} data-label={fieldLabel('apDiameterMm')}>
                        <EMRNumberInput
                          aria-label={`${fullLabel} ${fieldLabel('apDiameterMm')}`}
                          value={f.apDiameterMm ?? ''}
                          onChange={(v) => onChange(id, { apDiameterMm: toNum(v) })}
                          min={0}
                          max={40}
                          step={0.1}
                          decimalScale={1}
                          size="sm"
                          data-testid={`iliac-${id}-ap-diameter`}
                        />
                      </div>

                      <div className={classes.cell} data-label={fieldLabel('peakVelocityCmS')}>
                        <EMRNumberInput
                          aria-label={`${fullLabel} ${fieldLabel('peakVelocityCmS')}`}
                          value={f.peakVelocityCmS ?? ''}
                          onChange={(v) => onChange(id, { peakVelocityCmS: toNum(v) })}
                          min={0}
                          max={400}
                          step={1}
                          size="sm"
                          disabled={occluded}
                          data-testid={`iliac-${id}-pv`}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

export default IliacCavalTable;
