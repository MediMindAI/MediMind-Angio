// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRViewToggle - Reusable view mode toggle component
 *
 * Provides a styled toggle for switching between table/grid or list/card views.
 * Uses the EMR design system with gradient styling.
 */

import { Box, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconList, IconLayoutGrid } from '@tabler/icons-react';
import { useState, type ComponentType } from 'react';

interface IconProps {
  size?: number | string;
  stroke?: number;
}

export type EMRViewMode = 'table' | 'grid' | 'list' | 'card';

export interface EMRViewToggleOption {
  value: string;
  icon?: ComponentType<IconProps>;
  label?: string;
}

export interface EMRViewToggleProps {
  value: string;
  onChange: (value: string) => void;
  options?: EMRViewToggleOption[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  /**
   * Force labels to render at ALL widths, ignoring the mobile breakpoint that
   * normally hides them below 768px. Required for label-only SegmentedControl
   * conversions (options with no `icon`), which would otherwise render EMPTY
   * buttons on phones. Default false (current icon+label behavior).
   */
  alwaysShowLabels?: boolean;
  /**
   * Adds a soft drop-shadow + slightly stronger border so the control reads as
   * a primary navigation affordance. Opt-in so existing inline usages are
   * unchanged. Default false.
   */
  elevated?: boolean;
  /** Disable the whole control (no segment is clickable). Default false. */
  disabled?: boolean;
  /** Stretch the control to fill its parent width, segments sharing it equally. Default false. */
  fullWidth?: boolean;
  /** Passthrough class on the root container. */
  className?: string;
  'data-testid'?: string;
}

const DEFAULT_OPTIONS: EMRViewToggleOption[] = [
  { value: 'table', icon: IconList, label: 'Table' },
  { value: 'grid', icon: IconLayoutGrid, label: 'Grid' },
];

export function EMRViewToggle({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'sm',
  showLabels = true,
  alwaysShowLabels = false,
  elevated = false,
  disabled = false,
  fullWidth = false,
  className,
  'data-testid': dataTestId = 'emr-view-toggle',
}: EMRViewToggleProps): React.ReactElement {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const showLabel = showLabels && (alwaysShowLabels || !isMobile);
  // Track hover per-segment so inactive segments get a clear affordance.
  const [hovered, setHovered] = useState<string | null>(null);

  const padding = size === 'xs' ? '4px 10px' : size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 28px' : '9px 20px';
  const iconSize = size === 'xs' ? 14 : size === 'sm' ? 15 : size === 'lg' ? 19 : 17;
  const fontSize = size === 'xs' ? 'var(--emr-font-xs)' : size === 'lg' ? 'var(--emr-font-md)' : size === 'md' ? 'var(--emr-font-base)' : 'var(--emr-font-sm)';
  const isLg = size === 'lg';

  return (
    <Box
      data-testid={dataTestId}
      className={className}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        borderRadius: '12px',
        padding: isLg ? '4px' : '3px',
        background: 'var(--emr-bg-page)',
        border: elevated ? '1px solid var(--emr-border-default)' : '1px solid var(--emr-border-color)',
        boxShadow: elevated ? 'var(--emr-shadow-sm)' : 'none',
        opacity: disabled ? 0.6 : undefined,
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const isHovered = !disabled && !isActive && hovered === option.value;
        return (
          <UnstyledButton
            key={option.value}
            disabled={disabled}
            onClick={() => !disabled && onChange(option.value)}
            onMouseEnter={() => setHovered(option.value)}
            onMouseLeave={() => setHovered((h) => (h === option.value ? null : h))}
            data-testid={`${dataTestId}-${option.value}`}
            style={{
              display: 'flex',
              flex: fullWidth ? 1 : undefined,
              alignItems: 'center',
              justifyContent: 'center',
              gap: isLg ? '8px' : '6px',
              padding,
              borderRadius: isLg ? '9px' : '8px',
              fontSize,
              fontWeight: 'var(--emr-font-semibold)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              ...(isActive
                ? {
                    background: 'var(--emr-gradient-primary)',
                    color: 'var(--emr-text-inverse)',
                    boxShadow: '0 2px 6px rgba(43, 108, 176, 0.35)',
                  }
                : {
                    // Legible inactive segment (not washed-out tertiary), with a
                    // soft hover background so it clearly reads as clickable.
                    background: isHovered ? 'var(--emr-bg-hover)' : 'transparent',
                    color: isHovered ? 'var(--emr-text-primary)' : 'var(--emr-text-secondary)',
                  }),
            }}
          >
            {option.icon && <option.icon size={iconSize} />}
            {showLabel && option.label && <span>{option.label}</span>}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

export default EMRViewToggle;
