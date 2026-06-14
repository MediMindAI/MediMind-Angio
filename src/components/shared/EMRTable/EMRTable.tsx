// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties } from 'react';
import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import { Table, Box, Pagination, Group, Text, NativeSelect, Tooltip } from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { EMRCheckbox } from '../EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';

import type {
  EMRTableProps,
  EMRTableColumn,
  SortDirection,
  ColumnFormat,
} from './EMRTableTypes';
import { EMRTableEmptyState } from './EMRTableEmptyState';
import { EMRTableSkeleton } from './EMRTableSkeleton';
import { EMRTableActions } from './EMRTableActions';
import { THEME_FONT_WEIGHTS } from '../../../styles/theme-constants';

// Import theme CSS and module styles
import '../../../styles/theme.css';
import styles from './EMRTable.module.css';

/**
 * EMRTable - Main component wrapped with React.memo for performance optimization.
 * Used in 50+ data-heavy pages, memo prevents unnecessary re-renders.
 * @param root0
 * @param root0.columns
 * @param root0.data
 * @param root0.loading
 * @param root0.loadingConfig
 * @param root0.emptyState
 * @param root0.selectable
 * @param root0.selectedRows
 * @param root0.onSelectionChange
 * @param root0.allowSelectAll
 * @param root0.sortField
 * @param root0.sortDirection
 * @param root0.onSort
 * @param root0.pagination
 * @param root0.actions
 * @param root0.onRowClick
 * @param root0.highlightRow
 * @param root0.getRowId
 * @param root0.stickyHeader
 * @param root0.stickyOffset
 * @param root0.striped
 * @param root0.height
 * @param root0.maxHeight
 * @param root0.minWidth
 * @param root0.className
 * @param root0.compact
 * @param root0.disableHover
 * @param root0.ariaLabel
 * @param root0.ariaDescribedBy
 */
