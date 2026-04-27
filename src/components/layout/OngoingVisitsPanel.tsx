// SPDX-License-Identifier: Apache-2.0
/**
 * OngoingVisitsPanel — compact "in-progress encounters" panel rendered
 * above the intake form on the landing page.
 *
 * Replaces the standalone `/encounters` page (which is now redirected to
 * `/`). The clinic-realistic flow is: land on `/`, see any open visits at
 * the top, decide between resuming one or starting a new patient. Splitting
 * the two views across separate routes added an extra navigation step for
 * no clinical benefit.
 *
 * Behaviour mirrors `<EncountersPage>`:
 *   - List newest-first via `listEncounters()` (store guarantees ordering).
 *   - Per-row Resume + Discard with confirm dialog.
 *   - "Clear all visits" with confirm dialog in the panel footer.
 *   - Hides itself entirely when there are zero stored encounters — a
 *     fresh-install user shouldn't see a placeholder card; they get the
 *     intake form straight away.
 *
 * Resume strategy:
 *   - If the encounter has at least one selected study → navigate to that
 *     study under the encounter route.
 *   - If somehow it doesn't (legacy migrated drafts where the intake never
 *     committed a study) → navigate to `/?edit={id}` so the user can pick
 *     studies in the intake form.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconClockHour4,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import { EMRBadge } from '../common/EMRBadge';
import { EMRButton } from '../common/EMRButton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useTranslation } from '../../contexts/TranslationContext';
import { STUDY_PLUGINS } from '../studies';
import { clearAllDrafts } from '../../services/draftStore';
import {
  clearAllEncounters,
  clearEncounter,
  listEncounters,
} from '../../services/encounterStore';
import type { EncounterDraft } from '../../types/encounter';
import type { StudyType } from '../../types/study';
import classes from './OngoingVisitsPanel.module.css';

function ageFromBirthDate(birthIso: string | undefined): number | null {
  if (!birthIso) return null;
  const dob = new Date(birthIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function studyTypeShortLabel(
  studyType: StudyType,
  t: (key: string, paramsOrDefault?: Record<string, unknown> | string) => string,
): string {
  const pluginKey =
    studyType === 'venousLEBilateral' ||
    studyType === 'venousLERight' ||
    studyType === 'venousLELeft'
      ? 'venousLE'
      : studyType;
  const plugin = STUDY_PLUGINS.find((p) => p.key === pluginKey);
  if (!plugin) return studyType;
  return t(`${plugin.translationKey}.short`, studyType);
}

export interface OngoingVisitsPanelProps {
  /**
   * Optional notifier so the parent (EncounterIntake) can refresh its
   * resumable-flag side-effects when this panel discards/clears entries.
   * Kept optional because the panel is otherwise self-contained.
   */
  readonly onChange?: () => void;
}

