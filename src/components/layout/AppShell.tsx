// SPDX-License-Identifier: Apache-2.0

import { AppShell as MantineAppShell } from '@mantine/core';
import { useTranslation } from '../../contexts/TranslationContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { StudyPicker } from './StudyPicker';
import classes from './AppShell.module.css';

/**
 * AppShell — production top-nav + landing-page shell.
 *
 * Structure:
 *   Header (64 px, sticky, gradient background)
 *     - Brand lockup (MediMind three-bar icon + "MediMind Angio" wordmark)
 *     - Optional subtitle (hidden under 768 px)
 *     - Language switcher · Theme toggle
 *   Main
 *     - StudyPicker — eyebrow + title + responsive card grid
 */
export function AppShell(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <MantineAppShell
      header={{ height: 64 }}
      padding={0}
    >
      <MantineAppShell.Header className={classes.header} withBorder={false}>
        <div className={classes.headerInner}>
          {/* Brand lockup — acts as a "home" link (no-op for Phase 0). */}
          <a
            href="/"
            className={classes.brand}
            aria-label={t('app.title')}
            data-testid="brand-lockup"
            onClick={(e) => e.preventDefault()}
          >
            <svg
              className={classes.brandIcon}
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <rect x="30" y="14" width="10" height="74" rx="2" fill="currentColor" />
              <rect x="46" y="14" width="8" height="74" rx="2" fill="currentColor" opacity="0.82" />
              <rect x="60" y="14" width="10" height="74" rx="2" fill="currentColor" />
            </svg>
            <span className={classes.brandText}>
              <span className={classes.brandWord}>
                MediMind
                <span className={classes.brandWordAccent}>Angio</span>
              </span>
            </span>
            <span className={classes.brandDivider} aria-hidden />
            <span className={classes.brandSubtitle}>{t('app.subtitle')}</span>
          </a>

          {/* Controls — language switcher + theme toggle */}
          <div className={classes.controls}>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </MantineAppShell.Header>

      <MantineAppShell.Main className={classes.main}>
        <StudyPicker />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}

export default AppShell;
