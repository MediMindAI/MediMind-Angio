// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Skeleton } from '@mantine/core';
import type { EMRTableColumn, EMRTableLoadingConfig } from './EMRTableTypes';

interface EMRTableSkeletonProps<T extends { id?: string | number }> {
  columns: EMRTableColumn<T>[];
  config?: EMRTableLoadingConfig;
  selectable?: boolean;
  hasActions?: boolean;
  compact?: boolean;
}

export function EMRTableSkeleton<T extends { id?: string | number }>({
  columns,
  config,
  selectable,
  hasActions,
  compact,
}: EMRTableSkeletonProps<T>): React.ReactElement {
  const rowCount = config?.rows ?? 5;
  const animate = config?.animate ?? true;

  const cellPadding = compact ? 'var(--emr-table-cell-padding-compact)' : 'var(--emr-table-cell-padding)';

  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr
          key={`skeleton-row-${rowIndex}`}
          style={{
            backgroundColor: rowIndex % 2 === 0 ? 'var(--emr-table-row-bg)' : 'var(--emr-table-row-stripe)',
          }}
        >
          {/* Checkbox skeleton */}
          {selectable && (
            <td
              style={{
                padding: cellPadding,
                width: 48,
                textAlign: 'center',
              }}
            >
              <Skeleton
                height={18}
                width={18}
                radius="sm"
                animate={animate}
                style={{ margin: '0 auto' }}
              />
            </td>
          )}

          {/* Column skeletons */}
          {columns.map((column, colIndex) => (
            <td
              key={`skeleton-cell-${rowIndex}-${colIndex}`}
              style={{
                padding: cellPadding,
                textAlign: column.align || 'left',
              }}
            >
              <Skeleton
                height={14}
                width={getSkeletonWidth(column, colIndex)}
                radius="sm"
                animate={animate}
                style={{
                  marginLeft: column.align === 'right' ? 'auto' : undefined,
                  marginRight: column.align === 'center' ? 'auto' : undefined,
                }}
              />
            </td>
          ))}

          {/* Actions skeleton */}
          {hasActions && (
            <td
              style={{
                padding: cellPadding,
                width: 80,
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Skeleton height={28} width={28} radius="sm" animate={animate} />
                <Skeleton height={28} width={28} radius="sm" animate={animate} />
              </div>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

/**
 * Get varied skeleton width based on column type
 * @param column
 * @param index
 */
function getSkeletonWidth<T extends { id?: string | number }>(column: EMRTableColumn<T>, index: number): string {
  // Vary width based on format type
  switch (column.format) {
    case 'number':
    case 'percentage':
      return '60%';
    case 'currency':
      return '70%';
    case 'date':
      return '80%';
    case 'datetime':
      return '90%';
    case 'boolean':
      return '40%';
    default: {
      // Vary text columns to look more natural
      const variations = ['85%', '70%', '90%', '75%', '80%'];
      return variations[index % variations.length] ?? '80%';
    }
  }
}

export default EMRTableSkeleton;
