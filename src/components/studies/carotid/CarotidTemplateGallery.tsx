// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidTemplateGallery — thin wrapper over `TemplateGalleryGeneric` that
 * supplies carotid-specific templates, kind enum values, icons, and
 * translation keys.
 *
 * See `src/components/form/TemplateGalleryGeneric.tsx` for the shared UI
 * implementation.
 */

import { memo } from 'react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconVaccine,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import {
  CAROTID_TEMPLATES,
  type CarotidTemplate,
  type CarotidTemplateKind,
} from './templates';
import type { CustomTemplate } from '../../../services/customTemplatesService';
import {
  TemplateGalleryGeneric,
  type GalleryIconProps,
  type GallerySeverity,
  type GalleryTranslationKeys,
} from '../../form/TemplateGalleryGeneric';

type IconCmp = ComponentType<GalleryIconProps>;

const KIND_ORDER: ReadonlyArray<CarotidTemplateKind> = [
  'normal',
  'mild',
  'moderate',
  'severe',
  'post-procedure',
];

const KIND_ICONS: Record<CarotidTemplateKind, IconCmp> = {
  normal: IconCircleCheck,
  mild: IconInfoCircle,
  moderate: IconAlertTriangle,
  severe: IconAlertTriangle,
  'post-procedure': IconVaccine,
};

const KIND_LABELS: Record<
  CarotidTemplateKind,
  { key: string; fallback: string }
> = {
  normal: { key: 'carotid.templateGallery.kind.normal', fallback: 'Normal' },
  mild: { key: 'carotid.templateGallery.kind.mild', fallback: 'Mild' },
  moderate: { key: 'carotid.templateGallery.kind.moderate', fallback: 'Moderate' },
  severe: { key: 'carotid.templateGallery.kind.severe', fallback: 'Severe' },
  'post-procedure': {
    key: 'carotid.templateGallery.kind.postProcedure',
    fallback: 'Post-procedure',
  },
};

const SEVERITY_ICONS: Record<GallerySeverity, IconCmp> = {
  critical: IconAlertTriangle,
  urgent: IconAlertTriangle,
  routine: IconCircleCheck,
  informational: IconInfoCircle,
};

const TRANSLATIONS: GalleryTranslationKeys = {
  title: { key: 'carotid.templateGallery.title', fallback: 'Templates' },
  subtitle: {
    key: 'carotid.templateGallery.subtitle',
    fallback: 'Pick a pre-built case or save your own.',
  },
  searchPlaceholder: {
    key: 'carotid.templateGallery.searchPlaceholder',
    fallback: 'Search templates…',
  },
  categoriesLabel: {
    key: 'carotid.templateGallery.categoriesLabel',
    fallback: 'Categories',
  },
  categoryAll: { key: 'carotid.templateGallery.categoryAll', fallback: 'All' },
  recentGroup: {
    key: 'carotid.templateGallery.recentGroup',
    fallback: 'Recently used',
  },
  customGroup: {
    key: 'carotid.templateGallery.customGroup',
    fallback: 'My templates',
  },
  cardApply: { key: 'carotid.templateGallery.cardApply', fallback: 'Apply' },
  saveAction: {
    key: 'carotid.templateGallery.saveAction',
    fallback: '+ Save current as template',
  },
  customTag: { key: 'carotid.templateGallery.customTag', fallback: 'My template' },
  deleteAriaLabel: {
    key: 'carotid.templateGallery.deleteAriaLabel',
    fallback: 'Delete template',
  },
  emptyNoMatchTitle: {
    key: 'carotid.templateGallery.emptyNoMatchTitle',
    fallback: 'No templates match your search',
  },
  emptyNoMatch: {
    key: 'carotid.templateGallery.emptyNoMatch',
    fallback: 'No templates match "{query}" — try a different search term.',
  },
  emptyMineTitle: {
    key: 'carotid.templateGallery.emptyMineTitle',
    fallback: 'No saved templates yet',
  },
  emptyMine: {
    key: 'carotid.templateGallery.emptyMine',
    fallback:
      "You haven't saved any templates yet. Fill in a case and click + Save current as template below.",
  },
  emptyRecentTitle: {
    key: 'carotid.templateGallery.emptyRecentTitle',
    fallback: 'Nothing here yet',
  },
  emptyRecent: {
    key: 'carotid.templateGallery.emptyRecent',
    fallback: 'Templates you apply will appear here for quick access.',
  },
  emptyGeneric: {
    key: 'carotid.templateGallery.emptyGeneric',
    fallback: 'No templates in this category.',
  },
  severityLabel: {
    critical: {
      key: 'carotid.templateGallery.severity.critical',
      fallback: 'Critical',
    },
    urgent: { key: 'carotid.templateGallery.severity.urgent', fallback: 'Urgent' },
    routine: {
      key: 'carotid.templateGallery.severity.routine',
      fallback: 'Routine',
    },
    informational: {
      key: 'carotid.templateGallery.severity.informational',
      fallback: 'Informational',
    },
  },
  scopeLabel: {
    right: { key: 'carotid.templateGallery.scope.right', fallback: 'Right' },
    left: { key: 'carotid.templateGallery.scope.left', fallback: 'Left' },
    bilateral: {
      key: 'carotid.templateGallery.scope.bilateral',
      fallback: 'Bilateral',
    },
  },
};

export interface CarotidTemplateGalleryProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onApply: (template: CarotidTemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
}

export const CarotidTemplateGallery = memo(function CarotidTemplateGallery(
  props: CarotidTemplateGalleryProps,
): React.ReactElement {
  return (
    <TemplateGalleryGeneric<CarotidTemplate>
      opened={props.opened}
      onClose={props.onClose}
      onApply={props.onApply}
      onSaveCurrentAsTemplate={props.onSaveCurrentAsTemplate}
      customTemplates={props.customTemplates}
      recentTemplateIds={props.recentTemplateIds}
      onDeleteCustom={props.onDeleteCustom}
      templates={CAROTID_TEMPLATES}
      kindOrder={KIND_ORDER}
      kindIcons={KIND_ICONS}
      kindLabels={KIND_LABELS}
      severityIcons={SEVERITY_ICONS}
      translations={TRANSLATIONS}
      testIdPrefix="carotid-template-gallery"
    />
  );
});

export default CarotidTemplateGallery;
