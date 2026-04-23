// SPDX-License-Identifier: Apache-2.0

import { memo } from 'react';
import { useTranslation, type Language } from '../../contexts/TranslationContext';
import classes from './LanguageSwitcher.module.css';

const LANGUAGES: ReadonlyArray<{ code: Language; full: string; short: string }> = [
  { code: 'ka', full: 'ქართ', short: 'Ka' },
  { code: 'en', full: 'EN', short: 'En' },
  { code: 'ru', full: 'RU', short: 'Ru' },
];

/**
 * LanguageSwitcher — segmented-control pill that sits on the gradient
 * header bar. Active segment renders as a solid white pill; inactive
 * segments render as translucent white glyphs. Collapses to abbreviated
 * labels at < 576 px.
 */
export const LanguageSwitcher = memo(function LanguageSwitcher(): React.ReactElement {
  const { lang, setLang, t } = useTranslation();

  return (
    <div
      className={classes.wrapper}
      role="tablist"
      aria-label={t('language.label')}
      data-testid="language-switcher"
    >
      {LANGUAGES.map(({ code, full, short }) => {
        const isActive = lang === code;
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={t(`language.${code}`)}
            className={`${classes.segment ?? ''} ${isActive ? (classes.active ?? '') : ''}`}
            onClick={() => !isActive && setLang(code)}
            data-testid={`lang-${code}`}
          >
            <span className={classes.labelFull}>{full}</span>
            <span className={classes.labelShort}>{short}</span>
          </button>
        );
      })}
    </div>
  );
});

export default LanguageSwitcher;
