// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRStepGuide — collapsible "How to" card for guided clinical workflows.
 *
 * Plain English: a card pinned at the top of a step panel that tells the
 * operator (a) what they're trying to measure / record, (b) the procedure
 * (3-5 numbered steps), (c) anatomical landmarks to look for, and (d) an
 * estimated time. Collapsed by default so the panel stays compact; the
 * operator clicks the chevron to expand when they need guidance.
 *
 * Designed for the TAVI Planning suite step retrofit. Mirrors the pattern
 * used in MediScribe / Patient Card where each clinical step is expected
 * to provide brief context-sensitive help. Built on the layout primitives
 * already in `emr/components/common/` (EMRCollapsibleSection exists but it's
 * heavier — it manages its own state + expand-all signals; EMRStepGuide is
 * a thinner, presentational alternative).
 *
 * @module components/common/EMRStepGuide
 */

import { useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronRight, IconClock, IconHelpCircle } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';

import styles from './EMRStepGuide.module.css';

export interface EMRStepGuideProcedureStep {
  /** Short action — bold leading text (e.g. "Place 3 commissure peaks"). */
  what: string;
  /** Anatomical location / landmark description. */
  where: string;
  /** Optional measurement-tool hint (e.g. "📏 Length tool on the lumen"). */
  toolHint?: string;
}

export interface EMRStepGuideProps {
  /** Step number — rendered as a circular badge. */
  stepNumber: number;
  /** Step title — e.g. "Sinus / STJ / LVOT". */
  title: string;
  /**
   * One-line description of what the step measures / records, shown next to
   * the title even when the procedure list is collapsed.
   */
  subtitle?: string;
  /** Estimated minutes the step takes a trained operator. */
  estimatedMinutes?: number;
  /** Ordered procedure list — typically 3-5 entries. */
  procedure: EMRStepGuideProcedureStep[];
  /** Free-form extra content rendered AFTER the procedure list (optional). */
  children?: ReactNode;
  /** Whether the procedure list starts expanded. Defaults to false. */
  defaultExpanded?: boolean;
  /** Test id override. */
  'data-testid'?: string;
}

export function EMRStepGuide(props: EMRStepGuideProps): React.ReactElement {
  const { t } = useTranslation();
  const {
    stepNumber,
    title,
    subtitle,
    estimatedMinutes,
    procedure,
    children,
    defaultExpanded = false,
  } = props;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const testId = props['data-testid'] ?? `emr-step-guide-${stepNumber}`;

  return (
    <section
      className={styles.root}
      data-expanded={expanded || undefined}
      data-testid={testId}
      aria-label={t('common.guidanceFor', { title })}
    >
      <button
        type="button"
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid={`${testId}-toggle`}
      >
        <span className={styles.stepBadge} aria-hidden="true">
          {stepNumber}
        </span>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{title}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        <div className={styles.meta}>
          {typeof estimatedMinutes === 'number' && (
            <span className={styles.estimate} title={t('common.estimatedTime')}>
              <IconClock size={12} aria-hidden="true" /> {estimatedMinutes}m
            </span>
          )}
          <span className={styles.helpHint}>
            <IconHelpCircle size={14} aria-hidden="true" />
            {expanded ? t('common.hide') : t('common.howTo')}
          </span>
          {expanded ? (
            <IconChevronDown size={16} aria-hidden="true" />
          ) : (
            <IconChevronRight size={16} aria-hidden="true" />
          )}
        </div>
      </button>
      {expanded && (
        <div className={styles.body}>
          <ol className={styles.procedure}>
            {procedure.map((step, idx) => (
              <li key={idx} className={styles.procedureItem}>
                <span className={styles.procedureWhat}>{step.what}</span>
                <span className={styles.procedureWhere}>{step.where}</span>
                {step.toolHint && <span className={styles.procedureToolHint}>{step.toolHint}</span>}
              </li>
            ))}
          </ol>
          {children && <div className={styles.extraBlock}>{children}</div>}
        </div>
      )}
    </section>
  );
}

export default EMRStepGuide;
