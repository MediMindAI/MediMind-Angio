// SPDX-License-Identifier: Apache-2.0
/**
 * SaveTemplateDialog — EMRModal that captures a name / description / kind
 * from the user and emits a `SaveTemplatePayload` on submit.
 *
 * The caller is responsible for snapshotting the current form state (findings,
 * CEAP, recommendations, impression, sonographer comments, scope) and
 * persisting via `customTemplatesService.saveCustomTemplate()`.
 *
 * Every `t()` call carries an English fallback as its 2nd arg so the modal
 * is never rendered with raw translation keys even mid-load.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { EMRModal } from '../common';
import { EMRTextInput, EMRTextarea, EMRSelect } from '../shared/EMRFormFields';
import type { EMRSelectOption } from '../shared/EMRFormFields';
import { useTranslation } from '../../contexts/TranslationContext';
import type { TemplateKind } from '../studies/venous-le/templates';
import classes from './SaveTemplateDialog.module.css';

export interface SaveTemplatePayload {
  readonly name: string;
  readonly description: string;
  readonly kind: TemplateKind;
}

export interface SaveTemplateDialogProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: SaveTemplatePayload) => void;
  /** Initial kind suggested by the parent (derived from current state). */
  readonly defaultKind?: TemplateKind;
  readonly loading?: boolean;
}

export const SaveTemplateDialog = memo(function SaveTemplateDialog({
  opened,
  onClose,
  onSubmit,
  defaultKind = 'normal',
  loading = false,
}: SaveTemplateDialogProps): React.ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [kind, setKind] = useState<TemplateKind>(defaultKind);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset on open/close so a new save starts clean.
  useEffect(() => {
    if (opened) {
      setName('');
      setDescription('');
      setKind(defaultKind);
      setNameError(null);
    }
  }, [opened, defaultKind]);

  const kindOptions: EMRSelectOption[] = [
    {
      value: 'normal',
      label: t('venousLE.templates.kind.normal', 'Normal'),
    },
    {
      value: 'acute',
      label: t('venousLE.templates.kind.acute', 'Acute DVT'),
    },
    {
      value: 'chronic',
      label: t('venousLE.templates.kind.chronic', 'Chronic'),
    },
    {
      value: 'post-procedure',
      label: t('venousLE.templates.kind.postProcedure', 'Post-procedure'),
    },
  ];

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('venousLE.templates.save.nameRequired', 'Name is required.'));
      return;
    }
    setNameError(null);
    onSubmit({
      name: trimmed,
      description: description.trim(),
      kind,
    });
  }, [name, description, kind, onSubmit, t]);

  return (
    <EMRModal
      opened={opened}
      onClose={onClose}
      title={t('venousLE.templates.save.title', 'Save as template')}
      subtitle={t(
        'venousLE.templates.save.subtitle',
        'Save the current form state as a reusable template for this device.',
      )}
      size="sm"
      icon={IconDeviceFloppy}
      cancelLabel={t('venousLE.templates.save.cancel', 'Cancel')}
      submitLabel={t('venousLE.templates.save.submit', 'Save template')}
      onSubmit={handleSubmit}
      submitLoading={loading}
      submitIcon={IconDeviceFloppy}
      testId="save-template-dialog"
      zIndex={1200}
    >
      <div className={classes.body}>
        <EMRTextInput
          label={t('venousLE.templates.save.nameLabel', 'Template name')}
          placeholder={t(
            'venousLE.templates.save.namePlaceholder',
            'e.g. Post-op EHIT II — my lab',
          )}
          value={name}
          onChange={setName}
          required
          error={nameError ?? undefined}
          autoFocus
          data-testid="save-template-name"
          fullWidth
        />
        <EMRTextarea
          label={t('venousLE.templates.save.descriptionLabel', 'Description')}
          placeholder={t(
            'venousLE.templates.save.descriptionPlaceholder',
            'Short description so you can recognize this template later (optional).',
          )}
          value={description}
          onChange={setDescription}
          minRows={3}
          maxRows={6}
          autosize
          data-testid="save-template-description"
          fullWidth
        />
        <EMRSelect
          label={t('venousLE.templates.save.kindLabel', 'Template kind')}
          data={kindOptions}
          value={kind}
          onChange={(v) => setKind((v ?? 'normal') as TemplateKind)}
          data-testid="save-template-kind"
          fullWidth
        />
        <p className={classes.hint}>
          {t(
            'venousLE.templates.save.hint',
            'The template captures findings, CEAP, recommendations, impression, and sonographer comments. No patient data is stored.',
          )}
        </p>
      </div>
    </EMRModal>
  );
});

export default SaveTemplateDialog;
