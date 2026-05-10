// SPDX-License-Identifier: Apache-2.0
/**
 * DrawingToolbar — controls for the hand-drawing layer.
 *
 * Renders a horizontal strip with: Click/Draw mode toggle, color swatches,
 * size pills, eraser toggle, and Undo / Clear actions. State lives in the
 * parent (AnatomyDiagramSection) so both anatomy panels share the same
 * toolbar settings.
 */

import { memo, useCallback } from 'react';
import { Box, Group, SegmentedControl, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowBackUp, IconEraser, IconPencil, IconPointer, IconRoute, IconTrash } from '@tabler/icons-react';
import type { SegmentId } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import {
  DRAWING_COLORS,
  DRAWING_COLOR_HEX,
  DRAWING_SIZES,
  type DrawingColor,
  type DrawingMode,
  type DrawingSize,
  type DrawingTool,
} from '../../types/drawing';
import classes from './DrawingToolbar.module.css';

export interface DrawingToolbarProps {
  readonly mode: DrawingMode;
  readonly setMode: (mode: DrawingMode) => void;
  readonly tool: DrawingTool;
  readonly setTool: (tool: DrawingTool) => void;
  readonly color: DrawingColor;
  readonly setColor: (color: DrawingColor) => void;
  readonly size: DrawingSize;
  readonly setSize: (size: DrawingSize) => void;
  readonly onUndo: () => void;
  readonly onClear: () => void;
  readonly canUndo: boolean;
  readonly hasDrawings: boolean;
  /** Segment selected for redraw in `edit-segment` mode (drives the
   *  Clear-override button label + enabled state). */
  readonly editingSegmentId?: SegmentId | null;
  readonly onClearOverride?: () => void;
}

