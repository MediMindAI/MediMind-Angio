// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconStethoscope,
  IconClockHour4,
  IconTrash,
  IconPlayerPlay,
  IconPlus,
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
import classes from './StudyPicker.module.css';

/**
 * StudyPicker — landing grid for the angiology study-type selection.
 *
 * Layout: eyebrow + large title + subtitle, then a responsive 1 / 2 / 3
 * column grid of cards. Phase-1 studies are clickable, Phase-2..5 cards
 * stay visible but disabled so users can see what's coming.
 *
 * Phase 2.b — replaced the Wave 4.1 draft-count banner with an encounter
 * list. When `listEncounters()` returns ≥ 1 entry, we render a "+ New
 * encounter" CTA + a list of resumable encounters with their patient,
 * date, study chips, Resume + Discard actions, and a Clear-all action.
 * The "+ New encounter" link routes to `/` — once Phase 3a flips the
 * root route to render `<EncounterIntake>`, the flow naturally lands on
 * the intake form.
 */

/** Derive whole-year age from an ISO birth date — null when missing/invalid. */
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

/** Map a StudyType to a short label via the existing study-plugin translations. */
function studyTypeShortLabel(
  studyType: StudyType,
  t: (key: string, paramsOrDefault?: Record<string, unknown> | string) => string,
): string {
  // Plugins live under `studies.<key>.short`. Map the canonical StudyType to
  // its plugin key (venousLE* variants all share one plugin).
  const pluginKey =
    studyType === 'venousLEBilateral' || studyType === 'venousLERight' || studyType === 'venousLELeft'
      ? 'venousLE'
      : studyType;
  const plugin = STUDY_PLUGINS.find((p) => p.key === pluginKey);
  if (!plugin) return studyType;
  return t(`${plugin.translationKey}.short`, studyType);
}

