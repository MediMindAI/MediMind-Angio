// SPDX-License-Identifier: Apache-2.0
/**
 * BackToStudiesButton — small ghost chip that lands the user back on the
 * StudyPicker landing page (`/`). Mirrors the pathname-assignment
 * navigation used by `StudyPicker.handleStartStudy`.
 */
import { memo, useCallback } from 'react';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useTranslation } from '../../contexts/TranslationContext';

export const BackToStudiesButton = memo(function BackToStudiesButton(): React.ReactElement {
  const { t } = useTranslation();

  const handleBack = useCallback(() => {
    window.location.pathname = '/';
  }, []);

  return (
    <Button
      variant="subtle"
      size="xs"
      leftSection={<IconArrowLeft size={14} stroke={2} />}
      onClick={handleBack}
      styles={{ root: { alignSelf: 'flex-start', fontWeight: 500 } }}
      data-testid="back-to-studies"
    >
      {t('studyPicker.backToStudies', 'Back to studies')}
    </Button>
  );
});

export default BackToStudiesButton;
