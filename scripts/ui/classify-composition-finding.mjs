#!/usr/bin/env node
/**
 * classify-composition-finding.mjs — routing brain for /ui-excellence.
 *
 * Takes one composition finding (from design-critic or composition-metrics.mjs)
 * and decides WHO fixes it: a token swap, a restyle, a layout redesign, or a
 * human. Deterministic, first-match-wins — the same shape as judgment-day's
 * scripts/classify-finding.mjs, so the two pipelines route findings the same way.
 *
 * The load-bearing distinction: RESTYLE changes how something looks, REDESIGN
 * changes where it is or whether it exists. Handing a redesign to a restyle pass
 * produces a prettier version of the same broken screen.
 *
 * Usage:
 *   node classify-composition-finding.mjs --finding '<JSON>'
 *   node classify-composition-finding.mjs --self-test
 *   node classify-composition-finding.mjs --help
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    finding: { type: 'string' },
    'self-test': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

const CLASSES = {
  MECHANICAL_FIXABLE: 'MECHANICAL-FIXABLE',
  RESTYLE: 'RESTYLE',
  REDESIGN: 'REDESIGN',
  DESIGN_DECISION: 'DESIGN-DECISION',
};

if (values.help) {
  console.log(JSON.stringify({
    usage: "node classify-composition-finding.mjs --finding '<JSON>'",
    inputSchema: {
      dimension: 'hierarchy | colorDiscipline | redundancy | densityFit | restraint | oscillation (required)',
      rule: 'elevation-contrast | status-color-collision | duplicate-primary-data | empty-state-parity | density-tier-overflow | null',
      severity: 'P0 | P1 | P2 | P3 (required)',
      mechanical: 'boolean — came from composition-metrics.mjs rather than vision judgment',
      recommendation: 'string — the fix text; scanned for content-removal intent',
      score: 'number 0-3 — the dimension score that produced this finding (optional)',
    },
    outputSchema: {
      class: Object.values(CLASSES).join(' | '),
      confidence: '0.0 - 1.0',
      reasoning: 'one-line explanation',
      fixMode: "restyle | redesign | none — the MODE to spawn frontend-designer with",
    },
  }, null, 2));
  process.exit(0);
}

/**
 * Phrases in a recommendation that mean the fix must move, merge, or delete
 * content. Restyling cannot satisfy any of these — the screen's structure is
 * what's wrong, so they escalate past RESTYLE.
 */
const STRUCTURAL_INTENT = [
  'remove', 'delete', 'cut ', 'drop ', 'move ', 'relocate', 'merge',
  'collapse into', 'consolidat', 'combine', 'split', 'reorder', 'restructure',
  'demote', 'promote', 'behind a tab', 'progressive disclosure',
];

/**
 * Phrases that mean a human has to make a product call — what data a clinical
 * screen shows is not a decision an auto-fixer gets to make unilaterally.
 */
const PRODUCT_CALL_INTENT = [
  'decide whether', 'product decision', 'clinically', 'ask the', 'confirm with',
  'may be intentional', 'unclear whether', 'depends on the workflow',
];

function classify(finding) {
  const dimension = finding.dimension || '';
  const rule = finding.rule || null;
  const severity = finding.severity || 'P2';
  const mechanical = finding.mechanical === true;
  const rec = String(finding.recommendation || '').toLowerCase();
  const score = typeof finding.score === 'number' ? finding.score : null;

  const hasStructuralIntent = STRUCTURAL_INTENT.some((p) => rec.includes(p));
  const hasProductIntent = PRODUCT_CALL_INTENT.some((p) => rec.includes(p));

  // Row 1 — an unsettled score is never "fixed" by another pass at it.
  if (dimension === 'oscillation') {
    return {
      class: CLASSES.DESIGN_DECISION,
      confidence: 1.0,
      reasoning: 'Score oscillated across iterations — two rules conflict on this screen; a human picks',
      fixMode: 'none',
    };
  }

  // Row 2 — the recommendation itself defers to a human.
  if (hasProductIntent) {
    return {
      class: CLASSES.DESIGN_DECISION,
      confidence: 0.9,
      reasoning: 'Recommendation defers a product/clinical call — what a clinical screen shows is not an auto-fix',
      fixMode: 'none',
    };
  }

  // Row 3 — P0 means the screen is unusable; that is structural, not cosmetic.
  if (severity === 'P0') {
    return {
      class: CLASSES.REDESIGN,
      confidence: 0.9,
      reasoning: 'P0 composition failure — the screen is unusable as structured, restyling cannot recover it',
      fixMode: 'redesign',
    };
  }

  // Row 4 — pure token/CSS work with a measured threshold. Safest class.
  if (rule === 'elevation-contrast' || rule === 'empty-state-parity') {
    return {
      class: CLASSES.MECHANICAL_FIXABLE,
      confidence: 1.0,
      reasoning: `${rule} is satisfied by token/CSS values alone (surface + shadow, or empty-state padding)`,
      fixMode: 'restyle',
    };
  }

  // Row 5 — color collision: re-assigning a color is a restyle UNLESS the
  // recommendation says the element has to move or go.
  if (rule === 'status-color-collision') {
    return hasStructuralIntent
      ? {
          class: CLASSES.REDESIGN,
          confidence: 0.8,
          reasoning: 'Severity-color collision whose fix relocates or removes an element, not just recolors it',
          fixMode: 'redesign',
        }
      : {
          class: CLASSES.RESTYLE,
          confidence: 0.9,
          reasoning: 'Severity-color collision resolved by re-assigning colors to their reserved meanings',
          fixMode: 'restyle',
        };
  }

  // Row 6 — duplicated data is structural by definition: something must be
  // demoted or removed, and WHICH copy survives is often a product call.
  if (rule === 'duplicate-primary-data' || dimension === 'redundancy') {
    return hasStructuralIntent
      ? {
          class: CLASSES.REDESIGN,
          confidence: 0.85,
          reasoning: 'Duplicated data — the fix demotes or removes one copy, which changes layout',
          fixMode: 'redesign',
        }
      : {
          class: CLASSES.DESIGN_DECISION,
          confidence: 0.7,
          reasoning: 'Duplicated data with no stated resolution — which copy survives is a product call',
          fixMode: 'none',
        };
  }

  // Row 7 — too much above the fold. Cannot be restyled away; content moves.
  if (rule === 'density-tier-overflow') {
    return {
      class: CLASSES.REDESIGN,
      confidence: 0.85,
      reasoning: 'Above-fold budget exceeded — content must move or collapse; styling cannot reduce count',
      fixMode: 'redesign',
    };
  }

  // Row 8 — hierarchy: a 0 or 1 score means nothing wins visually. Weight
  // changes alone fix a 1; a 0 means the structure never had an order.
  if (dimension === 'hierarchy') {
    if (score === 0 || hasStructuralIntent) {
      return {
        class: CLASSES.REDESIGN,
        confidence: 0.8,
        reasoning: 'No hierarchy exists to strengthen — the screen needs a structural focal point',
        fixMode: 'redesign',
      };
    }
    return {
      class: CLASSES.RESTYLE,
      confidence: 0.8,
      reasoning: 'Hierarchy is present but too weak — adjust visual weight, elevation, and scale',
      fixMode: 'restyle',
    };
  }

  // Row 9 — density/restraint: structural intent decides.
  if (dimension === 'densityFit' || dimension === 'restraint') {
    return hasStructuralIntent
      ? {
          class: CLASSES.REDESIGN,
          confidence: 0.75,
          reasoning: `${dimension} fix moves or removes content`,
          fixMode: 'redesign',
        }
      : {
          class: CLASSES.RESTYLE,
          confidence: 0.75,
          reasoning: `${dimension} fix adjusts emphasis and spacing within the existing layout`,
          fixMode: 'restyle',
        };
  }

  // Row 10 — fall-through. Deliberately conservative: an unclassified finding
  // goes to a human rather than getting auto-applied on a clinical screen.
  return {
    class: CLASSES.DESIGN_DECISION,
    confidence: 0.5,
    reasoning: 'No rubric row matched — escalated rather than guessed (fail-closed)',
    fixMode: 'none',
  };
}

