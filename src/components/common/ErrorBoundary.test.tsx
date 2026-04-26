// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 1.2 — Area 06 BLOCKER guard.
 *
 * The ErrorBoundary must catch unhandled render errors and render a recovery
 * card instead of letting React unmount the entire tree to a blank screen.
 */

/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { ErrorBoundary } from './ErrorBoundary';

function BadChild(): React.ReactElement {
  throw new Error('boom');
}

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('ErrorBoundary', () => {
  // Suppress React's expected console.error during error-boundary tests.
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <Wrap>
        <ErrorBoundary>
          <div data-testid="happy-child">happy</div>
        </ErrorBoundary>
      </Wrap>,
    );
    expect(screen.getByTestId('happy-child')).toBeInTheDocument();
  });

  it('renders the recovery card when a child throws', () => {
    render(
      <Wrap>
        <ErrorBoundary>
          <BadChild />
        </ErrorBoundary>
      </Wrap>,
    );
    expect(screen.getByTestId('error-boundary-card')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-reload')).toBeInTheDocument();
  });

  it('exposes the underlying error message in the technical-details disclosure', () => {
    render(
      <Wrap>
        <ErrorBoundary>
          <BadChild />
        </ErrorBoundary>
      </Wrap>,
    );
    const details = screen.getByTestId('error-boundary-details');
    expect(details.textContent).toContain('boom');
  });

  it('Reload button calls window.location.reload', () => {
    const reloadSpy = vi.fn();
    // jsdom defines location as a non-configurable getter; replace via defineProperty.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadSpy },
    });
    render(
      <Wrap>
        <ErrorBoundary>
          <BadChild />
        </ErrorBoundary>
      </Wrap>,
    );
    fireEvent.click(screen.getByTestId('error-boundary-reload'));
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
