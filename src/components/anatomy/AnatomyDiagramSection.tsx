// SPDX-License-Identifier: Apache-2.0
/**
 * AnatomyDiagramSection — top-level composer that hosts the shared
 * drawing toolbar above two side-by-side AnatomyDiagram panels (anterior
 * + posterior). Toolbar state (mode, color, size, tool) lives here so
 * both panels operate in lock-step.
 */

import { memo, useCallback, useState } from 'react';
import { Box } from '@mantine/core';
import { AnatomyDiagram } from './AnatomyDiagram';
import { DrawingToolbar } from './DrawingToolbar';
import {
  DEFAULT_DRAWING_COLOR,
  DEFAULT_DRAWING_SIZE,
  type DrawingColor,
  type DrawingMode,
  type DrawingSize,
  type DrawingStroke,
  type DrawingTool,
} from '../../types/drawing';
import type { Competency, SegmentId } from '../../types/anatomy';

export interface AnatomyDiagramSectionProps {
  readonly segments: Map<SegmentId, Competency> | Record<SegmentId, Competency>;
  /** Per-segment SVG path-d override map (from `state.findings.pathOverride`). */
  readonly pathOverrides?: Map<SegmentId, string> | Record<SegmentId, string>;
  readonly drawings: ReadonlyArray<DrawingStroke>;
  readonly highlightId?: SegmentId | null;
  readonly onSegmentClick?: (id: SegmentId, current: Competency) => void;
  readonly onCommitStroke: (stroke: DrawingStroke) => void;
  readonly onEraseStroke: (strokeId: string) => void;
  readonly onUndo: () => void;
  readonly onClear: () => void;
  /** Fires when the user redraws the selected segment. */
  readonly onCommitSegmentEdit?: (segmentId: SegmentId, d: string) => void;
  /** Fires when the user clears the path override for a segment. */
  readonly onClearSegmentEdit?: (segmentId: SegmentId) => void;
}

export const AnatomyDiagramSection = memo(function AnatomyDiagramSection({
  segments,
  pathOverrides,
  drawings,
  highlightId,
  onSegmentClick,
  onCommitStroke,
  onEraseStroke,
  onUndo,
  onClear,
  onCommitSegmentEdit,
  onClearSegmentEdit,
}: AnatomyDiagramSectionProps): React.ReactElement {
  const [mode, setMode] = useState<DrawingMode>('click');
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState<DrawingColor>(DEFAULT_DRAWING_COLOR);
  const [size, setSize] = useState<DrawingSize>(DEFAULT_DRAWING_SIZE);
  // In `edit-segment` mode the user first clicks an anatomy segment to
  // select it, then drags to redraw it. We track the selection locally.
  const [editingSegmentId, setEditingSegmentId] = useState<SegmentId | null>(null);

  // When user switches to 'draw' mode, default the tool back to pen so
  // they don't get stuck in an eraser-with-nothing-to-erase state.
  const handleModeChange = useCallback((next: DrawingMode) => {
    setMode(next);
    if (next !== 'edit-segment') setEditingSegmentId(null);
    if (next === 'draw' && drawings.length === 0) setTool('pen');
  }, [drawings.length]);

  // Hijack segment clicks in edit-segment mode to set the redraw target.
  // In click mode they still cycle competency via onSegmentClick.
  const handleSegmentClick = useCallback(
    (id: SegmentId, current: Competency) => {
      if (mode === 'edit-segment') {
        setEditingSegmentId((prev) => (prev === id ? null : id));
        return;
      }
      onSegmentClick?.(id, current);
    },
    [mode, onSegmentClick],
  );

  const handleClearSegmentEdit = useCallback(() => {
    if (editingSegmentId) onClearSegmentEdit?.(editingSegmentId);
  }, [editingSegmentId, onClearSegmentEdit]);

  return (
    <Box>
      <DrawingToolbar
        mode={mode}
        setMode={handleModeChange}
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        onUndo={onUndo}
        onClear={onClear}
        canUndo={drawings.length > 0}
        hasDrawings={drawings.length > 0}
        editingSegmentId={editingSegmentId}
        onClearOverride={handleClearSegmentEdit}
      />
      {/* Single combined anatomy view — anterior + posterior segments share one image. */}
      <AnatomyDiagram
        view="le-anterior"
        segments={segments}
        pathOverrides={pathOverrides}
        drawings={drawings}
        mode={mode}
        tool={tool}
        color={color}
        size={size}
        highlightId={highlightId}
        editingSegmentId={editingSegmentId}
        onSegmentClick={handleSegmentClick}
        onCommitStroke={onCommitStroke}
        onEraseStroke={onEraseStroke}
        onCommitSegmentEdit={onCommitSegmentEdit}
      />
    </Box>
  );
});

export default AnatomyDiagramSection;