if (values['self-test']) {
  const cases = [
    [{ dimension: 'hierarchy', rule: 'elevation-contrast', severity: 'P1', mechanical: true, recommendation: 'Give decks --emr-shadow-card' }, CLASSES.MECHANICAL_FIXABLE],
    [{ dimension: 'colorDiscipline', rule: 'status-color-collision', severity: 'P1', mechanical: true, recommendation: 'Move Start Code Blue to the brand gradient' }, CLASSES.REDESIGN],
    [{ dimension: 'colorDiscipline', rule: 'status-color-collision', severity: 'P2', mechanical: true, recommendation: 'Recolor the count chip to neutral navy' }, CLASSES.RESTYLE],
    [{ dimension: 'redundancy', rule: 'duplicate-primary-data', severity: 'P1', mechanical: true, recommendation: 'Demote the sidebar copy to a condensed chip' }, CLASSES.REDESIGN],
    [{ dimension: 'redundancy', rule: 'duplicate-primary-data', severity: 'P2', mechanical: true, recommendation: 'NEWS2 appears twice' }, CLASSES.DESIGN_DECISION],
    [{ dimension: 'densityFit', rule: 'empty-state-parity', severity: 'P2', mechanical: true, recommendation: 'Compact the empty-state padding' }, CLASSES.MECHANICAL_FIXABLE],
    [{ dimension: 'densityFit', rule: 'density-tier-overflow', severity: 'P1', mechanical: true, recommendation: 'Too many actions above the fold' }, CLASSES.REDESIGN],
    [{ dimension: 'hierarchy', severity: 'P1', score: 0, recommendation: 'Nothing wins visually' }, CLASSES.REDESIGN],
    [{ dimension: 'hierarchy', severity: 'P2', score: 1, recommendation: 'Increase the header weight' }, CLASSES.RESTYLE],
    [{ dimension: 'oscillation', severity: 'P2', recommendation: 'redundancy flipped 1->3->1' }, CLASSES.DESIGN_DECISION],
    [{ dimension: 'restraint', severity: 'P0', recommendation: 'Unreadable' }, CLASSES.REDESIGN],
    [{ dimension: 'restraint', severity: 'P3', recommendation: 'Decide whether the ribbon is meaningful' }, CLASSES.DESIGN_DECISION],
    [{ dimension: 'somethingNew', severity: 'P2', recommendation: 'n/a' }, CLASSES.DESIGN_DECISION],
  ];

  let failed = 0;
  for (const [input, expected] of cases) {
    const got = classify(input).class;
    if (got !== expected) {
      failed += 1;
      console.error(`FAIL: ${JSON.stringify(input)}\n  expected ${expected}, got ${got}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${cases.length} self-test cases failed.`);
    process.exit(1);
  }
  console.log(`self-test OK — ${cases.length}/${cases.length} routing cases correct.`);
  process.exit(0);
}

if (!values.finding) {
  console.error(JSON.stringify({ error: 'Missing --finding flag (JSON string). Run with --help for schema.' }));
  process.exit(1);
}

let finding;
try {
  finding = JSON.parse(values.finding);
} catch {
  console.error(JSON.stringify({ error: 'Invalid JSON in --finding' }));
  process.exit(1);
}

console.log(JSON.stringify(classify(finding), null, 2));
