// SPDX-License-Identifier: Apache-2.0
/**
 * NarrativeSection — block order guard. The pelvic study prints auto findings →
 * clinician conclusion → the one comments box LAST, and drops the auto
 * conclusion bullets when the clinician wrote a conclusion. Other studies keep
 * the default order. Flattens the element tree (calling our own function
 * components; @react-pdf primitives are strings) instead of booting @react-pdf.
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { NarrativeSection, type NarrativeSectionLabels } from './NarrativeSection';

function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === 'function') {
    return flattenText((el.type as (p: unknown) => ReactNode)(el.props));
  }
  if (el.props && 'children' in el.props) return flattenText(el.props.children);
  return '';
}

const LABELS: NarrativeSectionLabels = {
  rightFindings: 'RIGHT-FINDINGS',
  leftFindings: 'LEFT-FINDINGS',
  indication: 'INDICATION',
  technique: 'TECHNIQUE',
  findings: 'FINDINGS',
  impression: 'IMPRESSION',
  comments: 'GENERIC-COMMENTS',
  conclusions: 'AUTO-CONCLUSIONS',
  clinicianComments: 'COMMENT-BOX',
};

function render(impression: string, conclusionThenComments: boolean): string {
  return flattenText(
    NarrativeSection({
      narrative: { impression, clinicianComments: 'doctor comment' },
      labels: LABELS,
      rightFindings: 'auto right',
      leftFindings: 'auto left',
      conclusions: ['auto bullet'],
      conclusionThenComments,
    }),
  );
}

describe('NarrativeSection order', () => {
  it('pelvic: findings → conclusion → comments last; no auto bullets beside a written conclusion', () => {
    const out = render('doctor conclusion', true);
    expect(out.indexOf('RIGHT-FINDINGS')).toBeLessThan(out.indexOf('IMPRESSION'));
    expect(out.indexOf('IMPRESSION')).toBeLessThan(out.indexOf('COMMENT-BOX'));
    expect(out).not.toContain('AUTO-CONCLUSIONS');
    expect(out).not.toContain('auto bullet');
  });

  it('pelvic: auto bullets print (before the comments) when no conclusion was written', () => {
    const out = render('', true);
    expect(out).toContain('auto bullet');
    expect(out.indexOf('AUTO-CONCLUSIONS')).toBeLessThan(out.indexOf('COMMENT-BOX'));
  });

  it('other studies keep the default order', () => {
    const out = render('doctor conclusion', false);
    expect(out.indexOf('IMPRESSION')).toBeLessThan(out.indexOf('COMMENT-BOX'));
    expect(out.indexOf('COMMENT-BOX')).toBeLessThan(out.indexOf('AUTO-CONCLUSIONS'));
  });
});
