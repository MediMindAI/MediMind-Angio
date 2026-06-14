// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Stack, ScrollArea, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronUp,
  IconLayoutGrid,
  IconLayoutList,
  IconInbox,
} from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import React, { useState, useCallback, useMemo } from 'react';
import { EMREmptyState } from './EMREmptyState';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './EMRDataList.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

/** Gap size options */
export type EMRDataListGap = 'xs' | 'sm' | 'md' | 'lg';

/** View mode options */
export type EMRDataListViewMode = 'list' | 'card';

/** Sort direction */
export type EMRDataListSortDirection = 'asc' | 'desc' | null;

/**
 * Column definition for list view headers
 */
export type EMRDataListColumnKey<T extends object> = Extract<keyof T, string>;

interface EMRDataListColumnBase<T extends object> {
  /** Column header label */
  label: string;
  /** Width of the column (CSS value) */
  width?: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Custom sort function */
  sortFn?: (a: T, b: T, direction: 'asc' | 'desc') => number;
}

export type EMRDataListColumn<T extends object> = EMRDataListColumnBase<T> & (
  | {
      /** Unique key for the column; used to read the row when render is omitted */
      key: EMRDataListColumnKey<T>;
      /** Render function for cell content */
      render?: (item: T, index: number) => ReactNode;
    }
  | {
      /** Display-only key for custom-rendered columns */
      key: string;
      /** Render function for cell content */
      render: (item: T, index: number) => ReactNode;
    }
);

/**
 * Detail field for expandable row details
 */
export interface EMRDataListDetailField<T extends object> {
  /** Label for the detail field */
  label: string;
  /** Render function for the value */
  render: (item: T) => ReactNode;
}

/**
 * Props for EMRDataList component
 */
export interface EMRDataListProps<T extends object> {
  /** Array of data items to render */
  items: T[];
  /** Render function for each item (used for simple list/card rendering) */
  renderItem?: (item: T, index: number) => ReactNode;
  /** Column definitions for list view with sortable headers */
  columns?: EMRDataListColumn<T>[];
  /** Render function for card view content */
  renderCard?: (item: T, index: number, isExpanded: boolean, toggleExpand: () => void) => ReactNode;
  /** Detail fields for expandable rows */
  detailFields?: EMRDataListDetailField<T>[];
  /** Gap between items */
  gap?: EMRDataListGap;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state icon */
  emptyIcon?: ComponentType<IconProps>;
  /** Empty state action button */
  emptyAction?: {
    label: string;
    onClick: () => void;
    icon?: ComponentType<IconProps>;
  };
  /** Max height with scrolling */
  maxHeight?: number | string;
  /** Enable entrance animations */
  animated?: boolean;
  /** Initial view mode (defaults to 'list' on desktop, 'card' on mobile) */
  defaultViewMode?: EMRDataListViewMode;
  /** Show view mode toggle */
  showViewToggle?: boolean;
  /** Enable expandable rows */
  expandable?: boolean;
  /** Custom function to get item key */
  getItemKey?: (item: T, index: number) => string | number;
  /** Callback when sort changes */
  onSortChange?: (key: string, direction: EMRDataListSortDirection) => void;
  /** Current sort key (for controlled sorting) */
  sortKey?: string;
  /** Current sort direction (for controlled sorting) */
  sortDirection?: EMRDataListSortDirection;
  /** Test ID for testing */
  'data-testid'?: string;
}

/** Gap size mapping to Mantine spacing */
const gapMap: Record<EMRDataListGap, string> = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
};

/**
 * Checks whether a runtime column key exists on a row item.
 * @param item - Row item to inspect.
 * @param key - Runtime column key.
 * @returns True when the key is available on the item.
 */
function hasColumnKey<T extends object>(item: T, key: string): key is EMRDataListColumnKey<T> {
  return key in item;
}

