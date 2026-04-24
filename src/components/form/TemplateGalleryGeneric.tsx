// SPDX-License-Identifier: Apache-2.0
/**
 * TemplateGalleryGeneric — study-agnostic modal gallery of clinical
 * presets. Wraps the layout, search bar, sidebar, and card rendering that
 * used to be triplicated across venous / arterial / carotid galleries.
 *
 * Per-study wrappers pass:
 *   - the templates array + field accessors (nameKey, severity, scope, …)
 *   - the `kindOrder` enum values (venous: normal|acute|chronic|post; arterial:
 *     normal|mild|moderate|severe|critical|post; carotid: normal|mild|…)
 *   - the icon + label maps per kind
 *   - a `translationKeys` bundle for all the gallery-level strings
 *     (title, empty states, etc.) — passed as a map because the three
 *     studies evolved slightly different prefix conventions.
 *
 * The component intentionally does NOT hard-code any study-level semantics —
 * every copy string comes from the caller, every template shape is reached
 * through the accessor props. This means the file will grow only if a new
 * *cross-study* feature is needed (e.g. preview-on-hover), never from a new
 * study being added.
 *
 * Originally forked from `src/components/form/TemplateGallery.tsx` (venous)
 * as part of Wave 3 consolidation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { memo, useMemo, useState } from 'react';
import { Box } from '@mantine/core';
import {
  IconBookmark,
  IconCircleDashed,
  IconClock,
  IconDeviceFloppy,
  IconLayoutGrid,
  IconSearch,
  IconStack2,
  IconTrash,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { EMRButton, EMRModal } from '../common';
import { EMRTextInput } from '../shared/EMRFormFields';
import { useTranslation } from '../../contexts/TranslationContext';
import type { CustomTemplate } from '../../services/customTemplatesService';
import classes from './TemplateGalleryGeneric.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GalleryIconProps {
  readonly size?: number | string;
  readonly stroke?: number;
}

type IconCmp = ComponentType<GalleryIconProps>;

/**
 * Shared severity — all three existing studies converged on these 4 values
 * (`critical | urgent | routine | informational`). If a future study needs
 * a different shape, widen the union here — the generic already treats it
 * as an opaque string for lookups.
 */
export type GallerySeverity = 'critical' | 'urgent' | 'routine' | 'informational';

/** Shared scope — all three existing studies use these 3 values. */
export type GalleryScope = 'left' | 'right' | 'bilateral';

/**
 * Minimal shape the gallery needs to read off a built-in template.
 * Each per-study `Template` type must be assignable to this structural
 * contract — which they already are today.
 */
export interface GalleryTemplateLike {
  readonly id: string;
  readonly nameKey: string;
  readonly nameFallback: string;
  readonly descriptionKey: string;
  readonly descriptionFallback: string;
  readonly impressionKey: string;
  readonly impressionFallback: string;
  readonly kind: string;
  readonly scope: GalleryScope;
  readonly severity: GallerySeverity;
}

/**
 * Translation keys used by the gallery chrome. Every string is passed
 * through `t(key, fallback)` — so if the study's JSON is missing the key,
 * the English fallback renders. Grouped by UI region for readability.
 */
export interface GalleryTranslationKeys {
  // Modal chrome
  readonly title: { readonly key: string; readonly fallback: string };
  readonly subtitle: { readonly key: string; readonly fallback: string };
  readonly searchPlaceholder: { readonly key: string; readonly fallback: string };
  readonly categoriesLabel: { readonly key: string; readonly fallback: string };
  readonly categoryAll: { readonly key: string; readonly fallback: string };
  readonly recentGroup: { readonly key: string; readonly fallback: string };
  readonly customGroup: { readonly key: string; readonly fallback: string };
  // Card actions
  readonly cardApply: { readonly key: string; readonly fallback: string };
  readonly saveAction: { readonly key: string; readonly fallback: string };
  readonly customTag: { readonly key: string; readonly fallback: string };
  readonly deleteAriaLabel: { readonly key: string; readonly fallback: string };
  // Empty states
  readonly emptyNoMatchTitle: { readonly key: string; readonly fallback: string };
  readonly emptyNoMatch: { readonly key: string; readonly fallback: string };
  readonly emptyMineTitle: { readonly key: string; readonly fallback: string };
  readonly emptyMine: { readonly key: string; readonly fallback: string };
  readonly emptyRecentTitle: { readonly key: string; readonly fallback: string };
  readonly emptyRecent: { readonly key: string; readonly fallback: string };
  readonly emptyGeneric: { readonly key: string; readonly fallback: string };
  // Severity/scope label lookups (indexed by literal value)
  readonly severityLabel: Readonly<Record<GallerySeverity, { readonly key: string; readonly fallback: string }>>;
  readonly scopeLabel: Readonly<Record<GalleryScope, { readonly key: string; readonly fallback: string }>>;
}

