// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Grid, Text } from '@mantine/core';
import type { DateCell } from './calendar.types';
import { getWeekdayNames } from './calendar.utils';

interface DayGridProps {
  days: DateCell[];
  onDayClick: (date: Date) => void;
}

/**
 * Grid of days with beautiful styling and animations
 * @param root0
 * @param root0.days
 * @param root0.onDayClick
 */
export function DayGrid({ days, onDayClick }: DayGridProps) {
  const weekdayNames = getWeekdayNames(true);

  const getDayStyles = (cell: DateCell) => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '32px',
      borderRadius: '8px',
      fontSize: 'var(--emr-font-base)',
      fontWeight: cell.isToday || cell.isSelected ? 'var(--emr-font-bold)' : 'var(--emr-font-medium)',
      cursor: cell.isDisabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      position: 'relative',
      userSelect: 'none',
      opacity: cell.isOtherMonth ? 0.3 : 1,
    };

    // Disabled state
    if (cell.isDisabled) {
      return {
        ...baseStyles,
        color: 'var(--emr-text-muted)',
        cursor: 'not-allowed',
      };
    }

    // Selected state (highest priority)
    if (cell.isSelected || cell.isRangeStart || cell.isRangeEnd) {
      return {
        ...baseStyles,
        background: 'var(--emr-secondary)',
        color: 'var(--emr-bg-card)',
        boxShadow: 'var(--emr-shadow-glow-primary)',
      };
    }

    // In range (not start/end)
    if (cell.isInRange) {
      return {
        ...baseStyles,
        background: 'rgba(var(--emr-primary-rgb), 0.15)',
        color: 'var(--emr-primary)',
      };
    }

    // Today (if not selected)
    if (cell.isToday) {
      return {
        ...baseStyles,
        border: '2px solid var(--emr-secondary)',
        background: 'rgba(var(--emr-primary-rgb), 0.05)',
        color: 'var(--emr-primary)',
      };
    }

    // Weekend
    if (cell.isWeekend) {
      return {
        ...baseStyles,
        color: 'var(--emr-secondary)',
      };
    }

    // Regular day
    return {
      ...baseStyles,
      color: 'var(--emr-text-primary)',
    };
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, cell: DateCell) => {
    if (cell.isDisabled) {return;}
    const target = e.currentTarget;
    if (!cell.isSelected && !cell.isRangeStart && !cell.isRangeEnd) {
      target.style.background = 'rgba(var(--emr-primary-rgb), 0.12)';
      target.style.transform = 'scale(1.08)';
      target.style.boxShadow = 'var(--emr-shadow-sm)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>, cell: DateCell) => {
    if (cell.isDisabled) {return;}
    const target = e.currentTarget;
    if (!cell.isSelected && !cell.isRangeStart && !cell.isRangeEnd) {
      if (cell.isInRange) {
        target.style.background = 'rgba(var(--emr-primary-rgb), 0.15)';
      } else if (cell.isToday) {
        target.style.background = 'rgba(var(--emr-primary-rgb), 0.05)';
      } else {
        target.style.background = 'transparent';
      }
      target.style.transform = 'scale(1)';
      target.style.boxShadow = 'none';
    }
  };

  return (
    <Box>
      {/* Weekday Headers */}
      <Grid gutter={4} mb="xs">
        {weekdayNames.map((name) => (
          <Grid.Col key={name} span={12 / 7} style={{ maxWidth: '14.28%' }}>
            <Text
              ta="center"
              size="xs"
              fw={600}
              style={{
                color: 'var(--emr-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: 'var(--emr-font-xs)',
              }}
            >
              {name}
            </Text>
          </Grid.Col>
        ))}
      </Grid>

      {/* Days Grid */}
      <Grid gutter={4}>
        {days.map((cell, index) => (
          <Grid.Col key={index} span={12 / 7} style={{ maxWidth: '14.28%' }}>
            <Box
              onClick={() => !cell.isDisabled && onDayClick(cell.date)}
              style={getDayStyles(cell)}
              onMouseEnter={(e) => handleMouseEnter(e, cell)}
              onMouseLeave={(e) => handleMouseLeave(e, cell)}
            >
              {cell.date.getDate()}
            </Box>
          </Grid.Col>
        ))}
      </Grid>
    </Box>
  );
}
