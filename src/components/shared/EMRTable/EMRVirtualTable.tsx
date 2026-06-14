// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useRef, useCallback } from 'react';
import { Box, Text, Group, Pagination, Skeleton, ActionIcon, Menu } from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { IconDots } from '@tabler/icons-react';
import type { EMRTableColumn, EMRTableActions } from './EMRTableTypes';
import { useTranslation } from '../../../contexts/TranslationContext';

// Import theme CSS and module styles
import '../../../styles/theme.css';
import styles from './EMRTable.module.css';

/**
 * Type guard narrowing a column key (which may be a display-only string for
 * custom-rendered columns) to a real key of the row before indexing.
 * @param key
 * @param obj
 */
function isKeyOf<T extends object>(key: string | keyof T, obj: T): key is keyof T {
  return key in obj;
}

interface EMRVirtualTableProps<T extends { id?: string | number }> {
  columns: EMRTableColumn<T>[];
  data: T[];
  loading?: boolean;
  getRowId?: (row: T) => string | number;
  actions?: (row: T) => EMRTableActions<T>;
  emptyState?: {
    icon?: React.ComponentType<{ size?: number; color?: string }>;
    title: string;
    description?: string;
  };
  // Pagination
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
  // Styling
  rowHeight?: number;
  maxHeight?: number;
  striped?: boolean;
}

/**
 * EMRVirtualTable - High-performance virtualized table
 *
 * Uses @tanstack/react-virtual to only render visible rows.
 * Ideal for large datasets (100+ rows).
 * @param root0
 * @param root0.columns
 * @param root0.data
 * @param root0.loading
 * @param root0.getRowId
 * @param root0.actions
 * @param root0.emptyState
 * @param root0.pagination
 * @param root0.rowHeight
 * @param root0.maxHeight
 * @param root0.striped
 */
export function EMRVirtualTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  getRowId = (row) => row.id as string | number,
  actions,
  emptyState,
  pagination,
  rowHeight = 52,
  maxHeight = 500,
  striped = true,
}: EMRVirtualTableProps<T>): React.JSX.Element {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual row setup
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calculate column widths
  const getColumnStyle = useCallback((col: EMRTableColumn<T>): React.CSSProperties => {
    if (col.width) {
      return { width: col.width, minWidth: col.width, maxWidth: col.width };
    }
    return { flex: 1, minWidth: 100 };
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <Box>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: columns.map(c => c.width ? `${c.width}px` : '1fr').join(' ') + (actions ? ' 80px' : ''),
            gap: 0,
            borderBottom: '2px solid var(--emr-primary)',
            padding: '12px 16px',
            background: 'var(--emr-gradient-secondary)',
          }}
        >
          {columns.map((col) => (
            <Text key={String(col.key)} fw={600} size="xs" c="var(--emr-text-inverse)" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              {col.title}
            </Text>
          ))}
          {actions && <Text fw={600} size="xs" c="var(--emr-text-inverse)"></Text>}
        </Box>
        <Box p="md">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={`virtual-row-skeleton-${i}`} height={rowHeight - 12} mb="sm" radius="sm" />
          ))}
        </Box>
      </Box>
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    const EmptyIcon = emptyState.icon;
    return (
      <Box ta="center" py="xl">
        {EmptyIcon && <EmptyIcon size={48} color="var(--emr-text-muted)" />}
        <Text size="lg" fw={500} c="var(--emr-text-primary)" mt="md">
          {emptyState.title}
        </Text>
        {emptyState.description && (
          <Text size="sm" c="dimmed" mt="xs">
            {emptyState.description}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header - Blue gradient to match EMRTable */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: columns.map(c => c.width ? `${c.width}px` : '1fr').join(' ') + (actions ? ' 80px' : ''),
          gap: 0,
          borderBottom: '2px solid var(--emr-primary)',
          padding: '12px 16px',
          background: 'var(--emr-gradient-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {columns.map((col) => (
          <Text key={String(col.key)} fw={600} size="xs" c="var(--emr-text-inverse)" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            {col.title}
          </Text>
        ))}
        {actions && <Text fw={600} size="sm" c="var(--emr-text-primary)"></Text>}
      </Box>

      {/* Virtualized Body */}
      <Box
        ref={parentRef}
        style={{
          height: Math.min(maxHeight, totalSize + 20),
          maxHeight,
          overflow: 'auto',
          contain: 'strict',
        }}
      >
        <Box
          style={{
            height: totalSize,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = data[virtualRow.index];
            if (!row) {return null;}
            const rowId = getRowId(row);
            const isEven = virtualRow.index % 2 === 0;
            const rowActions = actions?.(row);

            return (
              <Box
                key={rowId}
                data-index={virtualRow.index}
                className={striped && isEven ? styles.virtualRowStriped : styles.virtualRow}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: columns.map(c => c.width ? `${c.width}px` : '1fr').join(' ') + (actions ? ' 80px' : ''),
                  alignItems: 'center',
                  padding: '0 16px',
                }}
              >
                {columns.map((col) => (
                  <Box key={String(col.key)} style={getColumnStyle(col)}>
                    {col.render ? col.render(row, virtualRow.index) : String((isKeyOf(col.key, row) ? row[col.key] : undefined) ?? '')}
                  </Box>
                ))}

                {/* Actions */}
                {rowActions && (
                  <Group gap={4} justify="flex-end">
                    {rowActions.primary && (
                      <ActionIcon
                        variant="subtle"
                        color={rowActions.primary.color || 'blue'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          rowActions.primary?.onClick(row);
                        }}
                        title={rowActions.primary.label}
                        aria-label={rowActions.primary.label}
                      >
                        <rowActions.primary.icon size={16} />
                      </ActionIcon>
                    )}
                    {rowActions.secondary && rowActions.secondary.length > 0 && (
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t('common.moreActions')}>
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {rowActions.secondary.map((action, idx) => (
                            <Menu.Item
                              key={idx}
                              leftSection={<action.icon size={14} />}
                              color={action.color}
                              onClick={() => action.onClick(row)}
                            >
                              {action.label}
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Group>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Pagination */}
      {pagination && pagination.total > pagination.pageSize && (
        <Group justify="space-between" p="md" style={{ borderTop: '1px solid var(--emr-border-color)' }}>
          <Text size="sm" c="dimmed">
            {((pagination.page - 1) * pagination.pageSize) + 1}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} / {pagination.total}
          </Text>
          <Pagination
            value={pagination.page}
            onChange={pagination.onPageChange}
            total={Math.ceil(pagination.total / pagination.pageSize)}
            size="sm"
            radius="md"
          />
        </Group>
      )}
    </Box>
  );
}
