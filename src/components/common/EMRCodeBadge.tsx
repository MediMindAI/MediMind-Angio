// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge } from '@mantine/core';
import classes from './EMRCodeBadge.module.css';

/** Code type variants for styling */
export type EMRCodeBadgeVariant = 'icd10' | 'ncsp' | 'loinc' | 'snomed' | 'custom';

/** Size variants for the badge */
export type EMRCodeBadgeSize = 'xs' | 'sm' | 'md';

/**
 * Props for EMRCodeBadge component
 */
export interface EMRCodeBadgeProps {
  /** The medical code to display */
  code: string;
  /** Code system variant: icd10, ncsp, loinc, snomed, custom */
  variant?: EMRCodeBadgeVariant;
  /** Size variant: xs, sm (default), md */
  size?: EMRCodeBadgeSize;
  /** Custom color (overrides variant default) */
  color?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/** Colors for each variant */
const variantColors: Record<EMRCodeBadgeVariant, string> = {
  icd10: 'blue',
  ncsp: 'grape',
  loinc: 'teal',
  snomed: 'cyan',
  custom: 'gray',
};

/**
 * EMRCodeBadge - Standardized badge for medical codes (ICD-10, NCSP, LOINC, etc.)
 *
 * Features:
 * - Monospace font for code readability
 * - Variant colors for different code systems
 * - Consistent sizing across all EMR pages
 * - Light variant for subtlety
 *
 * @param root0
 * @param root0.code
 * @param root0.variant
 * @param root0.size
 * @param root0.color
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // ICD-10 diagnosis code
 * <EMRCodeBadge code="J18.9" variant="icd10" />
 *
 * // NCSP procedure code
 * <EMRCodeBadge code="ABC123" variant="ncsp" />
 *
 * // LOINC lab code
 * <EMRCodeBadge code="2951-2" variant="loinc" />
 *
 * // Custom color
 * <EMRCodeBadge code="CUSTOM" variant="custom" color="orange" />
 * ```
 */
export function EMRCodeBadge({
  code,
  variant = 'icd10',
  size = 'sm',
  color,
  'data-testid': testId,
}: EMRCodeBadgeProps): React.ReactElement {
  const badgeColor = color || variantColors[variant];

  return (
    <Badge
      size={size}
      variant="light"
      color={badgeColor}
      data-testid={testId}
      className={classes.codeBadge}
    >
      {code}
    </Badge>
  );
}

export default EMRCodeBadge;
