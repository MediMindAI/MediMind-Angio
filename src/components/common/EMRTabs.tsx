// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRTabs Component
 *
 * A standardized tab navigation component with icon support, animated underline indicator,
 * and seamless dark/light mode integration.
 *
 * @example
 * ```tsx
 * <EMRTabs value={activeTab} onChange={setActiveTab}>
 *   <EMRTabs.List>
 *     <EMRTabs.Tab value="overview" icon={IconChartPie}>Overview</EMRTabs.Tab>
 *     <EMRTabs.Tab value="details" icon={IconList}>Details</EMRTabs.Tab>
 *   </EMRTabs.List>
 *   <EMRTabs.Panel value="overview">Overview content</EMRTabs.Panel>
 *   <EMRTabs.Panel value="details">Details content</EMRTabs.Panel>
 * </EMRTabs>
 * ```
 */

import React, { createContext, useContext, useCallback, useMemo, type ComponentType, type ReactNode } from 'react';
import { Box, UnstyledButton, Text } from '@mantine/core';
import styles from './EMRTabs.module.css';

// ============================================================================
// Types
// ============================================================================

export type EMRTabsVariant = 'default' | 'pills' | 'outline';
export type EMRTabsSize = 'sm' | 'md' | 'lg';

export interface EMRTabsProps {
  /** Currently active tab value */
  value: string | null;
  /** Callback when tab changes */
  onChange: (value: string | null) => void;
  /** Tab content (List and Panels) */
  children: ReactNode;
  /** Visual variant */
  variant?: EMRTabsVariant;
  /** Size of tabs */
  size?: EMRTabsSize;
  /** Allow deselecting tabs */
  allowDeselect?: boolean;
  /** Full width tabs that stretch to fill container */
  grow?: boolean;
  /** Custom className for the root element */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

export interface EMRTabsListProps {
  /** Tab elements */
  children: ReactNode;
  /** Position of the tab list */
  position?: 'left' | 'center' | 'right' | 'apart';
  /** Custom className */
  className?: string;
}

export interface EMRTabsTabProps {
  /** Unique value for the tab */
  value: string;
  /** Tab label */
  children: ReactNode;
  /** Icon component to show before label */
  icon?: ComponentType<{ size?: number; stroke?: number }>;
  /** Disable this tab */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Badge/count to show */
  badge?: ReactNode;
}

export interface EMRTabsPanelProps {
  /** Value that matches the tab */
  value: string;
  /** Panel content */
  children: ReactNode;
  /** Padding top for the panel */
  pt?: string | number;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

interface EMRTabsContextValue {
  value: string | null;
  onChange: (value: string | null) => void;
  variant: EMRTabsVariant;
  size: EMRTabsSize;
  allowDeselect: boolean;
  grow: boolean;
}

const EMRTabsContext = createContext<EMRTabsContextValue | null>(null);

function useEMRTabsContext(): EMRTabsContextValue {
  const context = useContext(EMRTabsContext);
  if (!context) {
    throw new Error('EMRTabs components must be used within EMRTabs');
  }
  return context;
}

// ============================================================================
// Size Configurations
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    height: 36,
    iconSize: 14,
    fontSize: 'var(--emr-font-sm)',
    padding: '0 12px',
    gap: 6,
  },
  md: {
    height: 42,
    iconSize: 16,
    fontSize: 'var(--emr-font-base)',
    padding: '0 16px',
    gap: 8,
  },
  lg: {
    height: 48,
    iconSize: 18,
    fontSize: 'var(--emr-font-md)',
    padding: '0 20px',
    gap: 10,
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * EMRTabs.List - Container for tab buttons
 */
function EMRTabsList({ children, position = 'left', className }: EMRTabsListProps): React.JSX.Element {
  const { grow } = useEMRTabsContext();

  const justifyContent = useMemo(() => {
    switch (position) {
      case 'center':
        return 'center';
      case 'right':
        return 'flex-end';
      case 'apart':
        return 'space-between';
      default:
        return 'flex-start';
    }
  }, [position]);

  return (
    <Box
      className={`${styles.list} ${className ?? ''}`}
      style={{ justifyContent }}
      role="tablist"
      data-grow={grow || undefined}
    >
      {children}
    </Box>
  );
}

/**
 * EMRTabs.Tab - Individual tab button
 */
function EMRTabsTab({
  value,
  children,
  icon: Icon,
  disabled,
  className,
  badge,
}: EMRTabsTabProps): React.JSX.Element {
  const { value: activeValue, onChange, variant, size, allowDeselect, grow } = useEMRTabsContext();
  const isActive = activeValue === value;
  const config = SIZE_CONFIG[size];

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isActive && allowDeselect) {
      onChange(null);
    } else if (!isActive) {
      onChange(value);
    }
  }, [disabled, isActive, allowDeselect, onChange, value]);

  const variantClass = styles[`tab--${variant}`] ?? '';
  const activeClass = isActive ? (styles['tab--active'] ?? '') : '';
  const disabledClass = disabled ? (styles['tab--disabled'] ?? '') : '';

  return (
    <UnstyledButton
      className={`${styles.tab} ${variantClass} ${activeClass} ${disabledClass} ${className ?? ''}`}
      onClick={handleClick}
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      data-active={isActive || undefined}
      data-grow={grow || undefined}
      style={{
        height: config.height,
        padding: config.padding,
        fontSize: config.fontSize,
        gap: config.gap,
      }}
    >
      {Icon && (
        <Icon size={config.iconSize} stroke={1.5} />
      )}
      <Text component="span" className={styles.tabLabel}>
        {children}
      </Text>
      {badge && (
        <span className={styles.tabBadge}>{badge}</span>
      )}
      {variant === 'default' && (
        <span className={styles.indicator} aria-hidden="true" />
      )}
    </UnstyledButton>
  );
}

/**
 * EMRTabs.Panel - Content panel for a tab
 */
function EMRTabsPanel({
  value,
  children,
  pt = 'md',
  className,
}: EMRTabsPanelProps): React.JSX.Element | null {
  const { value: activeValue } = useEMRTabsContext();
  const isActive = activeValue === value;

  if (!isActive) {
    return null;
  }

  const paddingTop = typeof pt === 'number' ? pt : pt === 'md' ? 16 : pt === 'lg' ? 24 : pt === 'sm' ? 8 : pt === 'xs' ? 4 : 16;

  return (
    <Box
      className={`${styles.panel} ${className ?? ''}`}
      role="tabpanel"
      style={{ paddingTop }}
    >
      {children}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * EMRTabs Component
 *
 * A standardized tab navigation component with icon support and consistent styling.
 */
function EMRTabsRoot({
  value,
  onChange,
  children,
  variant = 'default',
  size = 'md',
  allowDeselect = false,
  grow = false,
  className,
  'data-testid': testId,
}: EMRTabsProps): React.JSX.Element {
  const contextValue = useMemo<EMRTabsContextValue>(
    () => ({
      value,
      onChange,
      variant,
      size,
      allowDeselect,
      grow,
    }),
    [value, onChange, variant, size, allowDeselect, grow]
  );

  return (
    <EMRTabsContext.Provider value={contextValue}>
      <Box className={`${styles.root} ${className ?? ''}`} data-testid={testId}>
        {children}
      </Box>
    </EMRTabsContext.Provider>
  );
}

// ============================================================================
// Compound Component Export
// ============================================================================

export const EMRTabs = Object.assign(EMRTabsRoot, {
  List: EMRTabsList,
  Tab: EMRTabsTab,
  Panel: EMRTabsPanel,
});

export default EMRTabs;
