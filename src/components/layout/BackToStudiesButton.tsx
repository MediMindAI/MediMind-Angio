// SPDX-License-Identifier: Apache-2.0
/**
 * BackToStudiesButton — chip that lands the user back on the StudyPicker
 * landing page (`/`). Wave 2.2 switched from `window.location.pathname = '/'`
 * (full reload, drops in-progress dictation / unsaved fields / focus / scroll)
 * to React Router's `useNavigate()` for an in-app SPA transition.
 */
import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';

export const BackToStudiesButton = memo(function BackToStudiesButton(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <Button
      variant="default"
      size="sm"
      leftSection={<IconArrowLeft size={16} stroke={2} />}
      onClick={handleBack}
      styles={{
        root: {
          alignSelf: 'flex-start',
          fontWeight: 600,
          borderRadius: 10,
          paddingInline: 14,
          borderColor: 'var(--emr-border-color)',
          color: 'var(--emr-primary)',
          background: 'var(--emr-bg-card)',
          transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
        },
      }}
      data-testid="back-to-studies"
    >
      {t('studyPicker.backToStudies', 'Back to studies')}
    </Button>
  );
});

export default BackToStudiesButton;
