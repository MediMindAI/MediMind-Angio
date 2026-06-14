// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Box, Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCircleCheck, IconInfoCircle, IconAlertCircle, IconX } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';
import styles from './EMRNotice.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/** Semantic color of the notice (info rail = theme blue). */
export type EMRNoticeColor = 'info' | 'success' | 'error';

export interface EMRNoticeProps {
  /** Semantic color: info (navy/blue rail), success (green), error (red) */
  color?: EMRNoticeColor;
  /** Custom icon (overrides the color default). Hidden while loading. */
  icon?: ComponentType<IconProps>;
  /** Bold first-line title */
  title?: ReactNode;
  /** Calm body text */
  children?: ReactNode;
  /** Show a close button; renders only when onClose is provided */
  onClose?: () => void;
  /** Force-show the close button (defaults to true when onClose is set) */
  withCloseButton?: boolean;
  /** Replace the icon with a spinner */
  loading?: boolean;
  /** Test ID */
  'data-testid'?: string;
  /** Additional CSS class */
  className?: string;
}

const defaultIcons: Record<EMRNoticeColor, ComponentType<IconProps>> = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  error: IconAlertCircle,
};

/**
 * EMRNotice — inline, always-visible notification (the declarative counterpart
 * to the imperative EMRToast). Command alert idiom: borderless white "deck",
 * 4px solid left rail in the semantic color, card shadow, calm body text with
 * a bold title.
 *
 * Differs from EMRAlert by exposing a `loading` state and `color` semantics
 * tuned for the raw Mantine `<Notification>` declarative use-cases.
 *
 * @example
 * ```tsx
 * <EMRNotice color="success" icon={IconBell} title={t('doctorReady')} onClose={dismiss}>
 *   {t('preparing')}
 * </EMRNotice>
 * ```
 */
export function EMRNotice({
  color = 'info',
  icon,
  title,
  children,
  onClose,
  withCloseButton,
  loading = false,
  'data-testid': testId,
  className,
}: EMRNoticeProps): React.ReactElement {
  const { t } = useTranslation();
  const IconComponent = icon ?? defaultIcons[color];
  const showClose = (withCloseButton ?? Boolean(onClose)) && Boolean(onClose);

  return (
    <Box
      className={[styles.notice, styles[`color_${color}`], className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <Box className={styles.iconCell}>
        {loading ? <Loader size={18} color="var(--emr-secondary)" /> : <IconComponent size={18} />}
      </Box>

      <Stack gap={2} className={styles.body}>
        {title !== undefined && (
          <Text className={styles.title} component="div">
            {title}
          </Text>
        )}
        {children !== undefined && (
          <Text className={styles.message} component="div">
            {children}
          </Text>
        )}
      </Stack>

      {showClose && (
        <Group className={styles.closeCell} gap={0}>
          <UnstyledButton
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid={testId ? `${testId}-close` : undefined}
          >
            <IconX size={16} />
          </UnstyledButton>
        </Group>
      )}
    </Box>
  );
}

export default EMRNotice;