export const EMRTable = memo(function EMRTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  loadingConfig,
  emptyState,

  // Selection
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  allowSelectAll = true,

  // Sorting
  sortField,
  sortDirection,
  onSort,

  // Pagination
  pagination,

  // Actions
  actions,

  // Row interactions
  onRowClick,
  highlightRow,
  rowLeftBorder,
  getRowId = (row) => row.id as string | number,

  // Styling
  stickyHeader = false,
  stickyOffset = 0,
  striped = true,
  height,
  maxHeight,
  minWidth,
  className,
  compact = false,
  disableHover = false,

  // Virtualization
  virtualized = false,
  estimatedRowHeight = 52,
  overscan = 10,

  // Accessibility
  ariaLabel,
  ariaDescribedBy,
  caption,
  showCaption = false,
  enableKeyboardNavigation = false,
  onFocusedRowChange,
}: EMRTableProps<T>): React.ReactElement {
  const { t } = useTranslation();

  // Track hover state for rows
  const [hoveredRowId, setHoveredRowId] = useState<string | number | null>(null);

  // Track focused row for keyboard navigation
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Virtualization ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Table ref for keyboard events
  const tableRef = useRef<HTMLTableElement>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Filter columns based on responsive settings
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => {
      if (isMobile && col.hideOnMobile) {return false;}
      if (isTablet && col.hideOnTablet) {return false;}
      return true;
    });
  }, [columns, isMobile, isTablet]);

  // Pre-compute cumulative left offsets for multiple sticky-left columns
  // so they don't overlap when scrolling horizontally.
  const stickyLeftOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let cumulativeLeft = 0;
    for (const col of visibleColumns) {
      if (col.sticky === 'left') {
        offsets.set(col.key, cumulativeLeft);
        const w = typeof col.width === 'number' ? col.width : 0;
        cumulativeLeft += w;
      }
    }
    return offsets;
  }, [visibleColumns]);

  // Find the last sticky-left column key for box-shadow separator
  const lastStickyLeftKey = useMemo(() => {
    let lastKey = '';
    for (const col of visibleColumns) {
      if (col.sticky === 'left') {
        lastKey = col.key;
      }
    }
    return lastKey;
  }, [visibleColumns]);

  // Calculate if all visible rows are selected
  const allSelected = useMemo(() => {
    if (data.length === 0) {return false;}
    return data.every((row) => selectedRows.includes(getRowId(row)));
  }, [data, selectedRows, getRowId]);

  // Some rows selected (for indeterminate state)
  const someSelected = useMemo(() => {
    if (data.length === 0) {return false;}
    const selectedCount = data.filter((row) => selectedRows.includes(getRowId(row))).length;
    return selectedCount > 0 && selectedCount < data.length;
  }, [data, selectedRows, getRowId]);

  // Handle select all
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) {return;}
      if (checked) {
        const allIds = data.map((row) => getRowId(row));
        onSelectionChange(allIds);
      } else {
        onSelectionChange([]);
      }
    },
    [data, getRowId, onSelectionChange]
  );

  // Handle single row select
  const handleRowSelect = useCallback(
    (id: string | number, checked: boolean) => {
      if (!onSelectionChange) {return;}
      if (checked) {
        onSelectionChange([...selectedRows, id]);
      } else {
        onSelectionChange(selectedRows.filter((rowId) => rowId !== id));
      }
    },
    [selectedRows, onSelectionChange]
  );

  // Handle sort click
  const handleSort = useCallback(
    (field: string) => {
      if (!onSort) {return;}

      let newDirection: SortDirection;
      if (sortField !== field) {
        newDirection = 'asc';
      } else if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else {
        newDirection = null;
      }

      onSort(field, newDirection);
    },
    [sortField, sortDirection, onSort]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableElement>) => {
      if (!enableKeyboardNavigation || loading || data.length === 0) {return;}

      const { key } = event;
      let newIndex = focusedRowIndex;

      switch (key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = Math.min(focusedRowIndex + 1, data.length - 1);
          if (focusedRowIndex === -1) {newIndex = 0;}
          break;
        case 'ArrowUp':
          event.preventDefault();
          newIndex = Math.max(focusedRowIndex - 1, 0);
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = data.length - 1;
          break;
        case 'Enter':
        case ' ':
          if (focusedRowIndex >= 0 && focusedRowIndex < data.length) {
            event.preventDefault();
            const row = data[focusedRowIndex];
            if (!row) {return;}
            if (selectable && onSelectionChange) {
              const rowId = getRowId(row);
              const isSelected = selectedRows.includes(rowId);
              handleRowSelect(rowId, !isSelected);
            } else if (onRowClick) {
              onRowClick(row);
            }
          }
          return;
        default:
          return;
      }

      if (newIndex !== focusedRowIndex) {
        setFocusedRowIndex(newIndex);
        const nextRow = newIndex >= 0 ? data[newIndex] : undefined;
        const rowId = nextRow ? getRowId(nextRow) : null;
        onFocusedRowChange?.(rowId);
      }
    },
    [enableKeyboardNavigation, loading, data, focusedRowIndex, selectable, onSelectionChange, selectedRows, getRowId, handleRowSelect, onRowClick, onFocusedRowChange]
  );

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: virtualized && !loading ? data.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: overscan,
  });

  const virtualRows = virtualized ? rowVirtualizer.getVirtualItems() : [];
  const totalVirtualSize = virtualized ? rowVirtualizer.getTotalSize() : 0;

  // Calculate column count for empty state colspan
  const totalColumns =
    visibleColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

  const cellPadding = compact
    ? 'var(--emr-table-cell-padding-compact)'
    : 'var(--emr-table-cell-padding)';

  // Container styles
  const containerStyle: CSSProperties = {
    borderRadius: 'var(--emr-table-border-radius)',
    boxShadow: 'var(--emr-table-shadow)',
    border: '1px solid var(--emr-table-border)',
    overflow: 'hidden',
    background: 'var(--emr-table-row-bg)',
  };

  // Scroll wrapper styles
  const scrollWrapperStyle: CSSProperties = {
    overflowX: 'auto',
    overflowY: height || maxHeight ? 'auto' : undefined,
    height: height,
    maxHeight: maxHeight,
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <Box className={className} style={containerStyle}>
      <Box ref={scrollContainerRef} style={scrollWrapperStyle} className="emr-scrollbar">
        <Table
          ref={tableRef}
          style={{ minWidth: minWidth || 'auto' }}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          tabIndex={enableKeyboardNavigation ? 0 : undefined}
          onKeyDown={enableKeyboardNavigation ? handleKeyDown : undefined}
        >
          {/* Table Caption for Accessibility */}
          {caption && (
            <caption
              style={showCaption ? undefined : {
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              {caption}
            </caption>
          )}
          {/* Table Header */}
          <Table.Thead
            className={styles.tableHeader}
            style={{
              position: stickyHeader ? 'sticky' : undefined,
              top: stickyHeader ? stickyOffset : undefined,
              zIndex: stickyHeader ? 10 : undefined,
            }}
          >
            <Table.Tr>
              {/* Select All Checkbox */}
              {selectable && (
                <Table.Th
                  scope="col"
                  style={{
                    padding: cellPadding,
                    width: 48,
                    textAlign: 'center',
                    borderBottom: '2px solid var(--emr-table-header-border)',
                  }}
                >
                  {allowSelectAll && (
                    <EMRCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(checked) => {
                        handleSelectAll(checked);
                      }}
                      size="sm"
                      color="blue"
                      aria-label={t('table.selectAllRows')}
                      styles={{
                        input: {
                          cursor: 'pointer',
                          borderColor: 'var(--emr-border-color)',
                          '&:checked': {
                            backgroundColor: 'var(--emr-table-checkbox-color)',
                            borderColor: 'var(--emr-table-checkbox-color)',
                          },
                        },
                      }}
                    />
                  )}
                </Table.Th>
              )}

              {/* Column Headers */}
              {visibleColumns.map((column) => {
                // Determine aria-sort value for accessible sorting
                const getAriaSort = (): 'ascending' | 'descending' | 'none' | undefined => {
                  if (!column.sortable || !onSort) return undefined;
                  if (sortField !== column.key || !sortDirection) return 'none';
                  return sortDirection === 'asc' ? 'ascending' : 'descending';
                };

                return (
                <Table.Th
                  key={column.key}
                  scope="col"
                  aria-sort={getAriaSort()}
                  style={{
                    padding: cellPadding,
                    textAlign: column.align || 'left',
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                    fontWeight: THEME_FONT_WEIGHTS.bold,
                    color: 'var(--emr-table-header-text)',
                    fontSize: 'var(--emr-font-sm)',
                    letterSpacing: '0.01em',
                    borderBottom: '2px solid var(--emr-table-header-border)',
                    cursor: column.sortable && onSort ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'var(--emr-transition-fast)',
                    position: column.sticky ? 'sticky' : undefined,
                    left: column.sticky === 'left' ? (stickyLeftOffsets.get(column.key) ?? 0) : undefined,
                    right: column.sticky === 'right' ? 0 : undefined,
                    background: column.sticky ? 'var(--emr-table-header-bg)' : undefined,
                    zIndex: column.sticky ? 5 : undefined,
                    overflow: column.sticky ? 'hidden' : undefined,
                    boxShadow: (column.sticky === 'left' && column.key === lastStickyLeftKey) ? '2px 0 4px rgba(0,0,0,0.06)' : undefined,
                  }}
                  onClick={() => column.sortable && onSort && handleSort(column.key)}
                  className={column.className}
                >
                  <Group gap={4} justify={column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start'}>
                    {column.headerTooltip ? (
                      <Tooltip label={column.headerTooltip} multiline maw={300} withArrow position="top">
                        <span style={{ borderBottom: '1px dashed var(--emr-text-secondary)', cursor: 'help' }}>
                          {column.title}
                        </span>
                      </Tooltip>
                    ) : (
                      <span>{column.title}</span>
                    )}
                    {column.sortable && onSort && (
                      <SortIcon
                        field={column.key}
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    )}
                  </Group>
                </Table.Th>
              );
              })}

              {/* Actions Header */}
              {actions && (
                <Table.Th
                  scope="col"
                  className={styles.actionColumn}
                  style={{
                    padding: cellPadding,
                  }}
                >
                  <span className={styles.srOnly}>{t('common.actions')}</span>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>

          {/* Table Body */}
          <Table.Tbody
            style={virtualized && !loading && data.length > 0 ? {
              height: `${totalVirtualSize}px`,
              position: 'relative',
            } : undefined}
          >
            {/* Loading State */}
            {loading && (
              <EMRTableSkeleton
                columns={visibleColumns}
                config={loadingConfig}
                selectable={selectable}
                hasActions={!!actions}
                compact={compact}
              />
            )}

            {/* Empty State */}
            {!loading && data.length === 0 && (
              <EMRTableEmptyState config={emptyState} colSpan={totalColumns} />
            )}

            {/* Virtualized Data Rows */}
            {!loading && virtualized && data.length > 0 &&
              virtualRows.map((virtualRow) => {
                const rowIndex = virtualRow.index;
                const row = data[rowIndex];
                if (!row) {return null;}
                const rowId = getRowId(row);
                const isSelected = selectedRows.includes(rowId);
                const isHovered = hoveredRowId === rowId;
                const isFocused = enableKeyboardNavigation && focusedRowIndex === rowIndex;

                // Calculate highlight
                let isHighlighted: boolean | string = false;
                if (highlightRow) {
                  isHighlighted = highlightRow(row, rowIndex);
                }
                const highlightColor =
                  typeof isHighlighted === 'string'
                    ? isHighlighted
                    : isHighlighted
                    ? 'var(--emr-table-row-highlight)'
                    : undefined;

                // Opaque base background for sticky cells (never semi-transparent)
                const baseBg = striped && rowIndex % 2 === 1 ? 'var(--emr-table-row-stripe)' : 'var(--emr-table-row-bg)';

                // Row background (may include semi-transparent highlight tints)
                let rowBg = baseBg;
                if (highlightColor) {rowBg = highlightColor;}
                if (isSelected) {rowBg = 'var(--emr-table-row-selected)';}
                if (isHovered && !disableHover) {rowBg = 'var(--emr-table-row-hover)';}
                if (isFocused) {rowBg = 'var(--emr-table-row-focused, var(--emr-bg-hover))';}

                const rowClassName = disableHover
                  ? `${styles.tableRow} ${styles.tableRowDisableHover}`
                  : styles.tableRow;

                return (
                  <Table.Tr
                    key={rowId}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={rowClassName}
                    aria-selected={isSelected || undefined}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      backgroundColor: rowBg,
                      cursor: onRowClick ? 'pointer' : 'default',
                      outline: isFocused ? '2px solid var(--emr-primary)' : undefined,
                      outlineOffset: isFocused ? '-2px' : undefined,
                      borderLeft: isSelected
                        ? '3px solid var(--emr-table-selected-border)'
                        : rowLeftBorder
                          ? `3px solid ${rowLeftBorder(row, rowIndex) || 'transparent'}`
                          : '3px solid transparent',
                      display: 'table-row',
                    }}
                    onClick={() => onRowClick?.(row)}
                    onMouseEnter={() => !disableHover && setHoveredRowId(rowId)}
                    onMouseLeave={() => !disableHover && setHoveredRowId(null)}
                  >
                    {/* Row Checkbox */}
                    {selectable && (
                      <Table.Td
                        style={{
                          padding: cellPadding,
                          textAlign: 'center',
                          borderBottom: '1px solid var(--emr-table-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EMRCheckbox
                          checked={isSelected}
                          onChange={(checked) => {
                            handleRowSelect(rowId, checked);
                          }}
                          size="sm"
                          color="blue"
                          aria-label={t('table.selectRow', { row: rowIndex + 1 })}
                          styles={{
                            input: {
                              cursor: 'pointer',
                              borderColor: 'var(--emr-border-color)',
                              '&:checked': {
                                backgroundColor: 'var(--emr-table-checkbox-color)',
                                borderColor: 'var(--emr-table-checkbox-color)',
                              },
                            },
                          }}
                        />
                      </Table.Td>
                    )}

                    {/* Data Cells */}
                    {visibleColumns.map((column) => (
                      <Table.Td
                        key={column.key}
                        style={{
                          padding: cellPadding,
                          textAlign: column.align || 'left',
                          fontSize: 'var(--emr-font-base)',
                          color: 'var(--emr-text-primary)',
                          borderBottom: '1px solid var(--emr-table-border)',
                          maxWidth: column.maxWidth,
                          overflow: column.sticky ? 'hidden' : (column.maxWidth ? 'hidden' : undefined),
                          position: column.sticky ? 'sticky' : undefined,
                          left: column.sticky === 'left' ? (stickyLeftOffsets.get(column.key) ?? 0) : undefined,
                          right: column.sticky === 'right' ? 0 : undefined,
                          background: column.sticky ? baseBg : undefined,
                          zIndex: column.sticky ? 1 : undefined,
                          boxShadow: (column.sticky === 'left' && column.key === lastStickyLeftKey) ? '2px 0 4px rgba(0,0,0,0.06)' : undefined,
                        }}
                        className={column.className}
                      >
                        {renderCellContent(row, column, rowIndex)}
                      </Table.Td>
                    ))}

                    {/* Actions Cell */}
                    {actions && (
                      <Table.Td
                        className={styles.actionColumn}
                        style={{
                          padding: cellPadding,
                          borderBottom: '1px solid var(--emr-table-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EMRTableActions row={row} actions={actions(row)} />
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}

            {/* Non-virtualized Data Rows (default behavior) */}
            {!loading && !virtualized &&
              data.map((row, rowIndex) => {
                const rowId = getRowId(row);
                const isSelected = selectedRows.includes(rowId);
                const isHovered = hoveredRowId === rowId;
                const isFocused = enableKeyboardNavigation && focusedRowIndex === rowIndex;

                // Calculate highlight
                let isHighlighted: boolean | string = false;
                if (highlightRow) {
                  isHighlighted = highlightRow(row, rowIndex);
                }
                const highlightColor =
                  typeof isHighlighted === 'string'
                    ? isHighlighted
                    : isHighlighted
                    ? 'var(--emr-table-row-highlight)'
                    : undefined;

                // Opaque base background for sticky cells (never semi-transparent)
                const baseBg = striped && rowIndex % 2 === 1 ? 'var(--emr-table-row-stripe)' : 'var(--emr-table-row-bg)';

                // Row background (may include semi-transparent highlight tints)
                let rowBg = baseBg;
                if (highlightColor) {rowBg = highlightColor;}
                if (isSelected) {rowBg = 'var(--emr-table-row-selected)';}
                if (isHovered && !disableHover) {rowBg = 'var(--emr-table-row-hover)';}
                if (isFocused) {rowBg = 'var(--emr-table-row-focused, var(--emr-bg-hover))';}

                const rowClassName = disableHover
                  ? `${styles.tableRow} ${styles.tableRowDisableHover}`
                  : styles.tableRow;

                return (
                  <Table.Tr
                    key={rowId}
                    className={rowClassName}
                    aria-selected={isSelected || undefined}
                    style={{
                      backgroundColor: rowBg,
                      cursor: onRowClick ? 'pointer' : 'default',
                      borderLeft: isSelected
                        ? '3px solid var(--emr-table-selected-border)'
                        : rowLeftBorder
                          ? `3px solid ${rowLeftBorder(row, rowIndex) || 'transparent'}`
                          : '3px solid transparent',
                      outline: isFocused ? '2px solid var(--emr-primary)' : undefined,
                      outlineOffset: isFocused ? '-2px' : undefined,
                    }}
                    onClick={() => onRowClick?.(row)}
                    onMouseEnter={() => !disableHover && setHoveredRowId(rowId)}
                    onMouseLeave={() => !disableHover && setHoveredRowId(null)}
                  >
                    {/* Row Checkbox */}
                    {selectable && (
                      <Table.Td
                        style={{
                          padding: cellPadding,
                          textAlign: 'center',
                          borderBottom: '1px solid var(--emr-table-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EMRCheckbox
                          checked={isSelected}
                          onChange={(checked) => {
                            handleRowSelect(rowId, checked);
                          }}
                          size="sm"
                          color="blue"
                          aria-label={t('table.selectRow', { row: rowIndex + 1 })}
                          styles={{
                            input: {
                              cursor: 'pointer',
                              borderColor: 'var(--emr-border-color)',
                              '&:checked': {
                                backgroundColor: 'var(--emr-table-checkbox-color)',
                                borderColor: 'var(--emr-table-checkbox-color)',
                              },
                            },
                          }}
                        />
                      </Table.Td>
                    )}

                    {/* Data Cells */}
                    {visibleColumns.map((column) => (
                      <Table.Td
                        key={column.key}
                        style={{
                          padding: cellPadding,
                          textAlign: column.align || 'left',
                          fontSize: 'var(--emr-font-base)',
                          color: 'var(--emr-text-primary)',
                          borderBottom: '1px solid var(--emr-table-border)',
                          maxWidth: column.maxWidth,
                          overflow: column.sticky ? 'hidden' : (column.maxWidth ? 'hidden' : undefined),
                          position: column.sticky ? 'sticky' : undefined,
                          left: column.sticky === 'left' ? (stickyLeftOffsets.get(column.key) ?? 0) : undefined,
                          right: column.sticky === 'right' ? 0 : undefined,
                          background: column.sticky ? baseBg : undefined,
                          zIndex: column.sticky ? 1 : undefined,
                          boxShadow: (column.sticky === 'left' && column.key === lastStickyLeftKey) ? '2px 0 4px rgba(0,0,0,0.06)' : undefined,
                        }}
                        className={column.className}
                      >
                        {renderCellContent(row, column, rowIndex)}
                      </Table.Td>
                    ))}

                    {/* Actions Cell */}
                    {actions && (
                      <Table.Td
                        className={styles.actionColumn}
                        style={{
                          padding: cellPadding,
                          borderBottom: '1px solid var(--emr-table-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EMRTableActions row={row} actions={actions(row)} />
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <Box
          px="lg"
          py="sm"
          style={{
            borderTop: '1px solid var(--emr-table-border)',
            background: 'var(--emr-bg-card)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text
              size="sm"
              fw={500}
              style={{ color: 'var(--emr-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {t('common.showing')}{' '}
              <Text component="span" fw={700} style={{ color: 'var(--emr-text-primary)' }}>
                {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </Text>
              {' '}{t('common.of')}{' '}
              <Text component="span" fw={700} style={{ color: 'var(--emr-text-primary)' }}>
                {pagination.total}
              </Text>
            </Text>

            <Group gap="md" wrap="wrap">
              {pagination.showPageSizeSelector && pagination.onPageSizeChange && (
                <Group gap={8} style={{ flexShrink: 0 }}>
                  <Text size="sm" fw={500} style={{ color: 'var(--emr-text-secondary)', whiteSpace: 'nowrap' }}>
                    {t('common.perPage')}:
                  </Text>
                  <NativeSelect
                    value={String(pagination.pageSize)}
                    data={(pagination.pageSizeOptions || [10, 20, 50, 100]).map((n) => String(n))}
                    onChange={(e) => {
                      pagination.onPageSizeChange?.(Number(e.currentTarget.value));
                    }}
                    size="sm"
                    styles={{
                      input: {
                        width: 72,
                        fontSize: 'var(--emr-font-base)',
                        fontWeight: 600,
                        textAlign: 'center',
                        borderRadius: 'var(--emr-border-radius-sm)',
                        border: '1px solid var(--emr-border-color)',
                        background: 'var(--emr-bg-card)',
                        color: 'var(--emr-text-primary)',
                        cursor: 'pointer',
                      },
                    }}
                  />
                </Group>
              )}

              <Pagination
                total={Math.ceil(pagination.total / pagination.pageSize)}
                value={pagination.page}
                onChange={pagination.onChange}
                size="md"
                radius="md"
                withEdges
                getControlProps={(control) => ({
                  'aria-label': t(`table.pagination.${control}`),
                })}
                getItemProps={(page) => ({
                  'aria-label': t('table.pagination.page', { page }),
                })}
                styles={{
                  control: {
                    fontSize: 'var(--emr-font-base)',
                    fontWeight: 600,
                    minWidth: 36,
                    height: 36,
                    '&[dataActive]': {
                      background: 'var(--emr-secondary)',
                    },
                  },
                }}
              />
            </Group>
          </Group>
        </Box>
      )}
    </Box>
  );
}) as <T extends { id?: string | number }>(props: EMRTableProps<T>) => React.ReactElement;

/**
 * Sort icon component
 * @param root0
 * @param root0.field
 * @param root0.sortField
 * @param root0.sortDirection
 */
function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: string;
  sortField?: string;
  sortDirection?: SortDirection;
}): React.ReactElement {
  const isActive = sortField === field;
  const iconColor = isActive
    ? 'var(--emr-table-sort-icon-active)'
    : 'var(--emr-table-sort-icon-inactive)';

  if (!isActive || !sortDirection) {
    return <IconSelector size={14} style={{ color: iconColor, opacity: 0.5 }} />;
  }

  if (sortDirection === 'asc') {
    return <IconChevronUp size={14} style={{ color: iconColor }} />;
  }

  return <IconChevronDown size={14} style={{ color: iconColor }} />;
}

/**
 * Type guard narrowing a column key (which may be a display-only string for
 * custom-rendered columns) to a real key of the row before indexing.
 * @param key
 * @param obj
 */
function isKeyOf<T extends object>(key: string | keyof T, obj: T): key is keyof T {
  return key in obj;
}

/**
 * Render cell content with formatting
 * @param row
 * @param column
 * @param rowIndex
 */
function renderCellContent<T extends object>(
  row: T,
  column: EMRTableColumn<T>,
  rowIndex: number
): React.ReactNode {
  // Custom render function takes priority
  if (column.render) {
    return column.render(row, rowIndex);
  }

  // Get raw value
  const value: unknown = isKeyOf(column.key, row) ? row[column.key] : undefined;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--emr-text-secondary)' }}>—</span>;
  }

  // Apply formatting
  const formatted = formatValue(value, column.format, column.currencyCode);

  // Apply lineClamp with tooltip when set
  if (column.lineClamp) {
    const fullText = typeof formatted === 'string' ? formatted : String(value);
    return (
      <Tooltip label={fullText} multiline maw={400} withArrow>
        <Text lineClamp={column.lineClamp} style={{ fontSize: 'inherit', color: 'inherit' }}>
          {formatted}
        </Text>
      </Tooltip>
    );
  }

  return formatted;
}

/**
 * Format value based on column format type
 * @param value
 * @param format
 * @param currencyCode
 */
function formatValue(
  value: unknown,
  format?: ColumnFormat,
  currencyCode: string = 'GEL'
): React.ReactNode {
  switch (format) {
    case 'currency': {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(num) ? String(value) : `${num.toFixed(2)} ${currencyCode}`;
    }
    case 'number': {
      const numVal = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(numVal) ? String(value) : numVal.toLocaleString();
    }
    case 'percentage': {
      const pctVal = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(pctVal) ? String(value) : `${pctVal}%`;
    }

    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return String(value);

    case 'datetime':
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      return String(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
}

export default EMRTable;
