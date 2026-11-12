// SPDX-License-Identifier: Apache-2.0
/** UX-ANGIO-019 L2 — a text label is clamped inside the viewBox when it is
 *  committed, so a label dropped at the right edge is fully visible on screen
 *  and (because the clamped anchor is what persists) in the PDF. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DrawingCanvas } from './DrawingCanvas';
import type { DrawingStroke } from '../../types/drawing';

// jsdom has no SVG layout: stub the screen→viewBox transform so a pointer
// press lands exactly at `nextPoint` in viewBox space.
let nextPoint = { x: 0, y: 0 };
function stubSvgGeometry(svg: SVGSVGElement): void {
  Object.assign(svg, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ ...nextPoint }) }),
  });
}

function placeLabel(at: { x: number; y: number }, text: string): DrawingStroke {
  const onCommitStroke = vi.fn();
  render(
    <DrawingCanvas
      view="le-anterior"
      mode="draw"
      tool="text"
      color="normal"
      size={4}
      strokes={[]}
      onCommitStroke={onCommitStroke}
      onEraseStroke={vi.fn()}
      textPlaceholder="label"
    />,
  );
  const svg = screen.getByTestId('drawing-canvas-le-anterior') as unknown as SVGSVGElement;
  stubSvgGeometry(svg);
  nextPoint = at;
  fireEvent.pointerDown(svg);
  const input = screen.getByTestId('drawing-text-input');
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
  expect(onCommitStroke).toHaveBeenCalledTimes(1);
  return onCommitStroke.mock.calls[0]?.[0] as DrawingStroke;
}

afterEach(() => {
  nextPoint = { x: 0, y: 0 };
});

describe('DrawingCanvas text-label clamp', () => {
  // le-anterior viewBox is 600 × 1453; size 4 → font 28. jsdom falls back to
  // the per-glyph width estimate (0.6em).
  const text = 'მარჯვენა კიდე';
  const estWidth = text.length * 28 * 0.6;

  it('pulls a label dropped at the right edge back inside the viewBox', () => {
    const stroke = placeLabel({ x: 590, y: 700 }, text);
    const [x, y] = stroke.points[0] ?? [NaN, NaN];
    expect(stroke.text).toBe(text);
    expect(x + estWidth).toBeLessThan(600);
    expect(x).toBeGreaterThan(0);
    expect(y).toBe(700);
  });

  it('keeps a label dropped in the top-left corner fully inside', () => {
    const stroke = placeLabel({ x: -20, y: 3 }, 'A');
    const [x, y] = stroke.points[0] ?? [NaN, NaN];
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThanOrEqual(28); // whole glyph height below the top edge
  });

  it('keeps a label at the bottom edge above the bottom', () => {
    const stroke = placeLabel({ x: 100, y: 1453 }, 'A');
    expect(stroke.points[0]?.[1]).toBeLessThan(1453);
  });

  it('leaves a label placed in open space exactly where it was dropped', () => {
    const stroke = placeLabel({ x: 120, y: 500 }, 'GSV');
    expect(stroke.points[0]?.[0]).toBe(120);
    expect(stroke.points[0]?.[1]).toBe(500);
  });
});
