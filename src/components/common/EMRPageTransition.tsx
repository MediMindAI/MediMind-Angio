// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Loader } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './EMRPageTransition.module.css';

/**
 * Available transition animation types for page navigation
 */
export type EMRTransitionType = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'scale' | 'none';

/**
 * Props for EMRPageTransition component
 */
export interface EMRPageTransitionProps {
  /** Child content to wrap with transitions */
  children: ReactNode;

  /**
   * Type of transition animation
   * - 'fade': Simple opacity fade (default, good for most cases)
   * - 'slide-left': Slide from right to left (forward navigation)
   * - 'slide-right': Slide from left to right (backward navigation)
   * - 'slide-up': Slide from bottom to top (vertical navigation)
   * - 'scale': Scale in/out (modal-like transitions)
   * - 'none': Instant switch without animation
   */
  transition?: EMRTransitionType;

  /**
   * Duration of the transition in milliseconds
   * @default 200
   */
  duration?: number;

  /**
   * Show loading indicator during transition
   * @default false
   */
  showLoader?: boolean;

  /**
   * Custom loading component to show during transition
   */
  loader?: ReactNode;

  /**
   * Callback when transition starts
   */
  onTransitionStart?: () => void;

  /**
   * Callback when transition ends
   */
  onTransitionEnd?: () => void;

  /**
   * Whether to respect user's prefers-reduced-motion setting
   * When true and user prefers reduced motion, transitions are instant
   * @default true
   */
  respectReducedMotion?: boolean;

  /**
   * Whether to detect navigation direction automatically
   * When true, uses slide-left for forward, slide-right for backward
   * Only applies when transition is 'slide-left' or 'slide-right'
   * @default false
   */
  autoDetectDirection?: boolean;

  /**
   * Test ID for the component
   */
  testId?: string;

  /**
   * Optional styles to merge onto the transition container element.
   * Useful for overriding overflow behavior on specific routes.
   */
  containerStyle?: React.CSSProperties;
}

/**
 * Hook to detect if user prefers reduced motion
 * @returns true if user prefers reduced motion
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };

    // Use addEventListener for modern browsers
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Get CSS class names for the transition type
 */
function getTransitionClasses(type: EMRTransitionType): {
  enter: string | undefined;
  enterActive: string | undefined;
  exit: string | undefined;
  exitActive: string | undefined;
} {
  switch (type) {
    case 'slide-left':
      return {
        enter: styles.slideLeftEnter,
        enterActive: styles.slideLeftEnterActive,
        exit: styles.slideLeftExit,
        exitActive: styles.slideLeftExitActive,
      };
    case 'slide-right':
      return {
        enter: styles.slideRightEnter,
        enterActive: styles.slideRightEnterActive,
        exit: styles.slideRightExit,
        exitActive: styles.slideRightExitActive,
      };
    case 'slide-up':
      return {
        enter: styles.slideUpEnter,
        enterActive: styles.slideUpEnterActive,
        exit: styles.slideUpExit,
        exitActive: styles.slideUpExitActive,
      };
    case 'scale':
      return {
        enter: styles.scaleEnter,
        enterActive: styles.scaleEnterActive,
        exit: styles.scaleExit,
        exitActive: styles.scaleExitActive,
      };
    case 'none':
      return {
        enter: styles.noneEnter,
        enterActive: styles.noneEnterActive,
        exit: styles.noneExit,
        exitActive: styles.noneExitActive,
      };
    case 'fade':
    default:
      return {
        enter: styles.fadeEnter,
        enterActive: styles.fadeEnterActive,
        exit: styles.fadeExit,
        exitActive: styles.fadeExitActive,
      };
  }
}

/**
 * EMRPageTransition - Smooth page transition animations
 *
 * Provides smooth fade, slide, and scale transitions for page navigation.
 * Respects user's prefers-reduced-motion setting for accessibility.
 *
 * @example
 * ```tsx
 * // Basic usage with fade transition
 * <EMRPageTransition>
 *   <Outlet />
 * </EMRPageTransition>
 *
 * // With slide animation
 * <EMRPageTransition transition="slide-left">
 *   <Outlet />
 * </EMRPageTransition>
 *
 * // With auto-direction detection
 * <EMRPageTransition transition="slide-left" autoDetectDirection>
 *   <Outlet />
 * </EMRPageTransition>
 * ```
 */
