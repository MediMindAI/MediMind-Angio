// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialTemplateGallery — thin wrapper over `TemplateGalleryGeneric` that
 * supplies arterial-LE-specific templates, kind enum values, icons, and
 * translation keys.
 *
 * See `src/components/form/TemplateGalleryGeneric.tsx` for the shared UI
 * implementation. All chrome (search bar, sidebar, cards, empty states) is
 * study-agnostic; only the props below vary per study.
 */

import { memo } from 'react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFlame,
  IconInfoCircle,
  IconVaccine,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import {
  ARTERIAL_LE_TEMPLATES,
  type ArterialLETemplate,
  type ArterialTemplateKind,
} from './templates';
import type { CustomTemplate } from '../../../services/customTemplatesService';
import {
  TemplateGalleryGeneric,
  type GalleryIconProps,
  type GallerySeverity,
  type GalleryTranslationKeys,
} from '../../form/TemplateGalleryGeneric';

type IconCmp = ComponentType<GalleryIconProps>;

const KIND_ORDER: ReadonlyArray<ArterialTemplateKind> = [
  'normal',
  'mild',
  'moderate',
  'severe',
  'critical',
  'post-procedure',
];

const KIND_ICONS: Record<ArterialTemplateKind, IconCmp> = {
  normal: IconCircleCheck,
  mild: IconInfoCircle,
  moderate: IconAlertTriangle,
  severe: IconAlertTriangle,
  critical: IconFlame,
  'post-procedure': IconVaccine,
};

const KIND_LABELS: Record<
  ArterialTemplateKind,
  { key: string; fallback: string }
> = {
  normal: { key: 'arterialLE.templateGallery.kind.normal', fallback: 'Normal' },
  mild: { key: 'arterialLE.templateGallery.kind.mild', fallback: 'Mild' },
  moderate: { key: 'arterialLE.templateGallery.kind.moderate', fallback: 'Moderate' },
  severe: { key: 'arterialLE.templateGallery.kind.severe', fallback: 'Severe' },
  critical: { key: 'arterialLE.templateGallery.kind.critical', fallback: 'Critical' },
  'post-procedure': {
    key: 'arterialLE.templateGallery.kind.postProcedure',
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
  title: { key: 'arterialLE.templateGallery.title', fallback: 'Templates' },
  subtitle: {
    key: 'arterialLE.templateGallery.subtitle',
    fallback: 'Pick a pre-built case or save your own.',
  },
  searchPlaceholder: {
    key: 'arterialLE.templateGallery.searchPlaceholder',
    fallback: 'Search templates…',
  },
  categoriesLabel: {
    key: 'arterialLE.templateGallery.categoriesLabel',
    fallback: 'Categories',
  },
  categoryAll: { key: 'arterialLE.templateGallery.categoryAll', fallback: 'All' },
  recentGroup: {
    key: 'arterialLE.templateGallery.recentGroup',
    fallback: 'Recently used',
  },
  customGroup: {
    key: 'arterialLE.templateGallery.customGroup',
    fallback: 'My templates',
  },
  cardApply: { key: 'arterialLE.templateGallery.cardApply', fallback: 'Apply' },
  saveAction: {
    key: 'arterialLE.templateGallery.saveAction',
    fallback: '+ Save current as template',
  },
  customTag: { key: 'arterialLE.templateGallery.customTag', fallback: 'My template' },
  deleteAriaLabel: {
    key: 'arterialLE.templateGallery.deleteAriaLabel',
    fallback: 'Delete template',
  },
  emptyNoMatchTitle: {
    key: 'arterialLE.templateGallery.emptyNoMatchTitle',
    fallback: 'No templates match your search',
  },
  emptyNoMatch: {
    key: 'arterialLE.templateGallery.emptyNoMatch',
    fallback: 'No templates match "{query}" — try a different search term.',
  },
  emptyMineTitle: {
    key: 'arterialLE.templateGallery.emptyMineTitle',
    fallback: 'No saved templates yet',
  },
  emptyMine: {
    key: 'arterialLE.templateGallery.emptyMine',
    fallback:
      "You haven't saved any templates yet. Fill in a case and click + Save current as template below.",
  },
  emptyRecentTitle: {
    key: 'arterialLE.templateGallery.emptyRecentTitle',
    fallback: 'Nothing here yet',
  },
  emptyRecent: {
    key: 'arterialLE.templateGallery.emptyRecent',
    fallback: 'Templates you apply will appear here for quick access.',
  },
  emptyGeneric: {
    key: 'arterialLE.templateGallery.emptyGeneric',
    fallback: 'No templates in this category.',
  },
  severityLabel: {
    critical: {
      key: 'arterialLE.templateGallery.severity.critical',
      fallback: 'Critical',
    },
    urgent: { key: 'arterialLE.templateGallery.severity.urgent', fallback: 'Urgent' },
    routine: {
      key: 'arterialLE.templateGallery.severity.routine',
      fallback: 'Routine',
    },
    informational: {
      key: 'arterialLE.templateGallery.severity.informational',
      fallback: 'Informational',
    },
  },
  scopeLabel: {
    right: { key: 'arterialLE.templateGallery.scope.right', fallback: 'Right' },
    left: { key: 'arterialLE.templateGallery.scope.left', fallback: 'Left' },
    bilateral: {
      key: 'arterialLE.templateGallery.scope.bilateral',
      fallback: 'Bilateral',
    },
  },
};

export interface ArterialTemplateGalleryProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onApply: (template: ArterialLETemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
}

export const ArterialTemplateGallery = memo(function ArterialTemplateGallery(
  props: ArterialTemplateGalleryProps,
): React.ReactElement {
  return (
    <TemplateGalleryGeneric<ArterialLETemplate>
      opened={props.opened}
      onClose={props.onClose}
      onApply={props.onApply}
      onSaveCurrentAsTemplate={props.onSaveCurrentAsTemplate}
      customTemplates={props.customTemplates}
      recentTemplateIds={props.recentTemplateIds}
      onDeleteCustom={props.onDeleteCustom}
      templates={ARTERIAL_LE_TEMPLATES}
      kindOrder={KIND_ORDER}
      kindIcons={KIND_ICONS}
      kindLabels={KIND_LABELS}
      severityIcons={SEVERITY_ICONS}
      translations={TRANSLATIONS}
      testIdPrefix="arterial-template-gallery"
    />
  );
});

export default ArterialTemplateGallery;
