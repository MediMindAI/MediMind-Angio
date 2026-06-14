// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';
import { EMRButton } from './EMRButton';
import styles from './EMRErrorCard.module.css';

/**
 * Props for EMRErrorCard component
 */
export interface EMRErrorCardProps {
  /** Error title (optional, defaults to "Analysis Error") */
  title?: string;
  /** Main error message */
  message: string;
  /** List of suggestions for the user */
  suggestions?: string[];
  /** Retry callback */
  onRetry?: () => void;
  /** Retry button label (optional, defaults to "Try Again") */
  retryLabel?: string;
  /** Secondary action callback */
  onSecondary?: () => void;
  /** Secondary button label */
  secondaryLabel?: string;
  /** Alternative message shown at the bottom */
  alternativeMessage?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRErrorCard Component
 *
 * Reusable error card component with consistent styling using theme CSS variables.
 * Displays error messages with actionable suggestions and retry functionality.
 *
 * @param root0
 * @param root0.title
 * @param root0.message
 * @param root0.suggestions
 * @param root0.onRetry
 * @param root0.retryLabel
 * @param root0.onSecondary
 * @param root0.secondaryLabel
 * @param root0.alternativeMessage
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRErrorCard
 *   title="Analysis Failed"
 *   message="Unable to extract text from the image"
 *   suggestions={[
 *     "Ensure the image is clear and well-lit",
 *     "Try a different angle or closer zoom",
 *     "Upload a higher resolution image"
 *   ]}
 *   onRetry={handleRetry}
 *   retryLabel="Try Again"
 *   alternativeMessage="Your system supports Flowise AI as backup"
 * />
 * ```
 */
export function EMRErrorCard({
  title,
  message,
  suggestions = [],
  onRetry,
  retryLabel,
  onSecondary,
  secondaryLabel,
  alternativeMessage,
  'data-testid': dataTestId = 'emr-error-card',
}: EMRErrorCardProps): React.ReactElement {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('common.analysisError');
  const resolvedRetryLabel = retryLabel ?? t('common.tryAgain');

  return (
    <div className={styles.errorCard} data-testid={dataTestId}>
      {/* Error Icon & Title */}
      <div className={styles.header}>
        <IconAlertCircle size={24} className={styles.icon} />
        <h3 className={styles.title}>{resolvedTitle}</h3>
      </div>

      {/* Error Message */}
      <p className={styles.message}>{message}</p>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          <h4 className={styles.suggestionsTitle}>{t('common.whatYouCanDo')}</h4>
          <ul className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <li key={index} className={styles.suggestionItem}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {(onRetry || onSecondary) && (
        <div className={styles.actions}>
          {onRetry && (
            <EMRButton variant="danger" onClick={onRetry} data-testid={`${dataTestId}-retry`}>
              {resolvedRetryLabel}
            </EMRButton>
          )}
          {onSecondary && secondaryLabel && (
            <EMRButton variant="secondary" onClick={onSecondary} data-testid={`${dataTestId}-secondary`}>
              {secondaryLabel}
            </EMRButton>
          )}
        </div>
      )}

      {/* Alternative Message */}
      {alternativeMessage && <p className={styles.alternative}>{alternativeMessage}</p>}
    </div>
  );
}
