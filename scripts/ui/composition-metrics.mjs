#!/usr/bin/env node
/**
 * composition-metrics.mjs — the deterministic half of the UI composition audit.
 *
 * Measures what is objectively countable about a rendered page's composition, so the
 * vision-judging `design-critic` agent never re-derives arithmetic. Same page in, same
 * numbers out. The five rules come from
 * src/styles/DESIGN-DIRECTION.md "Composition, hierarchy & severity".
 *
 * Angio port (2026-11-12, from MediMind): base URL defaults to :3001, no login step (a redirect
 * away from --route is a hard failure), contexts are closed with angio's `close-context`, and the
 * locale proof falls back to the rendered script when <html lang> is unset (angio only sets it on
 * a language switch, not on load).
 *
 * Drives the shared Playwright harness (scripts/playwright/*) — it never boots its own
 * browser and never adds a dependency.
 *
 * Usage:
 *   node scripts/ui/composition-metrics.mjs --route "/" [--slug name]
 *       [--viewport 1440x900] [--scheme light|dark] [--tier triage|deep-dive] [--out PATH]
 *       [--scope-selector CSS] [--setup-click CSS ...] [--persistent-progress]
 *       [--context NAME --reuse-context] [--allow-flat-scope]
 *       [--scope-selector CSS --read-only-row-selector CSS --read-only-min-rows N]
 *   node scripts/ui/composition-metrics.mjs --self-test
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ------------------------------------------------------------------ thresholds
/** Elevation contrast — below this WCAG ratio a deck and its surface read as one plane. */
const ELEVATION_MIN_CONTRAST = 1.05;
/** Status-color reservation — one severity color carrying this many distinct meanings is the collision. */
const SEVERITY_MAX_DISTINCT_CONTEXTS = 3;
/** A severity tint fainter than this alpha is a decorative wash, not a meaning-carrying mark. */
const SEVERITY_MIN_ALPHA = 0.08;
/** No duplicate primary data — this many full-weight occurrences of one label fails. */
const DUPLICATE_MIN_FULL_WEIGHT = 2;
/**
 * Under this px a repeated label is a caption — subordinate by design, never "full weight".
 * 11px is deliberate: --emr-font-xs is 11px and DESIGN-DIRECTION's section-header and table
 * label recipes are 10–11px uppercase, so a primary card title in this system IS 11px.
 */
const FULL_WEIGHT_MIN_FONT_PX = 11;
/** Two occurrences count as comparable within this font-size ratio band. */
const COMPARABLE_FONT_RATIO = [0.85, 1.18];
/** …this box-area ratio band. */
const COMPARABLE_AREA_RATIO = [0.5, 2.0];
/** …and this font-weight delta. */
const COMPARABLE_WEIGHT_DELTA = 100;
/** Density tiers — a triage/scan screen may expose at most this many actions above the fold. */
const TRIAGE_ABOVE_FOLD_ACTION_CAP = 12;
/**
 * A list is one control (founder decision U-954, 2026-11-05): this many same-template, same-width
 * siblings count as ONE action, however many rows or bed cells are showing, so showing more
 * patients cannot fail the density cap. Uniform width is what separates a list from a toolbar:
 * toolbar buttons share a template but size to their labels. Plain blocks must also offer the
 * same actions to be twins. Known limit: a grid of 4+ equal-width buttons with different commands still reads as a list.
 */
const REPEATED_LIST_MIN_ITEMS = 4;
const REPEATED_LIST_WIDTH_TOLERANCE_PX = 2;
const REPEATED_LIST_MAX_DEPTH = 6;
/** Empty states collapse — an empty deck taller than this fraction of a populated sibling fails. */
const EMPTY_STATE_MAX_HEIGHT_RATIO = 0.75;
/**
 * Without an `empty`-marker class, only a deck this short can BE an empty state. A populated
 * summary deck routinely says "None" for one of its own fields; the length gate is what keeps
 * "Allergies: No known allergies / Isolation: None" from reading as an empty deck.
 */
const EMPTY_DECK_MAX_TEXT_CHARS = 45;
/**
 * A box-shadow only counts as elevation above these floors. --emr-shadow-card clears them in
 * both modes (14px blur @ 0.07 light, 16px @ 0.2 dark); the `0 1px 2px rgba(0,0,0,.05)`
 * hairline that decorates a flat white-on-white deck does not, and must not launder the rule.
 */
const SHADOW_MIN_BLUR_PX = 4;
const SHADOW_MIN_ALPHA = 0.06;
/** Cap on elements the in-page probe styles, so a 20k-node page cannot hang the run. */
const PROBE_MAX_ELEMENTS = 6000;
/** Smallest box (px²) that can be a deck — anything smaller is a chip, a button or a row. */
const MIN_CARD_AREA = 12000;
/**
 * Readiness floor, measured on the MAIN LANDMARK only. The app shell mounts hundreds of nodes
 * before the route's content exists, so a body-wide node count reads as "ready" while the screen
 * is still blank — and a blank screen scores zero hard fails, the worst possible false green.
 */
const CONTENT_SETTLE_MIN_CHARS = 120;
/** Re-probes allowed while waiting for two consecutive runs to agree on the page's shape. */
const PROBE_CONVERGE_POLLS = 12;
/** Polls spent waiting for the SPA to settle on a final pathname (route vs. an auth redirect). */
const LOGIN_GATE_POLLS = 10;
const LANG_PROBE =
  '(() => { const l = document.documentElement.lang; if (l) return l; ' +
  'const t = (document.querySelector("main") || document.body).innerText || ""; ' +
  'const n = (re) => (t.match(re) || []).length; ' +
  'const ka = n(/[\\u10A0-\\u10FF]/g), ru = n(/[\\u0400-\\u04FF]/g), en = n(/[A-Za-z]/g); ' +
  'if (ka > ru && ka > en) return "ka"; if (ru > ka && ru > en) return "ru"; return en > 0 ? "en" : ""; })()';
const SETTLE_INTERVAL_MS = 1500;
const CONTENT_PROBE =
  '(() => { const r = document.querySelector(\'main, [role="main"]\') || document.body; ' +
  "return { path: location.pathname, chars: (r.innerText || '').trim().length }; })()";

/** Empty-state phrasing across the three shipped locales (en / ka / ru). */
const EMPTY_TEXT_PATTERN = [
  '^(no|nothing|none|not available|no data|no results|no records)\\b',
  '\\bno\\b[^.]{0,30}\\byet\\b',
  'არ არის',
  'არცერთი',
  'ჯერ არ',
  '^нет\\b',
  'не найдено',
  'отсутств',
  'пока нет',
].join('|');

const RULE_SEVERITY = {
  'elevation-contrast': 'P1',
  'status-color-collision': 'P1',
  'duplicate-primary-data': 'P2',
  'empty-state-parity': 'P2',
  'density-tier-overflow': 'P2',
};

function fail(msg) {
  console.error(`composition-metrics: ${msg}`);
  process.exit(1);
}

// ------------------------------------------------------------- hardFail derivation
/**
 * The frozen rule → verdict mapping. Pure: metrics in, hardFails out. Every threshold
 * lives here, so the self-test fixtures are the regression contract for all five rules.
 */
export function deriveHardFails(metrics, tier) {
  const fails = [];
  const push = (rule, evidence, measured, threshold) =>
    fails.push({ rule, severity: RULE_SEVERITY[rule], evidence, measured, threshold });

  const elev = metrics.elevationContrast;
  if (
    elev &&
    elev.cardsTotal > 0 &&
    elev.contrastRatio < ELEVATION_MIN_CONTRAST &&
    elev.cardsWithShadow === 0
  ) {
    push(
      'elevation-contrast',
      `card background ${elev.cardBg} vs page background ${elev.pageBg} = ${elev.contrastRatio} contrast, ` +
        `and 0 of ${elev.cardsTotal} decks carry a box-shadow — the decks are not separable from the surface`,
      elev.contrastRatio,
      ELEVATION_MIN_CONTRAST
    );
  }

  for (const bucket of metrics.severityColorUsage ?? []) {
    if (bucket.distinctContexts.length >= SEVERITY_MAX_DISTINCT_CONTEXTS) {
      push(
        'status-color-collision',
        `${bucket.color} carries ${bucket.distinctContexts.length} unrelated meanings ` +
          `(${bucket.distinctContexts.join(', ')}) across ${bucket.occurrences} marks — one color, one meaning`,
        bucket.distinctContexts.length,
        SEVERITY_MAX_DISTINCT_CONTEXTS
      );
    }
  }

  for (const dup of metrics.duplicateLabels ?? []) {
    if (dup.bothFullWeight && dup.occurrences >= DUPLICATE_MIN_FULL_WEIGHT) {
      push(
        'duplicate-primary-data',
        `"${dup.label}" renders ${dup.occurrences}× at comparable weight and size ` +
          `(${dup.selectors.slice(0, 2).join(' | ')}) — a second reference must be visibly subordinate`,
        dup.occurrences,
        DUPLICATE_MIN_FULL_WEIGHT
      );
    }
  }

  for (const empty of metrics.emptyStates ?? []) {
    if (empty.ratio > EMPTY_STATE_MAX_HEIGHT_RATIO) {
      push(
        'empty-state-parity',
        `empty deck ${empty.selector} is ${empty.heightPx}px tall vs ${empty.populatedSiblingMedianHeightPx}px ` +
          `for its populated siblings (${empty.ratio}) — a quiet shift must look quieter`,
        empty.ratio,
        EMPTY_STATE_MAX_HEIGHT_RATIO
      );
    }
  }

  // Deep-dive screens are allowed to be dense; only the triage/scan tier is capped.
  const actions = metrics.aboveFoldActions;
  if (tier === 'triage' && actions && actions.count > TRIAGE_ABOVE_FOLD_ACTION_CAP) {
    push(
      'density-tier-overflow',
      `${actions.count} actions above the fold (${actions.tabs} tabs + ${actions.buttons} buttons, repeated lists counted once) ` +
        `on a triage/scan screen — bounded primary data points, not completeness`,
      actions.count,
      TRIAGE_ABOVE_FOLD_ACTION_CAP
    );
  }

  return fails;
}

