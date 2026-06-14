// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Grid } from '@mantine/core';
import type { MonthCell } from './calendar.types';

interface MonthGridProps {
  months: MonthCell[];
  onMonthClick: (month: number) => void;
}

/**
 * Grid of months with card-style tiles
 * @param root0
 * @param root0.months
 * @param root0.onMonthClick
 */
export function MonthGrid({ months, onMonthClick }: MonthGridProps) {
  const getMonthStyles = (cell: MonthCell): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      borderRadius: '12px',
      fontSize: 'var(--emr-font-md)',
      fontWeight: cell.isSelected || cell.isCurrent ? 'var(--emr-font-bold)' : 'var(--emr-font-semibold)',
      cursor: cell.isDisabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      userSelect: 'none',
      border: '1px solid var(--emr-border-color)',
    };

    if (cell.isDisabled) {
      return {
        ...baseStyles,
        color: 'var(--emr-text-muted)',
        opacity: 0.5,
        cursor: 'not-allowed',
      };
    }

    if (cell.isSelected) {
      return {
        ...baseStyles,
        background: 'var(--emr-secondary)',
        color: 'var(--emr-bg-card)',
        boxShadow: 'var(--emr-shadow-glow-primary)',
        border: 'none',
      };
    }

    if (cell.isCurrent) {
      return {
        ...baseStyles,
        border: '2px solid var(--emr-secondary)',
        background: 'rgba(var(--emr-primary-rgb), 0.05)',
        color: 'var(--emr-primary)',
      };
    }

    return {
      ...baseStyles,
      background: 'var(--emr-bg-card)',
      color: 'var(--emr-text-primary)',
    };
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, cell: MonthCell) => {
    if (cell.isDisabled) {return;}
    const target = e.currentTarget;
    if (!cell.isSelected) {
      target.style.background = 'rgba(var(--emr-primary-rgb), 0.15)';
      target.style.transform = 'translateY(-3px)';
      target.style.boxShadow = 'var(--emr-shadow-md)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>, cell: MonthCell) => {
    if (cell.isDisabled) {return;}
    const target = e.currentTarget;
    if (!cell.isSelected) {
      if (cell.isCurrent) {
        target.style.background = 'rgba(var(--emr-primary-rgb), 0.05)';
      } else {
        target.style.background = 'var(--emr-bg-card)';
      }
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = 'none';
    }
  };

  return (
    <Grid gutter="md">
      {months.map((cell) => (
        <Grid.Col key={cell.month} span={3}>
          <Box
            onClick={() => !cell.isDisabled && onMonthClick(cell.month)}
            style={getMonthStyles(cell)}
            onMouseEnter={(e) => handleMouseEnter(e, cell)}
            onMouseLeave={(e) => handleMouseLeave(e, cell)}
          >
            {cell.name.slice(0, 3)}
          </Box>
        </Grid.Col>
      ))}
    </Grid>
  );
}
