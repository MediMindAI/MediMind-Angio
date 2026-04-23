// SPDX-License-Identifier: Apache-2.0
/**
 * TemplatePicker — "Templates" button that opens the full-size
 * TemplateGallery modal.
 *
 * The old cramped Mantine <Menu> dropdown has been replaced with a proper
 * modal gallery (see `TemplateGallery.tsx`). This file is now a thin trigger:
 *
 *   - Renders a single `EMRButton` labelled "Templates".
 *   - On click, opens <TemplateGallery>.
 *   - Forwards all template props to the gallery.
 *
 * Props are unchanged so parent components (SegmentAssessmentCard) keep
 * working without edits.
 */

import { memo, useState } from 'react';
import { IconStack2 } from '@tabler/icons-react';
import { EMRButton } from '../common';
import { useTranslation } from '../../contexts/TranslationContext';
import { TemplateGallery } from './TemplateGallery';
import type { VenousLETemplate } from '../studies/venous-le/templates';
import type { CustomTemplate } from '../../services/customTemplatesService';
import classes from './TemplatePicker.module.css';

export interface TemplatePickerProps {
  readonly onApply: (template: VenousLETemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
}

export const TemplatePicker = memo(function TemplatePicker({
  onApply,
  onSaveCurrentAsTemplate,
  customTemplates,
  recentTemplateIds,
  onDeleteCustom,
}: TemplatePickerProps): React.ReactElement {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <>
      <EMRButton
        variant="secondary"
        size="sm"
        icon={IconStack2}
        onClick={() => setOpened(true)}
        data-testid="template-picker-trigger"
      >
        <span className={classes.triggerLabel}>
          {t('venousLE.templates.menuLabel', 'Templates')}
        </span>
      </EMRButton>
      <TemplateGallery
        opened={opened}
        onClose={() => setOpened(false)}
        onApply={onApply}
        onSaveCurrentAsTemplate={onSaveCurrentAsTemplate}
        customTemplates={customTemplates}
        recentTemplateIds={recentTemplateIds}
        onDeleteCustom={onDeleteCustom}
      />
    </>
  );
});

export default TemplatePicker;