/**
 * Emptiness is a MEASUREMENT FAILURE, never a verdict. `hardFails: []` from a scope that
 * resolved to the wrong subtree is byte-identical to a genuinely clean page, so the run must
 * die rather than certify. Note the deliberate limit: this catches TOTAL collapse only — a
 * partial collapse (4 of 8 decks) still passes here, which is why the run-over-run delta on
 * the `metrics` block, not `hardFails` alone, is the real defense.
 */
export function isMeasurementSane(probe) {
  return (
    probe.metrics.elevationContrast.cardsTotal >= 1 &&
    probe.metrics.aboveFoldActions.count >= 1 &&
    probe.contentChars >= CONTENT_SETTLE_MIN_CHARS
  );
}

export function isReadOnlyMeasurementSane(probe, { minRows, path, lang }) {
  return (
    !probe.scopeFallback &&
    !probe.requestedScopeMissing &&
    !probe.truncated &&
    probe.readOnlyReady?.path === path &&
    probe.readOnlyReady.lang === lang &&
    probe.readOnlyReady.scopeReady &&
    probe.readOnlyReady.renderedRows >= minRows &&
    probe.busyIndicators === 0 &&
    probe.metrics.elevationContrast.cardsTotal >= 1 &&
    probe.metrics.aboveFoldActions.count === 0 &&
    probe.contentChars >= CONTENT_SETTLE_MIN_CHARS
  );
}

/** Both the CLI and direct browser callers must obtain two matching, settled samples. */
export function isCompositionStable(previous, probe, readOnlyExpectation) {
  return Boolean(previous &&
    previous.contentNodes === probe.contentNodes &&
    previous.contentChars === probe.contentChars &&
    previous.metrics.elevationContrast.cardsTotal === probe.metrics.elevationContrast.cardsTotal &&
    previous.metrics.aboveFoldActions.count === probe.metrics.aboveFoldActions.count &&
    previous.readOnlyReady?.renderedRows === probe.readOnlyReady?.renderedRows &&
    probe.contentChars >= CONTENT_SETTLE_MIN_CHARS &&
    probe.busyIndicators === 0 &&
    (!readOnlyExpectation || (
      isReadOnlyMeasurementSane(previous, readOnlyExpectation) &&
      isReadOnlyMeasurementSane(probe, readOnlyExpectation)
    ))
  );
}

/** Build the canonical report after the caller verifies route, locale, and measurement readiness. */
export function buildCompositionReport(probe, {
  route, slug, tier, lang, measurementSane, readOnlyRowSelector, readOnlyMinRows,
}) {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    route,
    slug,
    viewport: probe.viewport,
    // Scheme is load-bearing, not decoration: elevation-contrast routinely fails in one scheme
    // and passes in the other. A light-mode failure "fixed" by darkening cards globally breaks
    // dark mode, which may already pass. Never read a hardFail without reading this field.
    colorScheme: probe.colorScheme,
    // Same reasoning as colorScheme: the locale changes label lengths and therefore wrapping,
    // above-fold action counts and duplicate-label text. Recorded so a reader can tell whether
    // these metrics describe the same rendering as the screenshots they are paired with.
    locale: lang,
    densityTier: tier,
    scopeSelector: probe.scopeSelector,
    scopeFallback: probe.scopeFallback,
    measurementSane,
    ...(readOnlyRowSelector ? {
      readOnlyReady: {
        rowSelector: readOnlyRowSelector,
        minRows: readOnlyMinRows,
        renderedRows: probe.readOnlyReady.renderedRows,
      },
    } : {}),
    metrics: probe.metrics,
    hardFails: deriveHardFails(probe.metrics, tier),
  };
}

/** Serialize the same browser probe and thresholds used by the CLI. */
export function createCompositionProbeScript({ scopeSelector, readOnlyRowSelector, persistentProgress = false } = {}) {
  const cfg = {
    scopeSelector: scopeSelector || null,
    readOnlyRowSelector: readOnlyRowSelector || null,
    persistentProgress,
    maxElements: PROBE_MAX_ELEMENTS,
    minCardArea: MIN_CARD_AREA,
    severityMinAlpha: SEVERITY_MIN_ALPHA,
    shadowMinBlurPx: SHADOW_MIN_BLUR_PX,
    shadowMinAlpha: SHADOW_MIN_ALPHA,
    fullWeightMinFontPx: FULL_WEIGHT_MIN_FONT_PX,
    comparableFontRatio: COMPARABLE_FONT_RATIO,
    comparableAreaRatio: COMPARABLE_AREA_RATIO,
    comparableWeightDelta: COMPARABLE_WEIGHT_DELTA,
    emptyTextPattern: EMPTY_TEXT_PATTERN,
    emptyDeckMaxTextChars: EMPTY_DECK_MAX_TEXT_CHARS,
    repeatedListMinItems: REPEATED_LIST_MIN_ITEMS,
    repeatedListWidthTolerancePx: REPEATED_LIST_WIDTH_TOLERANCE_PX,
    repeatedListMaxDepth: REPEATED_LIST_MAX_DEPTH,
    severityTokens: ['--emr-error', '--emr-success', '--emr-info'],
    brandTokens: ['--emr-primary', '--emr-secondary', '--emr-accent', '--emr-light-accent'],
    labelStopwords: ['n/a', 'na', 'none', 'null', '-', '—', '–', 'ok', 'yes', 'no', 'all', 'და', 'არა', 'нет', 'да'],
  };
  return `(${String(compositionProbe)})(${JSON.stringify(cfg)})`;
}

// ------------------------------------------------------------------- the page probe
/**
 * Runs inside the page. Serialized with String() and handed to page.evaluate, so it may
 * reference NOTHING from this module's scope — every constant arrives via `cfg`.
 */
