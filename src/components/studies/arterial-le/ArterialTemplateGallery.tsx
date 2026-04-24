// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialTemplateGallery — full-size modal gallery of clinical presets for
 * the Arterial LE duplex study.
 *
 * Fork of `src/components/form/TemplateGallery.tsx`. Diffs from the venous
 * gallery are all surface: filter chip kinds (`normal | mild | moderate |
 * severe | critical | post-procedure`), severity icon palette extended with
 * `critical` rendering, translation namespace `arterialLE.templateGallery.*`.
 *
 * Every `t()` call passes an English fallback as 2nd arg so the gallery
 * renders readable text even while translation JSON is loading.
 */

import { memo, useMemo, useState } from 'react';
import { Box } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconCircleDashed,
  IconClock,
  IconDeviceFloppy,
  IconFlame,
  IconInfoCircle,
  IconLayoutGrid,
  IconSearch,
  IconStack2,
  IconTrash,
  IconVaccine,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { EMRButton, EMRModal } from '../../common';
import { EMRTextInput } from '../../shared/EMRFormFields';
import { useTranslation } from '../../../contexts/TranslationContext';
import {
  ARTERIAL_LE_TEMPLATES,
  findArterialTemplateById,
  type ArterialLETemplate,
  type ArterialTemplateKind,
  type ArterialTemplateScope,
  type ArterialTemplateSeverity,
} from './templates';
import type { CustomTemplate } from '../../../services/customTemplatesService';
import classes from './ArterialTemplateGallery.module.css';

interface IconProps {
  readonly size?: number | string;
  readonly stroke?: number;
}

type CategoryId = 'all' | 'recent' | 'custom' | ArterialTemplateKind;

const KIND_ORDER: ReadonlyArray<ArterialTemplateKind> = [
  'normal',
  'mild',
  'moderate',
  'severe',
  'critical',
  'post-procedure',
];

const KIND_ICON: Record<ArterialTemplateKind, ComponentType<IconProps>> = {
  normal: IconCircleCheck,
  mild: IconInfoCircle,
  moderate: IconAlertTriangle,
  severe: IconAlertTriangle,
  critical: IconFlame,
  'post-procedure': IconVaccine,
};

const KIND_LABEL_KEY: Record<ArterialTemplateKind, string> = {
  normal: 'arterialLE.templateGallery.kind.normal',
  mild: 'arterialLE.templateGallery.kind.mild',
  moderate: 'arterialLE.templateGallery.kind.moderate',
  severe: 'arterialLE.templateGallery.kind.severe',
  critical: 'arterialLE.templateGallery.kind.critical',
  'post-procedure': 'arterialLE.templateGallery.kind.postProcedure',
};

const KIND_LABEL_FALLBACK: Record<ArterialTemplateKind, string> = {
  normal: 'Normal',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  critical: 'Critical',
  'post-procedure': 'Post-procedure',
};

const SEVERITY_ICON: Record<ArterialTemplateSeverity, ComponentType<IconProps>> = {
  critical: IconAlertTriangle,
  urgent: IconAlertTriangle,
  routine: IconCircleCheck,
  informational: IconInfoCircle,
};

const SEVERITY_LABEL_KEY: Record<ArterialTemplateSeverity, string> = {
  critical: 'arterialLE.templateGallery.severity.critical',
  urgent: 'arterialLE.templateGallery.severity.urgent',
  routine: 'arterialLE.templateGallery.severity.routine',
  informational: 'arterialLE.templateGallery.severity.informational',
};

const SEVERITY_LABEL_FALLBACK: Record<ArterialTemplateSeverity, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  routine: 'Routine',
  informational: 'Informational',
};

const SCOPE_LABEL_KEY: Record<ArterialTemplateScope, string> = {
  right: 'arterialLE.templateGallery.scope.right',
  left: 'arterialLE.templateGallery.scope.left',
  bilateral: 'arterialLE.templateGallery.scope.bilateral',
};

const SCOPE_LABEL_FALLBACK: Record<ArterialTemplateScope, string> = {
  right: 'Right',
  left: 'Left',
  bilateral: 'Bilateral',
};