export const StudyPicker = memo(function StudyPicker(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cards = useMemo(() => STUDY_PLUGINS, []);

  // Phase 2.b — encounter list replaces the Wave 4.1 draft banner. Each row
  // is a resumable in-progress encounter; the clinician can Resume or
  // Discard individually, plus a "Clear all" destructive action.
  const [encounters, setEncounters] = useState<EncounterDraft[]>([]);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const refreshEncounters = useCallback(async () => {
    try {
      const list = await listEncounters();
      setEncounters(list);
    } catch {
      setEncounters([]);
    }
  }, []);

  useEffect(() => {
    void refreshEncounters();
  }, [refreshEncounters]);

  const handleConfirmClearAll = useCallback(async () => {
    setClearing(true);
    try {
      // Clear both encounters and per-study drafts so the workstation is
      // wiped of leftover PHI from any source. clearAllDrafts is the
      // existing Wave 4.1 helper; clearAllEncounters is Phase 1b's.
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

  const handleConfirmDiscard = useCallback(async () => {
    if (!pendingDiscardId) return;
    setDiscarding(true);
    try {
      await clearEncounter(pendingDiscardId);
      await refreshEncounters();
    } finally {
      setDiscarding(false);
      setPendingDiscardId(null);
    }
  }, [pendingDiscardId, refreshEncounters]);

  const handleResume = useCallback(
    (encounter: EncounterDraft) => {
      const firstStudy = encounter.selectedStudyTypes[0];
      if (!firstStudy) {
        // Defensive — encounter without selected studies shouldn't exist
        // but in case it does, fall back to encounter route prefix only.
        navigate(`/encounter/${encounter.encounterId}`);
        return;
      }
      navigate(`/encounter/${encounter.encounterId}/${firstStudy}`);
    },
    [navigate],
  );

  const handleNewEncounter = useCallback(() => {
    // TODO(Phase 3a): when App.tsx flips `/` to render <EncounterIntake>,
    // this naturally lands on the intake form. For now, navigating to `/`
    // simply re-renders this picker — the user must scroll to the cards.
    navigate('/');
  }, [navigate]);

  const handlePointerMove = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    e.currentTarget.style.setProperty('--pointer-y', `${y}%`);
  }, []);

  const handleStartStudy = useCallback(
    (studyKey: string) => {
      const plugin = STUDY_PLUGINS.find((p) => p.key === studyKey);
      if (plugin?.route) {
        navigate(plugin.route);
        return;
      }
      // eslint-disable-next-line no-console
      console.info('[StudyPicker] start study (not yet available):', studyKey);
    },
    [navigate],
  );

  return (
    <div className={classes.backdrop}>
      <div className={classes.container}>
        {/* Eyebrow + title + subtitle */}
        <header className={classes.header}>
          <span className={classes.eyebrow}>
            <span className={classes.eyebrowDot} aria-hidden />
            <span className={classes.eyebrowText}>{t('app.tagline')}</span>
          </span>
          <h1 className={classes.title}>{t('studyPicker.title')}</h1>
          <p className={classes.subtitle}>{t('studyPicker.subtitle')}</p>
        </header>

        {/* Phase 2.b — encounter list */}
        {encounters.length > 0 && (
          <section className={classes.encounterListSection} data-testid="encounter-list">
            <div className={classes.encounterListHeader}>
              <h2 className={classes.encounterListTitle}>
                <IconClockHour4 size={18} stroke={1.75} aria-hidden />
                {t('encounter.list.title')}
              </h2>
              <EMRButton
                variant="primary"
                size="sm"
                leftSection={<IconPlus size={16} stroke={1.75} />}
                onClick={handleNewEncounter}
                data-testid="encounter-list-new"
              >
                {t('encounter.list.newEncounter')}
              </EMRButton>
            </div>

            <ul className={classes.encounterList}>
              {encounters.map((enc) => {
                const age = ageFromBirthDate(enc.header.patientBirthDate);
                const ageSuffix = age !== null ? ` · ${age}` : '';
                return (
                  <li
                    key={enc.encounterId}
                    className={classes.encounterRow}
                    data-testid={`encounter-row-${enc.encounterId}`}
                  >
                    <div className={classes.encounterRowMain}>
                      <div className={classes.encounterRowPatient}>
                        <span className={classes.encounterRowPatientName}>
                          {enc.header.patientName || '—'}
                          {ageSuffix}
                        </span>
                        <span className={classes.encounterRowDate}>
                          {t('encounter.banner.dateLabel')}: {enc.header.encounterDate || '—'}
                        </span>
                      </div>
                      <div className={classes.encounterRowChips}>
                        {enc.selectedStudyTypes.map((st) => {
                          const started = Boolean(enc.studies && st in enc.studies);
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
                    <div className={classes.encounterRowActions}>
                      <EMRButton
                        variant="primary"
                        size="sm"
                        leftSection={<IconPlayerPlay size={16} stroke={1.75} />}
                        onClick={() => handleResume(enc)}
                        data-testid={`encounter-resume-${enc.encounterId}`}
                      >
                        {t('encounter.list.resume')}
                      </EMRButton>
                      <EMRButton
                        variant="outline"
                        size="sm"
                        leftSection={<IconTrash size={16} stroke={1.75} />}
                        onClick={() => setPendingDiscardId(enc.encounterId)}
                        data-testid={`encounter-discard-${enc.encounterId}`}
                      >
                        {t('encounter.list.discard')}
                      </EMRButton>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={classes.encounterListFooter}>
              <EMRButton
                variant="danger"
                size="sm"
                leftSection={<IconTrash size={16} stroke={1.75} />}
                onClick={() => setConfirmClearOpen(true)}
                data-testid="encounter-list-clear-all"
              >
                {t('encounter.list.clearAll')}
              </EMRButton>
            </div>
          </section>
        )}

        {/* Study card grid */}
        <div
          className={classes.grid}
          role="list"
          aria-label={t('studyPicker.title')}
        >
          {cards.map((study, index) => {
            const Icon = study.icon;
            const delayKey = `delay${index}` as const;
            const cardClass = [
              classes.card,
              study.available ? classes.cardAvailable : classes.cardDisabled,
              classes[delayKey] ?? '',
            ]
              .filter(Boolean)
              .join(' ');

            const title = t(`${study.translationKey}.title`);
            const description = t(`${study.translationKey}.description`);
            const short = t(`${study.translationKey}.short`);

            return (
              <button
                key={study.key}
                type="button"
                role="listitem"
                className={cardClass}
                onClick={
                  study.available ? () => handleStartStudy(study.key) : undefined
                }
                onMouseMove={handlePointerMove}
                disabled={!study.available}
                aria-label={`${title} — ${
                  study.available ? t('studyPicker.phase1Badge') : t('studyPicker.comingSoon')
                }`}
                data-testid={`study-card-${study.key}`}
              >
                <div className={classes.cardTop}>
                  <span className={classes.iconWrap} aria-hidden>
                    <Icon size={22} stroke={1.75} />
                  </span>
                  <span className={classes.badgeSlot}>
                    {study.available ? (
                      <EMRBadge variant="status-active" size="sm">
                        {t('studyPicker.phase1Badge')}
                      </EMRBadge>
                    ) : (
                      <EMRBadge variant="status-archived" size="sm">
                        {t('studyPicker.comingSoon')}
                      </EMRBadge>
                    )}
                  </span>
                </div>

                <div className={classes.cardBody}>
                  <h2 className={classes.title}>{title}</h2>
                  <p className={classes.description}>{description}</p>
                </div>

                <div className={classes.cardFoot}>
                  {study.available ? (
                    <span className={classes.cta}>
                      {t('studyPicker.startStudy')}
                      <IconArrowRight size={16} stroke={2.25} aria-hidden />
                    </span>
                  ) : (
                    <span className={classes.ctaMuted}>{t('studyPicker.comingSoon')}</span>
                  )}
                  <span className={classes.shortCode}>{short}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footnote */}
        <div className={classes.footnote}>
          <span className={classes.footnoteInner}>
            <IconStethoscope size={14} stroke={1.75} aria-hidden />
            FHIR&nbsp;R4 · {t('app.tagline')}
          </span>
        </div>
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

export default StudyPicker;
