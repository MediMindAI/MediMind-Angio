// SPDX-License-Identifier: Apache-2.0
/** UX-ANGIO-019 L1 — every drawing-toolbar control has a Georgian accessible
 *  name (pen, eraser and text used to be unnamed icons). */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { DrawingToolbar } from './DrawingToolbar';

// Translations load via dynamic import, so the first Georgian lookup waits.
function renderToolbar(mode: 'click' | 'draw') {
  return render(
    <MantineProvider>
      <TranslationProvider>
        <DrawingToolbar
          mode={mode}
          setMode={vi.fn()}
          tool="pen"
          setTool={vi.fn()}
          color="normal"
          setColor={vi.fn()}
          size={4}
          setSize={vi.fn()}
          onUndo={vi.fn()}
          onClear={vi.fn()}
          canUndo
          hasDrawings
        />
      </TranslationProvider>
    </MantineProvider>,
  );
}

describe('DrawingToolbar accessible names', () => {
  it('names the pen, eraser, text tools and size pills in Georgian', async () => {
    renderToolbar('draw');
    expect(await screen.findByRole('button', { name: 'კალამი' }, { timeout: 15_000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'საშლელი' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ტექსტი' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'წვრილი' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'საშუალო' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'სქელი' })).toBeTruthy();
  });

  it('leaves no toolbar button without a name, even while draw mode is off', async () => {
    renderToolbar('click');
    await screen.findByRole('button', { name: 'კალამი' }, { timeout: 15_000 });
    const toolbar = screen.getByRole('toolbar');
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const name = (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
      expect(name, button.getAttribute('data-testid') ?? '').not.toBe('');
    }
  });
});