// Fallback — surfaces a dashed-circle icon if a future kind is added without
// a mapping update. Keeps TypeScript honest.
const FALLBACK_KIND_ICON = IconCircleDashed;

/** A row the gallery can render — either a built-in or a custom template. */
type GalleryRow =
  | { readonly kind: 'builtin'; readonly template: ArterialLETemplate }
  | { readonly kind: 'custom'; readonly template: CustomTemplate };

function resolveTemplateById(
  id: string,
  customs: ReadonlyArray<CustomTemplate>,
): GalleryRow | null {
  const builtIn = findArterialTemplateById(id);
  if (builtIn) return { kind: 'builtin', template: builtIn };
  const custom = customs.find((c) => c.id === id);
  if (custom) return { kind: 'custom', template: custom };
  return null;
}

function matchesSearch(
  row: GalleryRow,
  query: string,
  t: (k: string, f?: string) => string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (row.kind === 'builtin') {
    const tpl = row.template;
    const name = t(tpl.nameKey, tpl.nameFallback).toLowerCase();
    const desc = t(tpl.descriptionKey, tpl.descriptionFallback).toLowerCase();
    const impression = t(tpl.impressionKey, tpl.impressionFallback).toLowerCase();
    return name.includes(q) || desc.includes(q) || impression.includes(q);
  }
  const tpl = row.template;
  const name = (tpl.name ?? '').toLowerCase();
  const desc = (tpl.description ?? '').toLowerCase();
  const impression = (tpl.impression ?? '').toLowerCase();
  return name.includes(q) || desc.includes(q) || impression.includes(q);
}

export interface ArterialTemplateGalleryProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onApply: (template: ArterialLETemplate | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
}

