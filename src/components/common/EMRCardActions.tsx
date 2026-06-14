// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRCardActions Component
 * Composite action bar for card headers with save/print/delete/select pattern
 *
 * Features:
 * - Pre-configured action buttons (save, print, chart, delete)
 * - Optional selection checkbox
 * - Loading state for save button
 * - Disabled states
 * - Consistent styling with EMR design system
 *
 * Usage:
 * ```tsx
 * <EMRCardActions
 *   showSave
 *   onSave={() => handleSave(id)}
 *   saveLoading={isSaving}
 *   saveLabel="შენახვა"
 *   showPrint
 *   onPrint={() => handlePrint(id)}
 *   showDelete
 *   onDelete={() => handleDelete(id)}
 *   showSelect
 *   selected={isSelected}
 *   onSelectChange={setSelected}
 * />
 * ```
 */

import React from 'react';
import type { ReactNode } from 'react';
import {
  IconDeviceFloppy,
  IconPrinter,
  IconTrash,
  IconChartLine,
} from '@tabler/icons-react';
import { EMRIconButton } from './EMRIconButton';
import type { EMRIconButtonSize } from './EMRIconButton';
import { EMRCheckbox } from '../shared/EMRFormFields';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './EMRCardActions.module.css';

// ============================================================================
// Types
// ============================================================================

export interface EMRCardActionsProps {
  /** Show save button */
  showSave?: boolean;
  /** Save click handler */
  onSave?: () => void;
  /** Save loading state */
  saveLoading?: boolean;
  /** Save disabled state */
  saveDisabled?: boolean;
  /** Save tooltip label */
  saveLabel?: string;

  /** Show print button */
  showPrint?: boolean;
  /** Print click handler */
  onPrint?: () => void;
  /** Print disabled state */
  printDisabled?: boolean;
  /** Print tooltip label */
  printLabel?: string;

  /** Show chart/graph button */
  showChart?: boolean;
  /** Chart click handler */
  onChart?: () => void;
  /** Chart disabled state */
  chartDisabled?: boolean;
  /** Chart tooltip label */
  chartLabel?: string;

  /** Show delete button */
  showDelete?: boolean;
  /** Delete click handler */
  onDelete?: () => void;
  /** Delete disabled state */
  deleteDisabled?: boolean;
  /** Delete tooltip label */
  deleteLabel?: string;

  /** Show selection checkbox */
  showSelect?: boolean;
  /** Selection checked state */
  selected?: boolean;
  /** Selection change handler */
  onSelectChange?: (selected: boolean) => void;

  /** Button size */
  size?: EMRIconButtonSize;

  /** Additional custom actions (rendered before checkbox) */
  additionalActions?: ReactNode;

  /** Test ID prefix */
  'data-testid'?: string;
}

const CHART_LABEL_FALLBACKS = {
  en: 'Chart',
  ka: 'გრაფიკი',
  ru: 'График',
};

// ============================================================================
// Component
// ============================================================================

export function EMRCardActions({
  showSave = false,
  onSave,
  saveLoading = false,
  saveDisabled = false,
  saveLabel,

  showPrint = false,
  onPrint,
  printDisabled = false,
  printLabel,

  showChart = false,
  onChart,
  chartDisabled = false,
  chartLabel,

  showDelete = false,
  onDelete,
  deleteDisabled = false,
  deleteLabel,

  showSelect = false,
  selected = false,
  onSelectChange,

  size = 'md',

  additionalActions,

  'data-testid': testIdPrefix,
}: EMRCardActionsProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const resolvedSaveLabel = saveLabel ?? t('common.save');
  const resolvedPrintLabel = printLabel ?? t('common.print');
  const resolvedChartLabel = chartLabel ?? t('common.chart', CHART_LABEL_FALLBACKS[lang]);
  const resolvedDeleteLabel = deleteLabel ?? t('common.delete');

  const hasActions = showSave || showPrint || showChart || showDelete || additionalActions;
  const hasCheckbox = showSelect;

  return (
    <div className={classes.cardActions} data-testid={testIdPrefix}>
      {/* Save Button */}
      {showSave && onSave && (
        <EMRIconButton
          icon={IconDeviceFloppy}
          label={resolvedSaveLabel}
          onClick={onSave}
          variant="save"
          size={size}
          loading={saveLoading}
          disabled={saveDisabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-save` : undefined}
        />
      )}

      {/* Print Button */}
      {showPrint && onPrint && (
        <EMRIconButton
          icon={IconPrinter}
          label={resolvedPrintLabel}
          onClick={onPrint}
          variant="print"
          size={size}
          disabled={printDisabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-print` : undefined}
        />
      )}

      {/* Chart Button */}
      {showChart && onChart && (
        <EMRIconButton
          icon={IconChartLine}
          label={resolvedChartLabel}
          onClick={onChart}
          variant="chart"
          size={size}
          disabled={chartDisabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-chart` : undefined}
        />
      )}

      {/* Delete Button */}
      {showDelete && onDelete && (
        <EMRIconButton
          icon={IconTrash}
          label={resolvedDeleteLabel}
          onClick={onDelete}
          variant="delete"
          size={size}
          disabled={deleteDisabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-delete` : undefined}
        />
      )}

      {/* Additional Custom Actions */}
      {additionalActions}

      {/* Divider between actions and checkbox */}
      {hasActions && hasCheckbox && <div className={classes.divider} />}

      {/* Selection Checkbox */}
      {showSelect && onSelectChange && (
        <div className={classes.checkboxWrapper}>
          <EMRCheckbox
            checked={selected}
            onChange={onSelectChange}
            data-testid={testIdPrefix ? `${testIdPrefix}-select` : undefined}
          />
        </div>
      )}
    </div>
  );
}

export default EMRCardActions;
