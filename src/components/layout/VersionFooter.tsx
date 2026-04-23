// SPDX-License-Identifier: Apache-2.0
/**
 * VersionFooter — tiny global build-hash indicator.
 *
 * Renders the git short-hash that Vite's `define` injected at build time.
 * Hidden in print media so it never lands on a downloaded PDF.
 */

import classes from './VersionFooter.module.css';

export function VersionFooter(): React.ReactElement {
  const hash = typeof __BUILD_HASH__ === 'string' ? __BUILD_HASH__ : 'dev';
  return (
    <div className={`${classes.footer} no-print`} aria-label="Build version">
      <span className={classes.label}>MediMind Angio</span>
      <span className={classes.dot} aria-hidden>
        ·
      </span>
      <span className={classes.hash} data-testid="build-hash">
        build {hash}
      </span>
    </div>
  );
}

export default VersionFooter;
