// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRClinicalWarning — semantic inline banner for sanity-check + decision-aid
 * warnings on EMR step panels.
 *
 * Plain English: a coloured banner the operator sees inline in a step panel
 * when a measured value or a derived metric crosses a clinically meaningful
 * threshold. Three severities (info → advisory → block) map to the existing
 * EMR theme tokens (info → accent-blue, advisory → warning, block → error).
 *
 * Designed for the TAVI Planning suite's step retrofit (e.g. "Tapered root —
 * favor balloon-expandable" on Step 6 when STJ < annulus), but kept generic
 * so any EMR module can adopt it (lab critical values, vitals out of range,
 * dose-range checks, etc.). The component is presentational only — clinical
 * thresholds live in the calling site.
 *
 * Severity philosophy:
 *   - `info` — neutral context ("Mean sinus diameter > annulus — as expected.")
 *   - `advisory` — clinician should consider a decision change but workflow
 *     continues ("Tapered root — favor balloon-expandable").
 *   - `block` — workflow should NOT continue without override (paired with
 *     an override-modal CTA elsewhere — this component just surfaces the
 *     reason).
 *
 * @module components/common/EMRClinicalWarning
 */

import type { ReactNode } from 'react';
import { IconAlertTriangle, IconInfoCircle, IconShieldX } from '@tabler/icons-react';

import styles from './EMRClinicalWarning.module.css';

export type EMRClinicalWarningSeverity = 'info' | 'advisory' | 'block';

export interface EMRClinicalWarningProps {
  severity: EMRClinicalWarningSeverity;
  /** Short headline — bold, 1 line. */
  title: string;
  /** Longer explanation — 1-3 sentences. Optional. */
  message?: string;
  /** Optional CTA rendered inline (e.g. "Open override modal", "Learn more"). */
  action?: ReactNode;
  /**
   * Optional anchor link to in-app help. When supplied the banner appends a
   * subtle "Why?" link below the message.
   */
  helpHref?: string;
  /** Test id override. */
  'data-testid'?: string;
}

function iconForSeverity(severity: EMRClinicalWarningSeverity): typeof IconInfoCircle {
  switch (severity) {
    case 'info':
      return IconInfoCircle;
    case 'advisory':
      return IconAlertTriangle;
    case 'block':
      return IconShieldX;
  }
}

export function EMRClinicalWarning(props: EMRClinicalWarningProps): React.ReactElement {
  const { severity, title, message, action, helpHref } = props;
  const Icon = iconForSeverity(severity);
  const testId = props['data-testid'] ?? `emr-clinical-warning-${severity}`;

  return (
    <div
      className={styles.root}
      data-severity={severity}
      role={severity === 'block' ? 'alert' : 'status'}
      data-testid={testId}
    >
      <Icon size={18} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {message && <div className={styles.message}>{message}</div>}
        {helpHref && (
          <a className={styles.helpLink} href={helpHref} target="_blank" rel="noreferrer noopener">
            Why?
          </a>
        )}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export default EMRClinicalWarning;
