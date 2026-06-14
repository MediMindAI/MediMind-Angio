// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Group, Box, Text, Collapse, UnstyledButton } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconSearch, IconX, IconFilter } from '@tabler/icons-react';
import type { ReactNode, ComponentType } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { EMRTextInput } from '../shared/EMRFormFields';
import { EMRButton } from './EMRButton';
import type { IconProps } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';

// ============================================================================
// TYPES
// ============================================================================
export interface EMRSearchFilterSectionProps {
  /** Title displayed in the header */
  title?: string;
  /** Custom icon for the header (defaults to IconFilter) */
  icon?: ComponentType<IconProps>;
  /** Search input value */
  searchValue?: string;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Callback when search value changes (debounced by default) */
  onSearchChange?: (value: string) => void;
  /** Callback when search button is clicked */
  onSearch?: () => void;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Show search button */
  showSearchButton?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Search button label */
  searchButtonLabel?: string;
  /** Clear button label */
  clearButtonLabel?: string;
  /** Filter components to render below search */
  children?: ReactNode;
  /** Count of active filters (displayed as badge) */
  activeCount?: number;
  /** Whether the section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Debounce delay in ms for search input (default: 300) */
  debounceMs?: number;
  /** Loading state for search button */
  loading?: boolean;
  /** Custom action buttons to render in header (e.g., export button) */
  headerActions?: ReactNode;
  /** Show inline search input in the collapsed content area */
  showInlineSearch?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function EMRSearchFilterSection({
  title,
  icon: Icon = IconFilter,
  searchValue = '',
  searchPlaceholder,
  onSearchChange,
  onSearch,
  onClear,
  showSearchButton = true,
  showClearButton = true,
  searchButtonLabel,
  clearButtonLabel,
  children,
  activeCount = 0,
  collapsible = true,
  defaultCollapsed = false,
  debounceMs = 300,
  loading = false,
  headerActions,
  showInlineSearch = false,
  'data-testid': testId = 'emr-search-filter-section',
}: EMRSearchFilterSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const [opened, { toggle }] = useDisclosure(!defaultCollapsed);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const isMobile = useMediaQuery('(max-width: 767px)') ?? false;
  const resolvedTitle = title ?? t('common.searchAndFilters');
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.searchPlaceholder');
  const resolvedSearchButtonLabel = searchButtonLabel ?? t('common.search');
  const resolvedClearButtonLabel = clearButtonLabel ?? t('common.clear');

  // Debounced search change handler
  useEffect(() => {
    if (!onSearchChange) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (localSearchValue !== searchValue) {
        onSearchChange(localSearchValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localSearchValue, searchValue, onSearchChange, debounceMs]);

  // Sync external search value changes
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleClear = useCallback(() => {
    setLocalSearchValue('');
    onClear?.();
  }, [onClear]);

  const handleSearch = useCallback(() => {
    onSearch?.();
  }, [onSearch]);

  return (
    <Box
      data-testid={testId}
      style={{
        borderRadius: 'var(--emr-border-radius-lg, 8px)',
        overflow: 'hidden',
        background: 'var(--emr-bg-card)',
        boxShadow: 'var(--emr-shadow-lg)',
        border: '1px solid var(--emr-border-color)',
      }}
    >
      {/* ====== HEADER ====== */}
      <Box
        onClick={collapsible ? toggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--emr-spacing-sm) var(--emr-spacing-lg)',
          background: 'var(--emr-secondary-alpha-06)',
          borderBottom: opened ? '1px solid var(--emr-border-color)' : undefined,
          cursor: collapsible ? 'pointer' : 'default',
          minHeight: 48,
        }}
      >
        <Group gap="sm">
          {/* Icon with subtle background */}
          <Box
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--emr-border-radius)',
              background: 'var(--emr-secondary-alpha-10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={16} color="var(--emr-secondary)" strokeWidth={2.5} />
          </Box>

          {/* Title */}
          <Text size="sm" fw={600} c="var(--emr-text-primary)" style={{ letterSpacing: '0.02em' }}>
            {resolvedTitle}
          </Text>

          {/* Active count badge */}
          {activeCount > 0 && (
            <Box
              style={{
                background: 'var(--emr-gradient-primary)',
                color: 'var(--emr-text-white)',
                fontSize: 'var(--emr-font-xs)',
                fontWeight: 'var(--emr-font-bold)',
                padding: '2px 8px',
                borderRadius: 9999,
              }}
            >
              {activeCount}
            </Box>
          )}

          {/* Chevron */}
          {collapsible && (
            <UnstyledButton
              data-testid="emr-search-collapse-toggle"
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--emr-transition-slow)',
                transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path
                  d="M1 1L5 5L9 1"
                  stroke="var(--emr-text-secondary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </UnstyledButton>
          )}
        </Group>

        {/* Actions - desktop/tablet only (on mobile, buttons move below filters) */}
        {!isMobile && (
          <Group gap="xs" onClick={(e) => e.stopPropagation()}>
            {headerActions}

            {showClearButton && (
              <EMRButton
                data-testid="emr-search-clear-btn"
                variant="ghost"
                size="sm"
                icon={IconX}
                onClick={handleClear}
                disabled={loading}
                style={{ color: 'var(--emr-text-secondary)' }}
              >
                {resolvedClearButtonLabel}
              </EMRButton>
            )}
            {showSearchButton && (
              <EMRButton
                data-testid="emr-search-btn"
                size="sm"
                variant="primary"
                icon={IconSearch}
                onClick={handleSearch}
                loading={loading}
              >
                {resolvedSearchButtonLabel}
              </EMRButton>
            )}
          </Group>
        )}
      </Box>

      {/* ====== CONTENT ====== */}
      <Collapse in={opened} transitionDuration={200}>
        <Box
          style={{
            padding: 'var(--emr-spacing-lg)',
            background: 'var(--emr-bg-page)',
            borderTop: '1px solid var(--emr-border-color)',
          }}
        >
          {/* Inline Search Input (optional) */}
          {showInlineSearch && onSearchChange && (
            <Box mb="md">
              <EMRTextInput
                data-testid="emr-search-input"
                placeholder={resolvedSearchPlaceholder}
                value={localSearchValue}
                onChange={setLocalSearchValue}
                leftSection={<IconSearch size={16} />}
                size="sm"
              />
            </Box>
          )}

          {/* Filter Components */}
          {children && (
            <Box data-testid="emr-search-filters">
              {children}
            </Box>
          )}

          {/* Action buttons - mobile only (moved from header for better layout) */}
          {isMobile && (showClearButton || showSearchButton) && (
            <Group gap="sm" mt="md" grow>
              {showClearButton && (
                <EMRButton
                  data-testid="emr-search-clear-btn"
                  variant="secondary"
                  size="sm"
                  icon={IconX}
                  onClick={handleClear}
                  disabled={loading}
                >
                  {resolvedClearButtonLabel}
                </EMRButton>
              )}
              {showSearchButton && (
                <EMRButton
                  data-testid="emr-search-btn"
                  size="sm"
                  variant="primary"
                  icon={IconSearch}
                  onClick={handleSearch}
                  loading={loading}
                >
                  {resolvedSearchButtonLabel}
                </EMRButton>
              )}
            </Group>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
