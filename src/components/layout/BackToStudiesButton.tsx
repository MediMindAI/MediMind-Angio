// SPDX-License-Identifier: Apache-2.0
/**
 * BackToStudiesButton — chip that lands the user back on the StudyPicker
 * landing page (`/`). Wave 2.2 switched from `window.location.pathname = '/'`
 * (full reload, drops in-progress dictation / unsaved fields / focus / scroll)
 * to React Router's `useNavigate()` for an in-app SPA transition.
 *
 * Wave 5.3 — switched the raw Mantine `Button` for the standardised
 * `EMRButton` so this control inherits the design-system focus ring,
 * disabled state, hover styling, and gradient/border tokens used
 * everywhere else in the app (Audit Part 06 LOW).
 */
import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { EMRButton } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';

export const BackToStudiesButton = memo(function BackToStudiesButton(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <EMRButton
      variant="secondary"
      size="sm"
      icon={IconArrowLeft}
      onClick={handleBack}
      style={{ alignSelf: 'flex-start' }}
      data-testid="back-to-studies"
    >
      {t('studyPicker.backToStudies', 'Back to studies')}
    </EMRButton>
  );
});

export default BackToStudiesButton;
