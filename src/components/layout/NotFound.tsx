// SPDX-License-Identifier: Apache-2.0
/**
 * NotFound — 404 fallback rendered by the React Router catch-all route.
 *
 * Wave 2.2 (Pattern A) introduced a real router; previously, any unknown
 * pathname silently rendered the landing page. With exact-match routing,
 * unknown URLs now land here so users can recover.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../contexts/TranslationContext';
import { EMRButton } from '../common';

export const NotFound = memo(function NotFound(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      role="main"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 1rem',
        minHeight: '60vh',
        gap: '0.75rem',
      }}
      data-testid="not-found"
    >
      <h1 style={{ color: 'var(--emr-text-primary)', margin: 0 }}>
        {t('notFound.title')}
      </h1>
      <p style={{ color: 'var(--emr-text-secondary)', margin: 0, maxWidth: 480 }}>
        {t('notFound.message')}
      </p>
      <Link to="/" style={{ marginTop: '1.5rem', textDecoration: 'none' }}>
        <EMRButton variant="primary">{t('notFound.home')}</EMRButton>
      </Link>
    </div>
  );
});

export default NotFound;
