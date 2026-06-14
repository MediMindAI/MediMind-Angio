// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { EMRButton } from './EMRButton';
import styles from './EMRActionBar.module.css';
import { useTranslation } from '../../contexts/TranslationContext';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/**
 * Props for EMRActionBar component
 */
export interface EMRActionBarProps {
  /** Cancel button label */
  cancelLabel?: string;
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button click handler */
  onCancel?: () => void;
  /** Submit button click handler */
  onSubmit?: () => void;
  /** Disable submit button */
  submitDisabled?: boolean;
  /** Show loading state on submit button */
  submitLoading?: boolean;
  /** Custom icon for cancel button */
  cancelIcon?: ComponentType<IconProps>;
  /** Custom icon for submit button */
  submitIcon?: ComponentType<IconProps>;
  /** Stick to bottom of viewport */
  sticky?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRActionBar - Action bar with cancel and submit buttons
 *
 * Features:
 * - Horizontal layout with cancel on left, submit on right
 * - Optional sticky positioning at bottom of viewport
 * - Customizable labels and icons
 * - Loading state support
 * - Mobile-responsive design
 *
 * @param root0
 * @param root0.cancelLabel
 * @param root0.submitLabel
 * @param root0.onCancel
 * @param root0.onSubmit
 * @param root0.submitDisabled
 * @param root0.submitLoading
 * @param root0.cancelIcon
 * @param root0.submitIcon
 * @param root0.sticky
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // Normal flow in parent
 * <EMRActionBar
 *   cancelLabel="Back"
 *   submitLabel="Continue"
 *   onCancel={handleBack}
 *   onSubmit={handleSubmit}
 *   submitDisabled={!isValid}
 * />
 *
 * // Sticky to bottom
 * <EMRActionBar
 *   sticky
 *   cancelLabel="Cancel"
 *   submitLabel="Save"
 *   onCancel={handleCancel}
 *   onSubmit={handleSave}
 *   submitLoading={isSaving}
 * />
 * ```
 */
export function EMRActionBar({
  cancelLabel,
  submitLabel,
  onCancel,
  onSubmit,
  submitDisabled = false,
  submitLoading = false,
  cancelIcon: CancelIcon = IconArrowLeft,
  submitIcon: SubmitIcon = IconArrowRight,
  sticky = false,
  'data-testid': testId,
}: EMRActionBarProps): React.ReactElement {
  const { t } = useTranslation();
  const finalCancelLabel = cancelLabel || t('common.cancel');
  const finalSubmitLabel = submitLabel || t('common.submit');
  return (
    <div className={`${styles.actionBar} ${sticky ? styles.sticky : ''}`} data-testid={testId}>
      <div className={styles.actionBarInner}>
        <EMRButton
          variant="secondary"
          icon={CancelIcon}
          iconPosition="left"
          onClick={onCancel}
          data-testid={testId ? `${testId}-cancel` : undefined}
        >
          {finalCancelLabel}
        </EMRButton>

        <EMRButton
          variant="primary"
          icon={SubmitIcon}
          iconPosition="right"
          onClick={onSubmit}
          disabled={submitDisabled}
          loading={submitLoading}
          data-testid={testId ? `${testId}-submit` : undefined}
        >
          {finalSubmitLabel}
        </EMRButton>
      </div>
    </div>
  );
}

export default EMRActionBar;
