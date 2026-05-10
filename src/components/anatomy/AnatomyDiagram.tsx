// SPDX-License-Identifier: Apache-2.0
/**
 * AnatomyDiagram — single-panel composer that stacks an AnatomyView
 * (reference image backdrop + invisible click-overlays) under a
 * DrawingCanvas (freehand stroke layer).
 *
 * The two layers share the same viewBox so coordinates align. Drawing-mode
 * routing: when toolbar is in `click`, AnatomyView receives pointer events
 * (segments are interactive); the canvas has pointer-events: none. When
 * toolbar is in `draw`, the canvas captures pointer events instead.
 */

import { memo, useMemo } from 'react';
import { Stack, Text } from '@mantine/core';
import { AnatomyView } from './AnatomyView';
import { DrawingCanvas } from './DrawingCanvas';
import type {
  AnatomyViewKey,
  DrawingColor,
  DrawingMode,
  DrawingSize,
  DrawingStroke,
  DrawingTool,
} from '../../types/drawing';
import type { Competency, SegmentId } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './AnatomyDiagram.module.css';

export interface AnatomyDiagramProps {
  readonly view: AnatomyViewKey;
  readonly segments: Map<SegmentId, Competency> | Record<SegmentId, Competency>;
  /** Per-segment SVG path-d override (overlay-mode "Edit segment"). */
  readonly pathOverrides?: Map<SegmentId, string> | Record<SegmentId, string>;
  readonly drawings: ReadonlyArray<DrawingStroke>;
  readonly mode: DrawingMode;
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly size: DrawingSize;
  readonly highlightId?: SegmentId | null;
  /** Segment currently selected for redraw, in `mode === 'edit-segment'`. */
  readonly editingSegmentId?: SegmentId | null;
  readonly onSegmentClick?: (id: SegmentId, current: Competency) => void;
  readonly onCommitStroke: (stroke: DrawingStroke) => void;
  readonly onEraseStroke: (strokeId: string) => void;
  /** Fires when a redrawn polyline is committed for the editing segment. */
  readonly onCommitSegmentEdit?: (segmentId: SegmentId, d: string) => void;
}

export const AnatomyDiagram = memo(function AnatomyDiagram({
  view,
  segments,
  pathOverrides,
  drawings,
  mode,
  tool,
  color,
  size,
  highlightId,
  editingSegmentId,
  onSegmentClick,
  onCommitStroke,
  onEraseStroke,
  onCommitSegmentEdit,
}: AnatomyDiagramProps): React.ReactElement {
  const { t } = useTranslation();
  // Strokes are stored in one global array; each panel only renders its own.
  const viewStrokes = useMemo(
    () => drawings.filter((s) => s.view === view),
    [drawings, view],
  );

  return (
    <Stack gap={6} align="center" className={classes.panel}>
      <Text className={classes.viewLabel}>
        {t(`anatomy.view.${view}`, view === 'le-anterior' ? 'Anterior view' : 'Posterior view')}
      </Text>
      <div
        className={classes.stage}
        data-view={view}
        data-mode={mode}
        data-testid={`anatomy-diagram-${view}`}
      >
        <AnatomyView
          view={view}
          segments={segments}
          pathOverrides={pathOverrides}
          size="lg"
          interactive={mode === 'click' || mode === 'edit-segment'}
          onSegmentClick={onSegmentClick}
          highlightId={editingSegmentId ?? highlightId ?? null}
          overlay
        />
        <DrawingCanvas
          view={view}
          mode={mode}
          tool={tool}
          color={color}
          size={size}
          strokes={viewStrokes}
          editingSegmentId={editingSegmentId ?? null}
          onCommitStroke={onCommitStroke}
          onEraseStroke={onEraseStroke}
          onCommitSegmentEdit={onCommitSegmentEdit}
          ariaLabel={t('venousLE.drawing.canvasAriaLabel', 'Hand-drawing canvas') + ` (${view})`}
        />
      </div>
    </Stack>
  );
});

export default AnatomyDiagram;
