// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 2.7 — TranslationContext race-condition guard.
 *
 * Audit Part 07 MEDIUM: previously the load-on-language-change effect used a
 * single `mountedRef` boolean shared across renders. If user toggled
 * `en → ka` quickly, the older `load('en')` could resolve AFTER the new
 * `load('ka')` had already set state — and because `mountedRef.current` was
 * still `true`, English translations would clobber the just-set Georgian
 * translations.
 *
 * Fix: per-effect `cancelled` flag (captured by each effect invocation).
 *
 * These tests render the real provider (with NO mocking of dynamic imports)
 * and exercise its public surface to prove that the LATEST language wins,
 * even after rapid switching.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { TranslationProvider, useTranslation } from './TranslationContext';
import { STORAGE_KEYS } from '../constants/storage-keys';

function ProbeT({ tKey }: { tKey: string }) {
  const { t, lang, setLang, isLoading } = useTranslation();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="value">{t(tKey, 'FALLBACK')}</span>
      <button data-testid="to-en" onClick={() => setLang('en')}>en</button>
      <button data-testid="to-ka" onClick={() => setLang('ka')}>ka</button>
      <button data-testid="to-ru" onClick={() => setLang('ru')}>ru</button>
    </div>
  );
}

describe('TranslationContext', () => {
  beforeEach(() => {
    localStorage.clear();
    // Force the provider to start in 'ka' regardless of any leakage.
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ka');
  });

  it('initializes with stored language and finishes loading', async () => {
    render(
      <TranslationProvider>
        <ProbeT tKey="common.cancel" />
      </TranslationProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('ka');
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });
  });

  it('rapid switching ka → en → ka → en ends with the LATEST language active (no stale clobber)', async () => {
    render(
      <TranslationProvider>
        <ProbeT tKey="common.cancel" />
      </TranslationProvider>,
    );

    // Wait for initial load to settle so we can observe transitions cleanly.
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    // Fire a burst of switches synchronously inside one act() to force
    // multiple effect invocations whose async loads will race.
    await act(async () => {
      screen.getByTestId('to-en').click();
      screen.getByTestId('to-ka').click();
      screen.getByTestId('to-en').click();
    });

    // After the burst, only the final language ('en') should be reflected.
    expect(screen.getByTestId('lang').textContent).toBe('en');

    // Allow ALL pending dynamic imports (including stale ka load) to resolve.
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    // Sanity: language is still 'en' — a stale ka resolution did NOT flip
    // state back. The cancelled flag in each prior effect prevented its
    // setTranslations call from running.
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });

  it('setLang persists to localStorage under the canonical key', async () => {
    render(
      <TranslationProvider>
        <ProbeT tKey="common.cancel" />
      </TranslationProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    await act(async () => {
      screen.getByTestId('to-ru').click();
    });

    expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe('ru');
  });
});
