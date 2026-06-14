// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Group, Stack, Text, ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { EMRCodeBadge  } from './EMRCodeBadge';
import type {EMRCodeBadgeVariant} from './EMRCodeBadge';
import { EMRDeleteButton } from './EMRDeleteButton';
import classes from './EMRDataItem.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

/** Variant types for styling the data item card */
export type EMRDataItemVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/**
 * Props for EMRDataItem component
 */
export interface EMRDataItemProps {
  /** Medical code to display (e.g., "J18.9", "ABC123") */
  code?: string;
  /** Code system variant for badge styling */
  codeVariant?: EMRCodeBadgeVariant;
  /** Custom code badge color (overrides codeVariant) */
  codeColor?: string;
  /** Primary name/description text */
  name: string;
  /** Date or year to display */
  date?: string;
  /** Comment or additional notes */
  comment?: string;
  /** Secondary info (e.g., vaccine name, result) */
  secondaryInfo?: string;
  /** Visual variant for left accent stripe */
  variant?: EMRDataItemVariant;
  /** Optional leading icon */
  icon?: ComponentType<IconProps>;
  /** Delete handler - if provided, shows delete button */
  onDelete?: () => void;
  /** Edit handler - if provided, shows edit button */
  onEdit?: () => void;
  /** Disable delete button */
  deleteDisabled?: boolean;
  /** Delete button tooltip */
  deleteTooltip?: string;
  /** Edit button tooltip */
  editTooltip?: string;
  /** Compact size mode */
  compact?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

// Variant color mapping for accent stripe (light mode)
const variantAccentMapLight: Record<EMRDataItemVariant, string> = {
  primary: 'var(--emr-accent-line-primary)',
  secondary: 'var(--emr-accent-line-secondary)',
  success: 'var(--emr-accent-line-success)',
  warning: 'var(--emr-accent-line-warning)',
  error: 'var(--emr-accent-line-error)',
  info: 'var(--emr-accent-line-info)',
};

// Variant color mapping for accent stripe (dark mode)
const variantAccentMapDark: Record<EMRDataItemVariant, string> = {
  primary: 'var(--emr-accent-line-blue)',
  secondary: 'var(--emr-accent-line-info)',
  success: 'var(--emr-accent-line-success)',
  warning: 'var(--emr-accent-line-warning)',
  error: 'var(--emr-accent-line-error)',
  info: 'var(--emr-accent-line-info)',
};

// Icon container gradient backgrounds (light mode)
const variantIconGradientMapLight: Record<EMRDataItemVariant, string> = {
  primary: 'var(--emr-icon-gradient-primary)',
  secondary: 'var(--emr-icon-gradient-secondary)',
  success: 'var(--emr-icon-gradient-success)',
  warning: 'var(--emr-icon-gradient-warning)',
  error: 'var(--emr-icon-gradient-error)',
  info: 'var(--emr-icon-gradient-info)',
};

// Icon container gradient backgrounds (dark mode)
const variantIconGradientMapDark: Record<EMRDataItemVariant, string> = {
  primary: 'var(--emr-icon-bg-blue)',
  secondary: 'var(--emr-icon-bg-info)',
  success: 'var(--emr-icon-bg-success)',
  warning: 'var(--emr-icon-bg-warning)',
  error: 'var(--emr-icon-bg-error)',
  info: 'var(--emr-icon-bg-info)',
};

// Variant icon colors
const variantColorMap: Record<EMRDataItemVariant, string> = {
  primary: 'var(--emr-primary)',
  secondary: 'var(--emr-secondary)',
  success: 'var(--emr-success)',
  warning: 'var(--emr-warning)',
  error: 'var(--emr-error)',
  info: 'var(--emr-info)',
};

/**
 * EMRDataItem - A visually prominent card for displaying medical data items
 *
 * Features:
 * - Elevated card with shadow and border
 * - Color-coded left accent stripe by data type
 * - Code badge with configurable styling
 * - Optional icon display
 * - Delete and edit action buttons with hover reveal
 * - Dark/light mode support
 * - Mobile responsive
 *
 * @param root0
 * @param root0.code
 * @param root0.codeVariant
 * @param root0.codeColor
 * @param root0.name
 * @param root0.date
 * @param root0.comment
 * @param root0.secondaryInfo
 * @param root0.variant
 * @param root0.icon
 * @param root0.onDelete
 * @param root0.onEdit
 * @param root0.deleteDisabled
 * @param root0.deleteTooltip
 * @param root0.editTooltip
 * @param root0.compact
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // ICD10 diagnosis
 * <EMRDataItem
 *   code="J18.9"
 *   codeVariant="icd10"
 *   name="Pneumonia, unspecified organism"
 *   date="2024"
 *   variant="primary"
 *   onDelete={() => handleDelete(id)}
 * />
 *
 * // Drug allergy
 * <EMRDataItem
 *   code="Penicillin"
 *   name="Severe allergic reaction"
 *   comment="Anaphylaxis risk"
 *   variant="warning"
 *   icon={IconPill}
 *   onDelete={() => handleDelete(id)}
 * />
 * ```
 */
export function EMRDataItem({
  code,
  codeVariant = 'icd10',
  codeColor,
  name,
  date,
  comment,
  secondaryInfo,
  variant = 'primary',
  icon: IconComponent,
  onDelete,
  onEdit,
  deleteDisabled = false,
  deleteTooltip,
  editTooltip,
  compact = false,
  'data-testid': dataTestId = 'emr-data-item',
}: EMRDataItemProps): React.ReactElement {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Select theme-appropriate maps
  const variantAccentMap = isDark ? variantAccentMapDark : variantAccentMapLight;
  const variantIconGradientMap = isDark ? variantIconGradientMapDark : variantIconGradientMapLight;
  const variantColor = variantColorMap[variant];

  // Get container class (hover controlled by CSS)
  const containerClass = `${classes.dataItem} ${isDark ? classes.dataItemDark : classes.dataItemLight}`;

  // Inline style for padding only (no hover-dependent styles)
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    padding: compact ? '8px 12px' : '12px 16px',
  };

