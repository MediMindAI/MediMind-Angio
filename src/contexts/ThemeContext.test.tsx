// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 2.7 — ThemeContext double-write guard.
 *
 * Audit Part 07 + Part 08 MEDIUM: previously the provider had two writers to
 * the `data-mantine-color-scheme` attribute (manual `applyTheme()` +
 * Mantine's color-scheme manager) and two writers to localStorage (manual
 * `localStorage.setItem` in both `setMode` and the sync-FROM-Mantine effect,
 * PLUS Mantine's manager). On `'system'` mode the attribute writers raced
 * (one wrote `'auto'`, the other the resolved `'light'/'dark'`), and every
 * `setMode` call wrote localStorage at least twice with the same value.
 *
 * Fix: Mantine's `createAppColorSchemeManager` is now the SOLE writer of both
 * sinks. ThemeContext only mirrors Mantine's state into our `ThemeMode`
 * shape and forwards `setMode` calls to `setColorScheme`.
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, useTheme } from './ThemeContext';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { createAppColorSchemeManager } from '../styles/mantineTheme';

function ProbeTheme() {
  const { mode, setMode, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button data-testid="to-dark" onClick={() => setMode('dark')}>dark</button>
      <button data-testid="to-light" onClick={() => setMode('light')}>light</button>
      <button data-testid="to-system" onClick={() => setMode('system')}>system</button>
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  // Mirror App.tsx wiring: Mantine owns the color-scheme manager.
  const manager = createAppColorSchemeManager(STORAGE_KEYS.THEME);
  return (
    <MantineProvider colorSchemeManager={manager} defaultColorScheme={manager.get('auto')}>
      <ThemeProvider>{children}</ThemeProvider>
    </MantineProvider>
  );
}

describe('ThemeContext', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    setItemSpy.mockRestore();
  });

  function themeWriteCount(): number {
    return setItemSpy.mock.calls.filter((c: unknown[]) => c[0] === STORAGE_KEYS.THEME).length;
  }

  it('renders with a sensible default mode', () => {
    render(
      <Wrap>
        <ProbeTheme />
      </Wrap>,
    );
    // Default with no stored value is 'system' (resolves to 'light' via matchMedia stub).
    expect(['system', 'light', 'dark']).toContain(screen.getByTestId('mode').textContent);
  });

  it('writes localStorage at most ONCE per setMode call (no double-write)', () => {
    render(
      <Wrap>
        <ProbeTheme />
      </Wrap>,
    );
    setItemSpy.mockClear();

    act(() => {
      screen.getByTestId('to-dark').click();
    });

    // Mantine's colorSchemeManager is the SOLE writer. Before the fix there
    // were 2+ writes per setMode (provider's setMode + sync effect).
    expect(themeWriteCount()).toBeLessThanOrEqual(1);
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('dark');
  });

  it('mode state mirrors Mantine — switching to light reflects in mode', () => {
    render(
      <Wrap>
        <ProbeTheme />
      </Wrap>,
    );

    act(() => {
      screen.getByTestId('to-dark').click();
    });
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    act(() => {
      screen.getByTestId('to-light').click();
    });
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('switching to system mode persists "system" (not "auto") to localStorage', () => {
    render(
      <Wrap>
        <ProbeTheme />
      </Wrap>,
    );

    act(() => {
      screen.getByTestId('to-system').click();
    });

    // The manager round-trips Mantine's 'auto' back to our 'system' shape.
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('system');
    expect(screen.getByTestId('mode').textContent).toBe('system');
  });

  it('does not write the data-mantine-color-scheme attribute redundantly to a stale value', () => {
    render(
      <Wrap>
        <ProbeTheme />
      </Wrap>,
    );

    act(() => {
      screen.getByTestId('to-dark').click();
    });

    // Only one writer (Mantine's manager) should have set this attribute,
    // and it should reflect the resolved scheme — never the raw 'system'/'auto'
    // value when in concrete dark/light mode.
    const attr = document.documentElement.getAttribute('data-mantine-color-scheme');
    expect(attr).toBe('dark');
  });
});
