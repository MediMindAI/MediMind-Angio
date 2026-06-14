// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from 'react';
import { Box, Menu } from '@mantine/core';
import {
  IconDoor,
  IconBed,
  IconChevronDown,
  IconDotsVertical,
} from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import styles from './EMRRoomCard.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

/** Bed status counts for the summary */
export interface EMRBedStatusCounts {
  available: number;
  occupied: number;
  cleaning: number;
  reserved: number;
  outOfService: number;
}

/** Quick action item */
export interface EMRRoomQuickAction {
  key: string;
  label: string;
  icon?: ComponentType<IconProps>;
  onClick: () => void;
  disabled?: boolean;
  color?: 'red' | 'yellow' | 'blue' | 'green';
}

/** Capacity configuration */
export interface EMRRoomCapacity {
  /** Number of used beds */
  used: number;
  /** Total bed capacity */
  total: number;
}

export interface EMRRoomCardProps {
  /** Icon component for the room */
  icon?: ComponentType<IconProps>;
  /** Room name/title */
  title: string;
  /** Subtitle (optional description) */
  subtitle?: string;
  /** Badge text (e.g., "WARD", "ICU") */
  badge?: string;
  /** Room capacity */
  capacity: EMRRoomCapacity;
  /** Capacity label (e.g., "საწოლი" for "bed") */
  capacityLabel?: string;
  /** Bed status counts for detailed summary */
  statusCounts?: EMRBedStatusCounts;
  /** Labels for bed status summary */
  statusLabels?: {
    available?: string;
    occupied?: string;
    cleaning?: string;
    reserved?: string;
    outOfService?: string;
  };
  /** Show occupancy progress bar */
  showOccupancyBar?: boolean;
  /** Quick actions menu items */
  quickActions?: EMRRoomQuickAction[];
  /** Children (bed cards) */
  children: ReactNode;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Called when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Loading state */
  loading?: boolean;
  /** Enable entrance animation */
  animated?: boolean;
  /** Animation delay index (0-9) for staggered animations */
  animationIndex?: number;
  /** Compact mode — smaller header, no icon, content rendered as list instead of grid */
  compact?: boolean;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * EMRRoomCard - Collapsible room card containing bed cards
 *
 * A container component for room information with expandable content area
 * for displaying bed cards. Features capacity indicator, badge, and
 * smooth expand/collapse animation.
 *
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.subtitle
 * @param root0.badge
 * @param root0.capacity
 * @param root0.capacityLabel
 * @param root0.children
 * @param root0.defaultExpanded
 * @param root0.expanded
 * @param root0.onExpandedChange
 * @param root0.loading
 * @param root0.animated
 * @param root0.animationIndex
 * @param root0.'data-testid'
 * @example
 * // Basic usage with bed cards
 * <EMRRoomCard
 *   title="ოთახი 101"
 *   badge="WARD"
 *   capacity={{ used: 2, total: 2 }}
 *   capacityLabel="საწოლი"
 *   defaultExpanded
 * >
 *   <EMRBedCard name="საწოლი 1" status="occupied" ... />
 *   <EMRBedCard name="საწოლი 2" status="available" ... />
 * </EMRRoomCard>
 *
 * @example
 * // With status counts and quick actions
 * <EMRRoomCard
 *   title="ოთახი 102"
 *   capacity={{ used: 3, total: 5 }}
 *   statusCounts={{ available: 2, occupied: 3, cleaning: 0, reserved: 0, outOfService: 0 }}
 *   showOccupancyBar
 *   quickActions={[
 *     { key: 'assign', label: 'Assign Patient', icon: IconUserPlus, onClick: handleAssign }
 *   ]}
 * >
 *   {beds}
 * </EMRRoomCard>
 *
 * @example
 * // Controlled expansion
 * const [expanded, setExpanded] = useState(false);
 * <EMRRoomCard
 *   title="ოთახი 102"
 *   capacity={{ used: 1, total: 3 }}
 *   expanded={expanded}
 *   onExpandedChange={setExpanded}
 * >
 *   {beds}
 * </EMRRoomCard>
 */
export function EMRRoomCard({
  icon: Icon = IconDoor,
  title,
  subtitle,
  badge,
  capacity,
  capacityLabel = 'beds',
  statusCounts,
  statusLabels,
  showOccupancyBar = false,
  quickActions,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  loading = false,
  animated = false,
  animationIndex = 0,
  compact = false,
  'data-testid': dataTestId = 'emr-room-card',
}: EMRRoomCardProps): React.JSX.Element {
  const { t } = useTranslation();
  // Handle controlled vs uncontrolled expansion
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const toggleExpanded = useCallback(() => {
    const newValue = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(newValue);
    }
    onExpandedChange?.(newValue);
  }, [isExpanded, controlledExpanded, onExpandedChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }, [toggleExpanded]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Check if room is at full capacity
  const isFull = capacity.used >= capacity.total;

  // Calculate occupancy percentage
  const occupancyPercent = capacity.total > 0
    ? Math.round((capacity.used / capacity.total) * 100)
    : 0;

  // Build class names
  const cardClasses = [
    styles.roomCard,
    isExpanded ? styles.expanded : '',
    loading ? styles.loading : '',
    animated ? styles.animated : '',
    animated && animationIndex >= 0 && animationIndex <= 9 ? styles[`delay${animationIndex}`] : '',
    compact ? styles.compact : '',
  ].filter(Boolean).join(' ');

  const capacityClasses = [
    styles.capacity,
    isFull ? styles.capacityFull : '',
  ].filter(Boolean).join(' ');

  // Get default status labels
  const defaultStatusLabels = {
    available: statusLabels?.available || 'Available',
    occupied: statusLabels?.occupied || 'Occupied',
    cleaning: statusLabels?.cleaning || 'Cleaning',
    reserved: statusLabels?.reserved || 'Reserved',
    outOfService: statusLabels?.outOfService || 'Out of Service',
  };

  return (
    <Box className={cardClasses} data-testid={dataTestId}>
      {/* Header - clickable to expand/collapse */}
      <Box
        className={styles.header}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${title}${badge ? ` - ${badge}` : ''} - ${capacity.used} / ${capacity.total} ${capacityLabel}`}
      >
        {/* Icon (hidden in compact mode) */}
        {!compact && (
          <Box className={styles.iconWrapper}>
            <Icon size={22} />
          </Box>
        )}

        {/* Room Info */}
        <Box className={styles.info}>
          <h3 className={styles.title}>{title}</h3>
          {!compact && subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </Box>

        {/* Badge */}
        {!compact && badge && <span className={styles.badge}>{badge}</span>}

        {/* Capacity Indicator with optional occupancy bar */}
        <Box className={styles.capacitySection}>
          <Box className={capacityClasses}>
            <IconBed size={16} className={styles.capacityIcon} />
            <span className={styles.capacityText}>
              {capacity.used} / {capacity.total} {capacityLabel}
            </span>
          </Box>

          {/* Occupancy Bar */}
          {showOccupancyBar && (
            <Box className={styles.occupancyBar} data-testid="occupancy-bar">
              <Box
                className={`${styles.occupancyFill} ${isFull ? styles.occupancyFull : ''}`}
                style={{ width: `${occupancyPercent}%` }}
              />
            </Box>
          )}
        </Box>

        {/* Quick Actions Menu */}
        {quickActions && quickActions.length > 0 && (
          <Box onClick={handleMenuClick} className={styles.actionsWrapper}>
            <Menu position="bottom-end" shadow="md" withinPortal>
              <Menu.Target>
                <button
                  className={styles.actionsButton}
                  aria-label={t('common.roomActions')}
                  type="button"
                >
                  <IconDotsVertical size={18} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                {quickActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Menu.Item
                      key={action.key}
                      leftSection={ActionIcon ? <ActionIcon size={16} /> : undefined}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      color={action.color}
                    >
                      {action.label}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          </Box>
        )}

        {/* Chevron */}
        <Box className={styles.chevron}>
          <IconChevronDown size={20} />
        </Box>
      </Box>

      {/* Status Summary Bar - shown when statusCounts provided */}
      {statusCounts && (
        <Box className={styles.statusSummary} data-testid="status-summary">
          {statusCounts.available > 0 && (
            <span className={`${styles.statusItem} ${styles.statusAvailable}`}>
              {statusCounts.available} {defaultStatusLabels.available}
            </span>
          )}
          {statusCounts.occupied > 0 && (
            <span className={`${styles.statusItem} ${styles.statusOccupied}`}>
              {statusCounts.occupied} {defaultStatusLabels.occupied}
            </span>
          )}
          {statusCounts.cleaning > 0 && (
            <span className={`${styles.statusItem} ${styles.statusCleaning}`}>
              {statusCounts.cleaning} {defaultStatusLabels.cleaning}
            </span>
          )}
          {statusCounts.reserved > 0 && (
            <span className={`${styles.statusItem} ${styles.statusReserved}`}>
              {statusCounts.reserved} {defaultStatusLabels.reserved}
            </span>
          )}
          {statusCounts.outOfService > 0 && (
            <span className={`${styles.statusItem} ${styles.statusOutOfService}`}>
              {statusCounts.outOfService} {defaultStatusLabels.outOfService}
            </span>
          )}
        </Box>
      )}

      {/* Content Area - contains bed cards */}
      <Box className={styles.content}>
        <Box className={styles.bedGrid}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

// Re-export icon for convenience
export { IconUserPlus, IconBrush, IconAlertTriangle, IconSettings } from '@tabler/icons-react';

export default EMRRoomCard;