export function EMRPageTransition({
  children,
  transition = 'fade',
  duration = 200,
  showLoader = false,
  loader,
  onTransitionStart,
  onTransitionEnd,
  respectReducedMotion = true,
  autoDetectDirection = false,
  testId = 'emr-page-transition',
  containerStyle: containerStyleProp,
}: EMRPageTransitionProps): React.ReactElement {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef<string>(location.pathname);
  const navigationHistoryRef = useRef<string[]>([location.pathname]);

  // Determine effective transition type based on settings and user preferences
  const getEffectiveTransition = useCallback((): EMRTransitionType => {
    // If user prefers reduced motion and we respect it, use instant transition
    if (respectReducedMotion && prefersReducedMotion) {
      return 'none';
    }

    // If auto-detection is enabled and we're using slide transitions
    if (autoDetectDirection && (transition === 'slide-left' || transition === 'slide-right')) {
      const history = navigationHistoryRef.current;
      const currentPath = location.pathname;
      const previousIndex = history.indexOf(previousPathRef.current);
      const currentIndex = history.indexOf(currentPath);

      // If current path exists in history before previous, we're going back
      if (currentIndex !== -1 && currentIndex < previousIndex) {
        return 'slide-right';
      }
      // Otherwise, we're going forward
      return 'slide-left';
    }

    return transition;
  }, [transition, respectReducedMotion, prefersReducedMotion, autoDetectDirection, location.pathname]);

  const effectiveTransition = getEffectiveTransition();

  // Fire the transition flag + callbacks on route change. IMPORTANT: the content
  // rendered below is ALWAYS the live `children` (the current <Outlet/>), never a
  // copy stored in state. Previously the children were snapshotted into state and
  // swapped in via chained setTimeouts; if that timer chain was interrupted (a fast
  // second navigation, an unmount, or a re-render mid-transition) the swap never ran
  // and `previousPathRef` never advanced, so the page got permanently stuck showing
  // the PREVIOUS route while the URL had already changed. Driving the animation off a
  // keyed child (RouteFade) instead makes that failure mode impossible.
  useEffect(() => {
    if (location.pathname === previousPathRef.current) {
      return;
    }

    const history = navigationHistoryRef.current;
    if (!history.includes(location.pathname)) {
      history.push(location.pathname);
    }

    if (effectiveTransition === 'none') {
      previousPathRef.current = location.pathname;
      return;
    }

    setIsTransitioning(true);
    onTransitionStart?.();

    const timer = setTimeout(() => {
      setIsTransitioning(false);
      previousPathRef.current = location.pathname;
      onTransitionEnd?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [location.pathname, duration, effectiveTransition, onTransitionStart, onTransitionEnd]);

  // Set CSS custom properties for duration
  const containerStyle = {
    '--emr-page-transition-duration': `${duration}ms`,
    '--emr-page-transition-easing': 'cubic-bezier(0.4, 0, 0.2, 1)',
  } as React.CSSProperties;

  return (
    <Box
      className={styles.transitionContainer}
      style={{ ...containerStyle, ...containerStyleProp }}
      data-testid={testId}
      data-transitioning={isTransitioning}
    >
      {showLoader && isTransitioning && (
        <Box className={styles.loadingContainer} data-testid={`${testId}-loader`}>
          {loader ?? <Loader size="md" color="blue" />}
        </Box>
      )}

      <RouteFade
        key={location.pathname}
        transitionType={effectiveTransition}
        hidden={showLoader && isTransitioning}
      >
        {children}
      </RouteFade>
    </Box>
  );
}

/**
 * Renders one route's content and plays its enter animation. Remounted on every
 * navigation via `key={location.pathname}`, so the enter animation replays and —
 * crucially — the live `children` are always shown. It holds no snapshot of the
 * page, so a view can never get stuck behind a stale copy.
 */
function RouteFade({
  transitionType,
  hidden,
  children,
}: {
  transitionType: EMRTransitionType;
  hidden: boolean;
  children: ReactNode;
}): React.ReactElement {
  const classes = getTransitionClasses(transitionType);
  // Start in the "enter" (pre-animation) state, then flip to "enterActive" on the
  // next frame so the CSS opacity/transform transition actually fires. For 'none'
  // we skip straight to the settled state.
  const [active, setActive] = useState(transitionType === 'none');

  useEffect(() => {
    if (transitionType === 'none') {
      return;
    }
    const raf = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(raf);
  }, [transitionType]);

  const animClass =
    transitionType === 'none' ? '' : active ? `${classes.enter} ${classes.enterActive}` : classes.enter;

  return (
    <Box
      className={`${styles.transitionContent} ${animClass}`.trim()}
      style={{ visibility: hidden ? 'hidden' : 'visible' }}
    >
      {children}
    </Box>
  );
}

/**
 * Hook to get the current transition state
 * Useful for components that need to know when a transition is happening
 */
export function usePageTransitionState(): {
  isTransitioning: boolean;
  prefersReducedMotion: boolean;
} {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== previousPathRef.current) {
      setIsTransitioning(true);
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        previousPathRef.current = location.pathname;
      }, 400); // Default total transition time (200ms exit + 200ms enter)

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [location.pathname]);

  return { isTransitioning, prefersReducedMotion };
}
