// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@mantine/core';
import { IconMapPin, IconChevronRight } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import styles from './EMRDashboardCard.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

/** Stat item for the footer grid */
export interface EMRDashboardCardStat {
  value: number | string;
  label: string;
  /** Highlight this stat with accent color */
  highlight?: boolean;
}

/** Progress bar configuration */
export interface EMRDashboardCardProgress {
  value: number;
  label: string;
}

export interface EMRDashboardCardProps {
  /** Icon component for the card header */
  icon?: ComponentType<IconProps>;
  /** Main title */
  title: string;
  /** Subtitle (location, description, etc.) */
  subtitle?: string;
  /** Badge text (e.g., "GENERAL", "ICU") */
  badge?: string;
  /** Stats to display in the footer grid (max 4) */
  stats?: EMRDashboardCardStat[];
  /** Progress bar configuration */
  progress?: EMRDashboardCardProgress;
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Enable entrance animation */
  animated?: boolean;
  /** Animation delay index (0-9) for staggered animations */
  animationIndex?: number;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * EMRDashboardCard - Reusable clickable card for department/entity selection
 *
 * A standardized card component with icon, title, badge, progress bar,
 * and stats footer. Features smooth hover animations, gradient accents,
 * and staggered entrance animations.
 *
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.subtitle
 * @param root0.badge
 * @param root0.stats
 * @param root0.progress
 * @param root0.onClick
 * @param root0.loading
 * @param root0.animated
 * @param root0.animationIndex
 * @param root0.'data-testid'
 * @example
 * // Department card with all features
 * <EMRDashboardCard
 *   icon={IconBuildingHospital}
 *   title="Cardiology"
 *   subtitle="Building A / Floor 2"
 *   badge="GENERAL"
 *   progress={{ value: 75, label: "Capacity" }}
 *   stats={[
 *     { value: 20, label: "Beds" },
 *     { value: 15, label: "Available", highlight: true },
 *     { value: 5, label: "Occupied" },
 *     { value: 4, label: "Rooms" },
 *   ]}
 *   onClick={() => navigate(`/department/${id}`)}
 *   animated
 *   animationIndex={0}
 * />
 *
 * @example
 * // Simple card without stats
 * <EMRDashboardCard
 *   icon={IconUser}
 *   title="Patient Records"
 *   subtitle="View all patient records"
 *   onClick={handleClick}
 * />
 */
export function EMRDashboardCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  stats,
  progress,
  onClick,
  loading = false,
  animated = false,
  animationIndex = 0,
  'data-testid': dataTestId = 'emr-dashboard-card',
}: EMRDashboardCardProps): React.JSX.Element {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  // Build class names
  const cardClasses = [
    styles.card,
    loading ? styles.loading : '',
    animated ? styles.animated : '',
    animated && animationIndex >= 0 && animationIndex <= 9 ? styles[`delay${animationIndex}`] : '',
  ].filter(Boolean).join(' ');

  return (
    <Box
      className={cardClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${title}${subtitle ? ` - ${subtitle}` : ''}` : undefined}
      data-testid={dataTestId}
    >
      {/* Header */}
      <Box className={styles.header}>
        {Icon && (
          <Box className={styles.iconWrapper}>
            <Icon size={24} />
          </Box>
        )}
        <Box className={styles.info}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && (
            <p className={styles.subtitle}>
              <IconMapPin size={14} />
              {subtitle}
            </p>
          )}
        </Box>
        {badge && <span className={styles.badge}>{badge}</span>}
      </Box>

      {/* Progress Bar */}
      {progress && (
        <Box className={styles.progressSection}>
          <Box className={styles.progressRow}>
            <span className={styles.progressLabel}>{progress.label}</span>
            <span className={styles.progressPercent}>{progress.value}%</span>
          </Box>
          <Box className={styles.progressBar}>
            <Box
              className={styles.progressFill}
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
          </Box>
        </Box>
      )}

      {/* Stats Footer */}
      {stats && stats.length > 0 && (
        <Box className={styles.statsFooter}>
          {stats.slice(0, 4).map((stat, index) => (
            <Box
              key={index}
              className={`${styles.stat} ${stat.highlight ? styles.statHighlight : ''}`}
            >
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </Box>
          ))}
        </Box>
      )}

      {/* Arrow indicator */}
      {onClick && (
        <Box className={styles.arrow}>
          <IconChevronRight size={18} />
        </Box>
      )}
    </Box>
  );
}

export default EMRDashboardCard;
