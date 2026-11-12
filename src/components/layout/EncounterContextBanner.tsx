// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterContextBanner — patient-context strip rendered above per-study
 * findings.
 *
 * Phase 3c of the encounter-pivot plan. Replaces the visual real-estate
 * the dropped collapsible `<StudyHeader>` used to occupy on every per-
 * study form.
 *
 * Post-redesign layout (3 zones, all CSS-grid-driven):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  [👤 Avatar] Patient name              [Studies tabs]            │
 *   │              date · age · ID                          [+ Add] [✏][⋮] │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Action hierarchy (one primary CTA per bar, the rest are icon-only):
 *   - "+ Add study"         → secondary deck (only when studies remain; the
 *                              screen's one gradient primary is PDF download)
 *   - "Edit details"        → ghost icon-button with aria-label tooltip
 *   - "All encounters"      → ghost icon-button with aria-label tooltip
 *
 * Renders nothing when `encounter === null`.
 */

import { memo, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconEdit,
  IconList,
  IconPlus,
  IconCalendarEvent,
  IconUser,
} from '@tabler/icons-react';
import { Menu } from '@mantine/core';
import { EMRButton } from '../common/EMRButton';
import { useEncounter } from '../../contexts/EncounterContext';
import { useTranslation } from '../../contexts/TranslationContext';
import { loadEncounterSync } from '../../services/encounterStore';
import type { StudyType } from '../../types/study';
import classes from './EncounterContextBanner.module.css';
import { formatDottedDate } from '../../services/dateHelpers';

/** Per-StudyType metadata for chip labels and routes. */
interface StudyTypeMeta {
  readonly route: string;
  readonly translationKey: string;
  readonly fallbackLabel: string;
  /**
   * Venous laterality (UX-ANGIO-012 L2). Right / left / both-legs studies get
   * distinct keys; until a locale carries them, the label is composed from the
   * already-translated `studies.venousLE.short` + `anatomy.side.<side>` so the
   * three entries never read identically.
   */
  readonly side?: 'bilateral' | 'right' | 'left';
  /**
   * `false` = no study form exists yet, so the add menu must not offer it:
   * EncounterStudyWrapper bounces the route to `/`, leaving a study in the
   * visit that can never be opened or completed. Chips still render it for
   * visits that already contain one.
   */
  readonly addable?: false;
}

const STUDY_TYPE_META: Readonly<Record<StudyType, StudyTypeMeta>> = {
  venousLEBilateral: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.shortBilateral',
    fallbackLabel: 'Venous LE',
    side: 'bilateral',
  },
  venousLERight: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.shortRight',
    fallbackLabel: 'Venous LE (R)',
    side: 'right',
  },
  venousLELeft: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.shortLeft',
    fallbackLabel: 'Venous LE (L)',
    side: 'left',
  },
  arterialLE: {
    route: '/arterial-le',
    translationKey: 'studies.arterialLE.short',
    fallbackLabel: 'Arterial LE',
  },
  carotid: {
    route: '/carotid',
    translationKey: 'studies.carotid.short',
    fallbackLabel: 'Carotid',
  },
  ivcDuplex: {
    route: '/ivc-duplex',
    translationKey: 'studies.ivcDuplex.short',
    fallbackLabel: 'IVC',
    addable: false,
  },
  iliacPelvicVenous: {
    route: '/iliac-pelvic-venous',
    translationKey: 'studies.iliacPelvicVenous.short',
    fallbackLabel: 'Iliac & pelvic',
  },
};

/** Whole-year age from an ISO `YYYY-MM-DD` birth date. */
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

