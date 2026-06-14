// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRFormSection — flat, typographic clinical form section.
 *
 * The quiet cousin of `EMRCollapsibleSection`. Zero visual enclosure: no card,
 * no gradient header, no shadow. It's a document block with a typographic
 * title row, a thin divider, and body content that flows directly.
 *
 * Use this inside long forms (especially multi-section modals) where every
 * section wearing its own card turns the UI into "boxes inside boxes".
 *
 * API mirrors `EMRCollapsibleSection` for drop-in replacement:
 *   • `expandAllSignal` / `collapseAllSignal` / `forceOpen` / `lazy`
 *   • `rightSection` for status indicators, templates buttons etc.
 *   • `count` / `isComplete` for quiet metadata rendering.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Collapse, Text } from '@mantine/core';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './EMRFormSection.module.css';

export interface EMRFormSectionProps {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  /** Optional right-side content (e.g. SaveStatusIndicator, small Templates link). */
  rightSection?: React.ReactNode;
  /** Force the section open (one-way — only opens, never auto-closes). */
  forceOpen?: boolean;
  /** Don't mount children until the section has been opened at least once. */
  lazy?: boolean;
  /** Increment to expand this section. */
  expandAllSignal?: number;
  /** Increment to collapse this section. */
  collapseAllSignal?: number;
  /** Optional count shown as a quiet neutral pill (e.g. "3"). */
  count?: number;
  /** When true, shows a small green "✓" glyph after the title. */
  isComplete?: boolean;
  /** Anchor id so sidebar clicks can scroll to this section. */
  id?: string;
}

export const EMRFormSection = React.memo(function EMRFormSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  testId,
  rightSection,
  forceOpen,
  lazy,
  expandAllSignal = 0,
  collapseAllSignal = 0,
  count,
  isComplete,
  id,
}: EMRFormSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(defaultOpen);
  const hasBeenOpenedRef = useRef(defaultOpen);

  useEffect(() => {
    if (opened) hasBeenOpenedRef.current = true;
  }, [opened]);

  useEffect(() => {
    if (forceOpen) setOpened(true);
  }, [forceOpen]);

  useEffect(() => {
    if (expandAllSignal > 0) setOpened(true);
  }, [expandAllSignal]);

  useEffect(() => {
    if (collapseAllSignal > 0) setOpened(false);
  }, [collapseAllSignal]);

  const handleToggle = useCallback(() => {
    setOpened((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const bodyId = testId ? `${testId}-body` : undefined;

  return (
    <section
      id={id}
      className={classes.section}
      data-testid={testId}
      aria-labelledby={testId ? `${testId}-header` : undefined}
    >
      <button
        type="button"
        id={testId ? `${testId}-header` : undefined}
        className={classes.header}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={opened}
        aria-controls={bodyId}
        data-section-header
      >
        <Box
          component="span"
          className={`${classes.chevron} ${opened ? classes.chevronOpen : ''}`}
          aria-hidden="true"
        >
          <IconChevronRight size={16} />
        </Box>

        <Box component="span" className={classes.icon} aria-hidden="true">
          <Icon size={18} />
        </Box>

        <Text component="span" className={classes.title}>
          {title}
        </Text>

        {typeof count === 'number' && count > 0 && (
          <span className={classes.count} aria-label={`${count} items`}>
            {count}
          </span>
        )}

        {isComplete && (
          <span className={classes.completionCheck} aria-label={t('common.complete')}>
            <IconCheck size={14} stroke={3} />
          </span>
        )}

        {rightSection && (
          <span
            className={classes.rightSlot}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {rightSection}
          </span>
        )}
      </button>

      <Collapse in={opened} transitionDuration={180} transitionTimingFunction="ease">
        <Box id={bodyId} className={classes.body}>
          {!lazy || hasBeenOpenedRef.current ? children : null}
        </Box>
      </Collapse>
    </section>
  );
});

export default EMRFormSection;
