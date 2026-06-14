// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRTranslatedOrError — Feature 078 (Nursing Workstation V3) T036
 *
 * Per plan A12 (FR-063, FR-129) "failing-key fallback policy":
 *   medical terminology cannot fall back silently — block render with
 *   EMRErrorCard if a key is missing in the active locale.
 *
 * For non-medical strings (button labels, generic empty states, etc.) the
 * component falls back to the provided `fallback` string, or the raw key
 * when no fallback is supplied.
 *
 * Usage:
 *   <EMRTranslatedOrError i18nKey="nursing.v3.scales.morse.title" isMedicalTerminology />
 *   <EMRTranslatedOrError i18nKey="nursing.v3.empty.worklist" fallback="No tasks" />
 */

import { useMemo } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import { EMRErrorCard } from './EMRErrorCard';

/**
 * Sentinel marker returned by `t(key, sentinel)` when the key is not found
 * in the active translation tree (TranslationContext.t falls back to the
 * supplied default string when a lookup misses). The marker is opaque enough
 * that no legitimate translation will ever equal it.
 */
const MISSING_KEY_SENTINEL = '__EMR_TRANSLATED_OR_ERROR_MISSING__';

export interface EMRTranslatedOrErrorProps {
  /** Full dotted translation key (e.g. `"nursing.v3.scales.morse.title"`). */
  i18nKey: string;
  /**
   * Plain-text fallback used when the key is missing AND the string is NOT
   * medical terminology. Ignored when `isMedicalTerminology` is true.
   */
  fallback?: string;
  /**
   * When true, a missing key blocks the render and surfaces an `EMRErrorCard`
   * instead of falling back. Required for any clinical label (scale names,
   * protocol names, dose/route/site, override reasons, etc.) per FR-129.
   */
  isMedicalTerminology?: boolean;
  /** Test ID forwarded to the rendered output for QA hooks. */
  'data-testid'?: string;
}

/**
 * Renders a translated string or, for missing medical terminology, an
 * EMRErrorCard. The component intentionally returns a `ReactElement` (not
 * `ReactNode`) so it can be safely composed inside text contexts.
 *
 * @param props - See `EMRTranslatedOrErrorProps`.
 */
export function EMRTranslatedOrError(props: EMRTranslatedOrErrorProps): React.ReactElement {
  const {
    i18nKey,
    fallback,
    isMedicalTerminology = false,
    'data-testid': dataTestId,
  } = props;
  const { t } = useTranslation();

  // Probe the translation tree using the sentinel as the default-value arg.
  // TranslationContext.t returns the second argument when the key is missing,
  // so an equality check against the sentinel reliably reports presence.
  const resolved = t(i18nKey, MISSING_KEY_SENTINEL);
  const isMissing = resolved === MISSING_KEY_SENTINEL;

  // Localized error labels for the failing-key path. These keys themselves
  // live in nursing-v3/{ka,en,ru}.json under `nursing.v3.errors.*` and are
  // covered by the build-time parity gate (T034).
  const errorTitle = useMemo(
    () => t('nursing.v3.errors.translationMissingTitle'),
    [t]
  );
  const errorMessage = useMemo(
    () =>
      t('nursing.v3.errors.translationMissingMessage', { key: i18nKey }),
    [t, i18nKey]
  );

  if (isMissing && isMedicalTerminology) {
    return (
      <EMRErrorCard
        title={errorTitle}
        message={errorMessage}
        data-testid={dataTestId ?? 'emr-translated-or-error-missing'}
      />
    );
  }

  const text = isMissing ? (fallback ?? i18nKey) : resolved;
  return <span data-testid={dataTestId ?? 'emr-translated-or-error'}>{text}</span>;
}
