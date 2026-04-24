// SPDX-License-Identifier: Apache-2.0
/**
 * TemplateGallery — thin wrapper over `TemplateGalleryGeneric` that supplies
 * venous-LE-specific templates, kind enum values, icons, and translation
 * keys.
 *
 * See `TemplateGalleryGeneric.tsx` for the shared UI implementation.
 *
 * Note on translation keys: the venous JSON evolved mixed prefixes —
 * some chrome strings live under `venousLE.templates.gallery.*` while
 * others (recentGroup, customGroup, saveAction, kind.*) live under
 * `venousLE.templates.*`. The map below preserves those existing keys
 * verbatim so no JSON migration is required.
 */

import { memo } from 'react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconInfoCircle,
  IconVaccine,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import {
  VENOUS_LE_TEMPLATES,
  type TemplateKind,
  type VenousLETemplate,
} from '../studies/venous-le/templates';
import type { CustomTemplate } from '../../services/customTemplatesService';
import {
  TemplateGalleryGeneric,
  type GalleryIconProps,
  type GallerySeverity,
  type GalleryTranslationKeys,
} from './TemplateGalleryGeneric';

type IconCmp = ComponentType<GalleryIconProps>;

const KIND_ORDER: ReadonlyArray<TemplateKind> = [
  'normal',
  'acute',
  'chronic',
  'post-procedure',
];

const KIND_ICONS: Record<TemplateKind, IconCmp> = {
  normal: IconCircleCheck,
  acute: IconAlertTriangle,
  chronic: IconCircleDashed,
  'post-procedure': IconVaccine,
};

const KIND_LABELS: Record<TemplateKind, { key: string; fallback: string }> = {
  normal: { key: 'venousLE.templates.kind.normal', fallback: 'Normal' },
  acute: { key: 'venousLE.templates.kind.acute', fallback: 'Acute DVT' },
  chronic: { key: 'venousLE.templates.kind.chronic', fallback: 'Chronic' },
  'post-procedure': {
    key: 'venousLE.templates.kind.postProcedure',
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
  title: { key: 'venousLE.templates.gallery.title', fallback: 'Templates' },
  subtitle: {
    key: 'venousLE.templates.gallery.subtitle',
    fallback: 'Pick a pre-built case or save your own.',
  },
  searchPlaceholder: {
    key: 'venousLE.templates.gallery.searchPlaceholder',
    fallback: 'Search templates…',
  },
  categoriesLabel: {
    key: 'venousLE.templates.gallery.categoriesLabel',
    fallback: 'Categories',
  },
  categoryAll: { key: 'venousLE.templates.gallery.categoryAll', fallback: 'All' },
  recentGroup: { key: 'venousLE.templates.recentGroup', fallback: 'Recently used' },
  customGroup: { key: 'venousLE.templates.customGroup', fallback: 'My templates' },
  cardApply: { key: 'venousLE.templates.gallery.cardApply', fallback: 'Apply' },
  saveAction: {
    key: 'venousLE.templates.saveAction',
    fallback: '+ Save current as template',
  },
  customTag: {
    key: 'venousLE.templates.gallery.customTag',
    fallback: 'My template',
  },
  deleteAriaLabel: {
    key: 'venousLE.templates.delete.ariaLabel',
    fallback: 'Delete template',
  },
  emptyNoMatchTitle: {
    key: 'venousLE.templates.gallery.emptyNoMatchTitle',
    fallback: 'No templates match your search',
  },
  emptyNoMatch: {
    key: 'venousLE.templates.gallery.emptyNoMatch',
    fallback: 'No templates match "{query}" — try a different search term.',
  },
  emptyMineTitle: {
    key: 'venousLE.templates.gallery.emptyMineTitle',
    fallback: 'No saved templates yet',
  },
  emptyMine: {
    key: 'venousLE.templates.gallery.emptyMine',
    fallback:
      "You haven't saved any templates yet. Fill in a case and click + Save current as template below.",
  },
  emptyRecentTitle: {
    key: 'venousLE.templates.gallery.emptyRecentTitle',
    fallback: 'Nothing here yet',
  },
  emptyRecent: {
    key: 'venousLE.templates.gallery.emptyRecent',
    fallback: 'Templates you apply will appear here for quick access.',
  },
  emptyGeneric: {
    key: 'venousLE.templates.gallery.emptyGeneric',
    fallback: 'No templates in this category.',
  },
  severityLabel: {
    critical: {
      key: 'venousLE.templates.gallery.severity.critical',
      fallback: 'Critical',
    },
    urgent: {
      key: 'venousLE.templates.gallery.severity.urgent',
      fallback: 'Urgent',
    },
    routine: {
      key: 'venousLE.templates.gallery.severity.routine',
      fallback: 'Routine',
    },
    informational: {
      key: 'venousLE.templates.gallery.severity.informational',
      fallback: 'Informational',
    },
  },
  scopeLabel: {
    right: { key: 'venousLE.templates.gallery.scope.right', fallback: 'Right' },
    left: { key: 'venousLE.templates.gallery.scope.left', fallback: 'Left' },
    bilateral: {
      key: 'venousLE.templates.gallery.scope.bilateral',
      fallback: 'Bilateral',
    },
  },
};

export interface TemplateGalleryProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onApply: (template: VenousLETemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
}

export const TemplateGallery = memo(function TemplateGallery(
  props: TemplateGalleryProps,
): React.ReactElement {
  return (
    <TemplateGalleryGeneric<VenousLETemplate>
      opened={props.opened}
      onClose={props.onClose}
      onApply={props.onApply}
      onSaveCurrentAsTemplate={props.onSaveCurrentAsTemplate}
      customTemplates={props.customTemplates}
      recentTemplateIds={props.recentTemplateIds}
      onDeleteCustom={props.onDeleteCustom}
      templates={VENOUS_LE_TEMPLATES}
      kindOrder={KIND_ORDER}
      kindIcons={KIND_ICONS}
      kindLabels={KIND_LABELS}
      severityIcons={SEVERITY_ICONS}
      translations={TRANSLATIONS}
      testIdPrefix="template-gallery"
    />
  );
});

export default TemplateGallery;
