// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Group, Collapse, UnstyledButton, Text, Box } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

export interface EMRStatCardGroupProps {
  children: ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  title?: string;
  showDividers?: boolean;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  'data-testid'?: string;
}

/**
 * EMRStatCardGroup - Container for arranging multiple EMRStatCard components
 *
 * Features:
 * - Horizontal layout with consistent spacing
 * - Optional vertical dividers between cards
 * - Collapsible with smooth animation
 * - Responsive: stacks on mobile
 *
 * @param root0
 * @param root0.children
 * @param root0.collapsible
 * @param root0.expanded
 * @param root0.defaultExpanded
 * @param root0.onExpandedChange
 * @param root0.title
 * @param root0.showDividers
 * @param root0.gap
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRStatCardGroup
 *   title="Patient Statistics"
 *   collapsible
 *   defaultExpanded
 *   showDividers
 *   gap="md"
 * >
 *   <EMRStatCard label="Total Patients" value={250} variant="total" />
 *   <EMRStatCard label="Active" value={180} variant="active" />
 *   <EMRStatCard label="Pending" value={70} variant="pending" />
 * </EMRStatCardGroup>
 * ```
 */
export function EMRStatCardGroup({
  children,
  collapsible = false,
  expanded: controlledExpanded,
  defaultExpanded = true,
  onExpandedChange,
  title,
  showDividers = false,
  gap = 'md',
  'data-testid': testId = 'emr-stat-card-group',
}: EMRStatCardGroupProps): React.ReactElement {
  // Uncontrolled state
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : uncontrolledExpanded;

  const handleToggle = (): void => {
    const newExpanded = !isExpanded;

    if (!isControlled) {
      setUncontrolledExpanded(newExpanded);
    }

    onExpandedChange?.(newExpanded);
  };

  // Map gap prop to Mantine spacing
  const gapMap: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  };

  const gapValue = gapMap[gap];

  // Render children with optional dividers
  const renderChildrenWithDividers = (): ReactNode[] => {
    // Flatten children to handle Fragments
    const flattenChildren = (children: ReactNode): ReactNode[] => {
      const result: ReactNode[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === React.Fragment) {
          result.push(...flattenChildren((child.props as { children?: ReactNode }).children));
        } else {
          result.push(child);
        }
      });
      return result;
    };

    const childArray = flattenChildren(children);

    if (!showDividers) {
      return childArray;
    }

    const result: ReactNode[] = [];
    childArray.forEach((child, index) => {
      result.push(child);
      if (index < childArray.length - 1) {
        result.push(
          <div
            key={`divider-${index}`}
            data-testid="emr-stat-card-group-divider"
            style={{
              width: '1px',
              height: 'auto',
              alignSelf: 'stretch',
              backgroundColor: 'var(--emr-border-color)',
            }}
          />
        );
      }
    });
    return result;
  };

  const content = (
    <Group
      gap={gapValue}
      style={{
        alignItems: 'stretch',
        flexWrap: 'wrap',
      }}
      data-testid="emr-stat-card-group-content"
    >
      {renderChildrenWithDividers()}
    </Group>
  );

  return (
    <Box data-testid={testId}>
      {collapsible && title && (
        <UnstyledButton
          onClick={handleToggle}
          data-testid="emr-stat-card-group-header"
          style={{
            width: '100%',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            borderRadius: 'var(--emr-border-radius)',
            backgroundColor: 'transparent',
            transition: 'background-color var(--emr-transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--emr-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Text
            fw={600}
            size="sm"
            style={{
              color: 'var(--emr-text-primary)',
            }}
          >
            {title}
          </Text>
          <IconChevronDown
            size={18}
            style={{
              color: 'var(--emr-text-secondary)',
              transition: 'transform var(--emr-transition-base)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </UnstyledButton>
      )}

      {!collapsible && title && (
        <Box
          mb="md"
          data-testid="emr-stat-card-group-header"
          style={{
            padding: '8px 12px',
          }}
        >
          <Text
            fw={600}
            size="sm"
            style={{
              color: 'var(--emr-text-primary)',
            }}
          >
            {title}
          </Text>
        </Box>
      )}

      {collapsible ? (
        <Collapse in={isExpanded} transitionDuration={300} transitionTimingFunction="ease">
          <Box pt="sm">{content}</Box>
        </Collapse>
      ) : (
        content
      )}
    </Box>
  );
}