function compositionProbe(cfg) {
  const parseColor = (raw) => {
    if (!raw) return null;
    const t = String(raw).trim().toLowerCase();
    if (t === 'transparent' || t === 'none') return { r: 0, g: 0, b: 0, a: 0 };
    const hex = /^#([0-9a-f]{3,8})$/.exec(t);
    if (hex) {
      const h = hex[1];
      const pair = (i) => parseInt(h.slice(i, i + 2), 16);
      if (h.length === 3) {
        return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
      }
      if (h.length === 6) return { r: pair(0), g: pair(2), b: pair(4), a: 1 };
      if (h.length === 8) return { r: pair(0), g: pair(2), b: pair(4), a: pair(6) / 255 };
      return null;
    }
    const fn = /^rgba?\(([^)]+)\)$/.exec(t);
    if (!fn) return null;
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const rgbKey = (c) => `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`;
  const rgbStr = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  const luminance = (c) => {
    const chan = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  };
  const contrastRatio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  const median = (xs) => {
    if (xs.length === 0) return 0;
    const s = xs.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const modeOf = (xs) => {
    const counts = new Map();
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
    let best = null;
    let bestN = -1;
    for (const [k, n] of counts) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best;
  };
  const selectorFor = (elm) => {
    const parts = [];
    let node = elm;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      let step = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${step}#${node.id}`);
        break;
      }
      const testid = node.getAttribute('data-testid');
      if (testid) {
        parts.unshift(`${step}[data-testid="${testid}"]`);
        break;
      }
      const cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      if (cls) step += `.${cls}`;
      parts.unshift(step);
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  };
  /** Ancestor lookup bounded to `maxUp` levels — an unbounded closest() makes every mark inside a clickable row read as "button". */
  const nearest = (elm, sel, maxUp) => {
    let node = elm;
    for (let i = 0; node && i <= maxUp; i += 1) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentElement;
    }
    return null;
  };

  /** A shadow only separates a deck when it is actually perceptible — see SHADOW_MIN_* above. */
  const shadowElevates = (raw) => {
    if (!raw || raw === 'none' || raw.includes('inset')) return false;
    const lengths = [...raw.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => Math.abs(Number(m[1])));
    const maxBlur = lengths.length > 0 ? Math.max(...lengths) : 0;
    const alphas = [...raw.matchAll(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*[,/]\s*([\d.]+)\s*\)/g)].map((m) =>
      Number(m[1])
    );
    const maxAlpha = alphas.length > 0 ? Math.max(...alphas) : 1;
    return maxBlur >= cfg.shadowMinBlurPx && maxAlpha >= cfg.shadowMinAlpha;
  };

  // App chrome (top nav, facility/language switchers, notifications, user menu, left rail)
  // renders identically on EVERY screen — counting it gives every page the same inflated
  // numbers and the metric stops discriminating. Scope is the main landmark and NOTHING else:
  // membership by tag name is wrong twice over — cards use <header> for their own title row,
  // and the cockpit's mode strip is a <nav> that IS page content. The landmark already
  // excludes the shell, so an in-content <nav> or <header> stays counted.
  let scopeSelector = cfg.scopeSelector || null;
  let contentRoot = scopeSelector ? document.querySelector(scopeSelector) : null;
  const requestedScopeMissing = Boolean(scopeSelector && !contentRoot);
  if (!scopeSelector) {
    for (const candidate of ['main', '[role="main"]', '#main-content']) {
      const found = document.querySelector(candidate);
      if (found) {
        scopeSelector = candidate;
        contentRoot = found;
        break;
      }
    }
  }
  // No landmark: fall back to <body> and filter chrome by tag, and SAY SO in the output —
  // a reader must be able to tell that these numbers include the shell.
  const scopeFallback = contentRoot === null;
  const FALLBACK_CHROME = 'nav, header, [role="navigation"], [role="banner"], [role="menubar"], [role="menu"]';
  if (scopeFallback) {
    contentRoot = document.body;
    scopeSelector = 'body';
  }
  const isChrome = (elm) =>
    !contentRoot.contains(elm) || (scopeFallback && elm.closest(FALLBACK_CHROME) !== null);
  /** Structural label sources that repeat by design and are never "primary data". */
  // Every final vital submission is an explicitly timestamped clinical record.
  // Its measurements remain visible for safety, but the same labels appearing
  // in separate rounds are not duplicate primary data in the composition hierarchy.
  const LABEL_SKIP =
    'thead, th, [role="columnheader"], [role="tablist"], option, select, [data-timestamped-vital="true"], [data-composition-action-label]';

  const rootStyle = getComputedStyle(document.documentElement);
  const readToken = (name) => parseColor(rootStyle.getPropertyValue(name));
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ---- collect every visible node once (style + rect are the expensive part)
  const nodes = [];
  let truncated = false;
  for (const elm of document.body.querySelectorAll('*')) {
    if (nodes.length >= cfg.maxElements) {
      truncated = true;
      break;
    }
    const st = getComputedStyle(elm);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) <= 0.05) continue;
    const rect = elm.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    // Screen-reader-only labels are intentionally repeated for accessibility.
    // They are not visible primary data and must not inflate visual-composition scores.
    if (rect.width <= 1 && rect.height <= 1 &&
      (st.position === 'absolute' || st.position === 'fixed') &&
      (st.overflow === 'hidden' || st.clip !== 'auto' || st.clipPath !== 'none')) continue;
    nodes.push({ elm, st, rect });
  }

  // ---- 1. elevation contrast -------------------------------------------------
  const CARD_SELECTOR =
    '[class*="mantine-Paper"], [class*="mantine-Card"], [data-card], [class*="Card_"], [class*="card_"], [class*="Card-"], section, article';
  const viewportArea = vw * vh;
  const cardCandidates = nodes.filter(({ elm, st, rect }) => {
    if (isChrome(elm)) return false;
    // The requested measurement root is the surface being audited, not a card
    // inside itself (especially for full-screen mobile dialogs).
    if (elm === contentRoot) return false;
    if (/^(button|a|input|select|textarea|svg|path)$/i.test(elm.tagName)) return false;
    if (nearest(elm, 'button, [role="button"]', 1)) return false;
    if (rect.width < 120 || rect.height < 50) return false;
    if (rect.width * rect.height < cfg.minCardArea) return false;
    if (rect.width * rect.height > viewportArea * 4) return false;
    const radius = parseFloat(st.borderTopLeftRadius) || 0;
    const hasSkin =
      st.boxShadow !== 'none' ||
      (parseFloat(st.borderTopWidth) || 0) > 0 ||
      (parseColor(st.backgroundColor)?.a ?? 0) > 0.05;
    // Semantic <section> elements and legacy `*Card*` class names are often flat
    // form/layout groups. A name alone does not create an elevated deck; counting a
    // transparent, borderless group makes a deliberately flat form fail contrast.
    if (elm.matches(CARD_SELECTOR) && !hasSkin && radius < 6) return false;
    if (elm.matches(CARD_SELECTOR)) return true;
    return radius >= 6 && hasSkin;
  });
  // Two passes, because a page shell (<section>, a padded grid) matches every "looks like a
  // card" test while being the layout, not a deck. Pass 1 drops anything holding 2+ other
  // candidates — that is a container. Pass 2 keeps the outermost of what is left, so a card
  // with one nested sub-card counts once.
  const containers = cardCandidates.filter(
    (c) => cardCandidates.filter((other) => other !== c && c.elm.contains(other.elm)).length >= 2
  );
  const decks = cardCandidates.filter((c) => !containers.includes(c));
  const cards = decks.filter((c) => !decks.some((other) => other !== c && other.elm.contains(c.elm)));

  /** Effective background of `start`, walking up until something actually paints. */
  const effectiveBg = (start) => {
    let node = start;
    while (node && node.nodeType === 1) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.05) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const cardBgKeys = [];
  const pageBgKeys = [];
  const byKey = new Map();
  let cardsWithShadow = 0;
  for (const card of cards) {
    const own = effectiveBg(card.elm);
    const surface = effectiveBg(card.elm.parentElement);
    byKey.set(rgbKey(own), own);
    byKey.set(rgbKey(surface), surface);
    cardBgKeys.push(rgbKey(own));
    pageBgKeys.push(rgbKey(surface));
    if (shadowElevates(card.st.boxShadow)) cardsWithShadow += 1;
  }
  const bodyBg = effectiveBg(document.body);
  const cardBg = byKey.get(modeOf(cardBgKeys)) ?? bodyBg;
  const pageBg = byKey.get(modeOf(pageBgKeys)) ?? bodyBg;
  const elevationContrast = {
    pageBg: rgbStr(pageBg),
    cardBg: rgbStr(cardBg),
    contrastRatio: round2(contrastRatio(pageBg, cardBg)),
    cardsWithShadow,
    cardsTotal: cards.length,
  };

  // ---- 2. severity color usage ----------------------------------------------
  // A severity color that resolves byte-identical to a brand token cannot be attributed to
  // severity at all (this palette's info blue IS --emr-accent), so it is dropped rather
  // than reported as a collision on every screen in the product.
  const brandKeys = new Set();
  for (const tok of cfg.brandTokens) {
    const c = readToken(tok);
    if (c && c.a > 0) brandKeys.add(rgbKey(c));
  }
  const buckets = new Map();
  for (const tok of cfg.severityTokens) {
    const c = readToken(tok);
    if (!c || c.a === 0) continue;
    const k = rgbKey(c);
    if (brandKeys.has(k) || buckets.has(k)) continue;
    buckets.set(k, { color: rgbStr(c), occurrences: 0, contexts: new Set(), sampleSelectors: [] });
  }

  const classify = (node, channel) => {
    const { elm, rect } = node;
    const cls = `${elm.getAttribute('class') || ''} ${elm.getAttribute('data-testid') || ''}`;
    if (nearest(elm, 'button, [role="button"], [role="tab"], a[href]', 3)) return 'button';
    // The icon, text, and translucent tint of one status badge communicate one
    // meaning. Count that unit once instead of treating its child SVG paths as
    // unrelated uses of the same severity color.
    if (elm.closest('[data-composition-unit="severity-badge"]')) return 'badge-or-chip';
    if (elm.tagName.toLowerCase() === 'svg' || elm.closest('svg') || /\bicon\b|tabler-icon/i.test(cls)) return 'icon';
    if (rect.width <= 16 && rect.height <= 16) return 'bullet-or-dot';
    if (/badge|chip|pill|\btag\b/i.test(cls)) return 'badge-or-chip';
    if (channel === 'border') return 'border';
    if (channel === 'background') {
      const text = (elm.textContent || '').trim();
      if (rect.height <= 34 && rect.width <= 260 && text.length <= 24) return 'badge-or-chip';
      return rect.width * rect.height > 24000 ? 'surface' : 'badge-or-chip';
    }
    return 'text';
  };

  for (const node of nodes) {
    const { st } = node;
    if (isChrome(node.elm)) continue;
    const channels = [
      ['text', st.color],
      ['background', st.backgroundColor],
    ];
    // Gradient fills are background-IMAGE, not background-color, and the primary-action recipe
    // in DESIGN-DIRECTION is a gradient. Reading only backgroundColor makes the largest color
    // mass on the screen invisible — a red "Start Code Blue" button reports as transparent, so
    // the collision rule misses the single most dangerous offender it exists to catch.
    if (st.backgroundImage && st.backgroundImage !== 'none') {
      for (const stop of st.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) ?? []) {
        channels.push(['background', stop]);
      }
    }
    const borderSeen = new Set();
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if ((parseFloat(st[`border${side}Width`]) || 0) <= 0) continue;
      const val = st[`border${side}Color`];
      if (borderSeen.has(val)) continue;
      borderSeen.add(val);
      channels.push(['border', val]);
    }
    const counted = new Set();
    for (const [channel, raw] of channels) {
      const c = parseColor(raw);
      if (!c || c.a < cfg.severityMinAlpha) continue;
      const bucket = buckets.get(rgbKey(c));
      if (!bucket) continue;
      // One mark per element per channel — a two-stop gradient in the same red is one red thing.
      const mark = `${channel}|${rgbKey(c)}`;
      if (counted.has(mark)) continue;
      counted.add(mark);
      bucket.occurrences += 1;
      bucket.contexts.add(classify(node, channel));
      if (bucket.sampleSelectors.length < 6) bucket.sampleSelectors.push(selectorFor(node.elm));
    }
  }
  const severityColorUsage = [...buckets.values()]
    .filter((b) => b.occurrences > 0)
    .map((b) => ({
      color: b.color,
      occurrences: b.occurrences,
      distinctContexts: [...b.contexts].sort(),
      sampleSelectors: b.sampleSelectors,
    }))
    .sort((a, b) => b.distinctContexts.length - a.distinctContexts.length || b.occurrences - a.occurrences);

  // ---- 3. duplicate primary data --------------------------------------------
  const cardIndexOf = (elm) => cards.findIndex((c) => c.elm === elm || c.elm.contains(elm));
  const STOPWORDS = new Set(cfg.labelStopwords);
  const groups = new Map();
  for (const node of nodes) {
    const { elm, st, rect } = node;
    let own = '';
    for (const child of elm.childNodes) if (child.nodeType === 3) own += child.nodeValue;
    own = own.replace(/\s+/g, ' ').trim();
    if (own.length === 0 || own.length > 40) continue;
    if (/^[\d\s.,:%/+-]*$/.test(own)) continue;
    const label = own.replace(/[:*]+$/, '').trim();
    const norm = label.toLowerCase();
    if (norm.length === 0 || STOPWORDS.has(norm)) continue;
    if (isChrome(elm) || elm.closest(LABEL_SKIP)) continue;
    // Empty EMR date-picker format hints are input chrome, not clinical data.
    // Keep other clinical text inside picker buttons measurable.
    if (/^dd\.mm\.yyyy(?: hh:mm)?$/i.test(label) && elm.closest('button[aria-haspopup="dialog"]')) continue;
    const entry = {
      elm,
      label,
      selector: selectorFor(elm),
      // Some values are intentionally repeated across separately classified
      // clinical moments (for example, during-stay vs final diagnosis). An
      // explicit scope keeps those comparisons independent while duplicates
      // inside either moment remain measurable.
      duplicateScope:
        elm.closest('[data-composition-duplicate-scope]')?.getAttribute('data-composition-duplicate-scope') ?? '',
      fontSize: parseFloat(st.fontSize) || 0,
      fontWeight: parseInt(st.fontWeight, 10) || 400,
      area: rect.width * rect.height,
      cardIndex: cardIndexOf(elm),
    };
    if (!groups.has(norm)) groups.set(norm, []);
    groups.get(norm).push(entry);
  }

  const duplicateLabels = [];
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    // Two marks are a real duplication only when they sit in DIFFERENT decks — a label and
    // its own descendant, or two marks inside one deck, are one display.
    const pairs = [];
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        if (a.cardIndex < 0 || b.cardIndex < 0 || a.cardIndex === b.cardIndex) continue;
        if (a.duplicateScope && b.duplicateScope && a.duplicateScope !== b.duplicateScope) continue;
        if (a.elm.contains(b.elm) || b.elm.contains(a.elm)) continue;
        pairs.push([a, b]);
      }
    }
    if (pairs.length === 0) continue;
    const fullWeight = pairs.some(([a, b]) => {
      if (a.fontSize < cfg.fullWeightMinFontPx || b.fontSize < cfg.fullWeightMinFontPx) return false;
      const fontRatio = Math.min(a.fontSize, b.fontSize) / Math.max(a.fontSize, b.fontSize);
      if (fontRatio < cfg.comparableFontRatio[0]) return false;
      if (Math.abs(a.fontWeight - b.fontWeight) > cfg.comparableWeightDelta) return false;
      const areaRatio = a.area / (b.area || 1);
      return areaRatio >= cfg.comparableAreaRatio[0] && areaRatio <= cfg.comparableAreaRatio[1];
    });
    const involved = new Set();
    for (const [a, b] of pairs) {
      involved.add(a);
      involved.add(b);
    }
    duplicateLabels.push({
      label: entries[0].label,
      occurrences: involved.size,
      selectors: [...involved].slice(0, 6).map((e) => e.selector),
      bothFullWeight: fullWeight,
    });
  }
  duplicateLabels.sort((a, b) => Number(b.bothFullWeight) - Number(a.bothFullWeight) || b.occurrences - a.occurrences);

  // ---- 4. above-fold actions -------------------------------------------------
  // App chrome (main menu, submenu, banner) is present on every screen; counting it would
  // fail every page identically and say nothing about THIS screen's density.
  const INTERACTIVE =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="switch"], [role="checkbox"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  const TAB_SELECTOR = '[role="tab"], [class*="Tabs-tab"], [class*="mantine-Tabs-tab"]';
  // Form fields are separate questions and tabs are separate destinations, however uniform they look.
  const NEVER_A_LIST_ITEM = `${TAB_SELECTOR}, input, select, textarea, [contenteditable="true"]`;
  const itemTemplate = (elm) =>
    `${elm.tagName}|${elm.getAttribute('role') || ''}|${elm.classList.item(0) || ''}`;
  /** What a block offers: its own and inner action templates. Unlike blocks are not a list, however alike they look. */
  const actionShape = (block) =>
    [block, ...block.querySelectorAll(INTERACTIVE)]
      .filter((node) => node.matches(INTERACTIVE))
      .map(itemTemplate)
      .join(',');
  /** The list this action repeats inside, found from the nearest ancestor that has uniform twins. */
  const repeatedListOf = (elm) => {
    if (elm.matches(NEVER_A_LIST_ITEM)) return null;
    let item = elm;
    for (let depth = 0; depth < cfg.repeatedListMaxDepth && item && item !== contentRoot; depth += 1) {
      const parent = item.parentElement;
      if (!parent) return null;
      const template = itemTemplate(item);
      // A cell that is itself the action may carry a small extra (a bed's status icon) and is still the
      // same cell. A plain block is only known by what it offers, so unlike blocks never group.
      const shape = item.matches(INTERACTIVE) ? null : actionShape(item);
      const widths = [...parent.children]
        .filter((sibling) => itemTemplate(sibling) === template && (shape === null || actionShape(sibling) === shape))
        .map((sibling) => sibling.getBoundingClientRect().width)
        .filter((width) => width > 0);
      if (
        widths.length >= cfg.repeatedListMinItems &&
        Math.max(...widths) - Math.min(...widths) <= cfg.repeatedListWidthTolerancePx
      ) {
        return parent;
      }
      item = parent;
    }
    return null;
  };
  let tabs = 0;
  let buttons = 0;
  let count = 0;
  let rawCount = 0;
  const repeatedLists = new Set();
  for (const { elm, rect } of nodes) {
    if (!elm.matches(INTERACTIVE)) continue;
    if (isChrome(elm)) continue;
    if (rect.top >= vh || rect.bottom <= 0) continue;
    rawCount += 1;
    const list = repeatedListOf(elm);
    if (list) {
      if (repeatedLists.has(list)) continue;
      repeatedLists.add(list);
    }
    count += 1;
    if (elm.matches(TAB_SELECTOR)) tabs += 1;
    else if (elm.matches('button, [role="button"]')) buttons += 1;
  }
  const aboveFoldActions = { count, tabs, buttons, rawCount, repeatedLists: repeatedLists.size };

  // ---- 5. empty-state parity -------------------------------------------------
  const EMPTY_ANCHOR = '[class*="empty" i], [data-testid*="empty" i]';
  const emptyRe = new RegExp(cfg.emptyTextPattern, 'i');
  // An input waiting to be typed in is not an empty state: its own "empty" class marks the
  // caret placeholder, and an answer editor is meant to be large.
  const EDITABLE = '[contenteditable="true"], textarea, input';
  const isEditableAnchor = (anchor) => anchor.closest(EDITABLE) !== null || anchor.querySelector(EDITABLE) !== null;
  const visibleFormControls = nodes.filter(({ elm }) =>
    elm.matches('input:not([type="hidden"]), select, textarea, [contenteditable="true"]'));
  const isEmptyDeck = (card) => {
    if ([...card.elm.querySelectorAll(EMPTY_ANCHOR)].some((anchor) => !isEditableAnchor(anchor))) return true;
    // Negative field values do not make a functional form an empty state.
    if (visibleFormControls.some(({ elm }) => card.elm.contains(elm))) return false;
    // Without a marker class, only a deck with almost no content qualifies. A populated
    // summary deck routinely contains "None" for one of its fields and must not count.
    const text = (card.elm.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length === 0 || text.length > cfg.emptyDeckMaxTextChars) return false;
    for (const desc of card.elm.querySelectorAll('*')) {
      let own = '';
      for (const child of desc.childNodes) if (child.nodeType === 3) own += child.nodeValue;
      if (emptyRe.test(own.replace(/\s+/g, ' ').trim())) return true;
    }
    return false;
  };
  const emptyFlags = cards.map(isEmptyDeck);
  const populatedHeights = cards.filter((_, i) => !emptyFlags[i]).map((c) => c.rect.height);
  const emptyStates = [];
  cards.forEach((card, i) => {
    if (!emptyFlags[i]) return;
    const siblingHeights = cards
      .filter((other, j) => !emptyFlags[j] && other.elm.parentElement === card.elm.parentElement)
      .map((other) => other.rect.height);
    const baseline = median(siblingHeights.length > 0 ? siblingHeights : populatedHeights);
    if (baseline <= 0) return;
    emptyStates.push({
      selector: selectorFor(card.elm),
      heightPx: Math.round(card.rect.height),
      populatedSiblingMedianHeightPx: Math.round(baseline),
      ratio: round2(card.rect.height / baseline),
    });
  });

  let readOnlyReady;
  if (cfg.readOnlyRowSelector) {
    // Rows may be below the fold, but must actually render within this scope.
    const isRendered = (elm) => {
      if (elm.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
      const { width, height } = elm.getBoundingClientRect();
      if (width <= 1 || height <= 1) return false;
      for (let node = elm; node; node = node.parentElement) {
        const { display, visibility, opacity } = getComputedStyle(node);
        if (display === 'none' || visibility === 'hidden' || visibility === 'collapse' || Number(opacity) <= 0.05) return false;
      }
      return true;
    };
    const blocked = '[data-content-state="loading"], [data-content-state="empty"], [data-content-state="error"]';
    const scopeReady = !scopeFallback &&
      contentRoot.matches('[data-content-state="ready"]') &&
      isRendered(contentRoot) &&
      !contentRoot.closest(blocked) &&
      ![...contentRoot.querySelectorAll(blocked)].some(isRendered);
    const renderedRows = scopeReady
      ? [...contentRoot.querySelectorAll(cfg.readOnlyRowSelector)]
        .filter((elm) => isRendered(elm) && (elm.innerText || '').trim()).length
      : 0;
    readOnlyReady = {
      path: location.pathname.replace(/\/+$/, '') || '/',
      lang: document.documentElement.lang,
      scopeReady,
      renderedRows,
    };
  }

  return {
    colorScheme: document.documentElement.getAttribute('data-mantine-color-scheme') || 'light',
    viewport: { width: vw, height: vh },
    truncated,
    nodesScanned: nodes.length,
    // Convergence signals for the caller — the shell mounts long before the route's content, and
    // a half-drawn screen scores zero hard fails, so the caller re-probes until these hold still.
    // A screen mid-fetch can sit at a STABLE partial render for seconds, so stability alone is
    // not enough: the skeletons/spinners it is showing are the signal that it is not done.
    scopeSelector,
    scopeFallback,
    requestedScopeMissing,
    readOnlyReady,
    contentNodes: contentRoot.querySelectorAll('*').length,
    contentChars: (contentRoot.innerText || '').trim().length,
    busyIndicators: nodes.filter(({ elm }) =>
      elm.matches(
        cfg.persistentProgress
          ? '[aria-busy="true"], [class*="Loader"], [class*="loader"], [class*="Skeleton"], [class*="skeleton"]'
          : '[aria-busy="true"], [role="progressbar"], [class*="Loader"], [class*="loader"], [class*="Skeleton"], [class*="skeleton"]'
      )
    ).length,
    metrics: { elevationContrast, severityColorUsage, duplicateLabels, aboveFoldActions, emptyStates },
  };
}

// ------------------------------------------------------------------- playwright glue
function pw(context, args, timeoutMs = 90_000) {
  const res = spawnSync('npx', ['tsx', 'scripts/playwright/cmd.ts', '--context', context, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_COMMAND_TIMEOUT_MS: String(timeoutMs) },
  });
  if (res.status !== 0) {
    const detail = `${res.stderr || ''}${res.stdout || ''}`.trim().slice(0, 800) || `exit ${res.status}`;
    fail(`playwright "${args[0]}" failed — measurement aborted (no report written): ${detail}`);
  }
  return res.stdout;
}

