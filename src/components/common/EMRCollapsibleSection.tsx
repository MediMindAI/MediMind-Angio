// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRCollapsibleSection - Standardized Collapsible Section Component
 *
 * A unified collapsible section component with a bold blue gradient header.
 *
 * Features:
 * - Unified blue gradient header (uses --emr-gradient-section-header)
 * - Smooth collapse animation with chevron rotation
 * - Dark mode support (automatic via theme variables)
 * - Mobile responsive
 * - Accessible (keyboard navigation, ARIA)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Paper, Box, Text, Collapse, Group } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import classes from './EMRCollapsibleSection.module.css';

export interface EMRCollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;
  /** Optional subtitle displayed below the title */
  subtitle?: string;
  /** Icon component from @tabler/icons-react */
  icon: React.ComponentType<{ size?: number }>;
  /** Content inside the collapsible section */
  children: React.ReactNode;
  /** Whether the section is expanded by default (default: true) */
  defaultOpen?: boolean;
  /** Test ID for testing purposes */
  testId?: string;
  /** Optional content rendered on the right side of the header */
  rightSection?: React.ReactNode;
  /** When true, forces the section open (one-way: only opens, never auto-closes) */
  forceOpen?: boolean;
  /** When true, children don't mount until the section has been opened at least once */
  lazy?: boolean;
  /** Increment to expand this section (signal-based expand all) */
  expandAllSignal?: number;
  /** Increment to collapse this section (signal-based collapse all) */
  collapseAllSignal?: number;
  /** Header visual weight.
   *  - 'primary' (default): bold blue gradient header
   *  - 'soft': light surface with dark text — use when nested */
  variant?: 'primary' | 'soft';
}

/**
 * EMRCollapsibleSection - Unified blue gradient collapsible section
 */
export function EMRCollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  children,
  defaultOpen = true,
  testId,
  rightSection,
  forceOpen,
  lazy,
  expandAllSignal = 0,
  collapseAllSignal = 0,
  variant = 'primary',
}: EMRCollapsibleSectionProps): React.ReactElement {
  const [opened, setOpened] = useState(defaultOpen);
  const userToggledRef = useRef(false);
  const hasBeenOpenedRef = useRef(defaultOpen);

  // Track if section has ever been opened (for lazy rendering)
  useEffect(() => {
    if (opened) hasBeenOpenedRef.current = true;
  }, [opened]);

  useEffect(() => {
    if (forceOpen) {
      setOpened(true);
    }
  }, [forceOpen]);

  // Expand all signal
  useEffect(() => {
    if (expandAllSignal > 0) {
      setOpened(true);
      userToggledRef.current = false;
    }
  }, [expandAllSignal]);

  // Collapse all signal
  useEffect(() => {
    if (collapseAllSignal > 0) {
      setOpened(false);
      userToggledRef.current = false;
    }
  }, [collapseAllSignal]);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setOpened((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
      // Arrow-key navigation between section headers
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-section-header]'));
        const currentIndex = headers.indexOf(event.currentTarget as HTMLElement);
        if (currentIndex === -1) return;
        const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < headers.length) {
          headers[nextIndex]?.focus();
        }
      }
    },
    [handleToggle]
  );

  return (
    <Paper
      className={classes.section}
      withBorder
      radius="sm"
      data-testid={testId}
    >
      {/* Header */}
      <Box
        className={`${classes.sectionHeader} ${variant === 'soft' ? classes.sectionHeaderSoft : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={opened}
        aria-controls={`${testId}-content`}
        data-section-header
      >
        <Group gap="sm" wrap="nowrap">
          {/* Chevron with rotation animation */}
          <Box className={`${classes.chevronIcon} ${opened ? classes.open : ''}`}>
            <IconChevronRight size={18} />
          </Box>

          {/* Section icon */}
          <Box className={classes.sectionIcon}>
            <Icon size={20} />
          </Box>

          {/* Section title and subtitle */}
          <Box>
            <Text className={classes.sectionTitle}>{title}</Text>
            {subtitle && <Text className={classes.sectionSubtitle}>{subtitle}</Text>}
          </Box>

          {/* Optional right section */}
          {rightSection && (
            <Box style={{ marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
              {rightSection}
            </Box>
          )}
        </Group>
      </Box>

      {/* Collapsible content */}
      <Collapse in={opened} transitionDuration={200} transitionTimingFunction="ease">
        <Box
          className={classes.sectionContent}
          id={`${testId}-content`}
        >
          {(!lazy || hasBeenOpenedRef.current) ? children : null}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default EMRCollapsibleSection;