/** Extract up to 2 initials from a patient name (handles single-name entries). */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export const EncounterContextBanner = memo(function EncounterContextBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ encounterId?: string; studyType?: string }>();
  const { encounter, addStudy } = useEncounter();

  const activeStudyType = params.studyType as StudyType | undefined;

  const addableStudyTypes = useMemo<ReadonlyArray<StudyType>>(() => {
    const selected = new Set<StudyType>(encounter?.selectedStudyTypes ?? []);
    return (Object.keys(STUDY_TYPE_META) as ReadonlyArray<StudyType>).filter(
      (s) => !selected.has(s) && STUDY_TYPE_META[s].addable !== false,
    );
  }, [encounter?.selectedStudyTypes]);

  const studyLabel = useCallback(
    (studyType: StudyType): string => {
      const meta = STUDY_TYPE_META[studyType];
      const fallback = meta.side
        ? `${t('studies.venousLE.short', 'Venous LE')} (${t(`anatomy.side.${meta.side}`, meta.side)})`
        : meta.fallbackLabel;
      return t(meta.translationKey, fallback);
    },
    [t],
  );

  const handleChipClick = useCallback(
    (studyType: StudyType) => {
      if (!encounter) return;
      if (studyType === activeStudyType) return;
      navigate(`/encounter/${encounter.encounterId}/${studyType}`);
    },
    [activeStudyType, encounter, navigate],
  );

  const handleAddStudy = useCallback(
    (studyType: StudyType) => {
      if (!encounter) return;
      const { encounterId } = encounter;
      addStudy(studyType);
      // The study route guard (EncounterStudyWrapper) checks the sync
      // localStorage cache, which saveEncounter writes only after IndexedDB
      // resolves. Navigating at once bounced the user to `/` even though the
      // study was saved. Wait until the cache shows the new study (the same
      // check the guard runs), capped so a failed cache write still moves on.
      const startedAt = Date.now();
      const goWhenStored = (): void => {
        const stored = loadEncounterSync(encounterId);
        if (stored?.selectedStudyTypes.includes(studyType) || Date.now() - startedAt > 2000) {
          navigate(`/encounter/${encounterId}/${studyType}`);
          return;
        }
        window.setTimeout(goWhenStored, 25);
      };
      goWhenStored();
    },
    [addStudy, encounter, navigate],
  );

  const handleEditEncounter = useCallback(() => {
    if (!encounter) return;
    navigate(`/?edit=${encounter.encounterId}`);
  }, [encounter, navigate]);

  const handleViewAll = useCallback(() => {
    // The encounters list moved onto the landing page (OngoingVisitsPanel
    // above the intake form). Navigating to `/` drops any `?edit=` context
    // so the user sees a fresh intake form alongside the list.
    navigate('/');
  }, [navigate]);

  if (!encounter) return null;

  const age = ageFromBirthDate(encounter.header.patientBirthDate);
  const patientName = encounter.header.patientName || t('encounter.banner.unnamedPatient', 'Unnamed');
  const initials = initialsFromName(patientName) || '?';
  const metaParts = [
    encounter.header.encounterDate ? formatDottedDate(encounter.header.encounterDate) : null,
    age !== null
      ? t('encounter.banner.ageYears', '{age} y').replace('{age}', String(age))
      : null,
    encounter.header.patientId ? `ID: ${encounter.header.patientId}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      className={classes.banner}
      role="region"
      aria-label={t('encounter.banner.regionLabel', 'Encounter context')}
      data-testid="encounter-context-banner"
    >
      <span className={classes.bannerAccent} aria-hidden />

      {/* ============== PATIENT IDENTITY (left) ============== */}
      <div className={classes.identity}>
        <span className={classes.avatar} aria-hidden>
          {initials}
        </span>
        <div className={classes.identityText}>
          <span className={classes.patientName} data-testid="banner-patient-name">
            {patientName}
          </span>
          <span className={classes.identityMeta}>
            <IconCalendarEvent
              size={13}
              stroke={1.75}
              className={classes.identityMetaIcon}
              aria-hidden
            />
            <span data-testid="banner-encounter-date">{metaParts || '—'}</span>
          </span>
        </div>
      </div>

      {/* ============== STUDY SWITCHER (middle) ============== */}
      {encounter.selectedStudyTypes.length > 0 && (
        <div className={classes.chips} data-testid="banner-chip-row">
          <span className={classes.chipsLabel}>
            {t('encounter.banner.studiesLabel', 'Studies')}
          </span>
          <div className={classes.chipTrack} role="tablist" aria-label="Studies">
            {encounter.selectedStudyTypes.map((studyType) => {
              const isActive = studyType === activeStudyType;
              const label = studyLabel(studyType);
              return (
                <button
                  key={studyType}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={[classes.chip, isActive ? classes.chipActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleChipClick(studyType)}
                  disabled={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={
                    isActive
                      ? label
                      : t('encounter.banner.switchTo', 'Switch to {study}').replace(
                          '{study}',
                          label,
                        )
                  }
                  data-testid={`banner-chip-${studyType}`}
                  data-active={isActive ? 'true' : 'false'}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============== ACTIONS (right) ============== */}
      <div className={classes.actions}>
        {addableStudyTypes.length > 0 && (
          // Mantine Menu portals its dropdown to <body>, so the banner's
          // `overflow: hidden` (which keeps the accent rail clipped to the
          // rounded corner) can no longer cut the options off (UX-ANGIO-012 L1,
          // sibling: IliacPelvicVenousForm templates menu).
          <Menu
            position="bottom-end"
            offset={8}
            zIndex="var(--emr-z-dropdown)"
            classNames={{
              dropdown: classes.menuDropdown,
              label: classes.menuHeader,
              item: classes.menuItem,
              itemSection: classes.menuItemIcon,
            }}
          >
            <Menu.Target>
              <EMRButton
                variant="secondary"
                size="sm"
                icon={IconPlus}
                data-testid="banner-add-study"
              >
                {t('encounter.banner.addStudy', '+ Add study')}
              </EMRButton>
            </Menu.Target>
            <Menu.Dropdown data-testid="banner-add-study-menu">
              <Menu.Label>{t('encounter.banner.addStudy', '+ Add study')}</Menu.Label>
              {addableStudyTypes.map((studyType) => (
                <Menu.Item
                  key={studyType}
                  leftSection={<IconUser size={14} stroke={1.75} aria-hidden />}
                  onClick={() => handleAddStudy(studyType)}
                  data-testid={`banner-add-option-${studyType}`}
                >
                  {studyLabel(studyType)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}

        <button
          type="button"
          className={classes.iconButton}
          onClick={handleEditEncounter}
          aria-label={t('encounter.banner.editEncounter', 'Edit encounter details')}
          title={t('encounter.banner.editEncounter', 'Edit encounter details')}
          data-testid="banner-edit-encounter"
        >
          <IconEdit size={16} stroke={1.75} aria-hidden />
        </button>

        <button
          type="button"
          className={classes.iconButton}
          onClick={handleViewAll}
          aria-label={t('encounter.list.viewAll', 'All encounters')}
          title={t('encounter.list.viewAll', 'All encounters')}
          data-testid="banner-view-all"
        >
          <IconList size={16} stroke={1.75} aria-hidden />
        </button>
      </div>
    </section>
  );
});

export default EncounterContextBanner;
