// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, type MouseEvent } from 'react';
import { IconArrowRight, IconStethoscope } from '@tabler/icons-react';
import { EMRBadge } from '../common/EMRBadge';
import { useTranslation } from '../../contexts/TranslationContext';
import { STUDY_PLUGINS } from '../studies';
import classes from './StudyPicker.module.css';

/**
 * StudyPicker — landing grid for the angiology study-type selection.
 *
 * Layout: eyebrow + large title + subtitle, then a responsive 1 / 2 / 3
 * column grid of cards. Phase-1 studies are clickable, Phase-2..5 cards
 * stay visible but disabled so users can see what's coming.
 */
export const StudyPicker = memo(function StudyPicker(): React.ReactElement {
  const { t } = useTranslation();

  const cards = useMemo(() => STUDY_PLUGINS, []);

  const handlePointerMove = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    e.currentTarget.style.setProperty('--pointer-y', `${y}%`);
  }, []);

  const handleStartStudy = useCallback((studyKey: string) => {
    const plugin = STUDY_PLUGINS.find((p) => p.key === studyKey);
    if (plugin?.route) {
      window.location.pathname = plugin.route;
      return;
    }
    // eslint-disable-next-line no-console
    console.info('[StudyPicker] start study (not yet available):', studyKey);
  }, []);

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
    </div>
  );
});

export default StudyPicker;