  // Get icon container styles
  const getIconStyles = (): React.CSSProperties => {
    const size = compact ? 28 : 32;
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '8px',
      background: variantIconGradientMap[variant],
      border: isDark
        ? '1px solid var(--emr-glass-border)'
        : '1px solid var(--emr-accent-transparent)',
      color: variantColor,
      flexShrink: 0,
    };
  };

  const hasActions = onDelete || onEdit;

  return (
    <Box
      className={containerClass}
      style={containerStyle}
      data-testid={dataTestId}
      data-variant={variant}
    >
      {/* Left accent stripe */}
      <Box
        className={classes.accentStripe}
        style={{
          background: variantAccentMap[variant],
        }}
      />

      {/* Main content */}
      <Box className={classes.content} pl="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          {/* Left side: Icon + Code + Name */}
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {/* Optional icon */}
            {IconComponent && (
              <Box style={getIconStyles()}>
                <IconComponent size={compact ? 14 : 16} />
              </Box>
            )}

            {/* Code + Name stack */}
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              {/* Code badge + Name row */}
              <Group gap="sm" wrap="nowrap">
                {code && (
                  <EMRCodeBadge
                    code={code}
                    variant={codeVariant}
                    color={codeColor}
                    size={compact ? 'xs' : 'sm'}
                  />
                )}
                <Text
                  fw={600}
                  size={compact ? 'sm' : 'md'}
                  className={classes.nameText}
                  lineClamp={2}
                >
                  {name}
                </Text>
              </Group>

              {/* Metadata row (date + secondary info) */}
              {(date || secondaryInfo) && (
                <Group gap="md" className={classes.metaRow}>
                  {date && (
                    <Text size="xs" c="dimmed">
                      {date}
                    </Text>
                  )}
                  {secondaryInfo && (
                    <Text size="xs" c="dimmed">
                      {secondaryInfo}
                    </Text>
                  )}
                </Group>
              )}

              {/* Doctor comment - separate section for readability */}
              {comment && (
                <Box className={classes.commentSection}>
                  <Text size="sm" lineClamp={4}>
                    {comment}
                  </Text>
                </Box>
              )}
            </Stack>
          </Group>

          {/* Right side: Action buttons */}
          {hasActions && (
            <Group
              gap={4}
              className={classes.actions}
            >
              {onEdit && (
                <Tooltip label={editTooltip || 'Edit'} position="top" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    size={compact ? 24 : 28}
                    onClick={onEdit}
                    aria-label={editTooltip || 'Edit'}
                  >
                    <IconEdit size={compact ? 14 : 16} />
                  </ActionIcon>
                </Tooltip>
              )}
              {onDelete && (
                <EMRDeleteButton
                  onClick={onDelete}
                  disabled={deleteDisabled}
                  size={compact ? 'sm' : 'md'}
                  tooltip={deleteTooltip}
                />
              )}
            </Group>
          )}
        </Group>
      </Box>
    </Box>
  );
}

export default EMRDataItem;