export interface TemplateGalleryGenericProps<T extends GalleryTemplateLike> {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly onApply: (template: T | CustomTemplate) => void;
  readonly onSaveCurrentAsTemplate: () => void;
  readonly customTemplates: ReadonlyArray<CustomTemplate>;
  readonly recentTemplateIds: ReadonlyArray<string>;
  readonly onDeleteCustom: (id: string) => void;
  /** Built-in templates for this study. */
  readonly templates: ReadonlyArray<T>;
  /** Display order for kind categories in the sidebar + "All" view. */
  readonly kindOrder: ReadonlyArray<string>;
  /** Icon for each kind chip / sidebar entry. Unknown kinds fall back to a dashed circle. */
  readonly kindIcons: Readonly<Record<string, IconCmp>>;
  readonly kindLabels: Readonly<Record<string, { readonly key: string; readonly fallback: string }>>;
  /** Icon per severity — all three studies share the same 4 severities today. */
  readonly severityIcons: Readonly<Record<GallerySeverity, IconCmp>>;
  readonly translations: GalleryTranslationKeys;
  /** Used as modal testId prefix so e2e can distinguish the 3 galleries. */
  readonly testIdPrefix?: string;
}

type CategoryId = 'all' | 'recent' | 'custom' | string;

type GalleryRow<T extends GalleryTemplateLike> =
  | { readonly kind: 'builtin'; readonly template: T }
  | { readonly kind: 'custom'; readonly template: CustomTemplate };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TemplateGalleryGenericInner<T extends GalleryTemplateLike>({
  opened,
  onClose,
  onApply,
  onSaveCurrentAsTemplate,
  customTemplates,
  recentTemplateIds,
  onDeleteCustom,
  templates,
  kindOrder,
  kindIcons,
  kindLabels,
  severityIcons,
  translations: tk,
  testIdPrefix = 'template-gallery',
}: TemplateGalleryGenericProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId>('all');

  const resolveById = (id: string): GalleryRow<T> | null => {
    const builtIn = templates.find((x) => x.id === id);
    if (builtIn) return { kind: 'builtin', template: builtIn };
    const custom = customTemplates.find((c) => c.id === id);
    if (custom) return { kind: 'custom', template: custom };
    return null;
  };

  const recentRows = useMemo<ReadonlyArray<GalleryRow<T>>>(() => {
    const out: GalleryRow<T>[] = [];
    for (const id of recentTemplateIds) {
      const row = resolveById(id);
      if (row) out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentTemplateIds, customTemplates, templates]);

  const customRows = useMemo<ReadonlyArray<GalleryRow<T>>>(
    () => customTemplates.map((tpl) => ({ kind: 'custom' as const, template: tpl })),
    [customTemplates],
  );

  const builtInGroups = useMemo(
    () =>
      kindOrder.map((kind) => ({
        kind,
        items: templates
          .filter((tpl) => tpl.kind === kind)
          .map((tpl) => ({ kind: 'builtin' as const, template: tpl })) as ReadonlyArray<GalleryRow<T>>,
      })),
    [kindOrder, templates],
  );

  const matchesSearch = (row: GalleryRow<T>, query: string): boolean => {
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
  };

  const filterRows = (rows: ReadonlyArray<GalleryRow<T>>): ReadonlyArray<GalleryRow<T>> =>
    rows.filter((r) => matchesSearch(r, search));

  const filteredRecent = useMemo(() => filterRows(recentRows), [recentRows, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredCustom = useMemo(() => filterRows(customRows), [customRows, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredBuiltInGroups = useMemo(
    () => builtInGroups.map((g) => ({ kind: g.kind, items: filterRows(g.items) })),
    [builtInGroups, search], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const totalFilteredCount =
    filteredRecent.length +
    filteredCustom.length +
    filteredBuiltInGroups.reduce((sum, g) => sum + g.items.length, 0);

  const counts = useMemo(() => {
    const kindCount: Record<string, number> = {};
    for (const k of kindOrder) kindCount[k] = 0;
    for (const tpl of templates) {
      const current = kindCount[tpl.kind];
      if (current !== undefined) kindCount[tpl.kind] = current + 1;
    }
    return {
      all: templates.length + customTemplates.length,
      recent: recentRows.length,
      custom: customTemplates.length,
      kinds: kindCount,
    };
  }, [kindOrder, templates, customTemplates.length, recentRows.length]);

  interface SidebarItem {
    readonly id: CategoryId;
    readonly icon: IconCmp;
    readonly label: string;
    readonly count: number;
  }

  const kindIconFor = (k: string): IconCmp => kindIcons[k] ?? IconCircleDashed;

  const sidebarItems = useMemo<ReadonlyArray<SidebarItem>>(() => {
    const items: SidebarItem[] = [];
    items.push({
      id: 'all',
      icon: IconLayoutGrid,
      label: t(tk.categoryAll.key, tk.categoryAll.fallback),
      count: counts.all,
    });
    if (counts.recent > 0) {
      items.push({
        id: 'recent',
        icon: IconClock,
        label: t(tk.recentGroup.key, tk.recentGroup.fallback),
        count: counts.recent,
      });
    }
    if (counts.custom > 0) {
      items.push({
        id: 'custom',
        icon: IconBookmark,
        label: t(tk.customGroup.key, tk.customGroup.fallback),
        count: counts.custom,
      });
    }
    for (const kind of kindOrder) {
      if ((counts.kinds[kind] ?? 0) > 0) {
        const lbl = kindLabels[kind];
        items.push({
          id: kind,
          icon: kindIconFor(kind),
          label: lbl ? t(lbl.key, lbl.fallback) : kind,
          count: counts.kinds[kind] ?? 0,
        });
      }
    }
    return items;
  }, [counts, t, tk, kindOrder, kindLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveCategory: CategoryId = useMemo(() => {
    if (sidebarItems.some((item) => item.id === category)) return category;
    return 'all';
  }, [sidebarItems, category]);

  const handleApply = (row: GalleryRow<T>): void => {
    onApply(row.template as T | CustomTemplate);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation();
    onDeleteCustom(id);
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    row: GalleryRow<T>,
  ): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleApply(row);
    }
  };

  const renderCard = (row: GalleryRow<T>): React.ReactElement => {
    if (row.kind === 'builtin') {
      const tpl = row.template;
      const SeverityIcon = severityIcons[tpl.severity];
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
            <span className={classes.cardIcon} data-severity={tpl.severity} aria-hidden>
              <SeverityIcon size={22} stroke={2} />
            </span>
            <span className={classes.severityBadge} data-severity={tpl.severity}>
              {t(tk.severityLabel[tpl.severity].key, tk.severityLabel[tpl.severity].fallback)}
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
              {t(tk.cardApply.key, tk.cardApply.fallback)}
            </EMRButton>
            <span className={classes.scopeChip}>
              {t(tk.scopeLabel[tpl.scope].key, tk.scopeLabel[tpl.scope].fallback)}
            </span>
          </div>
        </button>
      );
    }

    const tpl = row.template;
    const severity: GallerySeverity = 'informational';
    const scopeOk =
      tpl.scope === 'right' || tpl.scope === 'left' || tpl.scope === 'bilateral';
    const scopeLabel = scopeOk
      ? t(tk.scopeLabel[tpl.scope as GalleryScope].key, tk.scopeLabel[tpl.scope as GalleryScope].fallback)
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
            {t(tk.customTag.key, tk.customTag.fallback)}
          </span>
        </div>
        <button
          type="button"
          className={classes.deleteButton}
          onClick={(e) => handleDelete(e, tpl.id)}
          aria-label={t(tk.deleteAriaLabel.key, tk.deleteAriaLabel.fallback)}
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
            {t(tk.cardApply.key, tk.cardApply.fallback)}
          </EMRButton>
          {scopeLabel ? <span className={classes.scopeChip}>{scopeLabel}</span> : null}
        </div>
      </button>
    );
  };

  const renderSection = (
    label: string,
    icon: IconCmp,
    rows: ReadonlyArray<GalleryRow<T>>,
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
              {t(tk.emptyNoMatchTitle.key, tk.emptyNoMatchTitle.fallback)}
            </div>
            <div className={classes.emptyBody}>
              {t(tk.emptyNoMatch.key, tk.emptyNoMatch.fallback).replace('{query}', search)}
            </div>
          </div>
        );
      }
      if (effectiveCategory === 'custom') {
        return (
          <div className={classes.empty}>
            <IconBookmark size={28} stroke={1.5} />
            <div className={classes.emptyTitle}>
              {t(tk.emptyMineTitle.key, tk.emptyMineTitle.fallback)}
            </div>
            <div className={classes.emptyBody}>
              {t(tk.emptyMine.key, tk.emptyMine.fallback)}
            </div>
          </div>
        );
      }
      if (effectiveCategory === 'recent') {
        return (
          <div className={classes.empty}>
            <IconClock size={28} stroke={1.5} />
            <div className={classes.emptyTitle}>
              {t(tk.emptyRecentTitle.key, tk.emptyRecentTitle.fallback)}
            </div>
            <div className={classes.emptyBody}>
              {t(tk.emptyRecent.key, tk.emptyRecent.fallback)}
            </div>
          </div>
        );
      }
      return (
        <div className={classes.empty}>
          <IconStack2 size={28} stroke={1.5} />
          <div className={classes.emptyBody}>
            {t(tk.emptyGeneric.key, tk.emptyGeneric.fallback)}
          </div>
        </div>
      );
    }

    if (effectiveCategory === 'all') {
      const sections: Array<React.ReactElement | null> = [];
      sections.push(
        renderSection(
          t(tk.recentGroup.key, tk.recentGroup.fallback),
          IconClock,
          filteredRecent,
          true,
          'recent',
        ),
      );
      sections.push(
        renderSection(
          t(tk.customGroup.key, tk.customGroup.fallback),
          IconBookmark,
          filteredCustom,
          true,
          'custom',
        ),
      );
      for (const group of filteredBuiltInGroups) {
        const lbl = kindLabels[group.kind];
        sections.push(
          renderSection(
            lbl ? t(lbl.key, lbl.fallback) : group.kind,
            kindIconFor(group.kind),
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
      return renderSection('', kindIconFor(group.kind), group.items, false, `kind-only-${group.kind}`)!;
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
          {t(tk.saveAction.key, tk.saveAction.fallback)}
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
      title={t(tk.title.key, tk.title.fallback)}
      subtitle={t(tk.subtitle.key, tk.subtitle.fallback)}
      footer={footer}
      showFooter
      testId={`${testIdPrefix}-modal`}
    >
      <Box className={classes.root}>
        <div className={classes.searchRow}>
          <div className={classes.searchInput}>
            <EMRTextInput
              value={search}
              onChange={(value) => setSearch(value)}
              placeholder={t(tk.searchPlaceholder.key, tk.searchPlaceholder.fallback)}
              leftSection={<IconSearch size={16} stroke={1.75} />}
              clearable
              onClear={() => setSearch('')}
              aria-label={t(tk.searchPlaceholder.key, tk.searchPlaceholder.fallback)}
              data-testid="template-gallery-search"
            />
          </div>
        </div>

        <div className={classes.body}>
          <nav
            className={classes.sidebar}
            aria-label={t(tk.categoriesLabel.key, tk.categoriesLabel.fallback)}
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
}

// memo() loses the generic signature — cast back on export.
export const TemplateGalleryGeneric = memo(TemplateGalleryGenericInner) as unknown as <
  T extends GalleryTemplateLike,
>(
  props: TemplateGalleryGenericProps<T>,
) => React.ReactElement;

export default TemplateGalleryGeneric;
