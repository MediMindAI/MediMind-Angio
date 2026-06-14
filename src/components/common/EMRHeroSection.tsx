// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import styles from './EMRHeroSection.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

export interface EMRHeroSectionProps {
  /** Icon component to display in the header */
  icon?: ComponentType<IconProps>;
  /** Main title text */
  title: string;
  /** Subtitle text (hidden on mobile) */
  subtitle?: string;
  /** Badge text (e.g., "GENERAL", "ICU") */
  badge?: string;
  /** Content to render below header (usually EMRStatCardGrid) */
  children?: ReactNode;
  /** Action buttons for the header (right side) */
  actions?: ReactNode;
  /** Show back button */
  showBack?: boolean;
  /** Back button click handler */
  onBack?: () => void;
  /** Compact mode with reduced padding */
  compact?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRHeroSection - Premium gradient hero header for dashboard/overview pages
 *
 * A stunning component for page headers with animated gradient background,
 * glass-morphism effects, floating particles, and space for stat cards.
 *
 * Features:
 * - Multi-layer animated gradient with glow effects
 * - Glass-morphism icon wrapper with pulse animation
 * - Optional back button with hover animations
 * - Optional badge with glass effect
 * - Responsive design with mobile-first approach
 * - Dark mode support
 * - Reduced motion support for accessibility
 *
 * @param root0
 * @param root0.icon
 * @param root0.title
 * @param root0.subtitle
 * @param root0.badge
 * @param root0.children
 * @param root0.actions
 * @param root0.showBack
 * @param root0.onBack
 * @param root0.compact
 * @param root0.'data-testid'
 * @example
 * // Dashboard overview with stats
 * <EMRHeroSection
 *   icon={IconActivity}
 *   title="Hospital Command Center"
 *   subtitle="Real-time bed monitoring"
 *   actions={<EMRButton variant="ghost" icon={IconRefresh} onClick={refresh}>{null}</EMRButton>}
 * >
 *   <EMRStatCardGrid columns={6} gap="sm">
 *     <EMRStatCard icon={IconBed} value={50} label="Total Beds" mode="hero" />
 *     <EMRStatCard icon={IconUsers} value={35} label="Occupied" mode="hero" />
 *   </EMRStatCardGrid>
 * </EMRHeroSection>
 *
 * @example
 * // Department detail page with back button and badge
 * <EMRHeroSection
 *   icon={IconBuildingHospital}
 *   title="Cardiology"
 *   subtitle="Building A / 20 Beds"
 *   badge="GENERAL"
 *   showBack
 *   onBack={() => navigate('/departments')}
 *   actions={<EMRButton variant="ghost" icon={IconRefresh} onClick={refresh}>{null}</EMRButton>}
 * >
 *   <EMRStatCardGrid columns={4} gap="md">
 *     <EMRStatCard icon={IconDoor} value={5} label="Rooms" mode="hero" />
 *   </EMRStatCardGrid>
 * </EMRHeroSection>
 */
export function EMRHeroSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
  actions,
  showBack = false,
  onBack,
  compact = false,
  'data-testid': dataTestId = 'emr-hero-section',
}: EMRHeroSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Box
      className={`${styles.hero} ${compact ? styles.compact : ''}`}
      data-testid={dataTestId}
    >
      <Box className={styles.heroInner}>
        {/* Header Row */}
        <Box className={styles.headerRow}>
          <Box className={styles.titleBlock}>
            {/* Back Button */}
            {showBack && (
              <button
                type="button"
                className={styles.backButton}
                onClick={onBack}
                aria-label={t('common.goBack')}
              >
                <IconArrowLeft size={compact ? 18 : 20} />
              </button>
            )}

            {/* Icon */}
            {Icon && (
              <Box className={styles.iconWrapper}>
                <Icon size={compact ? 22 : 26} />
              </Box>
            )}

            {/* Title & Subtitle */}
            <Box className={styles.titleText}>
              <h1 className={styles.title}>{title}</h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </Box>

            {/* Badge */}
            {badge && <span className={styles.badge}>{badge}</span>}
          </Box>

          {/* Actions */}
          {actions && <Box className={styles.actions}>{actions}</Box>}
        </Box>

        {/* Content (Stats, etc.) */}
        <Box className={styles.content}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default EMRHeroSection;