export const DrawingToolbar = memo(function DrawingToolbar({
  mode,
  setMode,
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  onUndo,
  onClear,
  canUndo,
  hasDrawings,
  editingSegmentId,
  onClearOverride,
}: DrawingToolbarProps): React.ReactElement {
  const { t } = useTranslation();

  const handleClear = useCallback(() => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        t(
          'venousLE.drawing.actions.clearConfirm',
          'Clear all hand-drawn marks on the diagram?',
        ),
      );
      if (!confirmed) return;
    }
    onClear();
  }, [onClear, t]);

  return (
    <Box className={classes.toolbar} role="toolbar" aria-label={t('venousLE.drawing.ariaLabel', 'Drawing tools')}>
      <Group gap="md" wrap="wrap" align="center">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as DrawingMode)}
          size="sm"
          data={[
            {
              value: 'click',
              label: (
                <Group gap={6} align="center" wrap="nowrap">
                  <IconPointer size={14} stroke={1.75} />
                  <span>{t('venousLE.drawing.modeClick', 'Click')}</span>
                </Group>
              ),
            },
            {
              value: 'draw',
              label: (
                <Group gap={6} align="center" wrap="nowrap">
                  <IconPencil size={14} stroke={1.75} />
                  <span>{t('venousLE.drawing.modeDraw', 'Draw')}</span>
                </Group>
              ),
            },
            {
              value: 'edit-segment',
              label: (
                <Group gap={6} align="center" wrap="nowrap">
                  <IconRoute size={14} stroke={1.75} />
                  <span>{t('venousLE.drawing.modeEditSegment', 'Edit segment')}</span>
                </Group>
              ),
            },
          ]}
          data-testid="drawing-mode-toggle"
        />

        <Group
          gap={8}
          wrap="nowrap"
          className={classes.subgroup}
          data-disabled={mode !== 'draw' ? 'true' : undefined}
        >
          <Text size="xs" c="dimmed" component="span">
            {t('venousLE.drawing.color.label', 'Color')}
          </Text>
          {DRAWING_COLORS.map((c) => (
            <Tooltip key={c} label={t(`venousLE.drawing.color.${c}`, c)} withArrow openDelay={300}>
              <UnstyledButton
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                aria-label={t(`venousLE.drawing.color.${c}`, c)}
                className={classes.swatch}
                data-active={color === c ? 'true' : undefined}
                data-testid={`drawing-color-${c}`}
                disabled={mode !== 'draw'}
                style={{ background: DRAWING_COLOR_HEX[c] }}
              />
            </Tooltip>
          ))}
        </Group>

        <Group
          gap={6}
          wrap="nowrap"
          className={classes.subgroup}
          data-disabled={mode !== 'draw' ? 'true' : undefined}
        >
          <Text size="xs" c="dimmed" component="span">
            {t('venousLE.drawing.size.label', 'Size')}
          </Text>
          {DRAWING_SIZES.map((s) => (
            <Tooltip
              key={s}
              label={t(
                `venousLE.drawing.size.${s === 2 ? 'thin' : s === 4 ? 'medium' : 'thick'}`,
                s === 2 ? 'Thin' : s === 4 ? 'Medium' : 'Thick',
              )}
              withArrow
              openDelay={300}
            >
              <UnstyledButton
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={classes.sizePill}
                data-active={size === s ? 'true' : undefined}
                data-testid={`drawing-size-${s}`}
                disabled={mode !== 'draw'}
              >
                <span
                  className={classes.sizeDot}
                  style={{ width: `${s * 2}px`, height: `${s * 2}px` }}
                />
              </UnstyledButton>
            </Tooltip>
          ))}
        </Group>

        <Group
          gap={6}
          wrap="nowrap"
          className={classes.subgroup}
          data-disabled={mode !== 'draw' ? 'true' : undefined}
        >
          <Tooltip label={t('venousLE.drawing.tools.pen', 'Pen')} withArrow openDelay={300}>
            <UnstyledButton
              type="button"
              onClick={() => setTool('pen')}
              aria-pressed={tool === 'pen'}
              className={classes.toolBtn}
              data-active={tool === 'pen' ? 'true' : undefined}
              data-testid="drawing-tool-pen"
              disabled={mode !== 'draw'}
            >
              <IconPencil size={16} stroke={1.75} />
            </UnstyledButton>
          </Tooltip>
          <Tooltip label={t('venousLE.drawing.tools.eraser', 'Eraser')} withArrow openDelay={300}>
            <UnstyledButton
              type="button"
              onClick={() => setTool('eraser')}
              aria-pressed={tool === 'eraser'}
              className={classes.toolBtn}
              data-active={tool === 'eraser' ? 'true' : undefined}
              data-testid="drawing-tool-eraser"
              disabled={mode !== 'draw'}
            >
              <IconEraser size={16} stroke={1.75} />
            </UnstyledButton>
          </Tooltip>
        </Group>

        <Group gap={6} wrap="nowrap" className={classes.subgroup}>
          <Tooltip label={t('venousLE.drawing.actions.undo', 'Undo')} withArrow openDelay={300}>
            <UnstyledButton
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={classes.toolBtn}
              aria-label={t('venousLE.drawing.actions.undo', 'Undo')}
              data-testid="drawing-undo"
            >
              <IconArrowBackUp size={16} stroke={1.75} />
            </UnstyledButton>
          </Tooltip>
          <Tooltip label={t('venousLE.drawing.actions.clear', 'Clear all')} withArrow openDelay={300}>
            <UnstyledButton
              type="button"
              onClick={handleClear}
              disabled={!hasDrawings}
              className={classes.toolBtn}
              aria-label={t('venousLE.drawing.actions.clear', 'Clear all')}
              data-testid="drawing-clear"
            >
              <IconTrash size={16} stroke={1.75} />
            </UnstyledButton>
          </Tooltip>
        </Group>

        {mode === 'edit-segment' && (
          <Group gap={8} wrap="nowrap" className={classes.subgroup}>
            <Text size="xs" c="dimmed" component="span" data-testid="edit-segment-hint">
              {editingSegmentId
                ? `${editingSegmentId} — ${t('venousLE.drawing.actions.clearOverride', 'Reset segment path')}`
                : t('venousLE.drawing.editSegmentHint', 'Tap a vein, then redraw it to replace its geometry')}
            </Text>
            <Tooltip
              label={t('venousLE.drawing.actions.clearOverride', 'Reset segment path')}
              withArrow
              openDelay={300}
            >
              <UnstyledButton
                type="button"
                onClick={onClearOverride}
                disabled={!editingSegmentId}
                className={classes.toolBtn}
                aria-label={t('venousLE.drawing.actions.clearOverride', 'Reset segment path')}
                data-testid="drawing-clear-override"
              >
                <IconArrowBackUp size={16} stroke={1.75} />
              </UnstyledButton>
            </Tooltip>
          </Group>
        )}
      </Group>
    </Box>
  );
});

export default DrawingToolbar;