function evaluate(context, script) {
  const raw = pw(context, ['evaluate', script]);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`could not parse evaluate output as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parsed.result;
}

// ------------------------------------------------------------------------ self-test
/** A page that violates all five rules — the frozen contract for hardFail derivation. */
const BAD_FIXTURE = {
  elevationContrast: {
    pageBg: 'rgb(255, 255, 255)',
    cardBg: 'rgb(255, 255, 255)',
    contrastRatio: 1,
    cardsWithShadow: 0,
    cardsTotal: 9,
  },
  severityColorUsage: [
    {
      color: 'rgb(229, 62, 62)',
      occurrences: 14,
      distinctContexts: ['badge-or-chip', 'bullet-or-dot', 'button', 'surface'],
      sampleSelectors: ['div.alert'],
    },
    { color: 'rgb(56, 161, 105)', occurrences: 3, distinctContexts: ['badge-or-chip', 'icon'], sampleSelectors: [] },
  ],
  duplicateLabels: [
    { label: 'NEWS2', occurrences: 2, selectors: ['div.a', 'div.b'], bothFullWeight: true },
    { label: 'Allergies', occurrences: 2, selectors: ['div.c', 'div.d'], bothFullWeight: false },
  ],
  aboveFoldActions: { count: 17, tabs: 11, buttons: 6 },
  emptyStates: [
    { selector: 'div.empty', heightPx: 210, populatedSiblingMedianHeightPx: 230, ratio: 0.91 },
    { selector: 'div.tidy', heightPx: 90, populatedSiblingMedianHeightPx: 230, ratio: 0.39 },
  ],
};

/** The same shapes, all inside their thresholds — must yield an empty hardFails array. */
const GOOD_FIXTURE = {
  elevationContrast: {
    pageBg: 'rgb(241, 245, 249)',
    cardBg: 'rgb(255, 255, 255)',
    contrastRatio: 1.13,
    cardsWithShadow: 9,
    cardsTotal: 9,
  },
  severityColorUsage: [
    { color: 'rgb(229, 62, 62)', occurrences: 6, distinctContexts: ['badge-or-chip', 'icon'], sampleSelectors: [] },
  ],
  duplicateLabels: [{ label: 'Allergies', occurrences: 2, selectors: ['div.c', 'div.d'], bothFullWeight: false }],
  aboveFoldActions: { count: 11, tabs: 6, buttons: 5 },
  emptyStates: [{ selector: 'div.empty', heightPx: 88, populatedSiblingMedianHeightPx: 230, ratio: 0.38 }],
};

/**
 * FROZEN BASELINE — the verbatim metrics block measured on the nursing-station patient-detail
 * page (light, 1440x900, deep-dive) on 2026-08-05, the page whose four known defects are the
 * reason this script exists. Its 7 hardFails may never be edited to accommodate a change: a
 * refactor that moves these numbers has broken detection, not improved it.
 *
 * This exists because a scoping change once silently took that page from 7 hardFails to 0 —
 * output that is byte-indistinguishable from a genuinely clean page.
 */
const NURSING_BASELINE_FIXTURE = {
  elevationContrast: {
    pageBg: 'rgb(255, 255, 255)',
    cardBg: 'rgb(255, 255, 255)',
    contrastRatio: 1,
    cardsWithShadow: 0,
    cardsTotal: 8,
  },
  severityColorUsage: [
    {
      color: 'rgb(56, 161, 105)',
      occurrences: 18,
      distinctContexts: ['badge-or-chip', 'icon', 'text'],
      sampleSelectors: ['svg.tabler-icon.tabler-icon-check'],
    },
    {
      color: 'rgb(229, 62, 62)',
      occurrences: 9,
      distinctContexts: ['badge-or-chip', 'bullet-or-dot', 'text'],
      sampleSelectors: ['div[data-testid="cockpit-shift-overdue"]'],
    },
  ],
  duplicateLabels: [
    { label: 'NEWS2', occurrences: 2, selectors: ['span._news2HeroLabel', 'span#cr-news2-label'], bothFullWeight: true },
    { label: 'Allergies', occurrences: 2, selectors: ['span._summaryLabel', 'span#cr-allergies-label'], bothFullWeight: false },
    { label: 'Active alerts', occurrences: 2, selectors: ['span._summaryLabel', 'span#cr-active-alerts-label'], bothFullWeight: false },
  ],
  aboveFoldActions: { count: 6, tabs: 0, buttons: 6 },
  emptyStates: [
    { selector: 'section#cockpit-mode-overview > div._grid > section._card', heightPx: 267, populatedSiblingMedianHeightPx: 308, ratio: 0.87 },
    { selector: 'section[data-testid="context-rail-medications"]', heightPx: 93, populatedSiblingMedianHeightPx: 102, ratio: 0.91 },
    { selector: 'aside[data-testid="context-rail"] > section._cardSuccess', heightPx: 93, populatedSiblingMedianHeightPx: 102, ratio: 0.91 },
  ],
};

function selfTest() {
  const failures = [];
  const check = (name, actual, expected) => {
    if (actual !== expected) failures.push(`self-test FAILED [${name}]: expected ${String(expected)}, got ${String(actual)}`);
  };

  const bad = deriveHardFails(BAD_FIXTURE, 'triage');
  const byRule = (rule) => bad.filter((f) => f.rule === rule);
  check('bad/total', bad.length, 5);
  check('bad/elevation-contrast', byRule('elevation-contrast').length, 1);
  check('bad/status-color-collision', byRule('status-color-collision').length, 1);
  check('bad/duplicate-primary-data', byRule('duplicate-primary-data').length, 1);
  check('bad/empty-state-parity', byRule('empty-state-parity').length, 1);
  check('bad/density-tier-overflow', byRule('density-tier-overflow').length, 1);
  check('bad/severity-is-P1', byRule('status-color-collision')[0]?.severity, 'P1');
  check('bad/measured-is-the-number', byRule('elevation-contrast')[0]?.measured, 1);
  // The green bucket (2 contexts), the subordinate duplicate and the collapsed empty deck
  // are all inside their thresholds — silence there is as load-bearing as the 5 fails.
  check('bad/no-extra-rules', new Set(bad.map((f) => f.rule)).size, 5);
  // deep-dive lifts ONLY the density cap; the other four still fire.
  check('bad/deep-dive-drops-density', deriveHardFails(BAD_FIXTURE, 'deep-dive').length, 4);
  check('bad/unknown-tier-drops-density', deriveHardFails(BAD_FIXTURE, 'unknown').length, 4);

  check('good/total', deriveHardFails(GOOD_FIXTURE, 'triage').length, 0);

  // Exercise the real DOM probe: only generic action labels are exempt. Clinical
  // labels in the same rows must still trigger duplicate-primary-data findings.
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const fixture = new JSDOM(`<!doctype html><style>
    * { display: block; visibility: visible; opacity: 1; font-size: 16px; font-weight: 600; }
    section { background: rgb(255, 255, 255); border: 1px solid rgb(200, 200, 200); }
  </style><main>
    <section data-card><span>NEWS2</span><button data-composition-action-label="true"><span>Open</span></button><button aria-haspopup="dialog"><p>dd.mm.yyyy HH:MM</p></button></section>
    <section data-card><span>NEWS2</span><button data-composition-action-label="true"><span>Open</span></button><button aria-haspopup="dialog"><p>dd.mm.yyyy HH:MM</p></button></section>
  </main>`, { runScripts: 'outside-only' });
  try {
    fixture.window.HTMLElement.prototype.getBoundingClientRect = function () {
      const width = Number(this.dataset.width) || (this.tagName === 'SECTION' ? 320 : 120);
      const height = this.tagName === 'SECTION' ? 120 : 24;
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() { return this; } };
    };
    const probeConfig = {
      scopeSelector: 'main', maxElements: PROBE_MAX_ELEMENTS, minCardArea: MIN_CARD_AREA,
      severityMinAlpha: SEVERITY_MIN_ALPHA, shadowMinBlurPx: SHADOW_MIN_BLUR_PX, shadowMinAlpha: SHADOW_MIN_ALPHA,
      fullWeightMinFontPx: FULL_WEIGHT_MIN_FONT_PX, comparableFontRatio: COMPARABLE_FONT_RATIO,
      comparableAreaRatio: COMPARABLE_AREA_RATIO, comparableWeightDelta: COMPARABLE_WEIGHT_DELTA,
      emptyTextPattern: EMPTY_TEXT_PATTERN, emptyDeckMaxTextChars: EMPTY_DECK_MAX_TEXT_CHARS,
      severityTokens: [], brandTokens: [], labelStopwords: [],
      repeatedListMinItems: REPEATED_LIST_MIN_ITEMS, repeatedListWidthTolerancePx: REPEATED_LIST_WIDTH_TOLERANCE_PX,
      repeatedListMaxDepth: REPEATED_LIST_MAX_DEPTH,
    };
    const runProbe = () => fixture.window.eval(`(${String(compositionProbe)})(${JSON.stringify(probeConfig)})`);
    const annotated = runProbe().metrics.duplicateLabels;
    check('actions/annotated-open-is-not-patient-data', annotated.some((label) => label.label === 'Open'), false);
    check('actions/real-clinical-label-still-measured', annotated.find((label) => label.label === 'NEWS2')?.occurrences, 2);
    check('actions/real-clinical-duplicate-still-fails', deriveHardFails({ ...GOOD_FIXTURE, duplicateLabels: annotated }, 'triage').filter((finding) => finding.rule === 'duplicate-primary-data').length, 1);
    check('dates/empty-format-hints-are-not-patient-data', annotated.some((label) => label.label === 'dd.mm.yyyy HH:MM'), false);
    for (const button of fixture.window.document.querySelectorAll('button[aria-haspopup="dialog"]')) button.removeAttribute('aria-haspopup');
    check('dates/format-text-outside-picker-positive-control', runProbe().metrics.duplicateLabels.find((label) => label.label === 'dd.mm.yyyy HH:MM')?.occurrences, 2);
    for (const button of fixture.window.document.querySelectorAll('button:not([data-composition-action-label])')) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.querySelector('p').textContent = 'Anesthesia started';
    }
    const clinicalPickerText = runProbe().metrics.duplicateLabels;
    check('dates/clinical-picker-text-positive-control', clinicalPickerText.find((label) => label.label === 'Anesthesia started')?.occurrences, 2);
    check('dates/clinical-picker-text-still-fails', deriveHardFails({ ...GOOD_FIXTURE, duplicateLabels: clinicalPickerText }, 'triage').filter((finding) => finding.rule === 'duplicate-primary-data').length, 2);
    for (const button of fixture.window.document.querySelectorAll('[data-composition-action-label]')) button.removeAttribute('data-composition-action-label');
    check('actions/unannotated-open-positive-control', runProbe().metrics.duplicateLabels.find((label) => label.label === 'Open')?.occurrences, 2);
    const extraDeck = fixture.window.document.createElement('section');
    extraDeck.innerHTML = '<div class="is-editor-empty" contenteditable="true"></div>';
    fixture.window.document.querySelector('main').appendChild(extraDeck);
    check('empty/editable-surface-is-not-an-empty-state', runProbe().metrics.emptyStates.length, 0);
    extraDeck.innerHTML = '<label>Fridge<input /></label><span>No allergies recorded</span>';
    check('empty/functional-form-negative-value-is-not-empty', runProbe().metrics.emptyStates.length, 0);
    extraDeck.innerHTML += '<div class="emptyState"></div>';
    check('empty/explicit-empty-state-with-control-still-counts', runProbe().metrics.emptyStates.length, 1);
    extraDeck.innerHTML = '<input type="hidden" /><span>No data</span>';
    check('empty/hidden-control-does-not-hide-empty-state', runProbe().metrics.emptyStates.length, 1);
    extraDeck.innerHTML = '<div class="emptyState"></div>';
    check('empty/real-empty-state-positive-control', runProbe().metrics.emptyStates.length, 1);

    // U-954: a list is one control, a toolbar is not. Rows carrying two actions each collapse to one.
    const main = fixture.window.document.querySelector('main');
    main.innerHTML = '';
    const actionCount = () => runProbe().metrics.aboveFoldActions;
    main.innerHTML = '<div>' + '<article class="row"><button>Open</button><button>More</button></article>'.repeat(5) + '</div>';
    check('list/five-rows-of-two-actions-count-once', actionCount().count, 1);
    check('list/raw-count-still-reports-every-action', actionCount().rawCount, 10);
    main.innerHTML = '<div>' + '<article class="row"><button>Open</button></article>'.repeat(50) + '</div>';
    check('list/more-rows-do-not-raise-the-count', actionCount().count, 1);
    main.innerHTML = '<div>' + [60, 90, 120, 150, 180].map((w) => `<button class="tool" data-width="${w}">T${w}</button>`).join('') + '</div>';
    check('list/toolbar-of-unequal-buttons-still-counts-each', actionCount().count, 5);
    main.innerHTML = '<div>' + '<article class="row"><button>Open</button></article>'.repeat(3) + '</div>';
    check('list/three-items-are-not-a-list', actionCount().count, 3);
    main.innerHTML = [['a', 'b'], ['c'], ['d', 'e', 'f'], ['g', 'h', 'i', 'j']].map((kinds) =>
      '<div class="block">' + kinds.map((k) => `<button class="${k}" data-width="${40 + k.charCodeAt(0)}">${k}</button>`).join('') + '</div>').join('');
    check('list/unlike-blocks-of-equal-width-are-not-a-list', actionCount().count, 10);
    main.innerHTML = '<div>' + '<div role="button" tabindex="0" class="bed">Bed</div>'.repeat(3) +
      '<div role="button" tabindex="0" class="bed">Bed<span role="img" tabindex="0" class="flag">!</span></div>'.repeat(3) + '</div>';
    check('list/bed-cells-with-a-status-icon-are-still-one-list', actionCount().count, 1);
    main.innerHTML = '<div class="block"><button class="only">Only</button></div>' + '<div class="block"></div>'.repeat(4);
    check('list/empty-twins-do-not-make-a-list', actionCount().repeatedLists, 0);
    main.innerHTML = '<div>' + '<input class="field" />'.repeat(5) + '</div>';
    check('list/form-fields-still-count-each', actionCount().count, 5);
    main.innerHTML = '<div role="tablist">' + '<button role="tab" class="t">Tab</button>'.repeat(5) + '</div>';
    check('list/tabs-still-count-each', actionCount().tabs, 5);

    Object.defineProperty(fixture.window.HTMLElement.prototype, 'innerText', {
      get() { return this.textContent; },
    });
    const path = '/emr/immunization/calendar';
    fixture.reconfigure({ url: `http://localhost${path}` });
    fixture.window.document.documentElement.lang = 'ka';
    main.setAttribute('data-content-state', 'ready');
    main.innerHTML = '<section data-card><p>' + 'Vaccine schedule details '.repeat(6) + '</p><ul>' +
      '<li data-dose>BCG at birth</li><li data-dose>MMR at one year</li></ul></section>';
    probeConfig.readOnlyRowSelector = 'li[data-dose]';
    const expectation = { minRows: 2, path, lang: 'ka' };
    const readOnlySane = () => isReadOnlyMeasurementSane(runProbe(), expectation);
    const canonicalScript = createCompositionProbeScript({ scopeSelector: 'main', readOnlyRowSelector: 'li[data-dose]' });
    const firstSample = fixture.window.eval(canonicalScript);
    const secondSample = fixture.window.eval(canonicalScript);
    const measurementSane = isCompositionStable(firstSample, secondSample, expectation);
    check('read-only/two-canonical-samples-are-stable', measurementSane, true);
    check('read-only/a-single-sample-is-not-stable', isCompositionStable(null, secondSample, expectation), false);
    const report = buildCompositionReport(secondSample, {
      route: path, slug: 'calendar', tier: 'deep-dive', lang: 'ka', measurementSane,
      readOnlyRowSelector: 'li[data-dose]', readOnlyMinRows: 2,
    });
    check('read-only/canonical-schema-version', report.schemaVersion, 1);
    check('read-only/canonical-report-keeps-row-evidence', report.readOnlyReady.renderedRows, 2);
    check('read-only/canonical-report-keeps-actual-actions', report.metrics.aboveFoldActions.rawCount, 0);
    check('read-only/rendered-data-passes-without-actions', readOnlySane(), true);
    check('read-only/actual-zero-actions-retained', actionCount().rawCount, 0);
    check('read-only/zero-actions-still-fail-without-opt-in', isMeasurementSane(runProbe()), false);
    check('read-only/insufficient-rows-rejected', isReadOnlyMeasurementSane(runProbe(), { ...expectation, minRows: 3 }), false);
    check('read-only/wrong-locale-rejected', isReadOnlyMeasurementSane(runProbe(), { ...expectation, lang: 'en' }), false);
    fixture.reconfigure({ url: 'http://localhost/signin' });
    check('read-only/login-path-rejected', readOnlySane(), false);
    fixture.reconfigure({ url: `http://localhost${path}` });
    for (const state of ['loading', 'empty', 'error']) {
      main.setAttribute('data-content-state', state);
      check(`read-only/${state}-rejected-with-stale-rows`, readOnlySane(), false);
    }
    main.setAttribute('data-content-state', 'ready');
    main.setAttribute('hidden', '');
    check('read-only/hidden-ready-scope-rejected', readOnlySane(), false);
    main.removeAttribute('hidden');
    const row = main.querySelector('li');
    row.setAttribute('hidden', '');
    check('read-only/hidden-row-does-not-count', readOnlySane(), false);
    row.removeAttribute('hidden');
    row.textContent = ' ';
    check('read-only/blank-row-does-not-count', readOnlySane(), false);
    row.textContent = 'BCG at birth';
    main.insertAdjacentHTML('beforeend', '<div data-content-state="error">Failed</div>');
    check('read-only/nested-error-rejected', readOnlySane(), false);
    main.lastElementChild.remove();
    main.insertAdjacentHTML('beforeend', '<button>Action</button>');
    check('read-only/interactive-scope-rejected', readOnlySane(), false);
  } finally { fixture.window.close(); }

  // Frozen regression contract — see NURSING_BASELINE_FIXTURE. If these move, detection broke.
  const baseline = deriveHardFails(NURSING_BASELINE_FIXTURE, 'deep-dive');
  const baselineByRule = (rule) => baseline.filter((f) => f.rule === rule).length;
  check('baseline/total', baseline.length, 7);
  check('baseline/elevation-contrast', baselineByRule('elevation-contrast'), 1);
  check('baseline/status-color-collision', baselineByRule('status-color-collision'), 2);
  check('baseline/duplicate-primary-data', baselineByRule('duplicate-primary-data'), 1);
  check('baseline/empty-state-parity', baselineByRule('empty-state-parity'), 3);
  // The two subordinate duplicates must stay silent — that is the bothFullWeight gate working.
  check('baseline/subordinate-duplicates-stay-silent', baselineByRule('duplicate-primary-data'), 1);
  // The emptiness guard: a collapsed scope must be REJECTED, not reported as a clean page.
  check('sane/baseline-passes', isMeasurementSane({ metrics: NURSING_BASELINE_FIXTURE, contentChars: 1121 }), true);
  const collapsed = {
    elevationContrast: { pageBg: '', cardBg: '', contrastRatio: 1, cardsWithShadow: 0, cardsTotal: 0 },
    severityColorUsage: [],
    duplicateLabels: [],
    aboveFoldActions: { count: 0, tabs: 0, buttons: 0 },
    emptyStates: [],
  };
  check('sane/collapsed-scope-rejected', isMeasurementSane({ metrics: collapsed, contentChars: 0 }), false);
  // The exact 21:53 shape that false-passed: right page, half the subtree, still has content.
  check(
    'sane/partial-scope-with-content-is-not-auto-rejected',
    isMeasurementSane({ metrics: { ...collapsed, elevationContrast: { ...collapsed.elevationContrast, cardsTotal: 4 }, aboveFoldActions: { count: 1, tabs: 0, buttons: 1 } }, contentChars: 440 }),
    true
  );

  if (failures.length > 0) {
    for (const f of failures) console.error(f);
    process.exit(1);
  }
  console.log(
    'self-test PASSED: known-bad fixture → 5 hardFails (one per rule, density only under --tier triage); ' +
      'known-good fixture → 0; frozen nursing-station baseline → 7 (1 elevation + 2 collisions + 1 duplicate + 3 empty); ' +
      'collapsed-scope probe → rejected as insane; action labels excluded while clinical duplicates remain; ' +
      'zero actions accepted only with verified read-only content'
  );
}

