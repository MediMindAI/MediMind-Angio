// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@mantine/core';
import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import classes from './EMRStickyHeader.module.css';

/**
 * Scroll behavior options
 */
export type EMRStickyScrollBehavior = 'always' | 'on-scroll' | 'hide-on-scroll';

/**
 * Props for EMRStickyHeader component
 */
export interface EMRStickyHeaderProps {
  /** Normal (expanded) header content */
  children: ReactNode;
  /** Compact header content (shown when scrolled) */
  compactContent?: ReactNode;
  /** Scroll behavior: 'always' (always sticky), 'on-scroll' (compact on scroll), 'hide-on-scroll' (hide when scrolling down) */
  scrollBehavior?: EMRStickyScrollBehavior;
  /** Scroll threshold before triggering compact mode (in pixels) */
  scrollThreshold?: number;
  /** Whether to show shadow when scrolled */
  showShadowOnScroll?: boolean;
  /** Background color (uses CSS variable by default) */
  background?: string;
  /** Z-index for the sticky header */
  zIndex?: number;
  /** Height in normal mode */
  normalHeight?: number | string;
  /** Height in compact mode */
  compactHeight?: number | string;
  /** Whether the header is currently hidden */
  hidden?: boolean;
  /** Callback when scroll state changes */
  onScrollStateChange?: (isScrolled: boolean) => void;
  /** Callback when visibility changes */
  onVisibilityChange?: (isVisible: boolean) => void;
  /** Element to observe for scroll (default: window) */
  scrollContainer?: HTMLElement | null;
  /** Test ID for testing */
  testId?: string;
}

/**
 * EMRStickyHeader - Reusable sticky header with scroll-aware behavior
 *
 * Features:
 * - Sticky positioning with safe area support
 * - Compact mode on scroll
 * - Hide on scroll down option
 * - Smooth transitions
 * - Shadow on scroll
 * - Mobile responsive
 *
 * @example
 * ```tsx
 * // Always sticky with compact on scroll
 * <EMRStickyHeader
 *   scrollBehavior="on-scroll"
 *   compactContent={<CompactHeader title={title} />}
 * >
 *   <FullHeader title={title} subtitle={subtitle} />
 * </EMRStickyHeader>
 *
 * // Hide on scroll down (like mobile app nav)
 * <EMRStickyHeader
 *   scrollBehavior="hide-on-scroll"
 *   showShadowOnScroll
 * >
 *   <Navigation />
 * </EMRStickyHeader>
 *
 * // Simple always-sticky header
 * <EMRStickyHeader scrollBehavior="always">
 *   <PageTitle>My Page</PageTitle>
 * </EMRStickyHeader>
 * ```
 */
export function EMRStickyHeader({
  children,
  compactContent,
  scrollBehavior = 'always',
  scrollThreshold = 50,
  showShadowOnScroll = true,
  background,
  zIndex = 100,
  normalHeight,
  compactHeight,
  hidden: hiddenProp,
  onScrollStateChange,
  onVisibilityChange,
  scrollContainer,
  testId = 'emr-sticky-header',
}: EMRStickyHeaderProps): React.ReactElement {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);

  // Determine if we should show compact content
  const showCompact = scrollBehavior === 'on-scroll' && isScrolled && compactContent;

  // Handle scroll
  const handleScroll = useCallback(() => {
    const currentScrollY =
      scrollContainer ? scrollContainer.scrollTop : window.scrollY;

    // Check if scrolled past threshold
    const newIsScrolled = currentScrollY > scrollThreshold;
    if (newIsScrolled !== isScrolled) {
      setIsScrolled(newIsScrolled);
      onScrollStateChange?.(newIsScrolled);
    }

    // Handle hide on scroll behavior
    if (scrollBehavior === 'hide-on-scroll') {
      const isScrollingDown = currentScrollY > lastScrollY.current;
      const shouldHide = isScrollingDown && currentScrollY > scrollThreshold;

      if (shouldHide !== isHidden) {
        setIsHidden(shouldHide);
        onVisibilityChange?.(!shouldHide);
      }
    }

    lastScrollY.current = currentScrollY;
  }, [
    scrollContainer,
    scrollThreshold,
    isScrolled,
    isHidden,
    scrollBehavior,
    onScrollStateChange,
    onVisibilityChange,
  ]);

  // Set up scroll listener
  useEffect(() => {
    const scrollElement = scrollContainer ?? window;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainer, handleScroll]);

  // Handle external hidden prop
  const finalIsHidden = hiddenProp ?? isHidden;

  // Container classes
  const containerClasses = [
    classes.container,
    isScrolled && showShadowOnScroll ? classes.scrolled : '',
    finalIsHidden ? classes.hidden : '',
    showCompact ? classes.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Container style
  const containerStyle: React.CSSProperties = {
    zIndex,
    background: background ?? 'var(--emr-bg-card)',
    height: showCompact && compactHeight ? compactHeight : normalHeight,
  };

  return (
    <Box
      ref={headerRef}
      className={containerClasses}
      style={containerStyle}
      data-testid={testId}
      data-scrolled={isScrolled}
      data-hidden={finalIsHidden}
      data-compact={showCompact}
    >
      {/* Normal content */}
      <Box
        className={`${classes.content} ${showCompact ? classes.contentHidden : ''}`}
        data-testid={`${testId}-normal`}
      >
        {children}
      </Box>

      {/* Compact content (if provided and scrolled) */}
      {compactContent && (
        <Box
          className={`${classes.compactContent} ${showCompact ? classes.compactContentVisible : ''}`}
          data-testid={`${testId}-compact`}
        >
          {compactContent}
        </Box>
      )}
    </Box>
  );
}

/**
 * Hook to track scroll position for custom scroll-aware behavior
 *
 * @param threshold - Scroll threshold to trigger "scrolled" state
 * @param scrollContainer - Element to observe for scroll (default: window)
 * @returns Object with isScrolled, scrollY, and scrollDirection
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isScrolled, scrollY, scrollDirection } = useScrollPosition(50);
 *
 *   return (
 *     <div className={isScrolled ? 'compact' : 'normal'}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollPosition(
  threshold: number = 50,
  scrollContainer?: HTMLElement | null
): {
  isScrolled: boolean;
  scrollY: number;
  scrollDirection: 'up' | 'down' | null;
} {
  const [scrollState, setScrollState] = useState({
    isScrolled: false,
    scrollY: 0,
    scrollDirection: null as 'up' | 'down' | null,
  });
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      const isScrolled = currentScrollY > threshold;
      const scrollDirection =
        currentScrollY > lastScrollY.current
          ? 'down'
          : currentScrollY < lastScrollY.current
            ? 'up'
            : null;

      setScrollState({
        isScrolled,
        scrollY: currentScrollY,
        scrollDirection,
      });

      lastScrollY.current = currentScrollY;
    };

    const scrollElement = scrollContainer ?? window;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, scrollContainer]);

  return scrollState;
}

export default EMRStickyHeader;
