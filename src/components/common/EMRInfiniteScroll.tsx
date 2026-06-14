// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Button, Skeleton, Stack, Text } from '@mantine/core';
import { IconRefresh, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './EMRInfiniteScroll.module.css';

/**
 * Props for loading skeleton
 */
export interface EMRInfiniteScrollSkeletonProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Height of each skeleton item */
  itemHeight?: number | string;
  /** Gap between skeleton items */
  gap?: number | string;
}

/**
 * Props for EMRInfiniteScroll component
 */
export interface EMRInfiniteScrollProps {
  /** Child content (list items) */
  children: ReactNode;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether there was an error */
  hasError?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Whether end of list is reached */
  isEndOfList?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Callback to retry loading */
  onRetry?: () => void;
  /** Callback to load more */
  onLoadMore?: () => void;
  /** Ref for the sentinel element */
  sentinelRef?: (node: HTMLElement | null) => void;
  /** Loading skeleton configuration */
  skeleton?: EMRInfiniteScrollSkeletonProps;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error component */
  errorComponent?: ReactNode;
  /** Custom end of list component */
  endOfListComponent?: ReactNode;
  /** End of list message */
  endOfListMessage?: string;
  /** Retry button label */
  retryLabel?: string;
  /** Load more button label (for manual trigger) */
  loadMoreLabel?: string;
  /** Whether to show load more button instead of auto-loading */
  manualLoadMore?: boolean;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Default loading skeleton
 */
function DefaultLoadingSkeleton({
  count = 3,
  itemHeight = 60,
  gap = 8,
}: EMRInfiniteScrollSkeletonProps): React.ReactElement {
  return (
    <Stack gap={gap} className={classes.loadingContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={itemHeight} radius="md" animate />
      ))}
    </Stack>
  );
}

/**
 * Default error component
 */
function DefaultError({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}): React.ReactElement {
  return (
    <Box className={classes.errorContainer}>
      <IconAlertCircle
        size={32}
        stroke={1.5}
        className={classes.errorIcon}
      />
      <Text className={classes.errorMessage}>
        {message || 'Failed to load more items'}
      </Text>
      {onRetry && (
        <Button
          variant="light"
          color="red"
          size="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={onRetry}
          className={classes.retryButton}
        >
          {retryLabel}
        </Button>
      )}
    </Box>
  );
}

/**
 * Default end of list component
 */
function DefaultEndOfList({
  message,
}: {
  message?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('common.noMoreItemsToLoad');

  return (
    <Box className={classes.endOfListContainer}>
      <IconCheck size={20} stroke={2} className={classes.endOfListIcon} />
      <Text className={classes.endOfListMessage}>{resolvedMessage}</Text>
    </Box>
  );
}

/**
 * EMRInfiniteScroll - Container component for infinite scroll lists
 *
 * Features:
 * - Loading skeleton at bottom
 * - Error state with retry button
 * - End of list indicator
 * - Automatic or manual loading trigger
 * - Customizable components
 *
 * @example
 * ```tsx
 * function PatientList() {
 *   const {
 *     items,
 *     state,
 *     sentinelRef,
 *     retry,
 *   } = useInfiniteScroll({
 *     fetchFn: fetchPatients,
 *   });
 *
 *   return (
 *     <EMRInfiniteScroll
 *       isLoading={state.isLoading}
 *       hasError={state.hasError}
 *       errorMessage={state.errorMessage}
 *       isEndOfList={state.isEndOfList}
 *       hasMore={state.hasMore}
 *       onRetry={retry}
 *       sentinelRef={sentinelRef}
 *     >
 *       {items.map((patient) => (
 *         <PatientCard key={patient.id} patient={patient} />
 *       ))}
 *     </EMRInfiniteScroll>
 *   );
 * }
 * ```
 */
export function EMRInfiniteScroll({
  children,
  isLoading = false,
  hasError = false,
  errorMessage,
  isEndOfList = false,
  hasMore = true,
  onRetry,
  onLoadMore,
  sentinelRef,
  skeleton = {},
  loadingComponent,
  errorComponent,
  endOfListComponent,
  endOfListMessage,
  retryLabel,
  loadMoreLabel = 'Load More',
  manualLoadMore = false,
  testId = 'emr-infinite-scroll',
}: EMRInfiniteScrollProps): React.ReactElement {
  return (
    <Box className={classes.container} data-testid={testId}>
      {/* Main content */}
      <Box className={classes.content}>{children}</Box>

      {/* Loading state */}
      {isLoading && (
        <Box className={classes.statusArea} data-testid={`${testId}-loading`}>
          {loadingComponent ?? <DefaultLoadingSkeleton {...skeleton} />}
        </Box>
      )}

      {/* Error state */}
      {hasError && !isLoading && (
        <Box className={classes.statusArea} data-testid={`${testId}-error`}>
          {errorComponent ?? (
            <DefaultError
              message={errorMessage}
              onRetry={onRetry}
              retryLabel={retryLabel}
            />
          )}
        </Box>
      )}

      {/* End of list */}
      {isEndOfList && !isLoading && !hasError && (
        <Box className={classes.statusArea} data-testid={`${testId}-end`}>
          {endOfListComponent ?? (
            <DefaultEndOfList message={endOfListMessage} />
          )}
        </Box>
      )}

      {/* Manual load more button */}
      {manualLoadMore && hasMore && !isLoading && !hasError && !isEndOfList && (
        <Box className={classes.loadMoreContainer}>
          <Button
            variant="light"
            onClick={onLoadMore}
            className={classes.loadMoreButton}
          >
            {loadMoreLabel}
          </Button>
        </Box>
      )}

      {/* Sentinel element for intersection observer */}
      {!manualLoadMore && hasMore && !hasError && (
        <Box
          ref={sentinelRef}
          className={classes.sentinel}
          data-testid={`${testId}-sentinel`}
          aria-hidden="true"
        />
      )}
    </Box>
  );
}

export default EMRInfiniteScroll;
