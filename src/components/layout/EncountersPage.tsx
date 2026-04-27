// SPDX-License-Identifier: Apache-2.0
/**
 * EncountersPage — full-page management view for in-progress encounters.
 *
 * Phase 5 Item 2 of the encounter pivot. The Phase 2b StudyPicker shows
 * the encounter list as a banner above the study cards; that banner is
 * great for "I just landed and I have one open thing", but it doesn't
 * scale when a clinic has 5+ stale encounters from the day. This page
 * is the dedicated CRUD surface, reachable from:
 *   - the "All encounters" link on `<EncounterContextBanner>` (mid-flow)
 *   - the "All encounters" link in `<StudyPicker>`'s list section
 *   - direct URL `/encounters`
 *
 * Behavior mirrors `<StudyPicker>`'s encounter list:
 *   - List newest-first via `listEncounters()` (store guarantees ordering)
 *   - Per-row Resume + Discard with confirm dialog
 *   - "+ New encounter" CTA → navigates to `/`
 *   - "Clear all encounters" with confirm dialog
 *   - Empty state renders the same CTA at the center
 *
 * Why a separate page instead of just enlarging the StudyPicker banner:
 *   The intake form is the main job at `/`. A clinician who's mid-shift
 *   doesn't want to scroll past 8 stale encounters every time they
 *   create a new one. `/encounters` keeps management out of the way.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconClockHour4,
  IconPlayerPlay,
  IconPlus,
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
import classes from './EncountersPage.module.css';

/** Whole-year age from an ISO `YYYY-MM-DD` birth date (copy of StudyPicker helper). */
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

/** Map a StudyType to a localized short label via the study-plugin translations. */
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

export const EncountersPage = memo(function EncountersPage(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [encounters, setEncounters] = useState<EncounterDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
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

  const handleNewEncounter = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleResume = useCallback(
    (enc: EncounterDraft) => {
      const firstStudy = enc.selectedStudyTypes[0];
      if (!firstStudy) {
        navigate(`/encounter/${enc.encounterId}`);
        return;
      }
      navigate(`/encounter/${enc.encounterId}/${firstStudy}`);
    },
    [navigate],
  );

  const handleConfirmDiscard = useCallback(async () => {
    if (!pendingDiscardId) return;
    setDiscarding(true);
    try {
      await clearEncounter(pendingDiscardId);
      await refresh();
    } finally {
      setDiscarding(false);
      setPendingDiscardId(null);
    }
  }, [pendingDiscardId, refresh]);

  const handleConfirmClearAll = useCallback(async () => {
    setClearing(true);
    try {
      await Promise.all([clearAllEncounters(), clearAllDrafts()]);
      setEncounters([]);
      notifications.show({
        message: t('encounter.list.clearedToast'),
        color: 'gray',
      });
    } finally {
      setClearing(false);
      setConfirmClearOpen(false);
    }
  }, [t]);

  // Render guard: until `hydrated` flips true the empty state would
  // briefly flash for users with saved encounters. We render an empty
  // shell during hydration; tests assert post-hydration behavior.
  return (
    <div className={classes.backdrop}>
      <div className={classes.container}>
        <header className={classes.pageHeader}>
          <button
            type="button"
            className={classes.backLink}
            onClick={() => navigate('/')}
            data-testid="encounters-page-back"
          >
            <IconArrowLeft size={14} stroke={1.75} aria-hidden />
            {t('encounter.listPage.backLink')}
          </button>
          <div className={classes.titleRow}>
            <h1 className={classes.title}>{t('encounter.listPage.title')}</h1>
            {hydrated && encounters.length > 0 && (
              <span
                className={classes.count}
                data-testid="encounters-page-count"
              >
                {t('encounter.listPage.openCount').replace(
                  '{count}',
                  String(encounters.length),
                )}
              </span>
            )}
          </div>
          <p className={classes.subtitle}>{t('encounter.listPage.subtitle')}</p>
        </header>

        {hydrated && encounters.length === 0 && (
          <div className={classes.empty} data-testid="encounters-page-empty">
            <span className={classes.emptyIcon} aria-hidden>
              <IconClockHour4 size={26} stroke={1.5} />
            </span>
            <h2 className={classes.emptyTitle}>
              {t('encounter.listPage.emptyTitle')}
            </h2>
            <p className={classes.emptyBody}>
              {t('encounter.listPage.emptyBody')}
            </p>
            <EMRButton
              variant="primary"
              size="sm"
              leftSection={<IconPlus size={16} stroke={1.75} />}
              onClick={handleNewEncounter}
              data-testid="encounters-page-empty-cta"
            >
              {t('encounter.listPage.emptyCta')}
            </EMRButton>
          </div>
        )}

        {hydrated && encounters.length > 0 && (
          <section className={classes.card} data-testid="encounters-page-list">
            <ul className={classes.list}>
              {encounters.map((enc) => {
                const age = ageFromBirthDate(enc.header.patientBirthDate);
                const ageSuffix = age !== null ? ` · ${age}` : '';
                return (
                  <li
                    key={enc.encounterId}
                    className={classes.row}
                    data-testid={`encounters-page-row-${enc.encounterId}`}
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
                              variant={
                                started ? 'status-active' : 'status-draft'
                              }
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
                        data-testid={`encounters-page-resume-${enc.encounterId}`}
                      >
                        {t('encounter.list.resume')}
                      </EMRButton>
                      <EMRButton
                        variant="outline"
                        size="sm"
                        leftSection={<IconTrash size={16} stroke={1.75} />}
                        onClick={() => setPendingDiscardId(enc.encounterId)}
                        data-testid={`encounters-page-discard-${enc.encounterId}`}
                      >
                        {t('encounter.list.discard')}
                      </EMRButton>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={classes.footer}>
              <EMRButton
                variant="primary"
                size="sm"
                leftSection={<IconPlus size={16} stroke={1.75} />}
                onClick={handleNewEncounter}
                data-testid="encounters-page-new"
              >
                {t('encounter.list.newEncounter')}
              </EMRButton>
              <EMRButton
                variant="danger"
                size="sm"
                leftSection={<IconTrash size={16} stroke={1.75} />}
                onClick={() => setConfirmClearOpen(true)}
                data-testid="encounters-page-clear-all"
              >
                {t('encounter.list.clearAll')}
              </EMRButton>
            </div>
          </section>
        )}
      </div>

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
    </div>
  );
});

export default EncountersPage;
