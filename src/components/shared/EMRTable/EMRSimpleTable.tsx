// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Table, type TableProps } from '@mantine/core';
import { forwardRef } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import styles from './EMRSimpleTable.module.css';

/**
 * EMRSimpleTable — the Command-styled, COMPOUND-API table.
 *
 * This is the mechanical drop-in replacement for a raw Mantine `<Table>` that
 * uses the JSX compound API (`Table.Thead/Tbody/Tr/Th/Td/Tfoot/Caption/
 * ScrollContainer`). Unlike `EMRTable` (a columns/data props component), this
 * wrapper changes NOTHING about how you author the table — you keep your own
 * `<Tr>/<Td>` JSX. A conversion is a pure find-replace:
 *
 *   import { Table } from '@mantine/core';   →  import { EMRSimpleTable } from '.../shared/EMRSimpleTable';
 *   <Table …>                                →  <EMRSimpleTable …>
 *   <Table.Thead>                            →  <EMRSimpleTable.Thead>
 *   …Tbody / Tr / Th / Td / Tfoot / Caption / ScrollContainer likewise.
 *
 * Command identity applied centrally (DESIGN-DIRECTION.md → Tables):
 *  - header row bg color-mix(primary 5%), header text --emr-primary, 10px
 *    uppercase 700 letter-spaced labels;
 *  - row hover --emr-bg-hover (only when `highlightOnHover`);
 *  - hairline cell bottom borders; borderless deck (no outer frame).
 *
 * All Mantine `Table` props forward through unchanged (`striped`,
 * `highlightOnHover`, `stickyHeader`, `verticalSpacing`, `horizontalSpacing`,
 * `withTableBorder`, `withColumnBorders`, `layout`, `style`, `className`, …).
 *
 * SELECTED / CRITICAL row helpers — add the data attribute (or class) to a
 * `<EMRSimpleTable.Tr>` to get the Command rail + tint:
 *   <EMRSimpleTable.Tr data-selected={isSelected}>…</EMRSimpleTable.Tr>
 *   <EMRSimpleTable.Tr data-critical={isCritical}>…</EMRSimpleTable.Tr>
 * or the exported class names `simpleTableClasses.selectedRow` /
 * `simpleTableClasses.criticalRow` when you compose `className` manually.
 */
export type EMRSimpleTableProps = TableProps;

type EMRSimpleTableComponent = ForwardRefExoticComponent<
  EMRSimpleTableProps & RefAttributes<HTMLTableElement>
> & {
  Thead: typeof Table.Thead;
  Tbody: typeof Table.Tbody;
  Tfoot: typeof Table.Tfoot;
  Tr: typeof Table.Tr;
  Th: typeof Table.Th;
  Td: typeof Table.Td;
  Caption: typeof Table.Caption;
  ScrollContainer: typeof Table.ScrollContainer;
};

const EMRSimpleTableRoot = forwardRef<HTMLTableElement, EMRSimpleTableProps>(
  function EMRSimpleTableRoot({ className, withTableBorder, withColumnBorders, ...rest }, ref) {
    return (
      <Table
        ref={ref}
        // Command tables are borderless "decks": ignore any incoming
        // withTableBorder / withColumnBorders so converted tables match the
        // identity. (Both default to undefined when omitted from converted code.)
        withTableBorder={false}
        withColumnBorders={false}
        className={className ? `${styles.root} ${className}` : styles.root}
        {...rest}
      />
    );
  }
) as EMRSimpleTableComponent;

// Re-export the compound parts verbatim — they carry Mantine's correct
// <thead>/<tbody>/<tr>/<th>/<td> semantics; the Command styling is applied by
// the .root CSS module via descendant selectors, so the parts stay pass-through.
EMRSimpleTableRoot.Thead = Table.Thead;
EMRSimpleTableRoot.Tbody = Table.Tbody;
EMRSimpleTableRoot.Tfoot = Table.Tfoot;
EMRSimpleTableRoot.Tr = Table.Tr;
EMRSimpleTableRoot.Th = Table.Th;
EMRSimpleTableRoot.Td = Table.Td;
EMRSimpleTableRoot.Caption = Table.Caption;
EMRSimpleTableRoot.ScrollContainer = Table.ScrollContainer;

export const EMRSimpleTable = EMRSimpleTableRoot;

/** Exported class-name helpers for selected / critical rows when composing
 *  `className` manually instead of using the `data-selected` / `data-critical`
 *  attributes. */
export const simpleTableClasses = {
  selectedRow: styles.selected,
  criticalRow: styles.critical,
} as const;
