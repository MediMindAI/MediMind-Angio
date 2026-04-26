// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { EMRButton } from './EMRButton';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './ErrorBoundary.module.css';

const MAX_DETAIL_CHARS = 500;

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level ErrorBoundary that catches unhandled render errors anywhere
 * in the React tree (study forms, anatomy views, context providers, etc.)
 * and renders a polite recovery card in place of a blank white page.
 *
 * The fallback uses translations + theme tokens; place INSIDE the
 * MantineProvider/ThemeProvider/TranslationProvider stack.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console for ops/devtools — replace with structured logger when available.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] render error', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorBoundaryFallback error={this.state.error} onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}

interface FallbackProps {
  error: Error;
  onReload: () => void;
}

/**
 * Functional fallback so we can use the `useTranslation` hook.
 * (Class components cannot consume hooks directly.)
 */
function ErrorBoundaryFallback({ error, onReload }: FallbackProps): React.ReactElement {
  const { t } = useTranslation();

  // Truncate stack to keep the disclosure block compact for ops support.
  const rawStack = (error.stack ?? error.message ?? '').toString();
  const stack =
    rawStack.length > MAX_DETAIL_CHARS ? `${rawStack.slice(0, MAX_DETAIL_CHARS)}…` : rawStack;
  const detailText = `${error.message}\n\n${stack}`.trim();

  return (
    <div className={classes.root} role="alert" aria-live="assertive">
      <div className={classes.card} data-testid="error-boundary-card">
        <div className={classes.iconRow}>
          <span className={classes.iconBubble} aria-hidden="true">
            <IconAlertTriangle size={24} stroke={2} />
          </span>
          <h1 className={classes.title}>{t('errorBoundary.title')}</h1>
        </div>
        <p className={classes.message}>{t('errorBoundary.message')}</p>
        <div className={classes.actions}>
          <EMRButton
            variant="primary"
            icon={IconRefresh}
            onClick={onReload}
            data-testid="error-boundary-reload"
          >
            {t('errorBoundary.reload')}
          </EMRButton>
        </div>
        <details className={classes.details}>
          <summary className={classes.detailsSummary} data-testid="error-boundary-details-summary">
            {t('errorBoundary.copyDetails')}
          </summary>
          <pre className={classes.detailsBlock} data-testid="error-boundary-details">
            {detailText}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default ErrorBoundary;
