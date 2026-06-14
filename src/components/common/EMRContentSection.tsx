// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Paper, Box, Group, Text, UnstyledButton, Collapse, Skeleton, Stack, useMantineColorScheme } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { ReactNode, ComponentType } from 'react';
import { useState, memo, useMemo } from 'react';
import styles from './EMRContentSection.module.css';

export interface EMRContentSectionProps {
  /** Section title */
  title?: string;
  /** Optional subtitle/description shown under the title in the slim header */
  subtitle?: string;
  /** Optional icon component from @tabler/icons-react */
  icon?: ComponentType<{ size?: number; color?: string }>;
  /** Optional actions to display in header */
  headerActions?: ReactNode;
  /** Children content */
  children?: ReactNode;
  /** Whether section can be collapsed (default: false) */
  collapsible?: boolean;
  /** Whether section is expanded by default (default: true) */
  defaultExpanded?: boolean;
  /** Whether to show left accent border (default: true for premium look) */
  showAccent?: boolean;
  /** Custom padding (default: 'lg') */
  padding?: string | number;
  /** Empty state message when no children */
  emptyStateMessage?: string;
  /** Whether to show loading skeleton (default: false) */
  loading?: boolean;
  /** Variant for different visual styles */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Test id for the section container (defaults to 'emr-content-section') */
  'data-testid'?: string;
}

/**
 * EMRContentSection - Standardized content section component
 *
 * Features:
 * - Optional header with title, icon, and actions
 * - Collapsible content with smooth animations
 * - Loading skeleton state
 * - Empty state support
 * - Left accent border
 * - Consistent theming
 *
 * @param root0
 * @param root0.title
 * @param root0.icon
 * @param root0.headerActions
 * @param root0.children
 * @param root0.collapsible
 * @param root0.defaultExpanded
 * @param root0.showAccent
 * @param root0.padding
 * @param root0.emptyStateMessage
 * @param root0.loading
 * @param root0.variant
 * @example
 * ```tsx
 * <EMRContentSection
 *   title="Patient Information"
 *   icon={IconUser}
 *   headerActions={<Button size="sm">Edit</Button>}
 *   collapsible
 *   showAccent
 * >
 *   <Stack gap="md">
 *     <TextInput label="Name" />
 *     <TextInput label="Email" />
 *   </Stack>
 * </EMRContentSection>
 * ```
 */