export const OngoingVisitsPanel = memo(function OngoingVisitsPanel({
  onChange,
}: OngoingVisitsPanelProps): React.ReactElement | null {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [encounters, setEncounters] = useState<EncounterDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Collapsed-by-default: clinicians don't want a 5-row list pushing the
  // intake form below the fold every time they open the page. The count
  // badge in the header conveys "you have N open visits"; expanding is
  // a deliberate "I want to manage them" action.
  const [expanded, setExpanded] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listEncounters();
      setEncounters(list);
    } catch {
      setEncounters([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleResume = useCallback(
    (enc: EncounterDraft) => {
      const firstStudy = enc.selectedStudyTypes[0];
      if (!firstStudy) {
        navigate(`/?edit=${enc.encounterId}`);
        return;
      }
      navigate(`/encounter/${enc.encounterId}/${firstStudy}`);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (enc: EncounterDraft) => {
      navigate(`/?edit=${enc.encounterId}`);
    },
    [navigate],
  );

  const handleConfirmDiscard = useCallback(async () => {
    if (!pendingDiscardId) return;
    setDiscarding(true);
    try {
      await clearEncounter(pendingDiscardId);
      await refresh();
      onChange?.();
    } finally {
      setDiscarding(false);
      setPendingDiscardId(null);
    }
  }, [pendingDiscardId, refresh, onChange]);

  const handleConfirmClearAll = useCallback(async () => {
    setClearing(true);
    try {
      await Promise.all([clearAllEncounters(), clearAllDrafts()]);
      setEncounters([]);
      onChange?.();
      notifications.show({
        message: t('encounter.list.clearedToast'),
        color: 'gray',
      });
    } finally {
      setClearing(false);
      setConfirmClearOpen(false);
    }
  }, [t, onChange]);

  // Don't render anything (not even an empty state) when there are no
  // saved visits. The intake form below already serves as the empty
  // state for first-time / clean-slate users.
  if (!hydrated || encounters.length === 0) return null;

  return (
    <section
      className={[classes.panel, expanded ? classes.panelExpanded : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={t('encounter.listPage.title')}
      data-testid="ongoing-visits-panel"
      data-expanded={expanded ? 'true' : 'false'}
    >
      <button
        type="button"
        className={classes.panelHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="ongoing-visits-body"
        data-testid="ongoing-visits-toggle"
      >
        <span className={classes.panelHeaderIcon} aria-hidden>
          <IconClockHour4 size={18} stroke={1.75} />
        </span>
        <div className={classes.panelHeaderText}>
          <span className={classes.panelHeaderEyebrow}>
            {t('encounter.listPage.eyebrow', 'In progress')}
          </span>
          <h2 className={classes.panelHeaderTitle}>
            {t('encounter.listPage.title')}
          </h2>
        </div>
        <span
          className={classes.panelHeaderCount}
          data-testid="ongoing-visits-count"
        >
          {t('encounter.listPage.openCount').replace(
            '{count}',
            String(encounters.length),
          )}
        </span>
        <span
          className={[
            classes.panelHeaderChevron,
            expanded ? classes.panelHeaderChevronOpen : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden
        >
          <IconChevronDown size={16} stroke={2} />
        </span>
      </button>

      {!expanded ? null : (
      <div id="ongoing-visits-body" className={classes.panelBody}>
      <ul className={classes.list}>
        {encounters.map((enc) => {
          const age = ageFromBirthDate(enc.header.patientBirthDate);
          const ageSuffix = age !== null ? ` · ${age}` : '';
          return (
            <li
              key={enc.encounterId}
              className={classes.row}
              data-testid={`ongoing-visits-row-${enc.encounterId}`}
            >
              <div className={classes.rowMain}>
                <div className={classes.rowPatient}>
                  <span className={classes.rowPatientName}>
                    {enc.header.patientName || '—'}
                    {ageSuffix}
                  </span>
                  <span className={classes.rowDate}>
                    {t('encounter.banner.dateLabel')}:{' '}
                    {enc.header.encounterDate || '—'}
                  </span>
                </div>
                <div className={classes.rowChips}>
                  {enc.selectedStudyTypes.map((st) => {
                    const started = Boolean(
                      enc.studies && st in enc.studies,
                    );
                    return (
                      <EMRBadge
                        key={`${enc.encounterId}-${st}`}
                        variant={started ? 'status-active' : 'status-draft'}
                        size="sm"
                      >
                        {studyTypeShortLabel(st, t)}
                      </EMRBadge>
                    );
                  })}
                </div>
              </div>
              <div className={classes.rowActions}>
                <EMRButton
                  variant="primary"
                  size="sm"
                  leftSection={<IconPlayerPlay size={16} stroke={1.75} />}
                  onClick={() => handleResume(enc)}
                  data-testid={`ongoing-visits-resume-${enc.encounterId}`}
                >
                  {t('encounter.list.resume')}
                </EMRButton>
                <EMRButton
                  variant="outline"
                  size="sm"
                  leftSection={<IconPencil size={16} stroke={1.75} />}
                  onClick={() => handleEdit(enc)}
                  data-testid={`ongoing-visits-edit-${enc.encounterId}`}
                >
                  {t('encounter.list.edit', 'Edit')}
                </EMRButton>
                <EMRButton
                  variant="outline"
                  size="sm"
                  leftSection={<IconTrash size={16} stroke={1.75} />}
                  onClick={() => setPendingDiscardId(enc.encounterId)}
                  data-testid={`ongoing-visits-discard-${enc.encounterId}`}
                  aria-label={t('encounter.list.discard')}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {encounters.length > 1 && (
        <div className={classes.panelFooter}>
          <button
            type="button"
            className={classes.clearAllButton}
            onClick={() => setConfirmClearOpen(true)}
            data-testid="ongoing-visits-clear-all"
          >
            <IconTrash size={14} stroke={1.75} aria-hidden />
            <span>{t('encounter.list.clearAll')}</span>
          </button>
        </div>
      )}
      </div>
      )}

      <ConfirmDialog
        opened={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title={t('encounter.list.clearAllConfirmTitle')}
        message={t('encounter.list.clearAllConfirmBody')}
        confirmLabel={t('encounter.list.clearAllConfirmAction')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void handleConfirmClearAll()}
        loading={clearing}
        destructive
      />

      <ConfirmDialog
        opened={pendingDiscardId !== null}
        onClose={() => setPendingDiscardId(null)}
        title={t('encounter.list.discardConfirmTitle')}
        message={t('encounter.list.discardConfirmBody')}
        confirmLabel={t('encounter.list.discardConfirmAction')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void handleConfirmDiscard()}
        loading={discarding}
        destructive
      />
    </section>
  );
});

export default OngoingVisitsPanel;
