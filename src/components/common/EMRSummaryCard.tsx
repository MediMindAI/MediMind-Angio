// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRSummaryCard Component
 *
 * Thin wrapper providing a unified card shell for patient context summary cards.
 * Standardizes background, border, border-radius, padding, and 3px top accent gradient
 * across all 7 cards in the patient card "More" expanded section.
 *
 * Each card's internal content (headers, lists, controls) is passed as children.
 */

import type { ReactNode, CSSProperties, MouseEventHandler, JSX } from 'react';
import classes from './EMRSummaryCard.module.css';

export interface EMRSummaryCardProps {
  /** CSS gradient for the 3px top accent line */
  accentGradient: string;
  /** Optional dark mode gradient override */
  accentGradientDark?: string;
  /** Card content (headers, lists, controls) */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Optional click handler */
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function EMRSummaryCard({
  accentGradient,
  accentGradientDark,
  children,
  className,
  'data-testid': testId,
  onClick,
}: EMRSummaryCardProps): JSX.Element {
  const style: CSSProperties & Record<string, string> = {
    '--summary-card-accent': accentGradient,
  };
  if (accentGradientDark) {
    style['--summary-card-accent-dark'] = accentGradientDark;
  }

  return (
    <div
      className={`${classes.card}${className ? ` ${className}` : ''}`}
      style={style}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
