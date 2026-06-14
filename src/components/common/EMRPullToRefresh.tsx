// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Text, Loader, Stack } from '@mantine/core';
import { IconArrowDown, IconCheck, IconRefresh } from '@tabler/icons-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import styles from './EMRPullToRefresh.module.css';

export interface EMRPullToRefreshProps {
  /** Async function to call on refresh */
  onRefresh: () => Promise<void>;
  /** Whether currently loading (external control) */
  loading?: boolean;
  /** Threshold in pixels to trigger refresh (default: 60) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 100) */
  maxPull?: number;
  /** Children to wrap */
  children: React.ReactNode;
  /** Disable pull to refresh */
  disabled?: boolean;
  /** Custom pull text */
  pullText?: string;
  /** Custom release text */
  releaseText?: string;
  /** Custom refreshing text */
  refreshingText?: string;
  /** Custom complete text */
  completeText?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'complete';

/**
 * EMRPullToRefresh - Mobile pull-to-refresh wrapper
 *
 * Provides visual feedback during pull gesture and triggers refresh on release.
 * Following native app patterns for touch interaction.
 *
 * @example
 * ```tsx
 * function PatientList() {
 *   const [loading, setLoading] = useState(false);
 *
 *   const handleRefresh = async () => {
 *     setLoading(true);
 *     await fetchPatients();
 *     setLoading(false);
 *   };
 *
 *   return (
 *     <EMRPullToRefresh onRefresh={handleRefresh} loading={loading}>
 *       <PatientTable />
 *     </EMRPullToRefresh>
 *   );
 * }
 * ```
 */
export function EMRPullToRefresh({
  onRefresh,
  loading = false,
  threshold = 60,
  maxPull = 100,
  children,
  disabled = false,
  pullText,
  releaseText,
  refreshingText,
  completeText,
  'data-testid': testId = 'emr-pull-to-refresh',
}: EMRPullToRefreshProps): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<RefreshState>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  // Default texts with translations
  const texts = useMemo(() => ({
    pull: pullText || t('common.pullToRefresh'),
    release: releaseText || t('common.releaseToRefresh'),
    refreshing: refreshingText || t('common.refreshing'),
    complete: completeText || 'Done',
  }), [pullText, releaseText, refreshingText, completeText, t]);

  // Reset state when external loading changes
  useEffect(() => {
    if (!loading && state === 'refreshing') {
      setState('complete');
      const timer = setTimeout(() => {
        setState('idle');
        setPullDistance(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, state]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || loading) {return;}

      const container = containerRef.current;
      if (!container) {return;}

      // Only enable pull-to-refresh if at the top of the scroll container
      if (container.scrollTop <= 0) {
        startY.current = e.touches[0]?.clientY ?? 0;
        isPulling.current = true;
      }
    },
    [disabled, loading]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || disabled || loading) {return;}

      const currentY = e.touches[0]?.clientY ?? 0;
      const distance = Math.max(0, currentY - startY.current);

      if (distance > 0) {
        // Apply resistance to the pull
        const resistedDistance = Math.min(maxPull, distance * 0.5);
        setPullDistance(resistedDistance);

        if (resistedDistance >= threshold) {
          setState('ready');
        } else {
          setState('pulling');
        }
      }
    },
    [disabled, loading, threshold, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) {return;}

    isPulling.current = false;

    if (state === 'ready') {
      setState('refreshing');
      setPullDistance(threshold);

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull to refresh failed:', error);
      }

      // State will be updated by the useEffect when loading changes
    } else {
      setState('idle');
      setPullDistance(0);
    }
  }, [disabled, state, threshold, onRefresh]);

  const getIndicatorContent = useCallback(() => {
    switch (state) {
      case 'pulling':
        return (
          <>
            <IconArrowDown
              size={20}
              className={styles.arrowIcon}
              style={{ transform: `rotate(${Math.min(180, (pullDistance / threshold) * 180)}deg)` }}
            />
            <Text size="xs">{texts.pull}</Text>
          </>
        );
      case 'ready':
        return (
          <>
            <IconRefresh size={20} className={styles.readyIcon} />
            <Text size="xs" fw={500}>
              {texts.release}
            </Text>
          </>
        );
      case 'refreshing':
        return (
          <>
            <Loader size="sm" />
            <Text size="xs">{texts.refreshing}</Text>
          </>
        );
      case 'complete':
        return (
          <>
            <IconCheck size={20} className={styles.checkIcon} />
            <Text size="xs" c="green">
              {texts.complete}
            </Text>
          </>
        );
      default:
        return null;
    }
  }, [state, pullDistance, threshold, texts]);

  return (
    <Box className={styles.container} data-testid={testId}>
      {/* Pull indicator */}
      <Box
        className={styles.indicator}
        style={{
          height: pullDistance,
          opacity: Math.min(1, pullDistance / (threshold * 0.5)),
        }}
        data-state={state}
        data-testid={`${testId}-indicator`}
      >
        <Stack gap={4} align="center" justify="center" h="100%">
          {getIndicatorContent()}
        </Stack>
      </Box>

      {/* Main content with touch handlers */}
      <Box
        ref={containerRef}
        className={styles.content}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: state === 'idle' || state === 'complete' ? 'transform 0.2s ease' : 'none',
        }}
        data-testid={`${testId}-content`}
      >
        {children}
      </Box>
    </Box>
  );
}

export default EMRPullToRefresh;