/**
 * EMRDataList - Responsive data display component
 *
 * Features:
 * - Card view on mobile, list view on desktop
 * - Expandable row details
 * - Sortable column headers
 * - Empty state with illustration
 * - View mode toggle
 * - Consistent styling across EMR pages
 *
 * @param props - Component props
 * @example
 * ```tsx
 * // Basic usage with renderItem
 * <EMRDataList
 *   items={diseases}
 *   emptyTitle="No diseases recorded"
 *   renderItem={(disease) => (
 *     <EMRDataItem
 *       key={disease.id}
 *       code={disease.icd10Code}
 *       name={disease.icd10Name}
 *     />
 *   )}
 * />
 *
 * // Advanced usage with columns and expandable details
 * <EMRDataList
 *   items={patients}
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true, width: '30%' },
 *     { key: 'dob', label: 'Date of Birth', width: '20%' },
 *     { key: 'status', label: 'Status', render: (p) => <Badge>{p.status}</Badge> },
 *   ]}
 *   expandable
 *   detailFields={[
 *     { label: 'Address', render: (p) => p.address },
 *     { label: 'Phone', render: (p) => p.phone },
 *   ]}
 *   showViewToggle
 * />
 * ```
 */
function EMRDataListInner<T extends object>({
  items,
  renderItem,
  columns,
  renderCard,
  detailFields,
  gap = 'sm',
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  maxHeight,
  animated = false,
  defaultViewMode,
  showViewToggle = false,
  expandable = false,
  getItemKey,
  onSortChange,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDirection,
  'data-testid': dataTestId = 'emr-data-list',
}: EMRDataListProps<T>): React.ReactElement {
  const { t } = useTranslation();
  // Media query for mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

  // View mode state
  const [viewMode, setViewMode] = useState<EMRDataListViewMode>(
    defaultViewMode ?? (isMobile ? 'card' : 'list')
  );

  // Expanded items state (using indices for simplicity)
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  // Internal sort state (for uncontrolled mode)
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<EMRDataListSortDirection>(null);

  // Use controlled or internal sort state
  const currentSortKey = controlledSortKey ?? internalSortKey;
  const currentSortDirection = controlledSortDirection ?? internalSortDirection;

  // Toggle expand for an item
  const toggleExpand = useCallback((index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Handle sort column click
  const handleSort = useCallback(
    (key: string) => {
      let newDirection: EMRDataListSortDirection = 'asc';
      if (currentSortKey === key) {
        newDirection = currentSortDirection === 'asc' ? 'desc' : currentSortDirection === 'desc' ? null : 'asc';
      }

      if (onSortChange) {
        onSortChange(key, newDirection);
      } else {
        setInternalSortKey(newDirection ? key : null);
        setInternalSortDirection(newDirection);
      }
    },
    [currentSortKey, currentSortDirection, onSortChange]
  );

  // Sort items if internal sorting is enabled
  const sortedItems = useMemo(() => {
    if (!currentSortKey || !currentSortDirection || !columns) {
      return items;
    }

    const column = columns.find((c) => c.key === currentSortKey);
    if (!column?.sortable) {
      return items;
    }

    return [...items].sort((a, b) => {
      if (column.sortFn) {
        return column.sortFn(a, b, currentSortDirection);
      }
      const sortColumnKey = column.key;
      if (!hasColumnKey(a, sortColumnKey) || !hasColumnKey(b, sortColumnKey)) {
        return 0;
      }
      // Default string comparison
      const aVal = String(a[sortColumnKey] ?? '');
      const bVal = String(b[sortColumnKey] ?? '');
      const result = aVal.localeCompare(bVal);
      return currentSortDirection === 'desc' ? -result : result;
    });
  }, [items, currentSortKey, currentSortDirection, columns]);

  // Get key for an item
  const getKey = useCallback(
    (item: T, index: number): string | number => {
      if (getItemKey) {
        return getItemKey(item, index);
      }
      // Try common key patterns
      if ('id' in item && (typeof item.id === 'string' || typeof item.id === 'number')) {
        return item.id;
      }
      if ('key' in item && (typeof item.key === 'string' || typeof item.key === 'number')) {
        return item.key;
      }
      return index;
    },
    [getItemKey]
  );

  // Determine actual view mode (force card on mobile if columns not provided)
  const actualViewMode = isMobile && !columns ? 'card' : viewMode;

  // Memoized render column header function
  // T107: Wrapped with useCallback to prevent unnecessary re-renders of column headers
  const renderColumnHeader = useCallback(
    (column: EMRDataListColumn<T>) => {
      const isSorted = currentSortKey === column.key;
      const isDesc = isSorted && currentSortDirection === 'desc';

      const headerClasses = [
        classes.columnHeader,
        column.sortable ? classes.columnHeaderSortable : '',
      ]
        .filter(Boolean)
        .join(' ');

      const sortIconClasses = [
        classes.sortIcon,
        isSorted ? classes.sortIconActive : '',
        isDesc ? classes.sortIconDesc : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <Box
          key={column.key}
          className={headerClasses}
          style={{ flex: column.width ? `0 0 ${column.width}` : 1 }}
          onClick={column.sortable ? () => handleSort(column.key) : undefined}
          role={column.sortable ? 'button' : undefined}
          tabIndex={column.sortable ? 0 : undefined}
          onKeyDown={
            column.sortable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort(column.key);
                  }
                }
              : undefined
          }
        >
          {column.label}
          {column.sortable && (
            <IconChevronUp
              size={14}
              stroke={2}
              className={sortIconClasses}
            />
          )}
        </Box>
      );
    },
    [currentSortKey, currentSortDirection, handleSort]
  );

  // Memoized render expand button function
  // T107: Wrapped with useCallback to prevent unnecessary re-renders of expand buttons
  const renderExpandButton = useCallback(
    (index: number) => {
      const isExpanded = expandedIndices.has(index);
      return (
        <Tooltip label={isExpanded ? 'Collapse' : 'Expand'} position="top" withArrow>
          <button
            type="button"
            className={classes.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(index);
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <IconChevronDown
              size={16}
              stroke={2}
              className={`${classes.expandIcon} ${isExpanded ? classes.expandIconRotated : ''}`}
            />
          </button>
        </Tooltip>
      );
    },
    [expandedIndices, toggleExpand]
  );

  // Memoized render expanded details function
  // T107: Wrapped with useCallback to prevent unnecessary re-renders of detail panels
  const renderExpandedDetails = useCallback(
    (item: T) => {
      if (!detailFields || detailFields.length === 0) {
        return null;
      }

      return (
        <Box className={classes.expandedDetails}>
          <Box className={classes.detailsGrid}>
            {detailFields.map((field, fieldIndex) => (
              <Box key={field.label || fieldIndex} className={classes.detailItem}>
                <span className={classes.detailLabel}>{field.label}</span>
                <span className={classes.detailValue}>{field.render(item)}</span>
              </Box>
            ))}
          </Box>
        </Box>
      );
    },
    [detailFields]
  );

  // Memoized render view toggle function - MUST be before early return to respect Rules of Hooks
  // T107: Wrapped with useCallback to prevent unnecessary re-renders of view toggle
  const renderViewToggle = useCallback(() => {
    if (!showViewToggle) {
      return null;
    }

    return (
      <Box className={classes.actionBar}>
        <Box /> {/* Spacer for potential left-side content */}
        <Box className={classes.actionBarRight}>
          <Box className={classes.viewToggle}>
            <Tooltip label={t('common.listView')} position="top" withArrow>
              <button
                type="button"
                className={`${classes.viewToggleButton} ${actualViewMode === 'list' ? classes.viewToggleButtonActive : ''}`}
                onClick={() => setViewMode('list')}
                aria-label={t('common.listView')}
                aria-pressed={actualViewMode === 'list'}
              >
                <IconLayoutList size={18} stroke={1.5} />
              </button>
            </Tooltip>
            <Tooltip label={t('common.cardView')} position="top" withArrow>
              <button
                type="button"
                className={`${classes.viewToggleButton} ${actualViewMode === 'card' ? classes.viewToggleButtonActive : ''}`}
                onClick={() => setViewMode('card')}
                aria-label={t('common.cardView')}
                aria-pressed={actualViewMode === 'card'}
              >
                <IconLayoutGrid size={18} stroke={1.5} />
              </button>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    );
  }, [showViewToggle, actualViewMode, t]);

  // Empty state
  if (!items || items.length === 0) {
    return (
      <Box data-testid={`${dataTestId}-empty`} className={classes.emptyWrapper}>
        <EMREmptyState
          size="md"
          title={emptyTitle || 'No items found'}
          description={emptyDescription}
          icon={emptyIcon || IconInbox}
          action={emptyAction}
        />
      </Box>
    );
  }

  // Render list view with columns
  const renderListView = () => {
    return (
      <Box className={classes.listView}>
        {/* Header row */}
        {columns && columns.length > 0 && (
          <Box className={classes.listViewHeader} data-testid={`${dataTestId}-header`}>
            {expandable && <Box style={{ width: 32 }} />}
            {columns.map(renderColumnHeader)}
          </Box>
        )}

        {/* Data rows */}
        {sortedItems.map((item, index) => {
          const isExpanded = expandedIndices.has(index);
          const key = getKey(item, index);

          // If renderItem is provided, use simple rendering
          if (renderItem && !columns) {
            return (
              <Box
                key={key}
                className={animated ? classes.animatedItem : undefined}
                style={animated ? { animationDelay: `${index * 50}ms` } : undefined}
              >
                {renderItem(item, index)}
              </Box>
            );
          }

          // Render with columns
          return (
            <Box
              key={key}
              className={`${classes.listItem} ${isExpanded ? classes.listItemExpanded : ''}`}
              data-testid={`${dataTestId}-item-${index}`}
            >
              <Box className={classes.listItemRow}>
                {expandable && renderExpandButton(index)}
                {columns?.map((column) => (
                  <Box
                    key={column.key}
                    className={classes.listItemCell}
                    style={{ flex: column.width ? `0 0 ${column.width}` : 1 }}
                  >
                    {column.render
                      ? column.render(item, index)
                      : hasColumnKey(item, column.key)
                        ? String(item[column.key] ?? '')
                        : ''}
                  </Box>
                ))}
              </Box>
              {expandable && isExpanded && renderExpandedDetails(item)}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render card view
  const renderCardView = () => {
    return (
      <Box className={classes.cardView}>
        {sortedItems.map((item, index) => {
          const isExpanded = expandedIndices.has(index);
          const key = getKey(item, index);

          // If renderCard is provided, use custom card rendering
          if (renderCard) {
            return (
              <Box
                key={key}
                className={`${classes.cardItem} ${isExpanded ? classes.cardItemExpanded : ''} ${animated ? classes.animatedItem : ''}`}
                style={animated ? { animationDelay: `${index * 50}ms` } : undefined}
                data-testid={`${dataTestId}-card-${index}`}
              >
                {renderCard(item, index, isExpanded, () => toggleExpand(index))}
                {expandable && isExpanded && renderExpandedDetails(item)}
              </Box>
            );
          }

          // If renderItem is provided, use it for card view too
          if (renderItem) {
            return (
              <Box
                key={key}
                className={animated ? classes.animatedItem : undefined}
                style={animated ? { animationDelay: `${index * 50}ms` } : undefined}
              >
                {renderItem(item, index)}
              </Box>
            );
          }

          // Default card rendering with columns
          return (
            <Box
              key={key}
              className={`${classes.cardItem} ${isExpanded ? classes.cardItemExpanded : ''}`}
              data-testid={`${dataTestId}-card-${index}`}
            >
              <Box className={classes.cardHeader}>
                <Box className={classes.cardContent}>
                  {columns?.map((column, colIndex) => (
                    <Box key={column.key} className={colIndex === 0 ? classes.cardTitle : classes.cardMetaItem}>
                      {colIndex > 0 && <span className={classes.cardMetaIcon}>{column.label}:</span>}
                      {column.render
                        ? column.render(item, index)
                        : hasColumnKey(item, column.key)
                          ? String(item[column.key] ?? '')
                          : ''}
                    </Box>
                  ))}
                </Box>
                {expandable && <Box className={classes.cardActions}>{renderExpandButton(index)}</Box>}
              </Box>
              {expandable && isExpanded && renderExpandedDetails(item)}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Main content
  const content = (
    <Stack gap={gapMap[gap]} className={animated ? classes.animated : undefined}>
      {renderViewToggle()}
      {actualViewMode === 'list' ? renderListView() : renderCardView()}
    </Stack>
  );

  // With max height, wrap in ScrollArea
  if (maxHeight) {
    return (
      <ScrollArea.Autosize
        mah={maxHeight}
        data-testid={dataTestId}
        className={classes.scrollContainer}
      >
        {content}
      </ScrollArea.Autosize>
    );
  }

  // Without max height, render directly
  return (
    <Box data-testid={dataTestId} className={classes.listContainer}>
      {content}
    </Box>
  );
}

/**
 * EMRDataList wrapped with React.memo for performance optimization.
 * Prevents unnecessary re-renders when parent updates but props haven't changed.
 */
export const EMRDataList = React.memo(EMRDataListInner) as typeof EMRDataListInner;

export default EMRDataList;