export const ArterialTemplateGallery = memo(function ArterialTemplateGallery({
  opened,
  onClose,
  onApply,
  onSaveCurrentAsTemplate,
  customTemplates,
  recentTemplateIds,
  onDeleteCustom,
}: ArterialTemplateGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId>('all');

  // Recently used rows, resolved in MRU order.
  const recentRows = useMemo<ReadonlyArray<GalleryRow>>(() => {
    const out: GalleryRow[] = [];
    for (const id of recentTemplateIds) {
      const row = resolveTemplateById(id, customTemplates);
      if (row) out.push(row);
    }
    return out;
  }, [recentTemplateIds, customTemplates]);

  // Custom template rows, in creation order.
  const customRows = useMemo<ReadonlyArray<GalleryRow>>(
    () => customTemplates.map((tpl) => ({ kind: 'custom' as const, template: tpl })),
    [customTemplates],
  );

  // Built-in rows, grouped by kind.
  const builtInGroups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        items: ARTERIAL_LE_TEMPLATES.filter((tpl) => tpl.kind === kind).map(
          (tpl) => ({ kind: 'builtin' as const, template: tpl }),
        ),
      })),
    [],
  );

  // Filter helper applied to any row list.
  const filterRows = (rows: ReadonlyArray<GalleryRow>): ReadonlyArray<GalleryRow> =>
    rows.filter((r) => matchesSearch(r, search, t));

  const filteredRecent = useMemo(() => filterRows(recentRows), [recentRows, search, t]);
  const filteredCustom = useMemo(() => filterRows(customRows), [customRows, search, t]);
  const filteredBuiltInGroups = useMemo(
    () =>
      builtInGroups.map((g) => ({
        kind: g.kind,
        items: filterRows(g.items),
      })),
    [builtInGroups, search, t],
  );

  // Total matching count (drives empty state).
  const totalFilteredCount =
    filteredRecent.length +
    filteredCustom.length +
    filteredBuiltInGroups.reduce((sum, g) => sum + g.items.length, 0);

  // Counts per category (unfiltered — sidebar always shows full counts).
  const counts = useMemo(() => {
    const kindCount: Record<ArterialTemplateKind, number> = {
      normal: 0,
      mild: 0,
      moderate: 0,
      severe: 0,
      critical: 0,
      'post-procedure': 0,
    };
    for (const tpl of ARTERIAL_LE_TEMPLATES) {
      kindCount[tpl.kind] += 1;
    }
    return {
      all: ARTERIAL_LE_TEMPLATES.length + customTemplates.length,
      recent: recentRows.length,
      custom: customTemplates.length,
      kinds: kindCount,
    };
  }, [customTemplates.length, recentRows.length]);

  interface SidebarItem {
    readonly id: CategoryId;
    readonly icon: ComponentType<IconProps>;
    readonly label: string;
    readonly count: number;
  }

  const sidebarItems = useMemo<ReadonlyArray<SidebarItem>>(() => {
    const items: SidebarItem[] = [];
    items.push({
      id: 'all',
      icon: IconLayoutGrid,
      label: t('arterialLE.templateGallery.categoryAll', 'All'),
      count: counts.all,
    });
    if (counts.recent > 0) {
      items.push({
        id: 'recent',
        icon: IconClock,
        label: t('arterialLE.templateGallery.recentGroup', 'Recently used'),
        count: counts.recent,
      });
    }
    if (counts.custom > 0) {
      items.push({
        id: 'custom',
        icon: IconBookmark,
        label: t('arterialLE.templateGallery.customGroup', 'My templates'),
        count: counts.custom,
      });
    }
    for (const kind of KIND_ORDER) {
      if (counts.kinds[kind] > 0) {
        items.push({
          id: kind,
          icon: KIND_ICON[kind] ?? FALLBACK_KIND_ICON,
          label: t(KIND_LABEL_KEY[kind], KIND_LABEL_FALLBACK[kind]),
          count: counts.kinds[kind],
        });
      }
    }
    return items;
  }, [counts, t]);

  // Handle category switch — keep "all" if selection no longer exists.
  const effectiveCategory: CategoryId = useMemo(() => {
    if (sidebarItems.some((item) => item.id === category)) return category;
    return 'all';
  }, [sidebarItems, category]);

  const handleApply = (row: GalleryRow): void => {
    onApply(row.template);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation();
    onDeleteCustom(id);
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    row: GalleryRow,
  ): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleApply(row);
    }
  };

  const renderCard = (row: GalleryRow): React.ReactElement => {
    if (row.kind === 'builtin') {
      const tpl = row.template;
      const SeverityIcon = SEVERITY_ICON[tpl.severity];
      return (
        <button
          key={`builtin-${tpl.id}`}
          type="button"
          className={classes.card}
          data-severity={tpl.severity}
          data-kind={tpl.kind}
          onClick={() => handleApply(row)}
          onKeyDown={(e) => handleCardKeyDown(e, row)}
          data-testid={`template-card-${tpl.id}`}
          aria-label={t(tpl.nameKey, tpl.nameFallback)}
        >
          <div className={classes.cardTopRow}>
            <span
              className={classes.cardIcon}
              data-severity={tpl.severity}
              aria-hidden
            >
              <SeverityIcon size={22} stroke={2} />
            </span>
            <span className={classes.severityBadge} data-severity={tpl.severity}>
              {t(
                SEVERITY_LABEL_KEY[tpl.severity],
                SEVERITY_LABEL_FALLBACK[tpl.severity],
              )}
            </span>
          </div>
          <div className={classes.cardName}>{t(tpl.nameKey, tpl.nameFallback)}</div>
          <div className={classes.cardDesc}>
            {t(tpl.descriptionKey, tpl.descriptionFallback)}
          </div>
          <div className={classes.cardBottomRow}>
            <EMRButton
              variant="primary"
              size="sm"
              onClick={() => handleApply(row)}
              data-testid={`template-apply-${tpl.id}`}
            >
              {t('arterialLE.templateGallery.cardApply', 'Apply')}
            </EMRButton>
            <span className={classes.scopeChip}>
              {t(SCOPE_LABEL_KEY[tpl.scope], SCOPE_LABEL_FALLBACK[tpl.scope])}
            </span>
          </div>
        </button>
      );
    }

    // Custom template card
    const tpl = row.template;
    const severity: ArterialTemplateSeverity = 'informational';
    const scopeLabel =
      tpl.scope === 'right' || tpl.scope === 'left' || tpl.scope === 'bilateral'
        ? t(SCOPE_LABEL_KEY[tpl.scope], SCOPE_LABEL_FALLBACK[tpl.scope])
        : '';
    return (
      <button
        key={`custom-${tpl.id}`}
        type="button"
        className={classes.card}
        data-severity={severity}
        data-kind={tpl.kind}
        onClick={() => handleApply(row)}
        onKeyDown={(e) => handleCardKeyDown(e, row)}
        data-testid={`template-card-${tpl.id}`}
        aria-label={tpl.name}
      >
        <div className={classes.cardTopRow}>
          <span className={classes.cardIcon} data-severity={severity} aria-hidden>
            <IconBookmark size={22} stroke={2} />
          </span>
          <span className={classes.severityBadge} data-severity={severity}>
            {t('arterialLE.templateGallery.customTag', 'My template')}
          </span>
        </div>
        <button
          type="button"
          className={classes.deleteButton}
          onClick={(e) => handleDelete(e, tpl.id)}
          aria-label={t(
            'arterialLE.templateGallery.deleteAriaLabel',
            'Delete template',
          )}
          data-testid={`template-delete-${tpl.id}`}
        >
          <IconTrash size={14} stroke={2} />
        </button>
        <div className={classes.cardName}>{tpl.name}</div>
        {tpl.description ? (
          <div className={classes.cardDesc}>{tpl.description}</div>
        ) : (
          <div className={classes.cardDesc} aria-hidden="true">&nbsp;</div>
        )}
        <div className={classes.cardBottomRow}>
          <EMRButton
            variant="primary"
            size="sm"
            onClick={() => handleApply(row)}
            data-testid={`template-apply-${tpl.id}`}
          >
            {t('arterialLE.templateGallery.cardApply', 'Apply')}
          </EMRButton>
          {scopeLabel ? <span className={classes.scopeChip}>{scopeLabel}</span> : null}
        </div>
      </button>
    );
  };

  const renderSection = (
    label: string,
    icon: ComponentType<IconProps>,
    rows: ReadonlyArray<GalleryRow>,
    showHeader: boolean,
    keyPrefix: string,
  ): React.ReactElement | null => {
    if (rows.length === 0) return null;
    const Icon = icon;
    return (
      <section className={classes.section} key={keyPrefix}>
        {showHeader && (
          <div className={classes.sectionHeader}>
            <span className={classes.sectionHeaderIcon} aria-hidden>
              <Icon size={12} stroke={2.25} />
            </span>
            <span>{label}</span>
          </div>
        )}
        <div className={classes.grid}>{rows.map(renderCard)}</div>
      </section>
    );
  };

  const renderPanel = (): React.ReactElement => {
    if (totalFilteredCount === 0) {
      if (search.trim().length > 0) {
        return (
          <div className={classes.empty}>
            <IconSearch size={28} stroke={1.5} />
            <div className={classes.emptyTitle}>
              {t(
                'arterialLE.templateGallery.emptyNoMatchTitle',
                'No templates match your search',
              )}
            </div>
            <div className={classes.emptyBody}>
              {t(
                'arterialLE.templateGallery.emptyNoMatch',
                'No templates match "{query}" — try a different search term.',
              ).replace('{query}', search)}
            </div>
          </div>
        );
      }
      if (effectiveCategory === 'custom') {
        return (
          <div className={classes.empty}>
            <IconBookmark size={28} stroke={1.5} />
            <div className={classes.emptyTitle}>
              {t(
                'arterialLE.templateGallery.emptyMineTitle',
                'No saved templates yet',
              )}
            </div>
            <div className={classes.emptyBody}>
              {t(
                'arterialLE.templateGallery.emptyMine',
                "You haven't saved any templates yet. Fill in a case and click + Save current as template below.",
              )}
            </div>
          </div>
        );
      }
      if (effectiveCategory === 'recent') {
        return (
          <div className={classes.empty}>
            <IconClock size={28} stroke={1.5} />
            <div className={classes.emptyTitle}>
              {t(
                'arterialLE.templateGallery.emptyRecentTitle',
                'Nothing here yet',
              )}
            </div>
            <div className={classes.emptyBody}>
              {t(
                'arterialLE.templateGallery.emptyRecent',
                'Templates you apply will appear here for quick access.',
              )}
            </div>
          </div>
        );
      }
      return (
        <div className={classes.empty}>
          <IconStack2 size={28} stroke={1.5} />
          <div className={classes.emptyBody}>
            {t(
              'arterialLE.templateGallery.emptyGeneric',
              'No templates in this category.',
            )}
          </div>
        </div>
      );
    }

    if (effectiveCategory === 'all') {
      const sections: Array<React.ReactElement | null> = [];
      sections.push(
        renderSection(
          t('arterialLE.templateGallery.recentGroup', 'Recently used'),
          IconClock,
          filteredRecent,
          true,
          'recent',
        ),
      );
      sections.push(
        renderSection(
          t('arterialLE.templateGallery.customGroup', 'My templates'),
          IconBookmark,
          filteredCustom,
          true,
          'custom',
        ),
      );
      for (const group of filteredBuiltInGroups) {
        sections.push(
          renderSection(
            t(KIND_LABEL_KEY[group.kind], KIND_LABEL_FALLBACK[group.kind]),
            KIND_ICON[group.kind] ?? FALLBACK_KIND_ICON,
            group.items,
            true,
            `kind-${group.kind}`,
          ),
        );
      }
      return <>{sections.filter(Boolean)}</>;
    }

    if (effectiveCategory === 'recent') {
      return renderSection('', IconClock, filteredRecent, false, 'recent-only')!;
    }
    if (effectiveCategory === 'custom') {
      return renderSection('', IconBookmark, filteredCustom, false, 'custom-only')!;
    }
    const group = filteredBuiltInGroups.find((g) => g.kind === effectiveCategory);
    if (group) {
      return renderSection(
        '',
        KIND_ICON[group.kind] ?? FALLBACK_KIND_ICON,
        group.items,
        false,
        `kind-only-${group.kind}`,
      )!;
    }
    return <></>;
  };

  const footer = (
    <div className={classes.footer}>
      <div className={classes.footerLeft}>
        <EMRButton
          variant="secondary"
          size="sm"
          icon={IconDeviceFloppy}
          onClick={onSaveCurrentAsTemplate}
          data-testid="template-gallery-save-action"
        >
          {t('arterialLE.templateGallery.saveAction', '+ Save current as template')}
        </EMRButton>
      </div>
      <div className={classes.footerRight}>
        <EMRButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="template-gallery-cancel"
        >
          {t('common.cancel', 'Cancel')}
        </EMRButton>
      </div>
    </div>
  );

  return (
    <EMRModal
      opened={opened}
      onClose={onClose}
      size="xl"
      icon={IconStack2}
      title={t('arterialLE.templateGallery.title', 'Templates')}
      subtitle={t(
        'arterialLE.templateGallery.subtitle',
        'Pick a pre-built case or save your own.',
      )}
      footer={footer}
      showFooter
      testId="arterial-template-gallery-modal"
    >
      <Box className={classes.root}>
        <div className={classes.searchRow}>
          <div className={classes.searchInput}>
            <EMRTextInput
              value={search}
              onChange={(value) => setSearch(value)}
              placeholder={t(
                'arterialLE.templateGallery.searchPlaceholder',
                'Search templates…',
              )}
              leftSection={<IconSearch size={16} stroke={1.75} />}
              clearable
              onClear={() => setSearch('')}
              aria-label={t(
                'arterialLE.templateGallery.searchPlaceholder',
                'Search templates…',
              )}
              data-testid="template-gallery-search"
            />
          </div>
        </div>

        <div className={classes.body}>
          <nav
            className={classes.sidebar}
            aria-label={t(
              'arterialLE.templateGallery.categoriesLabel',
              'Categories',
            )}
          >
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === effectiveCategory;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={classes.sidebarItem}
                  aria-pressed={isActive}
                  onClick={() => setCategory(item.id)}
                  data-testid={`template-gallery-cat-${item.id}`}
                >
                  <span className={classes.sidebarIcon} aria-hidden>
                    <Icon size={16} stroke={2} />
                  </span>
                  <span className={classes.sidebarLabel}>{item.label}</span>
                  <span className={classes.sidebarCount}>{item.count}</span>
                </button>
              );
            })}
          </nav>

          <div className={classes.panel}>{renderPanel()}</div>
        </div>
      </Box>
    </EMRModal>
  );
});

export default ArterialTemplateGallery;
