// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Box, Stack, Text, UnstyledButton } from '@mantine/core';
import type { ComponentType } from 'react';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

export interface EMRTabHeaderProps {
  /** Icon component to display */
  icon: ComponentType<IconProps>;
  /** Tab title text */
  title: string;
  /** Count/badge number to display (hidden when undefined) */
  count?: number;
  /** Whether this tab is active */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional badge color for variants (e.g., 'blue', 'teal', 'violet') */
  badgeColor?: string;
  /** Optional subtitle text displayed below the title (e.g., "Level 1") */
  subtitle?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRTabHeader - Reusable tab header component for section navigation
 *
 * Features:
 * - PartnersTab-style visual design
 * - Blue/teal gradient on active state
 * - Gray background on inactive state
 * - Icon box with appropriate background
 * - Badge showing count
 * - Chevron indicator (down when active, right when inactive)
 * - Hover effects with elevation
 * - Uses theme CSS variables for all styling
 *
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.count
 * @param root0.active
 * @param root0.onClick
 * @param root0.badgeColor
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRTabHeader
 *   icon={IconUsers}
 *   title="Suppliers"
 *   count={495}
 *   active={activeSection === 'suppliers'}
 *   onClick={() => setActiveSection('suppliers')}
 *   badgeColor="blue"
 * />
 * ```
 */
export function EMRTabHeader({
  icon: Icon,
  title,
  count,
  active = false,
  onClick,
  badgeColor = 'blue',
  subtitle,
  'data-testid': dataTestId = 'emr-tab-header',
}: EMRTabHeaderProps): React.ReactElement {
  return (
    <UnstyledButton
      onClick={onClick}
      data-testid={dataTestId}
      data-active={active}
      style={{
        padding: 'var(--emr-spacing-md) var(--emr-spacing-lg)',
        background: active ? 'var(--emr-gradient-secondary)' : 'var(--emr-bg-card)',
        border: active ? '2px solid var(--emr-primary)' : '2px solid var(--emr-border-color)',
        borderRadius: 'var(--emr-border-radius-lg)',
        cursor: 'pointer',
        transition: 'var(--emr-transition-base)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: active ? 'var(--emr-shadow-lg)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--emr-bg-page)';
          e.currentTarget.style.borderColor = 'var(--emr-secondary)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--emr-shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--emr-bg-card)';
          e.currentTarget.style.borderColor = 'var(--emr-border-color)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Bottom accent line for active state */}
      <Box
        data-testid={`${dataTestId}-accent`}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: active ? 'var(--emr-accent)' : 'transparent',
          transition: 'var(--emr-transition-base)',
        }}
      />

      {/* Content: Icon → Title → Badge (vertical stack) */}
      <Stack gap={6} align="center" data-testid={`${dataTestId}-content`}>
        {/* Icon Container */}
        <Box
          data-testid={`${dataTestId}-icon`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: active
              ? 'rgba(255, 255, 255, 0.25)'
              : 'var(--emr-gradient-secondary)',
            backdropFilter: active ? 'blur(4px)' : 'none',
            boxShadow: active
              ? 'none'
              : '0 0 15px rgba(99, 179, 237, 0.4), 0 0 30px rgba(99, 179, 237, 0.2)',
            transition: 'var(--emr-transition-base)',
          }}
        >
          <Icon
            size={20}
            color="white"
          />
        </Box>

        {/* Title + Subtitle */}
        <Box style={{ textAlign: 'center' }}>
          <Text
            fw={600}
            size="sm"
            data-testid={`${dataTestId}-title`}
            style={{
              color: active ? 'white' : 'var(--emr-text-primary)',
              transition: 'var(--emr-transition-base)',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              size="xs"
              data-testid={`${dataTestId}-subtitle`}
              style={{
                color: active ? 'rgba(255,255,255,0.7)' : 'var(--emr-text-secondary)',
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          )}
        </Box>

        {/* Badge — only show when count is defined */}
        {count != null && (
          <Badge
            variant="light"
            color={badgeColor}
            size="lg"
            radius="xl"
            data-testid={`${dataTestId}-badge`}
            style={{
              background: active ? 'var(--emr-bg-card)' : 'var(--emr-glass-white-90)',
              color: active ? 'var(--emr-primary)' : 'var(--emr-text-primary)',
              fontWeight: 'var(--emr-font-bold)',
              border: active ? 'none' : '1px solid var(--emr-border-color)',
              boxShadow: active ? 'var(--emr-shadow-sm)' : 'none',
            }}
          >
            {count.toLocaleString()}
          </Badge>
        )}
      </Stack>
    </UnstyledButton>
  );
}