// ---------------------------------------------------------------------------- main
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    selfTest();
    return;
  }

  const argOf = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
  };
  const argsOf = (flag) =>
    args.flatMap((value, index) => (value === flag && args[index + 1] ? [args[index + 1]] : []));
  const route = argOf('--route', '');
  if (!route.startsWith('/')) fail('--route is required and must start with "/" (e.g. --route "/" or --route "/encounter/<id>/carotid")');

  const slug = argOf('--slug', route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'root');
  const tier = argOf('--tier', 'unknown');
  if (!['triage', 'deep-dive', 'unknown'].includes(tier)) fail(`--tier must be triage or deep-dive, got "${tier}"`);
  const scheme = argOf('--scheme', 'light');
  if (!['light', 'dark'].includes(scheme)) fail(`--scheme must be light or dark, got "${scheme}"`);
  // Locale is a density input, not a cosmetic one: Georgian labels run ~1.5-2x longer than their
  // English equivalents, so a screen that fits in en can overflow in ka. Measure the locale the
  // clinicians actually run, and keep it identical to the locale of the screenshots handed to
  // design-critic — mismatched pairs produce findings that are each true of a different rendering.
  const lang = argOf('--lang', 'en');
  if (!['en', 'ka', 'ru'].includes(lang)) fail(`--lang must be en, ka or ru, got "${lang}"`);
  const vpArg = argOf('--viewport', '1440x900');
  const vpMatch = /^(\d+)x(\d+)$/.exec(vpArg);
  if (!vpMatch) fail(`--viewport must look like 1440x900, got "${vpArg}"`);
  const width = Number(vpMatch[1]);
  const height = Number(vpMatch[2]);
  const scopeSelector = argOf('--scope-selector', '');
  const setupClicks = argsOf('--setup-click');
  const persistentProgress = args.includes('--persistent-progress');
  const allowFlatScope = args.includes('--allow-flat-scope');
  const readOnlyRowSelector = argOf('--read-only-row-selector', '');
  const readOnlyMinRowsArg = argOf('--read-only-min-rows', '');
  const readOnly = args.includes('--read-only-row-selector') || args.includes('--read-only-min-rows');
  const readOnlyMinRows = Number(readOnlyMinRowsArg);
  if (readOnly && (!scopeSelector.trim() || !readOnlyRowSelector.trim() ||
    !/^[1-9]\d*$/.test(readOnlyMinRowsArg) || !Number.isSafeInteger(readOnlyMinRows) || allowFlatScope)) {
    fail('read-only measurement requires --scope-selector, --read-only-row-selector and a positive --read-only-min-rows; it cannot use --allow-flat-scope');
  }

  const today = new Date().toISOString().slice(0, 10);
  const outArg = argOf('--out', `audit-findings/ui-audit/composition-metrics-${slug}-${today}.json`);
  const outPath = isAbsolute(outArg) ? outArg : resolve(REPO_ROOT, outArg);

  const baseUrl = process.env.COMPOSITION_BASE_URL || 'http://localhost:3001';
  const url = `${baseUrl}${route}`;
  const context = argOf('--context', `composition-${slug}`.slice(0, 60));
  const reuseContext = args.includes('--reuse-context');

  const server = spawnSync('npx', ['tsx', 'scripts/playwright/ensure-server.ts'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (server.status !== 0) fail(`ensure-server failed: ${(server.stderr || server.stdout || '').trim().slice(0, 400)}`);

  // A context wedged by a previously aborted run stays wedged (its page is closed but the name
  // is taken), so every later run would die on the first command. Reset it up front — closing a
  // context that does not exist is a no-op.
  if (!reuseContext) {
    pw(context, ['close-context', context]);

    pw(context, ['viewport', String(width), String(height)]);
    pw(context, ['navigate', url]);

    // The stored theme drives data-mantine-color-scheme and the language key drives the locale; set both,
    // then reload so the app rehydrates against them.
    // The locale key is `emr-language` (STORAGE_KEYS.LANGUAGE in src/constants/storage-keys.ts), read by
    // TranslationContext. It is NOT `i18nextLng` — writing that one is silently ignored, and the
    // run then reports on an English rendering while claiming the requested locale.
    evaluate(
      context,
      `(() => { localStorage.setItem('emr-theme', ${JSON.stringify(scheme)}); ` +
        `localStorage.setItem('emr-language', ${JSON.stringify(lang)}); return true; })()`
    );
    pw(context, ['navigate', url]);
  } else {
    // Reuse is for nested modal/drawer states that cannot be encoded in the route.
    // The caller owns navigation/theme setup; this command only normalizes viewport.
    pw(context, ['viewport', String(width), String(height)]);
  }

  // Authentication is decided by the URL, NOT by a password field: the signin screen opens on a
  // staff/patient chooser with no password input at all, so "no password field" reads as
  // "logged in" and the run happily measures the marketing page instead of the route.
  // Compare PATHNAMES only. A query string never changes which route matched, and this app
  // addresses sub-pages that way (the nursing cockpit's 10 modes are all `?mode=<key>` on one
  // route). Comparing the raw --route would make every such sub-page fail the guard, since
  // location.pathname carries no query. Stripping it keeps the guard's actual job — catching a
  // bounce to /signin or a redirect — while leaving query-addressed screens measurable.
  const normalize = (p) => p.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  const wantPath = normalize(route);
  const landedPath = () => {
    let seen = normalize(evaluate(context, CONTENT_PROBE).path);
    for (let attempt = 0; attempt < LOGIN_GATE_POLLS && seen !== wantPath; attempt += 1) {
      pw(context, ['wait', String(SETTLE_INTERVAL_MS)]);
      seen = normalize(evaluate(context, CONTENT_PROBE).path);
    }
    return seen;
  };

  // Angio has no auth: a page that lands elsewhere was redirected (e.g. a bare study route or an
  // unknown encounter id bounces to "/"). Never measure the fallback page.
  const landed = landedPath();
  if (landed !== wantPath) {
    fail(`ended on "${landed}" instead of "${wantPath}" — refusing to report composition for a page that is not the requested route`);
  }

  // Prove the locale took. Writing the key only proves we wrote it; TranslationContext mirrors the
  // active language onto <html lang>, so that attribute is the rendering's own account of itself.
  // Without this, a wrong/renamed storage key reports `"locale": "ka"` over English measurements —
  // confident, well-formed, and about a different screen than the one being judged.
  // Angio sets <html lang> only on a language switch, so an unset attribute falls back to the
  // dominant script of the rendered text (Georgian / Cyrillic / Latin) — still the rendering's own
  // account, never a read-back of the key we wrote.
  const renderedLang = evaluate(context, LANG_PROBE);
  if (renderedLang !== lang) {
    fail(
      `requested --lang ${lang} but the page rendered as "${renderedLang || '(unset)'}" — refusing ` +
        `to report locale-sensitive density for a rendering in another language`
    );
  }

  // Some production surfaces (drawers and modals) render in a portal outside <main>.
  // Optional setup clicks recreate that reachable state, while --scope-selector keeps
  // the measurement on the active surface instead of certifying the obscured page below.
  for (const selector of setupClicks) {
    pw(context, ['click', selector]);
    pw(context, ['wait', '750']);
  }

  const script = createCompositionProbeScript({
    scopeSelector,
    readOnlyRowSelector: readOnly ? readOnlyRowSelector : null,
    persistentProgress,
  });

  // Convergence, not a fixed wait: re-probe until two consecutive runs agree on the page's shape
  // AND the main landmark holds real content. A plateau in a loading skeleton looks "settled" to
  // any single readiness heuristic, and a half-drawn screen scores zero hard fails — the worst
  // possible false green. If it never converges, the run dies without writing a report.
  const readOnlyExpectation = readOnly ? { minRows: readOnlyMinRows, path: wantPath, lang } : undefined;

  let probe = null;
  let previous = null;
  for (let attempt = 0; attempt < PROBE_CONVERGE_POLLS; attempt += 1) {
    const now = evaluate(context, script);
    if (!now || typeof now !== 'object') fail('probe returned no data — cannot report on an unmeasured page');
    if (isCompositionStable(previous, now, readOnlyExpectation)) {
      probe = now;
      break;
    }
    previous = now;
    pw(context, ['wait', String(SETTLE_INTERVAL_MS)]);
  }
  if (!probe) {
    const last = previous ?? { contentNodes: 0, contentChars: 0, busyIndicators: -1 };
    fail(
      `${url} never converged on a stable render (last sample: ${last.contentNodes} content nodes / ` +
        `${last.contentChars} chars / ${last.busyIndicators} loading indicators` +
        (readOnly ? ` / ${last.readOnlyReady?.renderedRows ?? 0} of ${readOnlyMinRows} required rendered rows / ready scope: ${last.readOnlyReady?.scopeReady ?? false}` : '') +
        ') — refusing to emit a ' +
        `zero-hardFail report for a page that did not finish drawing`
    );
  }
  if (probe.requestedScopeMissing) {
    fail(`requested scope "${scopeSelector}" was not found after setup — refusing to measure the fallback page`);
  }
  // Sanity floor. An empty result set and a clean result set are byte-identical in JSON, so a
  // scope that resolves to the wrong subtree would silently certify a broken page as passing.
  // Emptiness is therefore a MEASUREMENT FAILURE, never a verdict: no report, non-zero exit.
  const measurementSane = readOnly ? isReadOnlyMeasurementSane(probe, readOnlyExpectation) :
    isMeasurementSane(probe) ||
    (allowFlatScope &&
      probe.metrics.elevationContrast.cardsTotal === 0 &&
      probe.metrics.aboveFoldActions.count >= 1 &&
      probe.contentChars >= CONTENT_SETTLE_MIN_CHARS);
  if (!measurementSane) {
    fail(
      `measurement failed sanity check at ${url} — scope "${probe.scopeSelector}" yielded ` +
        `${probe.metrics.elevationContrast.cardsTotal} deck(s), ${probe.metrics.aboveFoldActions.count} ` +
        `interactive element(s), ${probe.contentChars} chars. An empty measurement is NOT a passing ` +
        `page; refusing to emit hardFails: [] for a subtree that was never measured`
    );
  }

  // RESIDUAL RISK — read before trusting a clean report.
  // The guard above only catches TOTAL extraction failure. A *partial* scope
  // collapse (right container, wrong subtree) still emits `hardFails: []`, which is
  // byte-identical to a genuinely clean page. This is not hypothetical: a scoping
  // change once took the nursing-station patient-detail page from 7 hardFails to 0
  // with 4 cards instead of 8, and nothing here flagged it.
  // No threshold fixes this without false-alarming on legitimately simple pages, so
  // the defense is the run-over-run delta: `cardsTotal`, `severityColorUsage.length`
  // and `aboveFoldActions.count` are all in the output precisely so a reader can
  // compare against the previous run. /ui-excellence Phase 0 does this against the
  // composition-debt ledger. If you consume this JSON some other way, compare the
  // `metrics` block too — never conclude "improved" from `hardFails` alone.

  const report = buildCompositionReport(probe, {
    route, slug, tier, lang, measurementSane,
    readOnlyRowSelector: readOnly ? readOnlyRowSelector : null,
    readOnlyMinRows,
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!reuseContext) {
    pw(context, ['close-context', context]);
  }

  const ruleList = report.hardFails.map((f) => f.rule).join(', ') || 'none';
  console.log(
    `composition-metrics: ${route} (${tier}, ${report.colorScheme}, ${probe.viewport.width}x${probe.viewport.height}) — ` +
      `${report.hardFails.length} hard fail(s): ${ruleList}. ` +
      `${probe.contentNodes} content nodes / ${probe.contentChars} chars, ` +
      `${probe.metrics.elevationContrast.cardsTotal} decks, ${probe.metrics.aboveFoldActions.count} above-fold actions, ` +
      `${probe.metrics.severityColorUsage.length} severity bucket(s), ${probe.metrics.duplicateLabels.length} duplicate label(s), ` +
      `${probe.metrics.emptyStates.length} empty deck(s)` +
      `${probe.truncated ? ' [TRUNCATED at ' + PROBE_MAX_ELEMENTS + ' elements]' : ''} → ${outPath}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
