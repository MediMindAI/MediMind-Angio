// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useCallback } from 'react';
import { Box, Group, Text, Collapse, UnstyledButton, useMantineColorScheme } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { SEMANTIC_COLORS, THEME_COLORS } from '../../constants/theme-colors';
import './EMRAssessmentCard.css';

export type EMRAssessmentCardVariant = 'default' | 'health' | 'warning' | 'risk' | 'info';

export interface EMRAssessmentCardProps {
  /** Icon component from @tabler/icons-react */
  icon: ComponentType<{ size?: number; stroke?: number }>;
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Children content */
  children: ReactNode;
  /** Card variant determines accent color */
  variant?: EMRAssessmentCardVariant;
  /** Whether the card is collapsible */
  collapsible?: boolean;
  /** Whether the card is expanded by default */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Optional header action (right side) */
  headerAction?: ReactNode;
  /** Whether to show the status indicator dot */
  showStatusDot?: boolean;
  /** Custom status dot color (overrides variant) */
  statusDotColor?: string;
  /**
   * Flat mode — removes card chrome (border, shadow, gradient header,
   * left accent line, icon background). Used inside the Unified Clinical
   * Form where the modal itself is the only enclosure and nested sections
   * must read as document blocks, not cards.
   */
  flat?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRAssessmentCard - Premium card component for behavioral/clinical assessments
 *
 * Features:
 * - Semantic color variants (health, warning, risk, info)
 * - Collapsible content with smooth animations
 * - Status indicator dot
 * - Header actions slot
 * - Light/dark mode support
 *
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.subtitle
 * @param root0.children
 * @param root0.variant
 * @param root0.collapsible
 * @param root0.defaultExpanded
 * @param root0.expanded
 * @param root0.onExpandChange
 * @param root0.headerAction
 * @param root0.showStatusDot
 * @param root0.statusDotColor
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRAssessmentCard
 *   icon={IconSmoking}
 *   title="Tobacco / Smoking"
 *   variant="health"
 *   collapsible
 *   defaultExpanded
 * >
 *   <StatusSelector ... />
 *   <FormFields ... />
 * </EMRAssessmentCard>
 * ```
 */
export function EMRAssessmentCard({
  icon: Icon,
  title,
  subtitle,
  children,
  variant = 'default',
  collapsible = false,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandChange,
  headerAction,
  showStatusDot = false,
  statusDotColor,
  flat = false,
  'data-testid': dataTestId,
}: EMRAssessmentCardProps): React.JSX.Element {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (collapsible) {
      if (isControlled) {
        onExpandChange?.(!controlledExpanded);
      } else {
        setInternalExpanded(prev => !prev);
      }
    }
  }, [collapsible, isControlled, controlledExpanded, onExpandChange]);

  // Get variant-specific colors - uses theme-consistent colors
  const getVariantColors = () => {
    switch (variant) {
      case 'health':
        return {
          accentColor: isDark ? SEMANTIC_COLORS.successLight : SEMANTIC_COLORS.success,
          accentBg: isDark ? 'rgba(56, 161, 105, 0.1)' : 'rgba(56, 161, 105, 0.08)',
          iconBg: isDark ? 'rgba(56, 161, 105, 0.15)' : 'rgba(56, 161, 105, 0.12)',
          borderColor: isDark ? 'rgba(56, 161, 105, 0.2)' : 'rgba(56, 161, 105, 0.15)',
        };
      case 'warning':
        return {
          accentColor: isDark ? SEMANTIC_COLORS.warningLight : SEMANTIC_COLORS.warning,
          accentBg: isDark ? 'rgba(221, 107, 32, 0.1)' : 'rgba(221, 107, 32, 0.08)',
          iconBg: isDark ? 'rgba(221, 107, 32, 0.15)' : 'rgba(221, 107, 32, 0.12)',
          borderColor: isDark ? 'rgba(221, 107, 32, 0.2)' : 'rgba(221, 107, 32, 0.15)',
        };
      case 'risk':
        return {
          accentColor: isDark ? SEMANTIC_COLORS.errorLight : SEMANTIC_COLORS.error,
          accentBg: isDark ? 'rgba(229, 62, 62, 0.1)' : 'rgba(229, 62, 62, 0.08)',
          iconBg: isDark ? 'rgba(229, 62, 62, 0.15)' : 'rgba(229, 62, 62, 0.12)',
          borderColor: isDark ? 'rgba(229, 62, 62, 0.2)' : 'rgba(229, 62, 62, 0.15)',
        };
      case 'info':
        return {
          accentColor: isDark ? THEME_COLORS.accent : THEME_COLORS.secondary,
          accentBg: isDark ? 'rgba(43, 108, 176, 0.1)' : 'rgba(43, 108, 176, 0.08)',
          iconBg: isDark ? 'rgba(43, 108, 176, 0.15)' : 'rgba(43, 108, 176, 0.12)',
          borderColor: isDark ? 'rgba(43, 108, 176, 0.2)' : 'rgba(43, 108, 176, 0.15)',
        };
      default:
        return {
          accentColor: THEME_COLORS.secondary,
          accentBg: isDark ? 'rgba(43, 108, 176, 0.1)' : 'rgba(43, 108, 176, 0.08)',
          iconBg: isDark ? 'rgba(43, 108, 176, 0.15)' : 'rgba(43, 108, 176, 0.12)',
          borderColor: isDark ? 'rgba(43, 108, 176, 0.2)' : 'rgba(43, 108, 176, 0.15)',
        };
    }
  };

  const colors = getVariantColors();
  const dotColor = statusDotColor || colors.accentColor;

  return (
    <Box
      className={`emr-assessment-card ${isDark ? 'dark' : ''} ${isExpanded ? 'expanded' : ''} ${flat ? 'flat' : ''}`}
      data-testid={dataTestId}
      style={{
        '--assessment-accent-color': colors.accentColor,
        '--assessment-accent-bg': colors.accentBg,
        '--assessment-icon-bg': colors.iconBg,
        '--assessment-border-color': colors.borderColor,
      } as React.CSSProperties}
    >
      {/* Left accent line — hidden in flat mode via CSS */}
      {!flat && <div className="emr-assessment-card-accent" />}

      {/* Header */}
      <div className="emr-assessment-card-header">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          {collapsible && (
            <UnstyledButton
              onClick={handleToggle}
              className="emr-assessment-card-toggle"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              <div className={`emr-assessment-card-toggle-icon ${isExpanded ? 'expanded' : ''}`}>
                {isExpanded ? (
                  <IconChevronDown size={14} stroke={2} />
                ) : (
                  <IconChevronRight size={14} stroke={2} />
                )}
              </div>
            </UnstyledButton>
          )}

          <div className="emr-assessment-card-icon-wrapper">
            <Icon size={18} stroke={1.5} />
          </div>

          <div className="emr-assessment-card-title-group">
            <Group gap={8} align="center">
              <Text className="emr-assessment-card-title">
                {title}
              </Text>
              {showStatusDot && (
                <span
                  className="emr-assessment-card-status-dot"
                  style={{ backgroundColor: dotColor }}
                  role="img"
                  aria-label={variant === 'health' ? 'Healthy status' : variant === 'warning' ? 'Warning status' : variant === 'risk' ? 'Risk status' : 'Status indicator'}
                />
              )}
            </Group>
            {subtitle && (
              <Text className="emr-assessment-card-subtitle">
                {subtitle}
              </Text>
            )}
          </div>
        </Group>

        {headerAction && (
          <div className="emr-assessment-card-action" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>

      {/* Content */}
      {collapsible ? (
        <Collapse in={isExpanded} transitionDuration={200}>
          <div className="emr-assessment-card-content">
            {children}
          </div>
        </Collapse>
      ) : (
        <div className="emr-assessment-card-content">
          {children}
        </div>
      )}
    </Box>
  );
}

export default EMRAssessmentCard;
