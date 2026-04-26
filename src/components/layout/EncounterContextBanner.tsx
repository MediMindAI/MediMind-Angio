// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterContextBanner — compact strip rendered above per-study findings.
 *
 * Phase 3c of the encounter-pivot plan. Replaces the visual real-estate
 * the dropped collapsible `<StudyHeader>` used to occupy on every per-
 * study form. Shows three blocks in a single horizontal row (desktop) or
 * a two-row stack (mobile ≤768px):
 *
 *   [👤 Patient · age · encounter date]   [chip][chip][chip*]   [+ Add] [✏ Edit]
 *
 * The active chip (matching the current `:studyType` route param) is
 * highlighted with `--emr-primary`; non-active chips navigate to the
 * matching study within the same encounter via `useNavigate()`.
 *
 * `+ Add study` opens a Mantine `<Menu>` listing the supported StudyTypes
 * NOT yet in `selectedStudyTypes`; selecting one calls
 * `useEncounter().addStudy()` and navigates to the new study's route.
 *
 * `✏ Edit encounter` returns the user to `/?edit={encounterId}` so the
 * intake page (Phase 2b) can re-open the encounter for editing. Until 2b
 * implements the `?edit` query handler, the user lands on `/` and resumes
 * the encounter via the drafts banner — the TODO below tracks that.
 *
 * Renders nothing when `encounter === null` — graceful fallback for the
 * brief gap before EncounterContext finishes hydrating; the wrapper
 * (Phase 3a) is also expected to redirect to `/` in that case.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { EMRButton } from '../common/EMRButton';
import { useEncounter } from '../../contexts/EncounterContext';
import { useTranslation } from '../../contexts/TranslationContext';
import type { StudyType } from '../../types/study';
import classes from './EncounterContextBanner.module.css';

/**
 * Catalog of every StudyType the app supports — drives the "+ Add study"
 * menu and the chip→route mapping. Kept local to the banner because the
 * `STUDY_PLUGINS` registry is keyed by plugin (`venousLE`, not
 * `venousLEBilateral`); we need a per-StudyType view here.
 *
 * The translation-key column points to a plugin-level entry (e.g.
 * `studies.venousLE.short`) because `venousLEBilateral`, `venousLERight`,
 * and `venousLELeft` all share the venous-LE form and translation file.
 * For now they share the same chip label; Phase 5 can split them with a
 * laterality suffix once translation keys are added.
 */
interface StudyTypeMeta {
  readonly route: string;
  readonly translationKey: string;
  readonly fallbackLabel: string;
}

const STUDY_TYPE_META: Readonly<Record<StudyType, StudyTypeMeta>> = {
  venousLEBilateral: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.short',
    fallbackLabel: 'Venous LE',
  },
  venousLERight: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.short',
    fallbackLabel: 'Venous LE (R)',
  },
  venousLELeft: {
    route: '/venous-le',
    translationKey: 'studies.venousLE.short',
    fallbackLabel: 'Venous LE (L)',
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
  },
};

/** Whole-year age from an ISO `YYYY-MM-DD` birth date (copy of StudyHeader helper). */
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