export const EMRContentSection = memo(function EMRContentSection({
  title,
  subtitle,
  icon: Icon,
  headerActions,
  children,
  collapsible = false,
  defaultExpanded = true,
  showAccent = true,
  padding = 'lg',
  emptyStateMessage,
  loading = false,
  variant = 'default',
  'data-testid': dataTestId = 'emr-content-section',
}: EMRContentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const hasHeader = title || subtitle || Icon || headerActions;
  const hasChildren = Boolean(children);
  const showEmptyState = !hasChildren && emptyStateMessage && !loading;

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded((prev) => !prev);
    }
  };

  // Build CSS class for container based on theme and variant (memoized)
  const containerClass = useMemo((): string => {
    const classes = [styles.container];
    if (isDark) {
      switch (variant) {
        case 'elevated':
          classes.push(styles.darkElevated);
          break;
        case 'outlined':
          classes.push(styles.darkOutlined);
          break;
        default:
          classes.push(styles.darkDefault);
      }
    } else {
      switch (variant) {
        case 'elevated':
          classes.push(styles.lightElevated);
          break;
        case 'outlined':
          classes.push(styles.lightOutlined);
          break;
        default:
          classes.push(styles.lightDefault);
      }
    }
    return classes.join(' ');
  }, [isDark, variant]);

  // Command identity: slim header row — no full-width tinted band, just a
  // hairline separator from the body when there is content below.
  const headerStyles = useMemo((): React.CSSProperties => ({
    background: 'transparent',
    borderBottom: hasChildren && !collapsible
      ? '1px solid var(--emr-bg-hover)'
      : 'none',
  }), [hasChildren, collapsible]);

  // Command identity: 4×15px gradient tick bar before the title (replaces the
  // old boxed icon container + left accent rail).
  const tickBarStyle = useMemo((): React.CSSProperties => ({
    width: '4px',
    height: '15px',
    borderRadius: '2px',
    background: 'var(--emr-gradient-primary)',
    flexShrink: 0,
    // Nudge onto the title's first line when the header is top-aligned (so the
    // tick bar reads against the title even when a subtitle stacks below).
    marginTop: '4px',
  }), []);

  // Inline small icon, colored (no boxed container).
  const inlineIconStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--emr-secondary)',
    flexShrink: 0,
  }), []);

  const renderContent = () => {
    if (loading) {
      return (
        <Stack gap="md" data-testid="emr-content-section-skeleton">
          <Skeleton height={20} radius="sm" />
          <Skeleton height={20} radius="sm" />
          <Skeleton height={20} width="70%" radius="sm" />
        </Stack>
      );
    }

    if (showEmptyState) {
      return (
        <Box
          py="xl"
          data-testid="emr-content-section-empty"
          style={{
            textAlign: 'center',
            background: 'var(--emr-bg-hover)',
            borderRadius: '10px',
            border: '1px dashed var(--emr-border-color)',
          }}
        >
          <Text c="var(--emr-text-secondary)" size="sm" fw={500}>
            {emptyStateMessage}
          </Text>
        </Box>
      );
    }

    return <Box data-testid="emr-content-section-content">{children}</Box>;
  };

  return (
    <Paper
      shadow={undefined}
      radius={0}
      p={0}
      data-testid={dataTestId}
      className={containerClass}
    >
      {/* Command identity: slim gradient top ribbon (replaces old left rail).
          Inset 12px on each side + matching top radius so it sits cleanly
          inside the deck's rounded corners without overflow clipping. */}
      {showAccent && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: '12px',
            right: '12px',
            height: '3px',
            background: 'var(--emr-gradient-primary)',
            borderRadius: '0 0 2px 2px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header */}
      {hasHeader && (
        <Box
          p={padding}
          pb={hasChildren ? 'sm' : padding}
          data-testid="emr-content-section-header"
          style={headerStyles}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            {/* Title area */}
            <Group gap="sm" align="flex-start">
              {/* Gradient tick bar before the title */}
              {title && <Box style={tickBarStyle} />}
              {collapsible && (
                <UnstyledButton
                  onClick={toggleExpanded}
                  data-testid="emr-content-section-collapse"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      background: isExpanded
                        ? 'var(--emr-selected-bg)'
                        : 'var(--emr-bg-input)',
                      border: isExpanded ? '1px solid var(--emr-selected-border)' : '1px solid var(--emr-border-color)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isExpanded ? (
                      <IconChevronDown size={14} style={{ color: 'var(--emr-secondary)' }} />
                    ) : (
                      <IconChevronRight size={14} style={{ color: 'var(--emr-text-secondary)' }} />
                    )}
                  </Box>
                </UnstyledButton>
              )}

              {Icon && (
                <Box
                  data-testid="emr-content-section-icon"
                  style={inlineIconStyle}
                >
                  <Icon size={18} />
                </Box>
              )}

              {(title || subtitle) && (
                <Stack gap={2}>
                  {title && (
                    <Text
                      fw={600}
                      size="md"
                      data-testid="emr-content-section-title"
                      style={{
                        color: 'var(--emr-text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text
                      size="sm"
                      data-testid="emr-content-section-subtitle"
                      style={{ color: 'var(--emr-text-secondary)', lineHeight: 1.35 }}
                    >
                      {subtitle}
                    </Text>
                  )}
                </Stack>
              )}
            </Group>

            {/* Header actions */}
            {headerActions && (
              <Box data-testid="emr-content-section-actions" style={{ flexShrink: 0 }}>
                {headerActions}
              </Box>
            )}
          </Group>
        </Box>
      )}

      {/* Content */}
      {collapsible ? (
        <Collapse in={isExpanded} transitionDuration={200} transitionTimingFunction="ease">
          <Box p={padding} pt={hasHeader ? 'md' : padding}>
            {renderContent()}
          </Box>
        </Collapse>
      ) : (
        <Box p={padding} pt={hasHeader ? 'md' : padding}>
          {renderContent()}
        </Box>
      )}
    </Paper>
  );
});
