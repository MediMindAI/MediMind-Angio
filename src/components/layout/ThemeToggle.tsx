// SPDX-License-Identifier: Apache-2.0

import { memo } from 'react';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../contexts/TranslationContext';
import type { ThemeMode } from '../../types/theme';
import classes from './ThemeToggle.module.css';

type IconProps = { size?: number | string; stroke?: number };

const OPTIONS: ReadonlyArray<{
  mode: ThemeMode;
  icon: React.ComponentType<IconProps>;
  labelKey: string;
}> = [
  { mode: 'light', icon: IconSun, labelKey: 'theme.light' },
  { mode: 'dark', icon: IconMoon, labelKey: 'theme.dark' },
  { mode: 'system', icon: IconDeviceDesktop, labelKey: 'theme.system' },
];

/**
 * ThemeToggle — three-state icon pill (light / dark / system) that
 * pairs visually with LanguageSwitcher. Sits on the gradient header.
 */
export const ThemeToggle = memo(function ThemeToggle(): React.ReactElement {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      className={classes.wrapper}
      role="tablist"
      aria-label={t('theme.toggle')}
      data-testid="theme-toggle"
    >
      {OPTIONS.map(({ mode: m, icon: Icon, labelKey }) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={t(labelKey)}
            className={`${classes.segment ?? ''} ${isActive ? (classes.active ?? '') : ''}`}
            onClick={() => !isActive && setMode(m)}
            data-testid={`theme-${m}`}
          >
            <Icon size={16} stroke={2} />
          </button>
        );
      })}
    </div>
  );
});

export default ThemeToggle;