export const EncounterContextBanner = memo(function EncounterContextBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ encounterId?: string; studyType?: string }>();
  const { encounter, addStudy } = useEncounter();
  // Lightweight controlled menu — Mantine `<Menu>` was the original pick
  // but its Popover-anchored Dropdown doesn't render reliably under jsdom
  // (no `getBoundingClientRect` for floating-ui). The plan tags this as
  // "minimal; Phase 5 will polish" so a CSS-positioned dropdown is fine.
  const [addMenuOpened, setAddMenuOpened] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  // Click-outside dismissal — same pattern as ConfirmDialog elsewhere.
  useEffect(() => {
    if (!addMenuOpened) return;
    const handleDocClick = (event: MouseEvent): void => {
      if (!addMenuRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (addMenuRef.current.contains(event.target)) return;
      setAddMenuOpened(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [addMenuOpened]);

  const activeStudyType = params.studyType as StudyType | undefined;

  // Studies available for the "+ Add" menu — every supported StudyType
  // not already in selectedStudyTypes. Memoised so the menu doesn't
  // rebuild unless the selection list changes. Hooks must run before the
  // early-return null guard, so we coalesce a missing encounter to an
  // empty selection here.
  const addableStudyTypes = useMemo<ReadonlyArray<StudyType>>(() => {
    const selected = new Set<StudyType>(encounter?.selectedStudyTypes ?? []);
    return (Object.keys(STUDY_TYPE_META) as ReadonlyArray<StudyType>).filter((s) => !selected.has(s));
  }, [encounter?.selectedStudyTypes]);

  const handleChipClick = useCallback(
    (studyType: StudyType) => {
      if (!encounter) return;
      if (studyType === activeStudyType) return; // already on this study
      navigate(`/encounter/${encounter.encounterId}/${studyType}`);
    },
    [activeStudyType, encounter, navigate],
  );

  const handleAddStudy = useCallback(
    (studyType: StudyType) => {
      if (!encounter) return;
      addStudy(studyType);
      setAddMenuOpened(false);
      navigate(`/encounter/${encounter.encounterId}/${studyType}`);
    },
    [addStudy, encounter, navigate],
  );

  const handleEditEncounter = useCallback(() => {
    if (!encounter) return;
    // TODO(Phase 2b): the intake page should read `?edit={encounterId}`
    // and pre-load the encounter into edit mode. Until that lands the
    // user arrives on `/` and clicks "Resume" from the drafts banner.
    navigate(`/?edit=${encounter.encounterId}`);
  }, [encounter, navigate]);

  // Graceful no-render until the encounter has hydrated. The route wrapper
  // (Phase 3a) is the canonical guard, this is belt-and-braces. Placed
  // AFTER all hooks so we don't violate the rules-of-hooks.
  if (!encounter) return null;

  const age = ageFromBirthDate(encounter.header.patientBirthDate);

  return (
    <section
      className={classes.banner}
      role="region"
      aria-label={t('encounter.banner.regionLabel', 'Encounter context')}
      data-testid="encounter-context-banner"
    >
      {/* Identity block — read-only patient + encounter date */}
      <div className={classes.identity}>
        <span className={classes.identityLabel}>
          {t('encounter.banner.patientLabel', 'Patient')}
        </span>
        <span className={classes.patientName} data-testid="banner-patient-name">
          {encounter.header.patientName || t('encounter.banner.unnamedPatient', 'Unnamed')}
        </span>
        {age !== null && (
          <span className={classes.identityMeta} data-testid="banner-patient-age">
            <span className={classes.identitySeparator} aria-hidden>·</span>
            {t('encounter.banner.ageYears', '{age} y')
              .replace('{age}', String(age))}
          </span>
        )}
        <span className={classes.identityMeta} data-testid="banner-encounter-date">
          <span className={classes.identitySeparator} aria-hidden>·</span>
          <span className={classes.identityLabel} style={{ marginRight: 'var(--emr-space-2)' }}>
            {t('encounter.banner.dateLabel', 'Encounter date')}
          </span>
          {encounter.header.encounterDate}
        </span>
      </div>

      {/* Study switcher chips */}
      {encounter.selectedStudyTypes.length > 0 && (
        <div className={classes.chips} data-testid="banner-chip-row">
          <span className={classes.chipsLabel}>
            {t('encounter.banner.studiesLabel', 'Studies')}
          </span>
          {encounter.selectedStudyTypes.map((studyType) => {
            const meta = STUDY_TYPE_META[studyType];
            const isActive = studyType === activeStudyType;
            const label = t(meta.translationKey, meta.fallbackLabel);
            return (
              <button
                key={studyType}
                type="button"
                className={`${classes.chip} ${isActive ? classes.chipActive : ''}`}
                onClick={() => handleChipClick(studyType)}
                disabled={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  isActive
                    ? label
                    : t('encounter.banner.switchTo', 'Switch to {study}').replace('{study}', label)
                }
                data-testid={`banner-chip-${studyType}`}
                data-active={isActive ? 'true' : 'false'}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Secondary actions */}
      <div className={classes.actions}>
        {addableStudyTypes.length > 0 && (
          <div className={classes.menuWrap} ref={addMenuRef}>
            <EMRButton
              variant="subtle"
              size="sm"
              icon={IconPlus}
              onClick={() => setAddMenuOpened((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={addMenuOpened}
              data-testid="banner-add-study"
            >
              {t('encounter.banner.addStudy', '+ Add study')}
            </EMRButton>
            {addMenuOpened && (
              <div
                role="menu"
                className={classes.menuDropdown}
                data-testid="banner-add-study-menu"
              >
                {addableStudyTypes.map((studyType) => {
                  const meta = STUDY_TYPE_META[studyType];
                  return (
                    <button
                      key={studyType}
                      type="button"
                      role="menuitem"
                      className={classes.menuItem}
                      onClick={() => handleAddStudy(studyType)}
                      data-testid={`banner-add-option-${studyType}`}
                    >
                      {t(meta.translationKey, meta.fallbackLabel)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <EMRButton
          variant="subtle"
          size="sm"
          icon={IconEdit}
          onClick={handleEditEncounter}
          data-testid="banner-edit-encounter"
          aria-label={t('encounter.banner.editEncounter', 'Edit encounter details')}
        >
          {t('encounter.banner.editEncounter', 'Edit encounter details')}
        </EMRButton>
      </div>
    </section>
  );
});

export default EncounterContextBanner;
