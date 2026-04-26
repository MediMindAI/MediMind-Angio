// SPDX-License-Identifier: Apache-2.0
/**
 * VersionFooter — tiny global build-hash indicator.
 *
 * Renders the git short-hash that Vite's `define` injected at build time.
 * Hidden in print media so it never lands on a downloaded PDF.
 */

import { useTranslation } from '../../contexts/TranslationContext';
import classes from './VersionFooter.module.css';

export function VersionFooter(): React.ReactElement {
  const { t } = useTranslation();
  const hash = typeof __BUILD_HASH__ === 'string' ? __BUILD_HASH__ : 'dev';
  return (
    <div
      className={`${classes.footer} no-print`}
      aria-label={t('versionFooter.aria', 'Build version')}
    >
      <span className={classes.label}>MediMind Angio</span>
      <span className={classes.dot} aria-hidden>
        ·
      </span>
      <span className={classes.hash} data-testid="build-hash">
        {t('versionFooter.buildPrefix', 'build')} {hash}
      </span>
    </div>
  );
}

export default VersionFooter;
